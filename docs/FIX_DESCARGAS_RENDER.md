# Corrección de Descargas en Producción (Render) — Separación de Credenciales

> **Proyecto:** PRD-01: Agente Conversacional "Registro como Proveedor" — Periferia IT Group  
> **Fecha:** 2026-10-28  
> **Entorno Afectado:** Render Production (`https://retoperxia-registro-proveedor.onrender.com`)  
> **Commit Afectado:** `a988172`  
> **Estado:** **CORREGIDO Y VERIFICADO (47/47 tests aprobados + E2E Playwright OK)**  

---

## 1. Descripción del Error Observado en Producción

Al desplegar en Render con la variable de entorno `DEMO_ACCESS_KEY` activa y procesar exitosamente el caso `co-industrias-delta` con Gemini 3.5 Flash-Lite real:
* Las 4 herramientas del agente ejecutaron correctamente.
* Los artefactos físicos (`formulario.xlsx`, `checklist.md`, `borrador-correo.md`) se generaron con éxito en disco.
* Al pulsar el botón de descarga de `formulario.xlsx` desde la interfaz React, la API devolvía un error HTTP 403:
  ```json
  {
    "ok": false,
    "error": "Acceso denegado: credencial de propietario inválida"
  }
  ```

---

## 2. Causa Raíz Identificada

El fallo se originaba por una confusión de cabeceras de autorización entre la autenticación de la plataforma demo y la autenticación propietaria de la sesión:

1. **En Frontend (`web/src/services/api.ts`):**  
   La función `getAuthHeaders()` inyectaba simultáneamente tres cabeceras cuando existían clave de demo y sesión activa:
   - `x-demo-key: <DEMO_ACCESS_KEY>`
   - `authorization: Bearer <DEMO_ACCESS_KEY>`
   - `x-session-token: <sessionToken>`

2. **En Backend (`src/server.ts`):**  
   El helper `extractSessionToken()` inspeccionaba la cabecera `authorization: Bearer ...` antes de `x-session-token`:
   ```typescript
   // Implementación anterior con error de precedencia
   const extractSessionToken = (c) => {
     const authHeader = c.req.header("authorization");
     if (authHeader && authHeader.startsWith("Bearer ")) {
       return authHeader.slice(7).trim(); // <- Extraía DEMO_ACCESS_KEY en vez de sessionToken
     }
     return c.req.header("x-session-token") || undefined;
   };
   ```

3. **Efecto de la Colisión:**  
   Al procesar la descarga en `GET /api/artifacts/:caso/:file`, el servidor tomaba el valor de `DEMO_ACCESS_KEY` creyendo que era el `sessionToken`. Luego, la validación de propiedad `session.validateToken(token)` comparaba el token real de la sesión contra la clave de demo, produciendo un rechazo legítimo pero equivocado: `Acceso denegado: credencial de propietario inválida` (HTTP 403).
   Esta misma confusión afectaba a las peticiones multi-turno en `/api/chat` y a la consulta de historial en `/api/sessions/:id`.

---

## 3. Corrección Arquitectural Implementada

Se aplicó una separación estricta e inequívoca entre la autenticación global de la demo y el token propietario de la sesión:

### 3.1 Frontend (`web/src/services/api.ts`)
* Se eliminó por completo la inyección de `authorization: Bearer ${demoKey}` en `getAuthHeaders()`.
* La clave de demostración se transmite **única y exclusivamente** mediante la cabecera HTTP `x-demo-key`.
* La credencial propietaria de la sesión se transmite mediante `x-session-token`.
* Ambas credenciales coexisten en el objeto de cabeceras sin interferencia mutua.

### 3.2 Backend (`src/server.ts`)
* Se reformuló `extractSessionToken()` otorgando **prioridad absoluta** a la cabecera `x-session-token`.
* Se incorporó una salvaguarda estricta: en caso de existir una cabecera `Authorization: Bearer <token>` (por clientes API externos o curl), el servidor valida primero si dicho token coincide con la clave de demostración mediante `guard.validateAccessKey(candidate)`. Si coincide, **NUNCA** se interpreta como token propietario de sesión (devolviendo `undefined` para que el endpoint exija el `x-session-token` y responda 401 si falta, en lugar de 403 por confusión).
* En `extractDemoKey()`, se otorga prioridad a `x-demo-key` y se mantiene soporte secundario para `Authorization: Bearer` en clientes CLI.

