import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { AgentEngine } from "../src/core/agent.js";
import { SessionManager } from "../src/core/session.js";
import { MockAdapter } from "../src/llm/mock.js";
import { ToolContext } from "../src/types/index.js";
import { simular_envio } from "../src/tools/proveedor.js";

const rootDir = process.cwd();

test("1. Conversación de varios turnos: Mantiene el historial en la sesión", async () => {
  const sessionManager = new SessionManager();
  const mockAdapter = new MockAdapter();
  const agent = new AgentEngine(mockAdapter, sessionManager, { baseDir: rootDir });

  const session = sessionManager.getOrCreate();

  mockAdapter.enqueueResponse({ content: "¡Hola! Estoy listo para procesar solicitudes de registro." });
  const turn1 = await agent.processMessage(session.id, "Hola");
  assert.equal(turn1.reply, "¡Hola! Estoy listo para procesar solicitudes de registro.");
  assert.equal(session.messages.length, 2); // user + model

  mockAdapter.enqueueResponse({ content: "El caso co-industrias-delta es de Colombia." });
  const turn2 = await agent.processMessage(session.id, "¿De qué país es el caso co-industrias-delta?");
  assert.equal(turn2.reply, "El caso co-industrias-delta es de Colombia.");
  assert.equal(session.messages.length, 4); // 2 users + 2 models
});

test("2 & 3. Selección y ejecución correcta de herramientas con retorno de resultados", async () => {
  const sessionManager = new SessionManager();
  const mockAdapter = new MockAdapter();
  const agent = new AgentEngine(mockAdapter, sessionManager, { baseDir: rootDir });

  const session = sessionManager.getOrCreate();

  // Turno 1: El modelo decide llamar a leer_solicitud
  mockAdapter.enqueueResponse({
    toolCalls: [
      {
        id: "call_leer_1",
        name: "proveedor_leer_solicitud",
        args: { caso: "co-industrias-delta" }
      }
    ]
  });
  // Luego de recibir el resultado de la herramienta, el modelo responde
  mockAdapter.enqueueResponse({
    content: "He leído la solicitud de Industrias Delta S.A.S. (Colombia). Formato: xlsx."
  });

  const result = await agent.processMessage(session.id, "Procesa la solicitud de Delta");

  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].name, "proveedor_leer_solicitud");
  assert.equal(result.toolCalls[0].ok, true);
  assert.equal((result.toolCalls[0].result as { ok: boolean }).ok, true);
  assert.match(result.reply, /Industrias Delta/);
});

test("4. Manejo de argumentos inválidos o herramientas desconocidas sin caer", async () => {
  const sessionManager = new SessionManager();
  const mockAdapter = new MockAdapter();
  const agent = new AgentEngine(mockAdapter, sessionManager, { baseDir: rootDir });

  const session = sessionManager.getOrCreate();

  // El modelo inventa una herramienta o envía un caso inexistente
  mockAdapter.enqueueResponse({
    toolCalls: [
      {
        id: "call_err_1",
        name: "proveedor_leer_solicitud",
        args: { caso: "caso-totalmente-inexistente" }
      },
      {
        id: "call_err_2",
        name: "herramienta_fantasma",
        args: {}
      }
    ]
  });
  mockAdapter.enqueueResponse({
    content: "Se presentaron errores controlados al buscar la información solicitada."
  });

  const result = await agent.processMessage(session.id, "Ejecuta caso inexistente");

  assert.equal(result.toolCalls.length, 2);
  assert.equal(result.toolCalls[0].ok, false);
  assert.equal(result.toolCalls[1].ok, false);
  assert.match(result.reply, /errores controlados/);
});

test("5. Sesiones independientes: Aislamiento total de memoria entre sesiones", async () => {
  const sessionManager = new SessionManager();
  const mockAdapter = new MockAdapter();
  const agent = new AgentEngine(mockAdapter, sessionManager, { baseDir: rootDir });

  const sessA = sessionManager.getOrCreate("sesion-A");
  const sessB = sessionManager.getOrCreate("sesion-B");

  mockAdapter.enqueueResponse({ content: "Respuesta A" });
  await agent.processMessage(sessA.id, "Mensaje A");

  mockAdapter.enqueueResponse({ content: "Respuesta B" });
  await agent.processMessage(sessB.id, "Mensaje B");

  assert.equal(sessA.messages.length, 2);
  assert.equal(sessB.messages.length, 2);
  assert.equal(sessA.messages[0].content, "Mensaje A");
  assert.equal(sessB.messages[0].content, "Mensaje B");
});

