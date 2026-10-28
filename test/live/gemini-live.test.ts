import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { GeminiAdapter } from "../../src/llm/gemini.js";
import { AgentEngine } from "../../src/core/agent.js";
import { SessionManager } from "../../src/core/session.js";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

test("E2E Gemini Real: Ejecución con Gemini 3.5 Flash-Lite y Function Calling real", async (t) => {
  if (!apiKey) {
    t.skip("BLOQUEADO: GEMINI_API_KEY no encontrada en variables de entorno. Omitiendo prueba en vivo.");
    return;
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const adapter = new GeminiAdapter(apiKey, modelName);

  // 1. Verificar disponibilidad real del modelo
  const isAvailable = await adapter.isAvailable();
  if (!isAvailable) {
    t.skip(`BLOQUEADO: El modelo ${modelName} no se encuentra disponible con la API key configurada.`);
    return;
  }

  const sessionManager = new SessionManager();
  const agent = new AgentEngine(adapter, sessionManager, {
    baseDir: process.cwd(),
    maxIterations: 4 // Límite conservador
  });

  // 2. Enviar solicitud real que requiere llamar a la herramienta proveedor_leer_solicitud
  const prompt = "Por favor lee la solicitud del caso 'co-industrias-delta' y dime qué cliente es y qué formato solicita.";
  const result = await agent.processMessage(undefined, prompt);

  console.log("\n[Gemini Live E2E Output]");
  console.log("- Modelo:", adapter.getModelName());
  console.log("- Herramientas ejecutadas:", result.toolCalls.map((tc) => tc.name).join(", "));
  console.log("- Tokens usados:", result.usage);
  console.log("- Respuesta del modelo:\n", result.reply);

  // 3. Validaciones de la prueba E2E real
  assert.ok(result.toolCalls.length >= 1, "Gemini debe haber invocado al menos una herramienta");
  const toolLeer = result.toolCalls.find((tc) => tc.name === "proveedor_leer_solicitud");
  assert.ok(toolLeer, "Gemini debe haber seleccionado proveedor_leer_solicitud");
  assert.equal(toolLeer.ok, true, "La herramienta debe haberse ejecutado con éxito");

  // 4. Validar que la respuesta final mencione los datos reales retornados por la herramienta
  assert.match(result.reply, /Industrias Delta/i, "La respuesta debe mencionar al cliente real");
  assert.match(result.reply, /xlsx|excel/i, "La respuesta debe mencionar el formato real");
  assert.ok(result.usage.totalTokens > 0, "Debe registrar consumo real de tokens");
});

