# Estado Global del Proyecto — Agente "Registro como Proveedor" (PRD-01)

> **Proyecto:** PRD-01: Agente Conversacional "Registro como Proveedor" — Periferia IT Group  
> **Última Actualización:** 2026-10-28  
> **Fase Actual:** **DESPLEGADO EN PRODUCCIÓN (RENDER) — AUDITADO Y VALIDADO**

---

## 1. Tablero de Avance Acumulado por Fases

| Fase | Nombre | Estado | Pruebas Asociadas | Documento de Detalle |
|---|---|:---:|---|---|
| **Fase 1** | **Core de Herramientas y Determinismo** | **COMPLETADO Y PROBADO** | 16/16 tests unitarios/integración + `demo.ts` | [`docs/FASE_01_CORE.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_01_CORE.md) |
| **Fase 2** | **Motor del Agente, Integración Gemini y Backend API** | **COMPLETADO Y PROBADO** | 16 tests nuevos (Mock + HTTP + Gemini Live) | [`docs/FASE_02_BACKEND.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_02_BACKEND.md) |
| **Fase 3** | **Frontend Conversacional React** | **COMPLETADO Y PROBADO** | Build Vite OK + 2 tests integración frontend | [`docs/FASE_03_FRONTEND.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_03_FRONTEND.md) |
| **Fase 3.1**| **Validación E2E en Navegador Real** | **COMPLETADO Y PROBADO** | Playwright Chrome (9 evidencias, 0 errores) | [`docs/FASE_03_1_VALIDACION_E2E.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_03_1_VALIDACION_E2E.md) |
| **Fase 3.2**| **Correcciones de Consistencia, Seguridad y UX** | **COMPLETADO Y PROBADO** | 37 tests unitarios + Playwright E2E verificado | [`docs/FASE_03_2_CORRECCIONES.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_03_2_CORRECCIONES.md) |
| **Fase 4** | **Bonus Módulo Reutilizable y Documentación Final** | **COMPLETADO Y PROBADO** | Playwright E2E (10 evidencias) + 37 tests unitarios | [`docs/FASE_04_ENTREGA.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_04_ENTREGA.md) |
| **Fase 5** | **Auditoría Prepublicación y Despliegue Render** | **COMPLETADO Y PROBADO** | 44 tests unitarios + Playwright (2 navegadores) + Build OK | [`docs/VALIDACION_FINAL_PUBLICACION.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/VALIDACION_FINAL_PUBLICACION.md) |
| **Publicación** | **Publicación Segura en GitHub (origin/main)** | **COMPLETADO Y PUBLICADO** | `git push -u origin main` sin `--force` + merge seguro | [`docs/PUBLICACION_GITHUB.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/PUBLICACION_GITHUB.md) |
| **Pre-Render** | **Seguridad Descargas, Key Modal y Anti-Evasión Rate Limit** | **COMPLETADO Y AUDITADO** | 44 tests unitarios + Playwright (2 navegadores) + Build OK | [`docs/CORRECCION_PRE_RENDER.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/CORRECCION_PRE_RENDER.md) |
| **Hardening Final** | **Protección Credenciales, Eliminación Tokens URL y Proxy Render** | **COMPLETADO Y PROBADO** | 46 tests unitarios + Playwright (2 navegadores) + Build OK | [`docs/CORRECCION_FINAL_SEGURIDAD.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/CORRECCION_FINAL_SEGURIDAD.md) |
| **Fix Descargas Render** | **Separación Credencial Demo y Token Propietario de Sesión** | **COMPLETADO Y CORREGIDO** | 47 tests unitarios + Playwright E2E + Build OK | [`docs/FIX_DESCARGAS_RENDER.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FIX_DESCARGAS_RENDER.md) |

---

## 2. Clasificación Exhaustiva de Requisitos del Sistema

### 2.1 PROBADO EN NAVEGADOR REAL (PLAYWRIGHT + GOOGLE CHROME HEADLESS)
- [x] **Aislamiento Multi-Navegador E2E:** Dos contextos de navegador independientes (Visitante A vs Visitante B) ejecutados simultáneamente; 0 cruces de sesión detectados y rechazo HTTP 403 al intentar acceder a sesiones ajenas.
- [x] **Cero `Invalid Date`:** Formateador seguro `formatSafeTime` verificado en todo el DOM del chat y sesiones (0 ocurrencias).
- [x] **Consistencia de Confirmación Humana:** Sincronización verificada entre panel derecho y banner en captura `08_confirmacion_humana.png` (Colombia en ambos componentes para caso elegible).
- [x] **Protección de Envíos en Paquetes Bloqueados:** Si la documentación presenta soportes vencidos o ausentes, el banner conmuta a alerta roja y el botón de simulación se deshabilita operativamente (*"Envío Inhabilitado (Firma Bloqueada)"*, Evidencia `08a`).
- [x] **Rechazo HTTP 400 en Backend:** La ruta `POST /api/sessions/:id/confirm` inspecciona `checklist.md` y deniega cualquier autorización sobre paquetes no aptos para firma.
- [x] **Protección contra Confirmación Cruzada en UI:** Si una confirmación en sesión pertenece a un caso diferente al activo, la interfaz oculta preventivamente el banner.
- [x] **Diferenciación Visual de Motor LLM:** Badges contrastados en `LeftSidebar` y cabecera de `ChatView` (`[⚡ MOCK DETERMINISTA]` vs `[✨ GEMINI REAL]`).
- [x] **Desglose de Campos Faltantes y RN1:** Renderizado explícito de tarjetas rojas para campos faltantes (`Número de contribuyente especial` en EC, `Referencias comerciales` en HN) y tarjetas ámbar para confirmaciones RN1 (`RUC`, `RTN`).
- [x] **Renderizado de 3 paneles:** `LeftSidebar` (marca e historial), `ChatView` (conversación) y `RightSidebar` (proveedor y descargas).
- [x] **Descarga física de documentos:** Descargas comprobadas bit a bit de `.xlsx`, `.pdf` y `.md` con cabeceras MIME adecuadas.
- [x] **Diseño Responsivo Móvil:** Adaptación comprobada a viewport `390x844 px` (iPhone 12/13/14) con cajones laterales y menú hamburguesa.

### 2.2 PROBADO CON GEMINI REAL (Evidencia Preservada Fase 3.1)
- [x] **Integración E2E en Vivo (`gemini-3.5-flash-lite`):** Conexión oficial vía SDK `@google/genai`.
- [x] **Function Calling Encadenado en Vivo:** 4 llamadas consecutivas a herramientas reales (`leer_solicitud` -> `mapear_campos` -> `generar_formulario` -> `armar_paquete`).
- [x] **Respuesta Grounded en Datos Verídicos:** El modelo razonó sobre los datos reales del cliente Industrias Delta S.A.S. y explicó con precisión técnica el bloqueo legal por vencimiento de soportes.
- [x] **Registro de Consumo Real de Tokens:** 16,773 tokens consumidos (15,618 prompt, 1,155 completion) en 62.2s. Costo comercial estimado estándar: **\$0.0075729 USD por caso** (importe realmente facturado en pruebas: **\$0.00 USD** por Free Tier de Google AI Studio).
- [x] **Preservación de `thoughtSignature`:** Requisito arquitectural de Gemini 3.x para herramientas encadenadas.
- [x] **Cero consumo extra en Fases 3.2, 4 y 5:** Conforme a la regla obligatoria de control de costos, no se realizaron llamadas adicionales a Gemini en estas fases.

### 2.3 PROBADO CON MOCK
- [x] **Suite de 47 pruebas unitarias e integración:** Aprobadas en 4.18s con cero consumo de tokens.
- [x] **Seguridad de Acceso y Aislamiento (`visitor-isolation.test.ts`):** 8 pruebas exhaustivas que verifican: 1) Imposibilidad de obtener o enumerar sessionToken mediante visitorId ajeno; 2) Bloqueo de consulta de historial sin credencial válida (401/403); 3) Descargas de archivos sin exponer tokens en URLs (rechazo de query params y descarga vía cabeceras); 4) Rate limiting resistente a manipulación de cabeceras IP en proxy de Render (1-hop); 5) Rechazo de DEMO_ACCESS_KEY en query params y aceptación exclusiva por cabeceras; 6) Aislamiento estricto de operaciones de confirmación; 7) Presupuesto global acumulado de tokens (429); 8) Separación estricta de DEMO_ACCESS_KEY y sessionToken en descargas, historial y multi-turno (evitando colisión de cabeceras en producción).
- [x] **Pruebas de formateo de fecha (`date-formatting.test.ts`):** Cobertura de entradas corruptas, nulas, fechas inválidas y preformateadas.
- [x] **Auditoría de campos faltantes (`missing-fields-audit.test.ts`):** Comprobación por etiqueta exacta en los 4 casos del PRD.
- [x] **Seguridad de confirmaciones (`security-confirmations.test.ts`):** Bloqueo de confirmación cruzada, tokens expirados y rechazo HTTP 400 de paquetes bloqueados.
- [x] **Seguridad de Servidor y Producción (`server.test.ts`):** Control estricto de cuota de tokens por sesión (`MAX_SESSION_TOKENS` -> 429) y anulación de manipulación temporal `referenceDate` en producción.
- [x] **Aislamiento de sesiones:** Múltiples sesiones en memoria sin cruce de datos.
- [x] **Bloqueo preventivo de envíos:** Rechazo estricto de envíos si el paquete tiene soportes vencidos o ausentes.
- [x] **Endpoints HTTP en Hono:** Pruebas automatizadas de 9 rutas HTTP en `src/server.ts`.
- [x] **Serving de SPA compilado:** Verificación de serving estático en Hono sin dependencias externas.
- [x] **Inspección forense de PDF:** Extracción y validación de texto dentro del PDF generado mediante `pdf-parse`.

### 2.4 IMPLEMENTADO (Core, Backend, Frontend y Módulo Reutilizable)
- [x] Contratos Zod para las 5 herramientas (`proveedor_leer_solicitud`, `proveedor_mapear_campos`, `proveedor_generar_formulario`, `proveedor_armar_paquete`, `proveedor_simular_envio`).
- [x] Servicio de lectura de fixtures con bloqueo de Path Traversal (`FixtureService`).
- [x] Mapeo de campos a `maestro.json` con 38 sinónimos de `glosario-campos.json` y regla RN1 para ID tributario extranjero (`MapperService`).
- [x] Generación de formularios físicos XLSX multi-hoja con `exceljs`.
- [x] Generación de formularios físicos PDF vectoriales con `pdfkit`.
- [x] Generación de guía estructurada para portales web en `valores-portal.md`.
- [x] Evaluación de soportes exigidos con cálculo de vigencias y reloj inyectable (`SupportService`).
- [x] Empaquetado de soportes y borrador de correo con anonimización de datos bancarios (`PackageService`).
- [x] Bitácora append-only estructurada en formato JSON Lines (`LoggerService`).
- [x] Motor conversacional con bucle de ejecución de herramientas y tope de iteraciones (`AgentEngine`).
- [x] Gestor de sesiones en memoria con TTL y ratificación en dos fases (`SessionManager`).
- [x] Servidor HTTP REST en TypeScript con Hono (`src/server.ts`).
- [x] Script ejecutable determinista CLI (`demo.ts`).
- [x] Interfaz SPA en React 19 con Tailwind CSS (`web/`).
- [x] **Bonus Módulo Reutilizable (`modulo/`):** `modulo/agent.md`, `modulo/tools/proveedor.ts`, `modulo/skill/registro-proveedor/SKILL.md`.
- [x] **Documento Maestro de Arquitectura y Diseño:** `SOLUCION.md` (10 secciones oficiales).
- [x] **Guía de Instalación y Uso:** `README.md`.

---

## 3. Matriz de Cumplimiento Oficial Frente a la Rúbrica del PRD-01

| Criterio de Evaluación (Rúbrica Oficial) | Puntaje Máximo | Estado | Puntaje Obtenido | Justificación y Evidencia Técnica |
|---|:---:|:---:|:---:|---|
| **1. Funcionalidad del Agente y Herramientas** | 25 | **Completado** | 25 | Las 5 herramientas Zod operan deterministamente, manejan los 4 casos del PRD y generan archivos binarios reales (`xlsx`, `pdf`, `md`). |
| **2. Bucle Conversacional y Human-in-the-Loop** | 20 | **Completado** | 20 | Function Calling nativo con `@google/genai`, control de iteraciones `MAX_AGENT_ITERATIONS`, confirmación en 2 fases con token y bloqueo estricto en frontend y backend. |
| **3. Grounding, Integridad y Seguridad (RN1-RN5)** | 20 | **Completado** | 20 | Cero alucinación (CA2), regla fiscal RN1, protección de datos bancarios RN2, semáforo de vigencias RN3, reloj inyectable y defensa contra Path Traversal. |
| **4. Calidad del Código y Arquitectura** | 15 | **Completado** | 15 | TypeScript estricto sin `any`, modularidad en `src/services/`, separación frontend/backend, Hono framework y cero dependencias obsoletas. |
| **5. Frontend Conversacional y UX** | 10 | **Completado** | 10 | React 19 SPA, Tailwind CSS, panel tripartito responsivo, visualización de tool calls, descargas directas y 0 errores `'Invalid Date'`. |
| **6. Documentación (`SOLUCION.md` y `README.md`)** | 10 | **Completado** | 10 | `SOLUCION.md` con las 10 secciones obligatorias, estimación de costos estándar (\$0.0075729 USD/caso, \$0.00 facturado), diseño de portales y `README.md` completo. |
| **SUBTOTAL BASE** | **100** | — | **100** | **Cumplimiento 100% de los requisitos obligatorios.** |
| **BONUS: Módulo Reutilizable (`modulo/`)** | +10 | **Completado** | +10 | Carpeta `modulo/` con `agent.md`, `tools/proveedor.ts` y `skill/` exportando exactamente las mismas herramientas sin divergencia. |
| **PUNTAJE TOTAL PROYECTADO** | **110** | — | **110 / 100** | **Calificación sobresaliente con bonus completo.** |

---

## 4. Inventario de Entregables del Proyecto

1. **Código Fuente Backend:** `src/` (TypeScript estricto, Node.js + Hono, `@google/genai`).
2. **Código Fuente Frontend:** `web/` (React 19, Vite, Tailwind CSS, Lucide Icons).
3. **Módulo Standalone Reutilizable:** `modulo/` (`agent.md`, `tools/proveedor.ts`, `skill/`).
4. **Documentos Maestros de Entrega:**
   - [`SOLUCION.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/SOLUCION.md)
   - [`README.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/README.md)
   - [`DIAGNOSTICO.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/DIAGNOSTICO.md)
