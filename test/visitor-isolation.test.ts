import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "../src/server.js";
import { ResourceGuard } from "../src/core/guard.js";

// =============================================================================
// PRUEBA OBLIGATORIA 1: Intentar recuperar sessionToken con un visitorId ajeno
// =============================================================================
test("Prueba Obligatoria 1: Imposibilidad de obtener o enumerar sessionToken mediante visitorId ajeno o listado", async () => {
  const { app } = createServer({ useMock: true });

  const visitorA = "visitante_legitimo_A";
  const visitorB = "visitante_atacante_B";

  // 1. Visitante A crea una sesión legítima
  const chatResA = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-visitor-id": visitorA
    },
    body: JSON.stringify({ message: "Sesión confidencial de A" })
  });
  assert.equal(chatResA.status, 200);
  const dataA = (await chatResA.json()).data;
  const sessionIdA = dataA.sessionId;
  const sessionTokenA = dataA.sessionToken;
  assert.ok(sessionTokenA, "La creación inicial devuelve el token de posesión al creador");

  // 2. Visitante B intenta listar sesiones con su propio visitorId -> no ve la sesión de A
  const listB = await app.request("/api/sessions", {
    headers: { "x-visitor-id": visitorB }
  });
  const listJsonB = await listB.json();
  assert.equal(
    listJsonB.data.some((s: { id: string }) => s.id === sessionIdA),
    false,
    "Visitante B no debe ver la sesión de A en el listado"
  );

  // 3. Visitante B intenta suplantar el visitorId de A ('x-visitor-id: visitante_legitimo_A') en GET /api/sessions
  // El endpoint NUNCA expone el campo sessionToken en la lista devuelta
  const listSpoofed = await app.request("/api/sessions", {
    headers: { "x-visitor-id": visitorA }
  });
  assert.equal(listSpoofed.status, 200);
  const listJsonSpoofed = await listSpoofed.json();
  for (const s of listJsonSpoofed.data) {
    assert.equal(s.sessionToken, undefined, "Ninguna sesión en /api/sessions debe exponer sessionToken");
  }

  // 4. Visitante B intenta obtener sessionToken consultando GET /api/sessions/:id sin token -> 401
  const getDetailNoToken = await app.request(`/api/sessions/${sessionIdA}`, {
    headers: { "x-visitor-id": visitorA } // Suplantando visitorId pero sin token
  });
  assert.equal(getDetailNoToken.status, 401, "Sin poseer x-session-token debe responder 401 Unauthorized");

  // 5. El propietario legítimo consulta GET /api/sessions/:id con su token -> recibe datos pero NUNCA sessionToken reflejado
  const getDetailOwner = await app.request(`/api/sessions/${sessionIdA}`, {
    headers: {
      "x-visitor-id": visitorA,
      "x-session-token": sessionTokenA
    }
  });
  assert.equal(getDetailOwner.status, 200);
  const detailJsonOwner = await getDetailOwner.json();
  assert.equal(detailJsonOwner.data.sessionToken, undefined, "sessionToken nunca debe devolverse en respuestas GET");
});

// =============================================================================
// PRUEBA OBLIGATORIA 2: Consultar historial sin credencial válida
// =============================================================================
test("Prueba Obligatoria 2: Consultar historial sin credencial válida (401 sin cabecera, 403 con credencial inválida)", async () => {
  const { app } = createServer({ useMock: true });

  // Crear sesión inicial
  const chatRes = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-visitor-id": "visitor_historial_test"
    },
    body: JSON.stringify({ message: "Mensaje para probar historial" })
  });
  const data = (await chatRes.json()).data;
  const sessionId = data.sessionId;
  const validToken = data.sessionToken;

  // A. Petición sin cabecera x-session-token -> 401 Unauthorized
  const resNoHeader = await app.request(`/api/sessions/${sessionId}`);
  assert.equal(resNoHeader.status, 401, "Consultar historial sin cabecera x-session-token debe responder 401");
  const jsonNoHeader = await resNoHeader.json();
  assert.match(jsonNoHeader.error, /se requiere credencial de sesión/i);

  // B. Petición con token en query parameter ?token=... -> 401 Unauthorized (Tokens prohibidos en URL)
  const resQueryParam = await app.request(`/api/sessions/${sessionId}?token=${validToken}`);
  assert.equal(resQueryParam.status, 401, "Token en parámetro de consulta debe responder 401");
  const jsonQueryParam = await resQueryParam.json();
  assert.match(jsonQueryParam.error, /No se admiten tokens en la URL/i);

  // C. Petición con token en cabecera pero con valor inválido/falso -> 403 Forbidden
  const resBadToken = await app.request(`/api/sessions/${sessionId}`, {
    headers: { "x-session-token": "token_completamente_falso_999" }
  });
  assert.equal(resBadToken.status, 403, "Token inválido en cabecera debe responder 403");
  const jsonBadToken = await resBadToken.json();
  assert.match(jsonBadToken.error, /credencial de sesión inválida/i);

  // D. Petición con token válido en cabecera HTTP -> 200 OK
  const resValid = await app.request(`/api/sessions/${sessionId}`, {
    headers: { "x-session-token": validToken }
  });
  assert.equal(resValid.status, 200, "Token válido en cabecera x-session-token debe responder 200");
  const jsonValid = await resValid.json();
  assert.equal(jsonValid.data.id, sessionId);
});

