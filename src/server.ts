import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { z } from "zod";
import dotenv from "dotenv";

import { GeminiAdapter } from "./llm/gemini.js";
import { MockAdapter } from "./llm/mock.js";
import { SessionManager } from "./core/session.js";
import { AgentEngine } from "./core/agent.js";
import { ResourceGuard } from "./core/guard.js";
import { FixtureService } from "./services/fixture-service.js";
import { SupportService } from "./services/support-service.js";

dotenv.config();

export function createServer(options?: {
  agentEngine?: AgentEngine;
  sessionManager?: SessionManager;
  resourceGuard?: ResourceGuard;
  baseDir?: string;
  useMock?: boolean;
}) {
  const app = new Hono();
  const baseDir = path.resolve(options?.baseDir || process.cwd());
  const guard = options?.resourceGuard || new ResourceGuard();

  // Configuración del adaptador LLM
  const sessionManager = options?.sessionManager || options?.agentEngine?.getSessionManager() || new SessionManager();
  let adapter = options?.agentEngine?.getAdapter();

  if (!adapter) {
    if (options?.useMock || process.env.USE_MOCK === "true" || !process.env.GEMINI_API_KEY) {
      adapter = new MockAdapter();
    } else {
      adapter = new GeminiAdapter();
    }
  }

  const agentEngine = options?.agentEngine || new AgentEngine(adapter, sessionManager, {
    baseDir,
    maxIterations: Number(process.env.MAX_AGENT_ITERATIONS || 10)
  });

  // Clave de firma interna del servidor para emisión de tokens de visitante seguros
  const SERVER_SIGNING_KEY = process.env.SESSION_SECRET || "perxia_signing_secret_key_2026";

  const signVisitorId = (vid: string): string => {
    const hmac = crypto.createHmac("sha256", SERVER_SIGNING_KEY).update(vid).digest("hex").slice(0, 16);
    return `${vid}.${hmac}`;
  };

  const verifyVisitorId = (tokenOrId?: string): string | null => {
    if (!tokenOrId || typeof tokenOrId !== "string" || !tokenOrId.includes(".")) return null;
    const [vid, sig] = tokenOrId.split(".", 2);
    const expected = crypto.createHmac("sha256", SERVER_SIGNING_KEY).update(vid).digest("hex").slice(0, 16);
    if (sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return vid;
    }
    return null;
  };

  // Helper para extraer clientIp compatible con proxy reverso de Render (1 hop)
  // SUPUESTOS DE SEGURIDAD DOCUMENTADOS:
  // 1. Render opera como proxy reverso confiable de 1 salto frente al contenedor Node.js.
  // 2. Render añade la IP pública real del cliente al FINAL de la cabecera X-Forwarded-For.
  // 3. Los valores iniciales en X-Forwarded-For pueden ser inyectados/manipulados arbitrariamente por el cliente.
  // 4. Por ende, la IP real confiable agregada por Render es la ÚLTIMA entrada válida de X-Forwarded-For.
  const IP_REGEX = /^(?:(?:\d{1,3}\.){3}\d{1,3}|[a-fA-F0-9:]+)$/;

  const extractClientIp = (c: { req: { header: (k: string) => string | undefined } }): string => {
    // 1. Cabecera Cloudflare / CDN previa
    const cf = c.req.header("cf-connecting-ip");
    if (cf && IP_REGEX.test(cf.trim())) return cf.trim();

    // 2. Proxy reverso de Render (1 salto confiable): tomar la última IP agregada por el proxy
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((p) => p.trim()).filter((p) => IP_REGEX.test(p));
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
    }

    // 3. Fallback a x-real-ip
    const realIp = c.req.header("x-real-ip");
    if (realIp && IP_REGEX.test(realIp.trim())) return realIp.trim();

    return "127.0.0.1";
  };

  // Helper para extraer visitorId unívoco
  const extractVisitorId = (c: { req: { header: (k: string) => string | undefined; query: (k: string) => string | undefined } }) => {
    return c.req.header("x-visitor-id") || c.req.query("visitorId") || undefined;
  };

  // Helper para extraer credencial opaca de sesión emitida por el servidor (NUNCA de URL query parameters)
  // REGLA ARQUITECTURAL: Prioridad absoluta a x-session-token. Un Bearer de demo NUNCA se interpreta como token de sesión.
  const extractSessionToken = (c: { req: { header: (k: string) => string | undefined } }) => {
    // 1. Prioridad absoluta: cabecera x-session-token para identificar la sesión propietaria
    const sessionTokenHeader = c.req.header("x-session-token");
    if (sessionTokenHeader) {
      return sessionTokenHeader.trim();
    }
    // 2. Fallback a Authorization: Bearer <token> SOLO si NO es la clave de demostración (DEMO_ACCESS_KEY)
    const authHeader = c.req.header("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const candidate = authHeader.slice(7).trim();
      // Si coincide con la clave de demostración, NUNCA interpretarlo como token de sesión propietario
      if (guard.isKeyRequired() && guard.validateAccessKey(candidate)) {
        return undefined;
      }
      return candidate;
    }
    return undefined;
  };

  // Helper para extraer clave de acceso de evaluación (NUNCA de URL query parameters)
  const extractDemoKey = (c: { req: { header: (k: string) => string | undefined } }) => {
    // 1. Cabecera específica x-demo-key (utilizada exclusivamente por el frontend)
    const demoHeader = c.req.header("x-demo-key");
    if (demoHeader) {
      return demoHeader.trim();
    }
    // 2. Cabecera Authorization: Bearer <key> para clientes externos o herramientas CLI
    const authHeader = c.req.header("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.slice(7).trim();
    }
    return undefined;
  };

  // Middleware de CORS
  app.use("*", cors());

  // Middleware de protección por clave de evaluación (Demo privada)
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/health") {
      return next(); // Healthcheck siempre público para Render y monitor
    }
    // Denegar explícitamente si se envía la clave en URL query parameter (?key= o ?demoKey=)
    if (c.req.query("key") || c.req.query("demoKey")) {
      return c.json({ ok: false, error: "Clave de acceso de evaluación requerida o inválida (DEMO_ACCESS_KEY). No se admiten claves en la URL" }, 401);
    }
    if (guard.isKeyRequired()) {
      const key = extractDemoKey(c);
      if (!guard.validateAccessKey(key)) {
        return c.json({ ok: false, error: "Clave de acceso de evaluación requerida o inválida (DEMO_ACCESS_KEY)" }, 401);
      }
    }
    return next();
  });

  // 1. GET /api/health - Salud y configuración pública segura
  app.get("/api/health", async (c) => {
    const isModelAvailable = await agentEngine.getAdapter().isAvailable();
    return c.json({
      ok: true,
      provider: agentEngine.getAdapter() instanceof MockAdapter ? "mock" : "gemini",
      model: agentEngine.getAdapter().getModelName(),
      modelAvailable: isModelAvailable,
      status: "healthy",
      keyRequired: guard.isKeyRequired(),
      globalUsage: guard.getGlobalUsage(),
      timestamp: new Date().toISOString()
    });
  });

  // 2. POST /api/chat - Crear o continuar conversación con aislamiento por visitante y control de cuota
  const ChatRequestSchema = z.object({
    sessionId: z.string().optional(),
    message: z.string().min(1, "El mensaje no puede estar vacío"),
    referenceDate: z.string().optional(),
    visitorId: z.string().optional()
  });

  app.post("/api/chat", async (c) => {
    try {
      const body = await c.req.json();
      const parsed = ChatRequestSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ ok: false, error: parsed.error.issues[0]?.message || "Payload inválido" }, 400);
      }

      const { sessionId, message, referenceDate: refDateStr } = parsed.data;
      const clientIp = extractClientIp(c);
      const visitorId = parsed.data.visitorId || extractVisitorId(c) || `vis_${clientIp.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const sessionToken = extractSessionToken(c);

      // 1. Control de Frecuencia de Solicitudes (Rate Limiting por visitante y por IP para evitar elusión)
      const rateCheck = guard.checkRateLimit(visitorId, clientIp);
      if (!rateCheck.allowed) {
        return c.json({ ok: false, error: rateCheck.message }, 429);
      }

      // 2. Control de Presupuesto Global de Tokens
      const budgetCheck = guard.checkGlobalTokenBudget();
      if (!budgetCheck.allowed) {
        return c.json({
          ok: false,
          error: "Presupuesto global de tokens de la demostración alcanzado. El sistema requiere renovación de cuota."
        }, 429);
      }

      // 3. Restricción de seguridad: referenceDate solo se acepta en entornos no productivos o con flag explícito
      const allowRefDate = process.env.NODE_ENV !== "production" || process.env.ALLOW_REFERENCE_DATE === "true";
      const refDate = (allowRefDate && refDateStr) ? new Date(refDateStr) : undefined;

      // 4. Control de pertenencia y presupuesto de tokens por sesión
      if (sessionId) {
        const existingSession = agentEngine.getSessionManager().get(sessionId, visitorId, sessionToken);
        if (!existingSession) {
          // Comprobar si la sesión existe para otro visitante o con token incorrecto
          const otherSession = agentEngine.getSessionManager().get(sessionId);
          if (otherSession) {
            return c.json({ ok: false, error: "Acceso denegado: la sesión pertenece a otro visitante o credencial inválida" }, 403);
          }
        }
        const maxTokens = Number(process.env.MAX_SESSION_TOKENS || 50000);
        if (existingSession && existingSession.totalTokens.totalTokens >= maxTokens) {
          return c.json({
            ok: false,
            error: `Límite de tokens de la sesión excedido (${existingSession.totalTokens.totalTokens}/${maxTokens}). Por favor inicie una nueva sesión para continuar.`
          }, 429);
        }
      }

      // 5. Control de concurrencia al invocar Gemini
      const isGemini = !(agentEngine.getAdapter() instanceof MockAdapter);
      let concurrencySlot: { release: () => void } | null = null;

      if (isGemini) {
        concurrencySlot = await guard.acquireGeminiSlot(5000);
        if (!concurrencySlot) {
          return c.json({
            ok: false,
            error: "Servidor ocupado: límite de llamadas concurrentes al modelo de IA alcanzado. Por favor intente en unos segundos."
          }, 503);
        }
      }

      let result;
      try {
        result = await agentEngine.processMessage(sessionId, message, {
          referenceDate: refDate,
          visitorId
        });
        guard.recordTokenUsage(result.usage);
      } finally {
        if (concurrencySlot) {
          concurrencySlot.release();
        }
      }

      const signedVid = signVisitorId(visitorId);
      c.header("x-visitor-id", visitorId);
      c.header("x-visitor-token", signedVid);
      if (result.sessionToken) {
        c.header("x-session-token", result.sessionToken);
      }
      return c.json({
        ok: true,
        data: {
          ...result,
          visitorId,
          visitorToken: signedVid
        }
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("Acceso denegado")) {
        return c.json({ ok: false, error: errorMsg }, 403);
      }
      return c.json({ ok: false, error: errorMsg }, 500);
    }
  });

  // 3. GET /api/sessions - Listar sesiones del visitante verificado (CERO fuga de sessionToken)
  app.get("/api/sessions", (c) => {
    const rawVisitorToken = c.req.header("x-visitor-token");
    const rawVisitorId = extractVisitorId(c);

    let targetVisitorId: string | undefined = undefined;
    if (rawVisitorToken) {
      targetVisitorId = verifyVisitorId(rawVisitorToken) || undefined;
    } else if (rawVisitorId) {
      targetVisitorId = rawVisitorId;
    }

    const sessions = agentEngine.getSessionManager().list(targetVisitorId).map((s) => ({
      id: s.id,
      // SEGURIDAD: sessionToken NUNCA se expone en el listado de sesiones
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messagesCount: s.messages.length,
      toolCallsCount: s.toolCallsHistory.length,
      hasPendingConfirmation: s.pendingConfirmation?.status === "pending",
      usage: s.totalTokens
    }));
    return c.json({ ok: true, data: sessions });
  });

  // 4. GET /api/sessions/:id - Historial completo de sesión (REQUIERE posesión estricta de sessionToken)
  app.get("/api/sessions/:id", (c) => {
    const id = c.req.param("id");
    const sessionToken = extractSessionToken(c);
    const visitorId = extractVisitorId(c);

    // SEGURIDAD: Denegar explícitamente tokens en la URL (query parameters)
    if (c.req.query("token") || c.req.query("sessionToken")) {
      return c.json({ ok: false, error: "Acceso denegado: se requiere credencial de sesión en cabecera HTTP (x-session-token). No se admiten tokens en la URL" }, 401);
    }

    // 1. REGLA ESTRICTA DE SEGURIDAD: Se exige token de posesión en cabecera HTTP
    if (!sessionToken) {
      return c.json({ ok: false, error: "Acceso denegado: se requiere credencial de sesión (token de propietario en cabecera x-session-token)" }, 401);
    }

    const session = agentEngine.getSessionManager().get(id);
    if (!session) {
      return c.json({ ok: false, error: `Sesión no encontrada: ${id}` }, 404);
    }

    // 2. Comprobar validez del token de posesión
    if (!session.validateToken(sessionToken)) {
      return c.json({ ok: false, error: "Acceso denegado: credencial de sesión inválida" }, 403);
    }

    // 3. Comprobar visitorId si coincide
    if (visitorId && session.visitorId && session.visitorId !== visitorId) {
      return c.json({ ok: false, error: "Acceso denegado: la sesión pertenece a otro visitante" }, 403);
    }

    return c.json({
      ok: true,
      data: {
        id: session.id,
        // SEGURIDAD: CERO fuga de sessionToken en historial
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: session.messages,
        toolCalls: session.toolCallsHistory,
        pendingConfirmation: session.pendingConfirmation,
        usage: session.totalTokens
      }
    });
  });

  // 5. GET /api/sessions/:id/tools - Consultar llamadas a herramientas (aislado por visitante)
  app.get("/api/sessions/:id/tools", (c) => {
    const id = c.req.param("id");
    const visitorId = extractVisitorId(c);
    const session = agentEngine.getSessionManager().get(id, visitorId);
    if (!session) {
      const other = agentEngine.getSessionManager().get(id);
      if (other) {
        return c.json({ ok: false, error: "Acceso denegado: la sesión pertenece a otro visitante" }, 403);
      }
      return c.json({ ok: false, error: `Sesión no encontrada: ${id}` }, 404);
    }

    return c.json({ ok: true, data: session.toolCallsHistory });
  });

  // 6. GET /api/sessions/:id/confirmation - Estado de confirmación pendiente (aislado por visitante)
  app.get("/api/sessions/:id/confirmation", (c) => {
    const id = c.req.param("id");
    const visitorId = extractVisitorId(c);
    const session = agentEngine.getSessionManager().get(id, visitorId);
    if (!session) {
      const other = agentEngine.getSessionManager().get(id);
      if (other) {
        return c.json({ ok: false, error: "Acceso denegado: la sesión pertenece a otro visitante" }, 403);
      }
      return c.json({ ok: false, error: `Sesión no encontrada: ${id}` }, 404);
    }

    return c.json({
      ok: true,
      data: {
        hasPending: session.pendingConfirmation?.status === "pending",
        confirmation: session.pendingConfirmation
      }
    });
  });

  // 7. POST /api/sessions/:id/confirm - Confirmar operación pendiente explícitamente (aislado por visitante)
  const ConfirmSchema = z.object({
    token: z.string().optional(),
    caso: z.string().optional()
  });

  app.post("/api/sessions/:id/confirm", async (c) => {
    const id = c.req.param("id");
    const visitorId = extractVisitorId(c);
    const session = agentEngine.getSessionManager().get(id, visitorId);
    if (!session) {
      const other = agentEngine.getSessionManager().get(id);
      if (other) {
        return c.json({ ok: false, error: "Acceso denegado: la sesión pertenece a otro visitante" }, 403);
      }
      return c.json({ ok: false, error: `Sesión no encontrada: ${id}` }, 404);
    }

    let token: string | undefined;
    let caso: string | undefined;

    try {
      const body = await c.req.json();
      const parsed = ConfirmSchema.safeParse(body);
      if (parsed.success) {
        token = parsed.data.token;
        caso = parsed.data.caso;
      }
    } catch {
      // Body vacío permitido si solo hay una confirmación pendiente
    }

    const targetCaso = caso || session.pendingConfirmation?.caso;
    if (targetCaso) {
      const sessionChecklistPath = path.resolve(baseDir, "out", "sessions", id, targetCaso, "paquete", "checklist.md");
      const globalChecklistPath = path.resolve(baseDir, "out", targetCaso, "paquete", "checklist.md");
      let checklistPath = fs.existsSync(sessionChecklistPath) ? sessionChecklistPath : globalChecklistPath;

      if (!fs.existsSync(checklistPath)) {
        const sessionsBase = path.resolve(baseDir, "out", "sessions");
        if (fs.existsSync(sessionsBase)) {
          try {
            const sFolders = fs.readdirSync(sessionsBase);
            for (const sf of sFolders.reverse()) {
              const candidate = path.resolve(sessionsBase, sf, targetCaso, "paquete", "checklist.md");
              if (fs.existsSync(candidate)) {
                checklistPath = candidate;
                break;
              }
            }
          } catch {
            // Ignorar error de lectura
          }
        }
      }

      let isBlocked = false;
      if (fs.existsSync(checklistPath)) {
        const content = fs.readFileSync(checklistPath, "utf-8");
        if (content.includes("¿Listo para firma?: NO") || content.includes("BLOQUEADO")) {
          isBlocked = true;
        }
      } else {
        // Si no hay paquete armado en disco, evaluar directamente los soportes del caso
        try {
          const fixtureService = new FixtureService(baseDir);
          const supportService = new SupportService(fixtureService);
          const soportesExigidos = fixtureService.getSoportesExigidos(targetCaso);
          const evaluacion = supportService.evaluarSoportes(soportesExigidos, new Date());
          if (!evaluacion.listoParaFirma) {
            isBlocked = true;
          }
        } catch {
          // Caso de prueba sin fixtures asociados
        }
      }

      if (isBlocked) {
        return c.json({
          ok: false,
          error: `No se puede autorizar el envío: el paquete del caso '${targetCaso}' tiene la firma bloqueada debido a soportes vencidos o ausentes.`
        }, 400);
      }
    }

    const success = session.confirmPending(token, caso);
    if (!success) {
      return c.json({
        ok: false,
        error: "No existe una confirmación pendiente válida para ratificar o el token ha expirado"
      }, 400);
    }

    return c.json({
      ok: true,
      message: "Operación confirmada explícitamente por el analista",
      confirmation: session.pendingConfirmation
    });
  });

  // 8. POST /api/sessions/:id/reject - Rechazar operación pendiente (aislado por visitante)
  app.post("/api/sessions/:id/reject", (c) => {
    const id = c.req.param("id");
    const visitorId = extractVisitorId(c);
    const session = agentEngine.getSessionManager().get(id, visitorId);
    if (!session) {
      const other = agentEngine.getSessionManager().get(id);
      if (other) {
        return c.json({ ok: false, error: "Acceso denegado: la sesión pertenece a otro visitante" }, 403);
      }
      return c.json({ ok: false, error: `Sesión no encontrada: ${id}` }, 404);
    }

    session.rejectPending();
    return c.json({
      ok: true,
      message: "Operación pendiente cancelada por el usuario"
    });
  });

  // 9. GET /api/artifacts/:caso/:file - Descarga segura de artefactos con credencial de sesión obligatoria
  app.get("/api/artifacts/:caso/:file", (c) => {
    const rawCaso = c.req.param("caso");
    const rawFile = c.req.param("file");
    const sessionId = c.req.query("sessionId") || c.req.header("x-session-id");
    const token = extractSessionToken(c);
    const visitorId = extractVisitorId(c);

    // Sanitización estricta de parámetros
    if (!/^[a-zA-Z0-9_-]+$/.test(rawCaso)) {
      return c.json({ ok: false, error: "Parámetro caso inválido" }, 400);
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(rawFile)) {
      return c.json({ ok: false, error: "Nombre de archivo inválido" }, 400);
    }

    // 1. Toda descarga web EXIGE un sessionId válido (prohibido sin sesión)
    if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return c.json({ ok: false, error: "Se requiere un identificador de sesión válido para descargar artefactos" }, 400);
    }

    // 2. SEGURIDAD: Denegar explícitamente si se intenta enviar el token en la URL (?token=)
    if (c.req.query("token") || c.req.query("sessionToken")) {
      return c.json({ ok: false, error: "Acceso denegado: se requiere credencial de sesión en cabecera HTTP (x-session-token). No se admiten tokens en la URL" }, 401);
    }

    // 3. Toda descarga web EXIGE credencial opaca de sesión emitida por el servidor (transmitida únicamente en cabecera HTTP)
    if (!token) {
      return c.json({ ok: false, error: "Acceso denegado: se requiere credencial de sesión en cabecera HTTP (x-session-token)" }, 401);
    }

    // 3. Obtener sesión
    const session = agentEngine.getSessionManager().get(sessionId);
    if (!session) {
      return c.json({ ok: false, error: "Sesión no encontrada" }, 404);
    }

    // 4. Validar credencial del propietario (token opaco de sesión)
    if (!session.validateToken(token)) {
      return c.json({ ok: false, error: "Acceso denegado: credencial de propietario inválida" }, 403);
    }

    // 5. Validar pertenencia del visitorId (defensa en profundidad)
    if (visitorId && session.visitorId && session.visitorId !== visitorId) {
      return c.json({ ok: false, error: "Acceso denegado: este artefacto pertenece a otra sesión" }, 403);
    }

    // 6. Localización física: ÚNICAMENTE dentro del directorio aislado de la sesión
    const outDir = path.resolve(baseDir, "out");
    const sessionCaseDir = path.resolve(outDir, "sessions", sessionId, rawCaso);
    const candidateDirs = [
      sessionCaseDir,
      path.resolve(sessionCaseDir, "paquete")
    ];

    let filePath: string | null = null;
    for (const dir of candidateDirs) {
      const candidate = path.resolve(dir, rawFile);
      if (candidate.startsWith(sessionCaseDir) && fs.existsSync(candidate)) {
        filePath = candidate;
        break;
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return c.json({ ok: false, error: "Artefacto no encontrado en la sesión especificada" }, 404);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".pdf": "application/pdf",
      ".md": "text/markdown; charset=utf-8",
      ".jsonl": "application/x-jsonlines; charset=utf-8",
      ".txt": "text/plain; charset=utf-8"
    };

    const contentType = contentTypes[ext] || "application/octet-stream";
    const fileBuffer = fs.readFileSync(filePath);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${rawFile}"`
      }
    });
  });

  // 10. Servir frontend compilado (SPA) si existe web/dist
  const webDistPath = path.resolve(baseDir, "web", "dist");
  if (fs.existsSync(webDistPath)) {
    app.use("/*", serveStatic({ root: "./web/dist" }));
    app.get("*", (c) => {
      // Excluir rutas de API y descargas de artefactos del fallback
      if (c.req.path.startsWith("/api/")) {
        return c.json({ ok: false, error: "Recurso no encontrado" }, 404);
      }
      const indexPath = path.resolve(webDistPath, "index.html");
      if (fs.existsSync(indexPath)) {
        return c.html(fs.readFileSync(indexPath, "utf-8"));
      }
      return c.text("Frontend no encontrado", 404);
    });
  }

  return { app, agentEngine, sessionManager };
}

// Punto de entrada si se ejecuta directamente con node o bun
const isDirectRun =
  process.env.NODE_ENV !== "test" &&
  !process.argv.some((arg) => arg.includes(".test.")) &&
  (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js") || process.env.RUN_SERVER === "true");

if (isDirectRun) {
  const port = Number(process.env.PORT || 3000);
  const hostname = process.env.HOST || "0.0.0.0";
  const { app } = createServer();
  console.log(`🚀 Servidor backend escuchando en http://${hostname}:${port}`);
  serve({ fetch: app.fetch, port, hostname });
}