### 3.3 Preservación Íntegra de Controles de Seguridad
* Se mantuvieron todas las defensas en profundidad:
  * Prohibición absoluta de tokens o claves en URLs (`?token=`, `?sessionToken=`, `?key=`, `?demoKey=` -> HTTP 401).
  * Exigencia obligatoria de `sessionId` y coincidencia con la carpeta `out/sessions/<sessionId>/<caso>`.
  * Validación estricta de propiedad contra `session.validateToken()`.
  * Verificación de identidad con `visitorId` y firma criptográfica `x-visitor-token`.

---

## 4. Matriz de Pruebas de Regresión Ejecutadas

Se añadió la prueba formal en `test/visitor-isolation.test.ts`:
`Regresión Render: Separación estricta de DEMO_ACCESS_KEY y x-session-token en descargas, historial y multi-turno`.

| Escenario de Prueba | Cabeceras Transmitidas | Resultado Esperado | Resultado Real | Estado |
|---|---|---|---|:---:|
| **1. Descarga válida autorizada** | `x-demo-key: VALID` + `x-session-token: VALID` | HTTP 200 OK (`.xlsx`) | HTTP 200 OK | **APROBADO** |
| **2. Token de otra sesión** | `x-demo-key: VALID` + `x-session-token: OTHER` | HTTP 403 Forbidden | HTTP 403 Forbidden | **APROBADO** |
| **3. Token de sesión ausente** | `x-demo-key: VALID` (sin `x-session-token`) | HTTP 401 Unauthorized | HTTP 401 Unauthorized | **APROBADO** |
| **4. Clave de demo incorrecta** | `x-demo-key: INVALID` + `x-session-token: VALID` | HTTP 401 Unauthorized | HTTP 401 Unauthorized | **APROBADO** |
| **5. Descarga de artefactos Markdown** | `x-demo-key: VALID` + `x-session-token: VALID` | HTTP 200 OK (`checklist.md`, `borrador-correo.md`) | HTTP 200 OK | **APROBADO** |
| **6. Historial de sesión** | `x-demo-key: VALID` + `x-session-token: VALID` | HTTP 200 OK (mensajes recuperados) | HTTP 200 OK | **APROBADO** |
| **7. Multi-turno continuo** | `x-demo-key: VALID` + `x-session-token: VALID` en turnos 1 y 2 | HTTP 200 OK en ambos turnos | HTTP 200 OK | **APROBADO** |
| **8. Cliente externo con Bearer** | `Authorization: Bearer <KEY>` + `x-session-token: VALID` | HTTP 200 OK (prioridad a `x-session-token`) | HTTP 200 OK | **APROBADO** |
| **9. Cliente Bearer sin session token** | `Authorization: Bearer <KEY>` | HTTP 401 Unauthorized (no confunde con session token) | HTTP 401 Unauthorized | **APROBADO** |

---

## 5. Resultados de Validación Local (Modo Mock / Zero-LLM)

1. **Compilación de Producción (`npm run build`):**
   * Vite SPA: `web/dist` generado en 4.30s (0 errores).
   * TypeScript estricto backend (`tsc`): 0 errores.
2. **Suite de Pruebas Automatizadas (`npm test`):**
   * **47/47 pruebas aprobadas** (0 fallas, 0 canceladas, 4.18s).
   * Cero consumo de créditos de Gemini.
3. **Demostración CLI (`npm run demo`):**
   * 4/4 casos verificados en modo determinista con todas las reglas de negocio intactas.
4. **Validación E2E en Navegador Real (`npm run test:e2e`):**
   * Playwright + Google Chrome Headless: 13 pasos exitosos, 9 capturas visuales, 0 errores en consola.