// =============================================================================
// PRUEBA OBLIGATORIA 3: Descargar archivos sin exponer tokens en URLs
// =============================================================================
test("Prueba Obligatoria 3: Descargar archivos sin exponer tokens en URLs (Rechazo de query params y descarga vía cabeceras)", async () => {
  const { app } = createServer({ useMock: true });
  const visitorA = "visitante_descargas_A";
  const visitorB = "visitante_descargas_B";

  // Procesar caso co-industrias-delta
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

  // A. Intento de descargar con token expuesto en URL (?token=...) -> 401 Unauthorized
  const resUrlToken = await app.request(`/api/artifacts/co-industrias-delta/formulario.xlsx?sessionId=${sessionIdA}&token=${tokenA}`);
  assert.equal(resUrlToken.status, 401, "Token en URL debe ser rechazado con 401");
  const jsonUrlToken = await resUrlToken.json();
  assert.match(jsonUrlToken.error, /No se admiten tokens en la URL/i);

  // B. Intento de descargar con sessionToken expuesto en URL (?sessionToken=...) -> 401 Unauthorized
  const resUrlSessionToken = await app.request(`/api/artifacts/co-industrias-delta/formulario.xlsx?sessionId=${sessionIdA}&sessionToken=${tokenA}`);
  assert.equal(resUrlSessionToken.status, 401, "sessionToken en URL debe ser rechazado con 401");
  const jsonUrlSessionToken = await resUrlSessionToken.json();
  assert.match(jsonUrlSessionToken.error, /No se admiten tokens en la URL/i);

  // C. Intento de descargar sin ninguna credencial -> 401 Unauthorized
  const resNoCred = await app.request(`/api/artifacts/co-industrias-delta/formulario.xlsx?sessionId=${sessionIdA}`);
  assert.equal(resNoCred.status, 401, "Descarga sin cabecera de credencial debe responder 401");

  // D. Intento de descargar con token de otro visitante -> 403 Forbidden
  const resWrongVisitor = await app.request(`/api/artifacts/co-industrias-delta/formulario.xlsx?sessionId=${sessionIdA}`, {
    headers: {
      "x-visitor-id": visitorB,
      "x-session-token": tokenA
    }
  });
  assert.equal(resWrongVisitor.status, 403, "Descarga con visitorId cruzado debe responder 403");

  // E. Descarga legítima mediante cabecera x-session-token (sin tokens en URL) -> 200 OK
  const resLegit = await app.request(`/api/artifacts/co-industrias-delta/formulario.xlsx?sessionId=${sessionIdA}`, {
    headers: {
      "x-visitor-id": visitorA,
      "x-session-token": tokenA
    }
  });
  assert.equal(resLegit.status, 200, "Descarga autorizada mediante cabecera debe responder 200");
  assert.equal(resLegit.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

// =============================================================================
// PRUEBA OBLIGATORIA 4: Manipular cabeceras IP para evadir los límites (Proxy Render)
// =============================================================================
test("Prueba Obligatoria 4: Rate Limiting resistente a manipulación de cabeceras IP en proxy reverso de Render (1 hop)", async () => {
  const guard = new ResourceGuard({ maxRequestsPerMinute: 3 });
  const { app } = createServer({ useMock: true, resourceGuard: guard });
  const trustedClientIp = "198.51.100.88";

  // En el modelo de proxy de Render:
  // Render añade la IP pública verificada del cliente al FINAL de X-Forwarded-For.
  // Cualquier IP al inicio es aportada por el cliente y podría ser falsificada para intentar eludir límites.
  for (let i = 1; i <= 3; i++) {
    const forgedPrefix = `10.0.0.${i}, 172.16.0.${i}`;
    const res = await app.request("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `${forgedPrefix}, ${trustedClientIp}`,
        "x-visitor-id": `attacker_visitor_${i}`
      },
      body: JSON.stringify({ message: `Intento de ataque ${i}` })
    });
    assert.equal(res.status, 200, `Petición ${i} dentro de cuota permitida`);
  }

  // La 4ta petición con prefijo forjado completamente distinto DEBE ser bloqueada con 429
  // porque el servidor inspecciona la última IP agregada por el proxy de Render (198.51.100.88)
  const resBlocked = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `203.0.113.199, 10.99.99.99, ${trustedClientIp}`,
      "x-visitor-id": "attacker_visitor_evasion"
    },
    body: JSON.stringify({ message: "Intento 4 evadiendo prefijos" })
  });

  assert.equal(resBlocked.status, 429, "Debe rechazar con 429: el proxy de Render extrae la IP real al final");
  const jsonBlocked = await resBlocked.json();
  assert.equal(jsonBlocked.ok, false);
  assert.match(jsonBlocked.error, /Límite de solicitudes por minuto excedido/i);
});

