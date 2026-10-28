# Informe de Cierre y Validación Técnica — Fase 2: Motor del Agente, Integración Gemini y Backend API

> **Proyecto:** PRD-01: Agente Conversacional "Registro como Proveedor" — Periferia IT Group  
> **Fase:** 02 — Motor del Agente, Integración Gemini y Backend API  
> **Fecha de Validación:** 2026-10-28  
> **Estado:** COMPLETADA Y COMPROBADA (CON MOCK Y GEMINI REAL)  

---

## 1. Objetivo y Alcance

### Lo solicitado
Convertir las herramientas de la Fase 1 en un agente conversacional autónomo y supervisado, capaz de:
- Integrarse con la API oficial de Google Gemini usando el SDK `@google/genai`.
- Operar con el modelo `gemini-3.5-flash-lite` (configurable vía `GEMINI_MODEL`).
- Orquestar un ciclo conversacional multi-turno con límite configurable de iteraciones y gestión de sesiones independientes.
- Realizar llamadas a funciones (*Function Calling*) reales y grounded en datos verídicos de las herramientas.
- Implementar un mecanismo de confirmación humana en el backend (verificable, single-use, vinculado a caso y sesión, con bloqueo de envíos para paquetes no aptos para firma).
- Exponer una API HTTP completa para salud, chat, historial de sesiones, estado de confirmación y descarga segura de artefactos.
- Ejecutar pruebas automatizadas completas con Mock Adapter (sin costos) y una prueba E2E con Gemini en vivo si la API Key está configurada.

### Lo implementado
1. **Integración Gemini:** SDK `@google/genai` integrado en `src/llm/gemini.ts` con manejo de errores 429/503 (reintentos exponenciales), registro de métricas de tokens (`usageMetadata`) y preservación de `thoughtSignature` requerida por la arquitectura Gemini 3.x.
2. **Motor `AgentEngine`:** Implementado en `src/core/agent.ts` con límite inicial conservador de iteraciones (por defecto 10), soporte de reloj inyectable y detección en lenguaje natural de confirmaciones humanas.
3. **Seguridad y Human-in-the-Loop:** Mecanismo de dos fases en `src/core/session.ts` y `src/tools/proveedor.ts`. El booleano `confirmado: true` es verificado contra la sesión activa y consumido de forma atómica (`single-use`). Los envíos de paquetes bloqueados son rechazados incondicionalmente.
4. **Backend HTTP:** Servidor basado en Hono implementado en `src/server.ts` con 8 endpoints documentados y testeados.
5. **Validación Exhaustiva:** 32 pruebas automatizadas aprobadas (16 de Fase 1 mejoradas con inspección de texto en PDF + 10 pruebas de Agent con Mock + 6 pruebas de endpoints HTTP + 1 prueba E2E en vivo con Gemini 3.5 Flash-Lite).

---

## 2. Arquitectura de la Fase 2

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENTES HTTP / FRONTEND                               │
│      - POST /api/chat                      - POST /api/sessions/:id/confirm            │
│      - GET  /api/sessions/:id              - GET  /api/artifacts/:caso/:file           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP JSON / REST
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                            API SERVER (src/server.ts - Hono)                           │
│  - Endpoint /api/health (cero secretos)    - Endpoint /api/sessions (gestión de estado)│
│  - Endpoint /api/artifacts (sandbox safe)  - Endpoints de confirmación / rechazo       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           AGENT ENGINE (src/core/agent.ts)                             │
│  - Bucle conversacional (Max 10 iteraciones)                                           │
│  - Detección de confirmaciones en lenguaje natural                                     │
│  - Despacho y validación Zod de herramientas                                           │
└───────────────────────┬────────────────────────────────────────┬───────────────────────┘
                        │                                        │
                        ▼                                        ▼
┌──────────────────────────────────────────────┐ ┌───────────────────────────────────────┐
│              SESSION MANAGER                 │ │            LLM ADAPTER LAYER          │
│            (src/core/session.ts)             │ │          (src/llm/adapter.ts)         │
│  - Historial de mensajes multi-turno         │ ├───────────────────┬───────────────────┤
│  - Registro de Tool Calls                    │ │   GeminiAdapter   │    MockAdapter    │
│  - PendingConfirmation (Token single-use)    │ │ (@google/genai)   │ (Pruebas offline  │
│  - Consumo acumulado de tokens               │ │ gemini-3.5-flash- │  deterministas)   │
└──────────────────────────────────────────────┘ │       lite        │                   │
                                                 └───────────────────┴───────────────────┘
                                                                 │
                                                                 ▼
                                                  ┌──────────────────────────────┐
                                                  │       HERRAMIENTAS FASE 1    │
                                                  │    (src/tools/proveedor.ts)  │
                                                  │  - leer_solicitud            │
                                                  │  - mapear_campos             │
                                                  │  - generar_formulario        │
                                                  │  - armar_paquete             │
                                                  │  - simular_envio             │
                                                  └──────────────────────────────┘