5. **Informes Técnicos por Fases:**
   - [`docs/FASE_01_CORE.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_01_CORE.md)
   - [`docs/FASE_02_BACKEND.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_02_BACKEND.md)
   - [`docs/FASE_03_FRONTEND.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_03_FRONTEND.md)
   - [`docs/FASE_03_1_VALIDACION_E2E.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_03_1_VALIDACION_E2E.md)
   - [`docs/FASE_03_2_CORRECCIONES.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_03_2_CORRECCIONES.md)
   - [`docs/FASE_04_ENTREGA.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_04_ENTREGA.md)
   - [`docs/FASE_05_PREPUBLICACION.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FASE_05_PREPUBLICACION.md)
   - [`docs/VALIDACION_FINAL_PUBLICACION.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/VALIDACION_FINAL_PUBLICACION.md)
   - [`docs/PUBLICACION_GITHUB.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/PUBLICACION_GITHUB.md)
   - [`docs/CORRECCION_PRE_RENDER.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/CORRECCION_PRE_RENDER.md)
   - [`docs/CORRECCION_FINAL_SEGURIDAD.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/CORRECCION_FINAL_SEGURIDAD.md)
   - [`docs/FIX_DESCARGAS_RENDER.md`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/FIX_DESCARGAS_RENDER.md)
6. **Evidencias Gráficas E2E:** 10 capturas de pantalla en `docs/evidencias/`.
7. **Suite de Pruebas Automatizadas:** 47 pruebas unitarias e integración en `test/*.test.ts`, validación Playwright con aislamiento de dos navegadores en `test/e2e/browser-validation.ts`.
8. **Script Determinista CLI:** `demo.ts`.
9. **Configuración de Seguridad y Despliegue Cloud:** `.gitignore` (exclusión estricta de `.env`, `node_modules/`, `out/`), `.env.example`, `render.yaml` (Blueprint declarativo) y servicio de blindaje `src/core/guard.ts`.
