import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "../src/server.js";

test("Frontend Integration: El backend Hono sirve el SPA compilado en web/dist", async () => {
  const { app } = createServer({ useMock: true });

  // 1. GET / debe servir index.html con el div #root y el bundle
  const resRoot = await app.request("/");
  assert.equal(resRoot.status, 200, "Debe responder 200 OK para la raíz /");
  const html = await resRoot.text();
  assert.ok(html.includes('<div id="root"></div>'), "Debe contener el elemento montura #root");
  assert.ok(html.includes("Periferia IT"), "Debe contener el título de Periferia IT");

  // 2. Comprobar que los assets referenciados en index.html existen físicamente
  const distDir = path.resolve(process.cwd(), "web", "dist");
  assert.ok(fs.existsSync(distDir), "El directorio web/dist debe existir tras la compilación");

  const assetsDir = path.resolve(distDir, "assets");
  assert.ok(fs.existsSync(assetsDir), "El directorio de assets debe existir");
  const assetFiles = fs.readdirSync(assetsDir);
  assert.ok(assetFiles.some((f) => f.endsWith(".js")), "Debe existir al menos un bundle JavaScript");
  assert.ok(assetFiles.some((f) => f.endsWith(".css")), "Debe existir al menos un bundle CSS");
});

test("Frontend Contract: API responde con la estructura esperada por los componentes React", async () => {
  const { app } = createServer({ useMock: true });

  // 1. Health check contract
  const resHealth = await app.request("/api/health");
  assert.equal(resHealth.status, 200);
  const healthJson = await resHealth.json();
  assert.equal(healthJson.ok, true);
  assert.ok("provider" in healthJson);
  assert.ok("model" in healthJson);
  assert.ok("modelAvailable" in healthJson);

  // 2. Chat response contract con estructura consumible por ChatView
  const resChat = await app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hola, procesa el caso co-industrias-delta" })
  });
  assert.equal(resChat.status, 200);
  const chatJson = await resChat.json();
  assert.equal(chatJson.ok, true);
  assert.ok(chatJson.data.sessionId, "Debe incluir sessionId");
  assert.ok(typeof chatJson.data.reply === "string", "Debe incluir reply");
  assert.ok(Array.isArray(chatJson.data.toolCalls), "Debe incluir toolCalls array");
  assert.ok("needsConfirmation" in chatJson.data, "Debe incluir flag needsConfirmation");
  assert.ok("usage" in chatJson.data, "Debe incluir métricas de tokens");
});