test("6. Confirmación humana válida: Ratificación en dos fases y consumo único", async () => {
  const sessionManager = new SessionManager();
  const session = sessionManager.getOrCreate();

  // Simular creación de confirmación pendiente vinculada a co-industrias-delta
  const conf = session.createPendingConfirmation("co-industrias-delta", "simular_envio");
  assert.equal(conf.status, "pending");
  assert.ok(conf.token.startsWith("conf_"));

  // El usuario confirma expresamente
  const ok = session.confirmPending(conf.token, "co-industrias-delta");
  assert.equal(ok, true);
  assert.equal(session.pendingConfirmation?.status, "confirmed");

  // El backend consume la autorización
  const consumed = session.consumeAuthorization("co-industrias-delta");
  assert.equal(consumed, true);
  assert.equal(session.pendingConfirmation?.status, "consumed");

  // Intento de reusar la autorización (Single-Use check)
  const reConsumed = session.consumeAuthorization("co-industrias-delta");
  assert.equal(reConsumed, false, "Una confirmación ya consumida no puede volver a usarse");
});

test("7. Confirmación rechazada si es inexistente, expirada o de otro caso", () => {
  const sessionManager = new SessionManager();
  const session = sessionManager.getOrCreate();

  session.createPendingConfirmation("co-industrias-delta", "simular_envio");

  // Caso erróneo: intentar confirmar un caso distinto
  const okWrongCase = session.confirmPending(undefined, "ec-corp-andina");
  assert.equal(okWrongCase, false);

  // Token erróneo
  const okWrongToken = session.confirmPending("token-invalido-xyz", "co-industrias-delta");
  assert.equal(okWrongToken, false);

  // Expiración temporal
  session.pendingConfirmation!.expiresAt = new Date(Date.now() - 1000); // Expirado
  const okExpired = session.confirmPending(undefined, "co-industrias-delta");
  assert.equal(okExpired, false);
});

test("8. Bloqueo estricto de envíos si el paquete tiene soportes vencidos", async () => {
  // A fecha real (octubre 2026), Cámara de Comercio está vencida en co-industrias-delta
  const ctx: ToolContext = {
    directory: rootDir,
    referenceDate: new Date("2026-10-28"),
    sessionConfirmed: true // Aunque el analista haya confirmado, la regla RN3/seguridad bloquea el envío
  };

  const raw = await simular_envio.execute({ caso: "co-industrias-delta", confirmado: true }, ctx);
  const res = JSON.parse(raw);

  assert.equal(res.ok, false);
  assert.match(res.error, /el paquete está bloqueado para firma/);
});

test("9. Protección de credenciales y datos sensibles en sesión y logger", () => {
  const sessionManager = new SessionManager();
  const session = sessionManager.getOrCreate();

  // Comprobar que en el estado de la sesión no se almacene ninguna API key ni secreto
  const serialized = JSON.stringify(session);
  assert.doesNotMatch(serialized, /AIza[0-9A-Za-z-_]{35}/);
  assert.doesNotMatch(serialized, /GEMINI_API_KEY/);
});

test("10. Errores del modelo, tope de iteraciones y reintentos", async () => {
  const sessionManager = new SessionManager();
  const mockAdapter = new MockAdapter();
  // Configurar límite estricto de 2 iteraciones
  const agent = new AgentEngine(mockAdapter, sessionManager, { baseDir: rootDir, maxIterations: 2 });

  const session = sessionManager.getOrCreate();

  // El modelo entra en bucle infinito de tool calls
  mockAdapter.setHandler(() => ({
    toolCalls: [{ id: "loop_call", name: "proveedor_leer_solicitud", args: { caso: "co-industrias-delta" } }]
  }));

  const res = await agent.processMessage(session.id, "Inicia bucle");

  // Debe haberse detenido exactamente al alcanzar maxIterations (2)
  assert.match(res.reply, /límite de iteraciones/);
});

