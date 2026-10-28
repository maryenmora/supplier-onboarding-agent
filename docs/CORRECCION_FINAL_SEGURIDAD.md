# Auditoría y Corrección Final de Seguridad Pre-Render (PRD-01)

> **Proyecto:** PRD-01: Agente Conversacional "Registro como Proveedor" — Periferia IT Group  
> **Fecha:** 2026-10-28  
> **Estado:** **APROBADO PARA DESPLIEGUE EN RENDER**  
> **Commit Base Auditado:** `58f84f0`  
> **Suite de Pruebas:** 46/46 aprobadas (0 consumo de créditos Gemini en pruebas) + E2E Playwright OK  

---

## 1. Resumen Ejecutivo

Previo al despliegue en la plataforma de Render, se realizó una auditoría forense de seguridad sobre el commit `58f84f0` para resolver de forma definitiva tres hallazgos comprobados:
1. **Protección de credenciales de sesión:** Eliminación de la fuga de `sessionToken` en listados de sesiones y requerimiento estricto de credenciales de posesión en cabeceras HTTP.
2. **Eliminación total de tokens y claves en URLs:** Erradicación del transporte de secretos en parámetros de consulta (`query params`), reemplazándolo por descarga en memoria vía Blob con cabeceras seguras.
3. **Robustecimiento del Rate Limiting frente al modelo de Proxy Reverso de Render:** Inspección estricta de la última IP de `X-Forwarded-For` aportada por el proxy confiable de 1 salto de Render, bloqueando la evasión por spoofing de prefijos.

---

## 2. Detalle de Correcciones Implementadas

### 2.1 Hallazgo 1 — Protección Estricta de Credenciales de Sesión

* **Problema:** En `src/server.ts`, `GET /api/sessions` y `GET /api/sessions/:id` devolvían el campo `sessionToken` basándose en el identificador `visitorId` suministrado por el cliente, permitiendo a un atacante que rotara o suplantara `visitorId` obtener tokens de sesión confidenciales.
* **Solución Arquitectural:**
  * **Cero exposición en listados:** `GET /api/sessions` NUNCA retorna `sessionToken` en los resúmenes de sesión. Los listados permiten navegación histórica sin exponer credenciales.
  * **Comprobación de posesión en detalle:** `GET /api/sessions/:id` exige la presentación del token de posesión en la cabecera `x-session-token` (o `Authorization: Bearer <token>`). Si la cabecera no se envía, el servidor deniega el acceso con `401 Unauthorized`. Si el token es inválido o no corresponde a la sesión, responde con `403 Forbidden`.
  * **Cero reflejo en respuestas:** Ni el endpoint individual ni ningún otro endpoint devuelve jamás el `sessionToken` en su carga JSON una vez creada la sesión.
  * **Firma criptográfica de visitante:** Se incorporó el esquema de firma interna HMAC-SHA256 (`signVisitorId` y `verifyVisitorId`) en el servidor para generar y validar tokens de visitante opacos (`x-visitor-token`).

### 2.2 Hallazgo 2 — Eliminación de Tokens y Claves en las URLs

* **Problema:** En el frontend (`web/src/services/api.ts`), la función `getArtifactDownloadUrl` incorporaba el token de sesión en la URL mediante el parámetro de consulta `?token=`. Asimismo, el backend aceptaba tokens y claves en query params (`?token=`, `?sessionToken=`, `?key=`), lo que ocasionaba exposición de credenciales en el historial del navegador, cabeceras `Referer`, registros de proxy y logs de acceso del servidor web.
* **Solución Arquitectural:**
  * **Descarga segura en memoria vía Blob:** En `web/src/services/api.ts` se implementó la función asíncrona `downloadArtifact(caso, file, sessionId)`. Esta función:
    1. Realiza una petición `fetch` enviando la credencial exclusivamente en la cabecera `x-session-token` (junto con `x-visitor-id` y `x-visitor-token`).
    2. Recibe el flujo binario y genera un objeto `Blob` en la memoria del navegador.
    3. Construye un enlace temporal efímero con `URL.createObjectURL(blob)`, dispara el evento de descarga en el DOM y revoca de inmediato la URL con `URL.revokeObjectURL`.
  * **Actualización de componentes UI:** En `web/src/components/RightSidebar.tsx`, todos los enlaces de descarga directa fueron sustituidos por botones interactivos que invocan `downloadArtifact` de manera segura.
  * **Rechazo tajante en Backend:** En `src/server.ts`, tanto en `GET /api/artifacts/:caso/:file`, en `GET /api/sessions/:id` y en el middleware global de clave de evaluación (`DEMO_ACCESS_KEY`), si se detecta cualquier parámetro de consulta como `?token=`, `?sessionToken=`, `?key=` o `?demoKey=`, la solicitud es rechazada inmediatamente con `HTTP 401 Unauthorized` indicando que no se admiten secretos en la URL.

