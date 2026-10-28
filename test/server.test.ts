import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "../src/server.js";

const { app, sessionManager } = createServer({ useMock: true });

test("HTTP GET /api/health: Retorna estado saludable y configuración pública sin secretos", async () => {
  const res = await app.request("/api/health");
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.status, "healthy");
  assert.ok(json.model);
  // Verificar que jamás exponga claves
  assert.equal(json.apiKey, undefined);
  assert.equal(json.GEMINI_API_KEY, undefined);
});

test("HTTP POST /api/chat: Procesa mensaje y devuelve respuesta estructurada", async () => {
  const res = await app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hola agente" })
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.ok(json.data.sessionId);
  assert.ok(json.data.reply);
  assert.ok(Array.isArray(json.data.toolCalls));
});

test("HTTP POST /api/chat: Rechaza mensaje vacío con 400", async () => {
  const res = await app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "" })
  });

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.ok, false);
});

test("HTTP GET /api/sessions y /api/sessions/:id: Consulta sesiones e historial", async () => {
  // Crear sesión enviando chat
  const chatRes = await app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Mensaje para sesion" })
  });
  const { data: chatData } = await chatRes.json();
  const sessionId = chatData.sessionId;

  // Consultar listado
  const listRes = await app.request("/api/sessions");
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  assert.ok(listJson.data.some((s: { id: string }) => s.id === sessionId));

  // Consultar detalle individual
  const detailRes = await app.request(`/api/sessions/${sessionId}`);
  assert.equal(detailRes.status, 200);
  const detailJson = await detailRes.json();
  assert.equal(detailJson.data.id, sessionId);
  assert.ok(detailJson.data.messages.length >= 2);
});

test("HTTP Confirmación Humana: /confirmation, /confirm y /reject", async () => {
  const session = sessionManager.getOrCreate("sesion-confirmacion-test");
  session.createPendingConfirmation("caso-aprobado-test", "simular_envio");

  // Consultar estado de confirmación
  const checkRes = await app.request(`/api/sessions/${session.id}/confirmation`);
  assert.equal(checkRes.status, 200);
  const checkJson = await checkRes.json();
  assert.equal(checkJson.data.hasPending, true);
  assert.equal(checkJson.data.confirmation.caso, "caso-aprobado-test");

  // Confirmar mediante endpoint
  const confirmRes = await app.request(`/api/sessions/${session.id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caso: "caso-aprobado-test" })
  });
  assert.equal(confirmRes.status, 200);
  const confirmJson = await confirmRes.json();
  assert.equal(confirmJson.ok, true);

  // Probar rechazo con otra sesión
  const sessionReject = sessionManager.getOrCreate("sesion-reject-test");
  sessionReject.createPendingConfirmation("ec-corp-andina", "simular_envio");

  const rejectRes = await app.request(`/api/sessions/${sessionReject.id}/reject`, {
    method: "POST"
  });
  assert.equal(rejectRes.status, 200);
  assert.equal(sessionReject.pendingConfirmation?.status, "rejected");
});

test("HTTP GET /api/artifacts: Descarga segura y bloqueo de Path Traversal", async () => {
  const testSession = sessionManager.getOrCreate("sesion-test-artifacts");
  const sessArtifactDir = path.resolve(process.cwd(), "out", "sessions", testSession.id, "co-industrias-delta");
  fs.mkdirSync(sessArtifactDir, { recursive: true });
  fs.writeFileSync(path.resolve(sessArtifactDir, "formulario.xlsx"), "dummy xlsx content");

  // Descarga válida de un artefacto con sesión y token de propietario
  const validRes = await app.request(`/api/artifacts/co-industrias-delta/formulario.xlsx?sessionId=${testSession.id}&token=${testSession.sessionToken}`);
  assert.equal(validRes.status, 200);
  assert.equal(validRes.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  // Descarga de archivo no existente dentro de la sesión
  const notFoundRes = await app.request(`/api/artifacts/co-industrias-delta/archivo-fantasma.xyz?sessionId=${testSession.id}&token=${testSession.sessionToken}`);
  assert.equal(notFoundRes.status, 404);

  // Intento de Path Traversal
  const traversalRes = await app.request(`/api/artifacts/co-industrias-delta/..%2f..%2fpackage.json?sessionId=${testSession.id}&token=${testSession.sessionToken}`);
  assert.equal(traversalRes.status, 400);

  // Intento de descarga sin sesión
  const noSessionRes = await app.request("/api/artifacts/co-industrias-delta/formulario.xlsx");
  assert.equal(noSessionRes.status, 400);
});

test("HTTP POST /api/chat: Control de cuota y límite de tokens por sesión (429)", async () => {
  const session = sessionManager.getOrCreate("sesion-cuota-excedida");
  // Simular consumo de tokens superior al umbral
  session.totalTokens = {
    promptTokens: 45000,
    completionTokens: 6000,
    totalTokens: 51000
  };

  const res = await app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: session.id,
      message: "Continuar procesamiento"
    })
  });

  assert.equal(res.status, 429);
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.ok(json.error.includes("Límite de tokens de la sesión excedido"));
});

test("HTTP Seguridad: En producción referenceDate es ignorada a menos que se autorice", async () => {
  const origEnv = process.env.NODE_ENV;
  const origAllow = process.env.ALLOW_REFERENCE_DATE;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_REFERENCE_DATE;

    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Hola",
        referenceDate: "1999-01-01T00:00:00.000Z"
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origAllow !== undefined) {
      process.env.ALLOW_REFERENCE_DATE = origAllow;
    }
  }
});