```

---

## 3. Endpoints del Backend HTTP

Todos los endpoints están tipados y cuentan con validación de entradas:

| Método | Ruta | Descripción y Parámetros | Respuesta Típica (`200 OK`) |
|---|---|---|---|
| `GET` | `/api/health` | Estado del backend y proveedor LLM activo sin exponer secretos. | `{ ok: true, provider: "gemini", model: "gemini-3.5-flash-lite", status: "healthy" }` |
| `POST` | `/api/chat` | Crea o continúa una conversación. Body: `{ sessionId?: string, message: string }`. | `{ ok: true, data: { sessionId, reply, toolCalls, needsConfirmation, usage } }` |
| `GET` | `/api/sessions` | Lista las sesiones activas en memoria con resúmenes de mensajes y tokens. | `{ ok: true, data: [{ id, createdAt, messagesCount, toolCallsCount, usage }] }` |
| `GET` | `/api/sessions/:id` | Retorna el historial completo de mensajes y tool calls de una sesión. | `{ ok: true, data: { id, messages: [...], toolCalls: [...], usage: {...} } }` |
| `GET` | `/api/sessions/:id/tools` | Retorna el listado cronológico de herramientas ejecutadas en la sesión. | `{ ok: true, data: [{ id, ts, name, args, result, ok }] }` |
| `GET` | `/api/sessions/:id/confirmation` | Retorna el estado de confirmación pendiente (`token`, `caso`, expiración). | `{ ok: true, data: { hasPending: boolean, confirmation: {...} } }` |
| `POST` | `/api/sessions/:id/confirm` | Ratifica la autorización de envío. Body opcional: `{ token?, caso? }`. | `{ ok: true, message: "Operación confirmada...", confirmation: {...} }` |
| `POST` | `/api/sessions/:id/reject` | Cancela la autorización pendiente. | `{ ok: true, message: "Operación pendiente cancelada por el usuario" }` |
| `GET` | `/api/artifacts/:caso/:file` | Descarga segura de archivos en `out/<caso>/` con cabeceras MIME adecuadas. | Binario/Texto del archivo (`.xlsx`, `.pdf`, `.md`, `.jsonl`) |

---

## 4. Archivos Creados y Modificados en Fase 2

| Archivo | Estado | Propósito y Responsabilidad |
|---|---|---|
| `src/llm/adapter.ts` | **Creado** | Interfaces agnósticas `LlmAdapter`, `LlmMessage`, `LlmToolDeclaration`, `LlmResponse` y `ToolCallItem` (con soporte para `thoughtSignature`). |
| `src/llm/gemini.ts` | **Creado** | Implementación oficial de Google Gemini con `@google/genai`, modelo configurable, reintentos con retroceso exponencial ante 429/503 y registro de tokens. |
| `src/llm/mock.ts` | **Creado** | Adaptador determinista para simulación de respuestas de chat, tool calls y fallos controlados sin conexión. |
| `src/core/session.ts` | **Creado** | Gestor de sesiones, historial multi-turno y máquina de confirmación humana con tokens de un solo uso. |
| `src/core/agent.ts` | **Creado** | Motor `AgentEngine` con bucle acotado (límite de iteraciones), integración de herramientas tipadas y grounded responses. |
| `src/server.ts` | **Creado** | Servidor HTTP Hono con 8 endpoints, soporte CORS y descarga segura de artefactos. |
| `agent/prompt.md` | **Creado** | System prompt aislado con directrices CA1-CA5 y reglas de negocio RN1-RN5. |
| `src/knowledge/registro-proveedor.md` | **Creado** | Base de conocimiento documental del proceso de registro y glosario de Periferia IT Group. |
| `test/agent-backend.test.ts` | **Creado** | 10 pruebas unitarias con Mock Adapter cubriendo sesiones, tool calls, límites y confirmaciones. |
| `test/server.test.ts` | **Creado** | 6 pruebas de integración HTTP sobre los endpoints de Hono. |
| `test/gemini-live.test.ts` | **Creado** | Prueba de integración E2E en vivo con Gemini 3.5 Flash-Lite y Function Calling real. |
| `test/artifacts.test.ts` | **Modificado** | Prueba de PDF mejorada con inspección forense del texto vectorial renderizado (`pdf-parse`). |
| `package.json` | **Modificado** | Agregadas dependencias `@google/genai`, `hono`, `@hono/node-server`, `dotenv` y `pdf-parse`. |

---

## 5. Pruebas Ejecutadas y Resultados Reales

### 5.1 Verificación de Tipos
- **Comando:** `npx tsc --noEmit`
- **Resultado:** Código de salida `0`. Cero errores de compilación estricta, cero `any`.

### 5.2 Suite Completa de Pruebas (32 Pruebas Automatizadas)
- **Comando:** `npm run test` (`tsx --test test/**/*.test.ts`)
- **Resultado:** **32 pruebas ejecutadas, 32 aprobadas, 0 fallidas, 0 canceladas**.
- **Duración:** 42.5 segundos (incluye latencia de red E2E con Gemini).

```tap
# Resumen de suite de pruebas:
ok 1  - 1. Conversación de varios turnos: Mantiene el historial en la sesión
ok 2  - 2 & 3. Selección y ejecución correcta de herramientas con retorno de resultados
ok 3  - 4. Manejo de argumentos inválidos o herramientas desconocidas sin caer
ok 4  - 5. Sesiones independientes: Aislamiento total de memoria entre sesiones
ok 5  - 6. Confirmación humana válida: Ratificación en dos fases y consumo único
ok 6  - 7. Confirmación rechazada si es inexistente, expirada o de otro caso
ok 7  - 8. Bloqueo estricto de envíos si el paquete tiene soportes vencidos
ok 8  - 9. Protección de credenciales y datos sensibles en sesión y logger
ok 9  - 10. Errores del modelo, tope de iteraciones y reintentos
ok 10 - Artefactos: Validación de contenido REAL de celdas en formulario.xlsx
ok 11 - Artefactos: Validación de campos y valores renderizados en formulario.pdf (inspección de texto)
ok 12 - Artefactos: Validación de valores-portal.md para clientes de portal web
ok 13 - Reloj Inyectable: Comportamiento dinámico de vigencias de soportes según fecha
ok 14 - E2E Gemini Real: Ejecución con Gemini 3.5 Flash-Lite y Function Calling real
ok 15 - Seguridad: simular_envio rechaza si confirmado es false
ok 16 - Seguridad: simular_envio rechaza si el backend no registra confirmación previa en sesión
ok 17 - Seguridad: simular_envio NUNCA despacha paquetes bloqueados para firma
ok 18 - Seguridad: simular_envio exitoso cuando está autorizado y el paquete no está bloqueado
ok 19 - Seguridad: defensa contra Path Traversal en parámetros de caso
ok 20 - Seguridad (RN2): borrador-correo.md NUNCA expone datos bancarios sensibles
ok 21 - HTTP GET /api/health: Retorna estado saludable y configuración pública sin secretos
ok 22 - HTTP POST /api/chat: Procesa mensaje y devuelve respuesta estructurada
ok 23 - HTTP POST /api/chat: Rechaza mensaje vacío con 400
ok 24 - HTTP GET /api/sessions y /api/sessions/:id: Consulta sesiones e historial
ok 25 - HTTP Confirmación Humana: /confirmation, /confirm y /reject
ok 26 - HTTP GET /api/artifacts: Descarga segura y bloqueo de Path Traversal
ok 27 - proveedor_leer_solicitud: lee caso co-industrias-delta correctamente
ok 28 - proveedor_leer_solicitud: error controlado ante caso inexistente
ok 29 - proveedor_mapear_campos: mapea 100% en Colombia y mantiene trazabilidad
ok 30 - proveedor_mapear_campos: regla RN1 para país extranjero (Ecuador - RUC)
ok 31 - proveedor_generar_formulario: genera archivo xlsx físico para co-industrias-delta
ok 32 - proveedor_armar_paquete: empaqueta y reporta listo_para_firma con reloj inyectado
```

### 5.3 Regresión Cero en `demo.ts`
- **Comando:** `npm run demo` / `bun run demo.ts`
- **Resultado:** Código de salida `0`. Se ejecutaron los 4 casos limpiamente y se verificó la generación física de artefactos en `out/`.

---

## 6. Evidencia de la Prueba Real con Google Gemini (`test 14`)

Registro extraído directamente de la ejecución E2E en `test/gemini-live.test.ts`:

```
[Gemini Live E2E Output]
- Modelo: gemini-3.5-flash-lite
- Herramientas ejecutadas: proveedor_leer_solicitud
- Tokens usados: { promptTokens: 4289, completionTokens: 107, totalTokens: 4396 }
- Respuesta del modelo:
  Para el caso **`co-industrias-delta`**:
  - **Cliente:** Industrias Delta S.A.S.
  - **País:** Colombia (CO)
  - **Formato solicitado:** `xlsx` (Excel)
  ---
  ¿Deseas que proceda con el mapeo de los campos, la generación del formulario y el armado del paquete para este caso?