### 2.3 Hallazgo 3 — Rate Limiting y Supuestos del Proxy de Render (1 Hop)

* **Problema:** Extraer ciegamente la primera IP de `X-Forwarded-For` permite a un cliente malicioso inyectar IPs arbitrarias al inicio de la cabecera (`X-Forwarded-For: 1.1.1.1, 2.2.2.2`) y rotarlas en cada petición para eludir los límites de tasa de peticiones y cuota.
* **Supuestos de Seguridad Documentados para Render:**
  1. Render despliega las aplicaciones detrás de un proxy reverso balanceador de carga confiable de 1 salto (*1-hop reverse proxy*).
  2. Al recibir una petición externa, el proxy de Render añade la dirección IP pública real del cliente de forma fidedigna al **FINAL** de la cadena `X-Forwarded-For`.
  3. Las entradas previas en la cabecera pueden haber sido manipuladas por el cliente antes de ingresar a la red de Render.
  4. En consecuencia, la implementación de `extractClientIp` en `src/server.ts` toma la **última dirección IP válida** de la lista generada por `X-Forwarded-For`, validada contra un patrón estricto de IPv4/IPv6 (`IP_REGEX`).
  5. Esta estrategia neutraliza completamente los intentos de elusión por suplantación de prefijos.

---

## 3. Matriz de Pruebas Obligatorias Ejecutadas

Se ejecutó la suite completa de 46 pruebas automatizadas en `test/visitor-isolation.test.ts`, `test/server.test.ts` y demás suites del proyecto, comprobando exhaustivamente los 5 escenarios obligatorios:

| # | Prueba Obligatoria | Procedimiento de Prueba | Resultado Obtenido | Estado |
|---|---|---|---|:---:|
| **1** | **Recuperar `sessionToken` con `visitorId` ajeno** | Un atacante lista `/api/sessions` y consulta `/api/sessions/:id` modificando `x-visitor-id`. | Listados nunca exponen `sessionToken`. Acceso a detalle sin token de posesión responde `401 Unauthorized`. | **APROBADO** |
| **2** | **Consultar historial sin credencial válida** | Peticiones a `/api/sessions/:id` sin cabecera, con token en URL (`?token=`), y con token falso. | Sin cabecera: `401`. Token en URL: `401`. Token falso: `403`. Token en cabecera: `200 OK` (sin exponer token en JSON). | **APROBADO** |
| **3** | **Descargar archivos sin exponer tokens en URLs** | Petición con `?token=...` en URL vs petición con cabecera `x-session-token`. | En URL responde `401 Unauthorized`. Vía cabecera HTTP responde `200 OK` con tipo MIME correcto. | **APROBADO** |
| **4** | **Manipular cabeceras IP para evadir límites** | Envío de ráfagas manipulando el prefijo de `X-Forwarded-For` manteniendo la IP real al final agregada por el proxy de Render. | El servidor inspecciona la última IP confiable y activa el bloqueo `429 Too Many Requests` en la 4ta petición. | **APROBADO** |
| **5** | **Enviar claves de demo en query parameters** | Petición con `?key=...` y `?demoKey=...` vs peticiones con cabeceras `x-demo-key` o `Authorization: Bearer`. | Query params responden `401 Unauthorized` (*"No se admiten claves en la URL"*). Cabeceras responden `200 OK`. | **APROBADO** |

