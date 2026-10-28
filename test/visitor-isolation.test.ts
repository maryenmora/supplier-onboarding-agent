import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "../src/server.js";
import { ResourceGuard } from "../src/core/guard.js";

test("Seguridad de Acceso: Aislamiento estricto de sesiones entre visitantes independientes", async () => {
  const { app } = createServer({ useMock: true });

  const visitorA = "visitante_alpha_123";
  const visitorB = "visitante_beta_456";

  // 1. Visitante A crea una sesión
  const chatResA = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-visitor-id": visitorA
    },
    body: JSON.stringify({ message: "Hola soy visitante A" })
  });

  assert.equal(chatResA.status, 200);
  const dataA = (await chatResA.json()).data;
  const sessionIdA = dataA.sessionId;
  assert.ok(sessionIdA, "Debe crearse una sesión para Visitante A");

  // 2. Visitante B lista sesiones -> NO debe ver la sesión de Visitante A
  const listResB = await app.request("/api/sessions", {
    headers: { "x-visitor-id": visitorB }
  });
  assert.equal(listResB.status, 200);
  const listDataB = (await listResB.json()).data;
  assert.equal(
    listDataB.some((s: { id: string }) => s.id === sessionIdA),
    false,
    "Visitante B no debe ver las sesiones de Visitante A"
  );

  // 3. Visitante B intenta consultar directamente la sesión de Visitante A -> 403 Forbidden
  const detailResB = await app.request(`/api/sessions/${sessionIdA}`, {
    headers: { "x-visitor-id": visitorB }
  });
  assert.equal(detailResB.status, 403, "Debe retornar 403 Forbidden al consultar sesión ajena");
  const detailJsonB = await detailResB.json();
  assert.equal(detailJsonB.ok, false);
  assert.match(detailJsonB.error, /pertenece a otro visitante/i);

  // 4. Visitante B intenta consultar herramientas de Visitante A -> 403 Forbidden
  const toolsResB = await app.request(`/api/sessions/${sessionIdA}/tools`, {
    headers: { "x-visitor-id": visitorB }
  });
  assert.equal(toolsResB.status, 403, "Debe retornar 403 Forbidden en tools ajenas");

  // 5. Visitante B intenta consultar confirmaciones de Visitante A -> 403 Forbidden
  const confResB = await app.request(`/api/sessions/${sessionIdA}/confirmation`, {
    headers: { "x-visitor-id": visitorB }
  });
  assert.equal(confResB.status, 403, "Debe retornar 403 Forbidden en confirmación ajena");

  // 6. Visitante B intenta ratificar confirmación en sesión ajena -> 403 Forbidden
  const confirmResB = await app.request(`/api/sessions/${sessionIdA}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-visitor-id": visitorB
    },
    body: JSON.stringify({ caso: "co-industrias-delta" })
  });
  assert.equal(confirmResB.status, 403, "Debe denegar confirmación en sesión ajena");

  // 7. Visitante B intenta enviar un mensaje a la sesión de Visitante A -> 403 Forbidden
  const injectChatResB = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-visitor-id": visitorB
    },
    body: JSON.stringify({
      sessionId: sessionIdA,
      message: "Intento de usurpación"
    })
  });
  assert.equal(injectChatResB.status, 403, "Debe impedir enviar mensajes a sesión ajena");
});

test("Seguridad de Acceso: Aislamiento físico y pruebas negativas de descarga de artefactos", async () => {
  const { app } = createServer({ useMock: true });

  const visitorA = "visitante_archivos_A";
  const visitorB = "visitante_archivos_B";

  // Visitante A procesa el caso co-industrias-delta
  const chatResA = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-visitor-id": visitorA
    },
    body: JSON.stringify({ message: "Procesa el caso co-industrias-delta" })
  });
  assert.equal(chatResA.status, 200);
  const dataA = (await chatResA.json()).data;
  const sessionIdA = dataA.sessionId;
  const tokenA = dataA.sessionToken;

  // Verificar que los archivos se crearon en su carpeta aislada
  const sessionDirA = path.resolve(process.cwd(), "out", "sessions", sessionIdA, "co-industrias-delta");
  assert.ok(fs.existsSync(sessionDirA), "El directorio aislado de la sesión debe existir");

  // 1. Prueba Negativa: Descargar sin sesión -> 400 Bad Request
  const resNoSession = await app.request("/api/artifacts/co-industrias-delta/formulario.xlsx");
  assert.equal(resNoSession.status, 400, "Descarga sin sesión debe retornar 400");
  const jsonNoSession = await resNoSession.json();
  assert.match(jsonNoSession.error, /Se requiere un identificador de sesión válido/i);

  // 2. Prueba Negativa: Descargar sin credencial de propietario -> 401 Unauthorized
  const resNoToken = await app.request(`/api/artifacts/co-industrias-delta/formulario.xlsx?sessionId=${sessionIdA}`, {
    headers: { "x-visitor-id": visitorA }
  });
  assert.equal(resNoToken.status, 401, "Descarga sin credencial/token debe retornar 401");
  const jsonNoToken = await resNoToken.json();
  assert.match(jsonNoToken.error, /se requiere credencial de sesión/i);

  // 3. Prueba Negativa: Descargar con token de propietario inválido -> 403 Forbidden
  const resBadToken = await app.request(`/api/artifacts/co-industrias-delta/formulario.xlsx?sessionId=${sessionIdA}&token=token_invalido_hacker`, {
    headers: { "x-visitor-id": visitorA }
  });
  assert.equal(resBadToken.status, 403, "Descarga con token inválido debe retornar 403");
  const jsonBadToken = await resBadToken.json();
  assert.match(jsonBadToken.error, /credencial de propietario inválida/i);

  // 4. Prueba Negativa: Descargar documentos de otra sesión (otro visitorId) -> 403 Forbidden
  const downloadResB = await app.request(`/api/artifacts/co-industrias-delta/formulario.xlsx?sessionId=${sessionIdA}&token=${tokenA}`, {
    headers: { "x-visitor-id": visitorB }
  });
  assert.equal(downloadResB.status, 403, "Debe rechazar la descarga de archivo de otra sesión");
  const downloadJsonB = await downloadResB.json();
  assert.match(downloadJsonB.error, /pertenece a otra sesión/i);

  // 5. Prueba Positiva: Visitante A descarga su propio archivo con su sessionId y token válido -> 200 OK
  const downloadResA = await app.request(`/api/artifacts/co-industrias-delta/formulario.xlsx?sessionId=${sessionIdA}&token=${tokenA}`, {
    headers: { "x-visitor-id": visitorA }
  });
  assert.equal(downloadResA.status, 200, "Visitante A debe poder descargar su propio artefacto");
  assert.equal(downloadResA.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

test("Protección de Consumo: Rate Limiting y bloqueo contra elusión por cambio arbitrario de visitorId", async () => {
  const guard = new ResourceGuard({ maxRequestsPerMinute: 3 });
  const { app } = createServer({ useMock: true, resourceGuard: guard });
  const ipSimulada = "198.51.100.25";

  // Enviar 3 peticiones desde la misma IP rotando arbitrariamente el visitorId en cada una
  for (let i = 1; i <= 3; i++) {
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ipSimulada,
        "x-visitor-id": `visitor_arbitrario_${i}`
      },
      body: JSON.stringify({ message: `Mensaje de ataque ${i}` })
    });
    assert.equal(res.status, 200, `Petición ${i} dentro de cuota permitida`);
  }

  // La 4ta petición, aunque use un 4to visitorId diferente, DEBE ser rechazada con 429
  const resEvasion = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ipSimulada,
      "x-visitor-id": "visitor_arbitrario_4"
    },
    body: JSON.stringify({ message: "Intento de evadir límite rotando visitorId" })
  });

  assert.equal(resEvasion.status, 429, "Debe rechazar con 429 al alcanzar límite de IP sin importar rotación de visitorId");
  const jsonEvasion = await resEvasion.json();
  assert.equal(jsonEvasion.ok, false);
  assert.match(jsonEvasion.error, /(Límite de solicitudes por minuto excedido para la conexión|Actividad sospechosa detectada)/i);
});

test("Protección de Consumo: Presupuesto Global de Tokens (Global Token Budget)", async () => {
  const guard = new ResourceGuard({ maxGlobalTokens: 1000 });
  // Simular consumo global previo cercano al límite
  guard.recordTokenUsage({ promptTokens: 800, completionTokens: 250, totalTokens: 1050 });

  const { app } = createServer({ useMock: true, resourceGuard: guard });

  const res = await app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Petición sobre presupuesto" })
  });

  assert.equal(res.status, 429);
  const json = await res.json();
  assert.match(json.error, /Presupuesto global de tokens de la demostración alcanzado/i);
});

test("Seguridad de Acceso: Clave de demostración privada (DEMO_ACCESS_KEY)", async () => {
  const guard = new ResourceGuard({ demoAccessKey: "perxia_secret_demo_2026" });
  const { app } = createServer({ useMock: true, resourceGuard: guard });

  // 1. Petición sin clave -> 401 Unauthorized
  const resNoKey = await app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hola sin clave" })
  });
  assert.equal(resNoKey.status, 401);
  const jsonNoKey = await resNoKey.json();
  assert.match(jsonNoKey.error, /Clave de acceso de evaluación requerida/i);

  // 1b. Petición con clave de demo incorrecta -> 401 Unauthorized
  const resBadKey = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-key": "clave_totalmente_erronea_999"
    },
    body: JSON.stringify({ message: "Hola con clave errónea" })
  });
  assert.equal(resBadKey.status, 401);
  const jsonBadKey = await resBadKey.json();
  assert.match(jsonBadKey.error, /Clave de acceso de evaluación requerida o inválida/i);

  // 2. Healthcheck no requiere clave (para Render / monitoreo)
  const healthRes = await app.request("/api/health");
  assert.equal(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.keyRequired, true);

  // 3. Petición con clave correcta vía header x-demo-key -> 200 OK
  const resKey = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-key": "perxia_secret_demo_2026"
    },
    body: JSON.stringify({ message: "Hola con clave autorizada" })
  });
  assert.equal(resKey.status, 200);
});