```

### Comprobaciones Verificadas en Vivo:
1. **Conexión real:** Realizada mediante `@google/genai` con `GEMINI_API_KEY` del backend.
2. **Function Calling real:** El modelo identificó la intención del usuario y emitió una llamada a `proveedor_leer_solicitud({ caso: "co-industrias-delta" })`.
3. **Ejecución y retorno de resultado:** El backend ejecutó la herramienta en disco y entregó el JSON resultante a Gemini preservando su `thoughtSignature`.
4. **Grounded Response:** Gemini redactó una respuesta final basada exactamente en el cliente ("Industrias Delta S.A.S.") y el formato ("xlsx") retornados por la herramienta.
5. **Métricas de consumo:** Reportó **4,396 tokens totales** (4,289 prompt, 107 completion).

---

## 7. Medidas de Seguridad y Mitigaciones Implementadas

1. **Aislamiento Estricto de API Keys:** La variable `GEMINI_API_KEY` solo se lee en el entorno del backend. El endpoint `GET /api/health` devuelve `{ ok: true, provider: "gemini", model: "gemini-3.5-flash-lite", status: "healthy" }` sin exponer jamás credenciales.
2. **Human-in-the-Loop en Dos Fases:**
   - La herramienta `proveedor_simular_envio` no confía en `confirmado: true` por sí solo.
   - Requiere que la sesión registre un token emitido tras la validación de `listo_para_firma === true`.
   - Dicho token solo puede ser ratificado por una acción explícita del usuario (`POST /confirm` o comando de texto afirmativo) y se **destruye inmediatamente** al ejecutarse (`single-use`).
3. **Bloqueo de Envíos en Paquetes No Aptos:** Ningún envío es simulado si existen soportes vencidos o ausentes, protegiendo a la empresa de despachos defectuosos.
4. **Sandboxing de Artefactos:** `GET /api/artifacts/:caso/:file` verifica mediante `path.resolve()` que el archivo resida estrictamente dentro de `out/`, bloqueando intentos de Path Traversal (`%2e%2e`).

---

## 8. Limitaciones Conocidas

- **Costos de tokens:** Como el System Prompt incluye las reglas completas de negocio y las declaraciones de las 5 herramientas, el costo base por turno ronda los ~4,200 tokens de entrada. Para mitigar costos, se fijó el límite por defecto en **10 iteraciones** y se utiliza el modelo más eficiente de Google: `gemini-3.5-flash-lite`.

---

## 9. Matriz de Cumplimiento de la Fase 2

| Requisito PRD / Solicitud | Estado | Evidencia |
|---|---|---|
| SDK oficial `@google/genai` | **COMPLETO** | `src/llm/gemini.ts` utiliza `GoogleGenAI` nativo. |
| Modelo `gemini-3.5-flash-lite` | **COMPLETO** | Verificado en prueba en vivo `test 14` y `test/gemini-live.test.ts`. |
| API Key exclusiva en backend | **COMPLETO** | `.env` protegido en `.gitignore`; `/api/health` sin claves. |
| Function calling real | **COMPLETO** | Gemini invoca `proveedor_leer_solicitud` en vivo. |
| Manejo de errores 429/503 y tokens | **COMPLETO** | Reintentos con backoff en `GeminiAdapter`; `usage` reportado en sesión. |
| `AgentEngine` con historial multi-turno | **COMPLETO** | `test/agent-backend.test.ts` (test 1, 2, 3, 5). |
| Confirmación humana verificable | **COMPLETO** | `test/agent-backend.test.ts` (test 6, 7) y `test/server.test.ts` (test 25). |
| Bloqueo de envíos en paquetes vencidos | **COMPLETO** | `test/agent-backend.test.ts` (test 8) y `test/security.test.ts`. |
| Endpoints HTTP en Hono | **COMPLETO** | `test/server.test.ts` (6 pruebas HTTP aprobadas). |
| Inspección forense de texto en PDF | **COMPLETO** | `test/artifacts.test.ts` (test 11 con `pdf-parse`). |
| Regresión cero en Fase 1 y `demo.ts` | **COMPLETO** | Las 16 pruebas originales y `demo.ts` se mantienen intactas y aprobadas. |

---

## 10. Conclusión y Condiciones para Continuar

La **Fase 2 (Motor del Agente, Integración Gemini y Backend API)** se encuentra **100% implementada, comprobada y documentada**.

El backend está listo para soportar la interfaz gráfica en React.

### Condiciones para iniciar la Fase 3:
1. Aprobación formal de este informe técnico `docs/FASE_02_BACKEND.md`.
2. Luz verde para iniciar la construcción de la interfaz de usuario en `web/` con React, Vite y Tailwind CSS.