---

## 4. Evidencias de Validación Técnica

### 4.1 Compilación de Producción (`npm run build`)
```bash
> reto-01-registro-proveedor@1.0.0 build
> npm run web:build && tsc

✓ built in 3.00s (dist/index.html, assets/index-*.css, assets/index-*.js)
tsc finalizado sin errores de tipado en TypeScript estricto.
```

### 4.2 Suite de Pruebas Offline (`npm test`)
```bash
> reto-01-registro-proveedor@1.0.0 test
> tsx --test test/*.test.ts

✔ Prueba Obligatoria 1: Imposibilidad de obtener o enumerar sessionToken mediante visitorId ajeno o listado (27.3ms)
✔ Prueba Obligatoria 2: Consultar historial sin credencial válida (401 sin cabecera, 403 con credencial inválida) (5.7ms)
✔ Prueba Obligatoria 3: Descargar archivos sin exponer tokens en URLs (Rechazo de query params y descarga vía cabeceras) (105.2ms)
✔ Prueba Obligatoria 4: Rate Limiting resistente a manipulación de cabeceras IP en proxy reverso de Render (1 hop) (3.7ms)
✔ Prueba Obligatoria 5: Rechazo estricto de DEMO_ACCESS_KEY en query params y aceptación exclusiva por cabeceras (2.9ms)
✔ Aislamiento Estricto: Operaciones de confirmación y mensajería bloqueadas para visitantes ajenos (5.4ms)
✔ Protección de Consumo: Presupuesto Global de Tokens (Global Token Budget) (2.1ms)
...
ℹ tests 46 | pass 46 | fail 0 | cancelled 0 | duration_ms 3914.9ms
```

### 4.3 Demostración CLI Determinista (`npm run demo`)
```bash
> reto-01-registro-proveedor@1.0.0 demo
> tsx demo.ts

PRD-01: REGISTRO COMO PROVEEDOR — DEMO DETERMINISTA (ZERO-LLM)
✓ 4/4 casos procesados con 100% de coherencia y firma bloqueada por fecha real de soportes.
✓ Todos los artefactos físicos generados y validados.
```

### 4.4 Validación E2E en Navegador Real (`npm run test:e2e`)
```bash
> reto-01-registro-proveedor@1.0.0 test:e2e
> tsx test/e2e/browser-validation.ts

[1] Servidor Hono activo en http://localhost:3005
[2] /api/health OK: provider=mock, model=mock-deterministic-model
[3] Lanzando Google Chrome (Playwright)...
[9] Validando descargas de documentos generados...
  ✓ Tokens en URL query parameters rechazados con HTTP 401
  ✓ Artefactos verificados (xlsx, pdf, portal.md, checklist.md, borrador-correo.md)
[10] Validando Banner de Confirmación Humana y Seguridad...
  ✓ Confirmación cruzada bloqueada visualmente en UI
  ✓ UI bloquea operativamente el envío para paquetes con firma bloqueada
  ✓ Backend rechaza ratificación de paquete bloqueado con HTTP 400
  ✓ Verificación 'Invalid Date': 0 ocurrencias detectadas en el DOM
[12] Validando aislamiento entre dos navegadores independientes...
  ✓ Verificación de aislamiento en navegador: 0 cruces de sesión detectados
  ✓ Intento de acceso ajeno desde navegador B rechazado con HTTP 401
  ✓ Intento de descarga de artefacto ajeno desde navegador B rechazado con HTTP 401/403
================================================================================
   TODAS LAS PRUEBAS EN NAVEGADOR Y E2E FUERON EXITOSAS (0 errores críticos)
================================================================================
```

---

## 5. Conclusión y Veredicto Pre-Despliegue

Los tres hallazgos comprobados de seguridad han sido subsanados con rigor arquitectural, sin introducir dependencias superfluas ni alterar la experiencia funcional de los usuarios legítimos.

* **Estado de Sincronización:** Listo para confirmar cambios en Git y sincronizar con `origin/main`.
* **Despliegue en Render:** Se detiene la ejecución a la espera de la autorización explícita para el despliegue final.
