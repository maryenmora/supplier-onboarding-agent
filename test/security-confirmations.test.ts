import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";
import { SessionManager } from "../src/core/session.js";

test("Seguridad Confirmaciones: Bloqueo de confirmación cruzada entre casos", async () => {
  const { app, sessionManager } = createServer({ useMock: true });

  const session = sessionManager.getOrCreate();
  session.createPendingConfirmation("co-industrias-delta", "simular_envio");

  const pending = session.pendingConfirmation!;
  assert.equal(pending.caso, "co-industrias-delta");

  // 1. Intentar confirmar especificando un caso diferente (Ecuador)
  const resCross = await app.request(`/api/sessions/${session.id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: pending.token, caso: "ec-corp-andina" })
  });

  assert.equal(resCross.status, 400, "Debe rechazar la confirmación cruzada con HTTP 400");
  const jsonCross = await resCross.json();
  assert.equal(jsonCross.ok, false);
  assert.equal(session.pendingConfirmation?.status, "pending", "El estado debe permanecer pending");

  // 2. Intentar confirmar con un token equivocado
  const resBadToken = await app.request(`/api/sessions/${session.id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "token_falso_invalido", caso: "co-industrias-delta" })
  });

  assert.equal(resBadToken.status, 400, "Debe rechazar token inválido con HTTP 400");
  assert.equal(session.pendingConfirmation?.status, "pending");
});

test("Seguridad Confirmaciones: No se permite autorizar envíos para paquetes con firma bloqueada", async () => {
  const { app, sessionManager } = createServer({ useMock: true });

  const session = sessionManager.getOrCreate();
  // Creamos la confirmación pendiente para pa-logistica-istmo (cuya firma está bloqueada por soportes vencidos)
  session.createPendingConfirmation("pa-logistica-istmo", "simular_envio");
  const pending = session.pendingConfirmation!;

  // 1. Intento directo via endpoint POST /api/sessions/:id/confirm
  // Debe retornar HTTP 400 informando que la firma está bloqueada
  const resConfirm = await app.request(`/api/sessions/${session.id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: pending.token, caso: "pa-logistica-istmo" })
  });

  assert.equal(resConfirm.status, 400, "Debe rechazar la ratificación de paquete bloqueado con 400");
  const jsonConfirm = await resConfirm.json();
  assert.equal(jsonConfirm.ok, false);
  assert.ok(
    jsonConfirm.error.includes("firma bloqueada") || jsonConfirm.error.includes("bloqueado para firma"),
    "El mensaje de error debe explicar que la firma está bloqueada"
  );
  assert.equal(session.pendingConfirmation?.status, "pending", "No debe marcarse como confirmed");

  // 2. Intento conversacional via POST /api/chat
  const resSimular = await app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: session.id,
      message: "Procede con el envío para pa-logistica-istmo"
    })
  });

  assert.equal(resSimular.status, 200);
  const chatJson = await resSimular.json();
  // El agente o la herramienta no debe haber despachado un envío
  assert.ok(
    !chatJson.data.reply.toLowerCase().includes("despachado exitosamente"),
    "No debe despachar envíos de paquetes bloqueados"
  );
});

