import fs from "node:fs";
import path from "node:path";
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

dotenv.config();

export function createServer(options?: {
  agentEngine?: AgentEngine;
  baseDir?: string;
  useMock?: boolean;
}) {
  const app = new Hono();
  const baseDir = path.resolve(options?.baseDir || process.cwd());

  // Configuración del adaptador LLM
  const sessionManager = new SessionManager();
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

  // Middleware de CORS
  app.use("*", cors());

  // 1. GET /api/health - Salud y configuración pública segura
  app.get("/api/health", async (c) => {
    const isModelAvailable = await agentEngine.getAdapter().isAvailable();
    return c.json({
      ok: true,
      provider: agentEngine.getAdapter() instanceof MockAdapter ? "mock" : "gemini",
      model: agentEngine.getAdapter().getModelName(),
      modelAvailable: isModelAvailable,
      status: "healthy",
      timestamp: new Date().toISOString()
    });
  });

  // 2. POST /api/chat - Crear o continuar conversación
  const ChatRequestSchema = z.object({
    sessionId: z.string().optional(),
    message: z.string().min(1, "El mensaje no puede estar vacío"),
    referenceDate: z.string().optional()
  });

  app.post("/api/chat", async (c) => {
    try {
      const body = await c.req.json();
      const parsed = ChatRequestSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ ok: false, error: parsed.error.issues[0]?.message || "Payload inválido" }, 400);
      }

      const { sessionId, message, referenceDate: refDateStr } = parsed.data;

      // Restricción de seguridad: referenceDate solo se acepta en entornos no productivos o con flag explícito
      const allowRefDate = process.env.NODE_ENV !== "production" || process.env.ALLOW_REFERENCE_DATE === "true";
      const refDate = (allowRefDate && refDateStr) ? new Date(refDateStr) : undefined;

      // Control de presupuesto de tokens por sesión
      if (sessionId) {
        const existingSession = agentEngine.getSessionManager().get(sessionId);
        const maxTokens = Number(process.env.MAX_SESSION_TOKENS || 50000);
        if (existingSession && existingSession.totalTokens.totalTokens >= maxTokens) {
          return c.json({
            ok: false,
            error: `Límite de tokens de la sesión excedido (${existingSession.totalTokens.totalTokens}/${maxTokens}). Por favor inicie una nueva sesión para continuar.`
          }, 429);
        }
      }

      const result = await agentEngine.processMessage(sessionId, message, { referenceDate: refDate });

      return c.json({
        ok: true,
        data: result
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return c.json({ ok: false, error: errorMsg }, 500);
    }
  });

  // 3. GET /api/sessions - Listar sesiones
  app.get("/api/sessions", (c) => {
    const sessions = agentEngine.getSessionManager().list().map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messagesCount: s.messages.length,
      toolCallsCount: s.toolCallsHistory.length,
      hasPendingConfirmation: s.pendingConfirmation?.status === "pending",
      usage: s.totalTokens
    }));
    return c.json({ ok: true, data: sessions });
  });

  // 4. GET /api/sessions/:id - Historial completo de sesión
  app.get("/api/sessions/:id", (c) => {
    const id = c.req.param("id");
    const session = agentEngine.getSessionManager().get(id);
    if (!session) {
      return c.json({ ok: false, error: `Sesión no encontrada: ${id}` }, 404);
    }

    return c.json({
      ok: true,
      data: {
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: session.messages,
        toolCalls: session.toolCallsHistory,
        pendingConfirmation: session.pendingConfirmation,
        usage: session.totalTokens
      }
    });
  });

  // 5. GET /api/sessions/:id/tools - Consultar llamadas a herramientas
  app.get("/api/sessions/:id/tools", (c) => {
    const id = c.req.param("id");
    const session = agentEngine.getSessionManager().get(id);
    if (!session) {
      return c.json({ ok: false, error: `Sesión no encontrada: ${id}` }, 404);
    }

    return c.json({ ok: true, data: session.toolCallsHistory });
  });

  // 6. GET /api/sessions/:id/confirmation - Estado de confirmación pendiente
  app.get("/api/sessions/:id/confirmation", (c) => {
    const id = c.req.param("id");
    const session = agentEngine.getSessionManager().get(id);
    if (!session) {
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

  // 7. POST /api/sessions/:id/confirm - Confirmar operación pendiente explícitamente
  const ConfirmSchema = z.object({
    token: z.string().optional(),
    caso: z.string().optional()
  });

  app.post("/api/sessions/:id/confirm", async (c) => {
    const id = c.req.param("id");
    const session = agentEngine.getSessionManager().get(id);
    if (!session) {
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
      const checklistPath = path.resolve(baseDir, "out", targetCaso, "paquete", "checklist.md");
      if (fs.existsSync(checklistPath)) {
        const content = fs.readFileSync(checklistPath, "utf-8");
        if (content.includes("¿Listo para firma?: NO") || content.includes("BLOQUEADO")) {
          return c.json({
            ok: false,
            error: `No se puede autorizar el envío: el paquete del caso '${targetCaso}' tiene la firma bloqueada debido a soportes vencidos o ausentes.`
          }, 400);
        }
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

  // 8. POST /api/sessions/:id/reject - Rechazar operación pendiente
  app.post("/api/sessions/:id/reject", (c) => {
    const id = c.req.param("id");
    const session = agentEngine.getSessionManager().get(id);
    if (!session) {
      return c.json({ ok: false, error: `Sesión no encontrada: ${id}` }, 404);
    }

    session.rejectPending();
    return c.json({
      ok: true,
      message: "Operación pendiente cancelada por el usuario"
    });
  });

  // 9. GET /api/artifacts/:caso/:file - Descarga segura de artefactos con prevención de Path Traversal
  app.get("/api/artifacts/:caso/:file", (c) => {
    const rawCaso = c.req.param("caso");
    const rawFile = c.req.param("file");

    // Sanitización estricta
    if (!/^[a-zA-Z0-9_-]+$/.test(rawCaso)) {
      return c.json({ ok: false, error: "Parámetro caso inválido" }, 400);
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(rawFile)) {
      return c.json({ ok: false, error: "Nombre de archivo inválido" }, 400);
    }

    const outDir = path.resolve(baseDir, "out");
    // Buscar en out/<caso>/ o en out/<caso>/paquete/
    const pathDirect = path.resolve(outDir, rawCaso, rawFile);
    const pathPaquete = path.resolve(outDir, rawCaso, "paquete", rawFile);

    let filePath: string | null = null;
    if (fs.existsSync(pathDirect) && pathDirect.startsWith(outDir)) {
      filePath = pathDirect;
    } else if (fs.existsSync(pathPaquete) && pathPaquete.startsWith(outDir)) {
      filePath = pathPaquete;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return c.json({ ok: false, error: "Artefacto no encontrado" }, 404);
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