// =============================================================================
// PRUEBA OBLIGATORIA 5: Enviar claves de demo en query parameters
// =============================================================================
test("Prueba Obligatoria 5: Rechazo estricto de DEMO_ACCESS_KEY en query params y aceptación exclusiva por cabeceras", async () => {
  const guard = new ResourceGuard({ demoAccessKey: "perxia_secret_demo_2026" });
  const { app } = createServer({ useMock: true, resourceGuard: guard });

  // A. Intento de enviar demo key en query parameter ?key=... -> 401 Unauthorized
  const resKeyInQuery = await app.request("/api/chat?key=perxia_secret_demo_2026", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Intento con key en query param" })
  });
  assert.equal(resKeyInQuery.status, 401, "Key en query param ?key= debe responder 401");
  const jsonKeyInQuery = await resKeyInQuery.json();
  assert.match(jsonKeyInQuery.error, /No se admiten claves en la URL/i);

  // B. Intento de enviar demo key en query parameter ?demoKey=... -> 401 Unauthorized
  const resDemoKeyInQuery = await app.request("/api/chat?demoKey=perxia_secret_demo_2026", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Intento con demoKey en query param" })
  });
  assert.equal(resDemoKeyInQuery.status, 401, "Key en query param ?demoKey= debe responder 401");
  const jsonDemoKeyInQuery = await resDemoKeyInQuery.json();
  assert.match(jsonDemoKeyInQuery.error, /No se admiten claves en la URL/i);

  // C. Petición sin ninguna clave -> 401 Unauthorized
  const resNoKey = await app.request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hola sin clave" })
  });
  assert.equal(resNoKey.status, 401);

  // D. Envío seguro vía cabecera x-demo-key -> 200 OK
  const resKeyInHeader = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-key": "perxia_secret_demo_2026"
    },
    body: JSON.stringify({ message: "Mensaje autorizado por cabecera x-demo-key" })
  });
  assert.equal(resKeyInHeader.status, 200, "Petición con cabecera x-demo-key debe responder 200");

  // E. Envío seguro vía cabecera Authorization: Bearer <key> -> 200 OK
  const resKeyInBearer = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer perxia_secret_demo_2026"
    },
    body: JSON.stringify({ message: "Mensaje autorizado por cabecera Authorization Bearer" })
  });
  assert.equal(resKeyInBearer.status, 200, "Petición con cabecera Authorization Bearer debe responder 200");
});

// =============================================================================
// PRUEBAS ADICIONALES: Aislamiento estricto de sesiones y presupuesto global
// =============================================================================
test("Aislamiento Estricto: Operaciones de confirmación y mensajería bloqueadas para visitantes ajenos", async () => {
  const { app } = createServer({ useMock: true });

  const visitorA = "visitante_alpha_123";
  const visitorB = "visitante_beta_456";

  const chatResA = await app.request("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-visitor-id": visitorA
    },
    body: JSON.stringify({ message: "Hola soy visitante A" })
  });
  const dataA = (await chatResA.json()).data;
  const sessionIdA = dataA.sessionId;

  // Visitante B intenta consultar herramientas de Visitante A -> 403 Forbidden
  const toolsResB = await app.request(`/api/sessions/${sessionIdA}/tools`, {
    headers: { "x-visitor-id": visitorB }
  });
  assert.equal(toolsResB.status, 403, "Debe retornar 403 Forbidden en tools ajenas");

  // Visitante B intenta consultar confirmaciones de Visitante A -> 403 Forbidden
  const confResB = await app.request(`/api/sessions/${sessionIdA}/confirmation`, {
    headers: { "x-visitor-id": visitorB }
  });
  assert.equal(confResB.status, 403, "Debe retornar 403 Forbidden en confirmación ajena");

  // Visitante B intenta ratificar confirmación en sesión ajena -> 403 Forbidden
  const confirmResB = await app.request(`/api/sessions/${sessionIdA}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-visitor-id": visitorB
    },
    body: JSON.stringify({ caso: "co-industrias-delta" })
  });
  assert.equal(confirmResB.status, 403, "Debe denegar confirmación en sesión ajena");

  // Visitante B intenta enviar un mensaje a la sesión de Visitante A -> 403 Forbidden
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

test("Protección de Consumo: Presupuesto Global de Tokens (Global Token Budget)", async () => {
  const guard = new ResourceGuard({ maxGlobalTokens: 1000 });
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
