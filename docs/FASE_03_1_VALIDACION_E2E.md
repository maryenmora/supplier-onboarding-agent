# Informe de Validación Funcional y Visual E2E desde Navegador Real — Fase 3.1

> **Proyecto:** PRD-01: Agente Conversacional "Registro como Proveedor" — Periferia IT Group  
> **Fase:** 03.1 — Validación E2E en Navegador Real (Playwright + Google Chrome + Gemini Live)  
> **Fecha de Validación:** 2026-10-28  
> **Estado:** COMPLETADA Y VALIDADA AL 100% (0 ERRORES EN NAVEGADOR, 9 EVIDENCIAS CAPTURADAS)  

---

## 1. Objetivo y Alcance

Validar integralmente y de forma automatizada la experiencia visual, funcional, de seguridad y de integración del sistema desde un **navegador web real (Google Chrome headless vía Playwright)**, verificando que la aplicación React 19, el servidor backend Hono, las herramientas del PRD-01 y la integración con Google Gemini funcionen como un producto empresarial terminado y no como una simple compilación teórica.

---

## 2. Entorno y Configuración de Pruebas

- **Navegador Real:** Google Chrome `v156.0.8078.48` controlado mediante Playwright.
- **Servidor Backend:** Hono `@hono/node-server` en el puerto `3005`.
- **Frontend Servido:** SPA React 19 compilada mediante Vite en `web/dist`, servida directamente por Hono con middleware estático.
- **Resoluciones Verificadas:**
  - Escritorio: `1440 x 900 px`
  - Dispositivo Móvil (iPhone 12/13/14): `390 x 844 px`
- **Modelo LLM Real Evaluado:** `gemini-3.5-flash-lite` vía `@google/genai`.

---

## 3. Comandos de Validación Ejecutados

```bash
# 1. Compilación del Frontend SPA
npm run build --prefix web
# Resultado: 1596 módulos transformados, 0 errores, bundles generados en web/dist

# 2. Ejecución Completa de la Suite E2E desde Navegador Real
npm run test:e2e
# Comando interno: tsx test/e2e/browser-validation.ts
# Resultado: Código 0 (Todas las aserciones superadas, 0 excepciones de consola/página)

# 3. Verificación de Cero Regresiones en la Suite de Pruebas Unitarias Offline
npm run test
# Comando interno: tsx --test test/*.test.ts
# Resultado: 33 / 33 pruebas aprobadas en 5.0s (Cero consumo de tokens)

# 4. Demostración Determinista de Herramientas (CLI)
npm run demo
# Resultado: Código 0 (Integridad verificada en los 4 casos)
```

---

## 4. Evidencias Visuales Capturadas en `docs/evidencias/`

Se generaron 9 capturas reales en disco que documentan el ciclo completo:

| Archivo de Evidencia | Descripción y Elementos Verificados | Resolución |
|---|---|---|
| [`01_chat_inicial.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/01_chat_inicial.png) | **Carga inicial de la SPA:** Renderizado de los tres paneles, identidad visual de Periferia IT Group, mensaje de bienvenida del agente y tarjetas de acceso rápido a los 4 casos. | 1440x900 |
| [`02_tool_calls_expandidos.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/02_tool_calls_expandidos.png) | **Visor de Tool Calls:** Acordeón interactivo expandido mostrando argumentos validados por Zod y respuesta JSON estructurada de `proveedor_leer_solicitud`. | 1440x900 |
| [`03_caso_colombia_soportes.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/03_caso_colombia_soportes.png) | **Caso Colombia (`co-industrias-delta`):** Panel derecho con 17 campos llenos, soporte `camara_comercio` marcado como vencido y badge `FIRMA BLOQUEADA`. | 1440x900 |
| [`04_caso_ecuador.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/04_caso_ecuador.png) | **Caso Ecuador (`ec-corp-andina`):** Mapeo con 13 llenos, 1 faltante (`direccion`), 1 a confirmar (RUC extranjero), soporte tributario ausente y formato PDF. | 1440x900 |
| [`05_caso_honduras.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/05_caso_honduras.png) | **Caso Honduras (`hn-agroexport-sula`):** Mapeo con 9 llenos, 1 faltante (`telefono`), soportes `camara_comercio` y `parafiscales` vencidos, formato Excel. | 1440x900 |
| [`06_caso_panama.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/06_caso_panama.png) | **Caso Panamá (`pa-logistica-istmo`):** Mapeo con 8 llenos, 0 faltantes, 1 a confirmar, formato portal VendorHub (`valores-portal.md`). | 1440x900 |
| [`07_descarga_documentos.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/07_descarga_documentos.png) | **Centro de Descargas en UI:** Enlaces de descarga directa para formularios físicos (`.xlsx`, `.pdf`), guía de portal (`.md`), `checklist.md` y `borrador-correo.md`. | 1440x900 |
| [`08_confirmacion_humana.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/08_confirmacion_humana.png) | **Banner Human-in-the-Loop (RN4):** Tarjeta destacada de autorización previa requerida con botones "Confirmar y Simular Envío" y "Cancelar / Posponer". | 1440x900 |
| [`09_vista_responsive_movil.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/09_vista_responsive_movil.png) | **Diseño Responsive:** Adaptación fluida a pantalla móvil, sidebars colapsados en cajones laterales y controles hamburguesa. | 390x844 |

---

## 5. Resultados de los Cuatro Escenarios del PRD en la Interfaz

| Escenario | País | Formato Exigido | Campos Mapeados | Soportes Verificados | Estado Firma | Descarga Físicamente Comprobada |
|---|---|---|---|---|---|---|
| **Industrias Delta S.A.S.** | Colombia (`CO`) | Excel (`.xlsx`, 2 hojas) | 17 Llenos · 0 Faltantes · 0 Conf. | `camara_comercio`: Vencido (2026-09-30)<br>`rut`: Vigente<br>`certificacion_bancaria`: Vigente<br>`estados_financieros`: Vigente | 🔴 Bloqueado | `formulario.xlsx` (7,938 bytes) |
| **Corp. Andina de Servicios** | Ecuador (`EC`) | PDF (`.pdf`) | 13 Llenos · 1 Faltante (`direccion`) · 1 Conf. (`id_tributario` RUC) | `camara_comercio`: Vencido<br>`certificado_cumplimiento_tributario`: **Ausente** | 🔴 Bloqueado | `formulario.pdf` (2,784 bytes) |
| **Agroexport Sula S. de R.L.** | Honduras (`HN`) | Excel (`.xlsx`) | 9 Llenos · 1 Faltante (`telefono`) · 1 Conf. (`id_tributario` RTN) | `camara_comercio`: Vencido<br>`parafiscales`: Vencido (2026-08-31) | 🔴 Bloqueado | `formulario.xlsx` (7,058 bytes) |
| **Logística del Istmo S.A.** | Panamá (`PA`) | Portal VendorHub | 8 Llenos · 0 Faltantes · 1 Conf. (`id_tributario` RUC) | `camara_comercio`: Vencido | 🔴 Bloqueado | `valores-portal.md` (1,922 bytes) |

---

## 6. Prueba Conversacional E2E con Google Gemini Real

Se ejecutó una **única prueba en vivo controlada** con el modelo oficial `gemini-3.5-flash-lite`:

- **Prompt Enviado:**
  > *"Por favor procesa el registro como proveedor para el caso 'co-industrias-delta'. Lee la solicitud, mapea los campos, genera el formulario y arma el paquete. Explica si el paquete quedó listo para firma y por qué."*

- **Traza de Function Calling Real en Turnos Sucesivos:**
  1. `proveedor_leer_solicitud` `args: { caso: "co-industrias-delta" }`
  2. `proveedor_mapear_campos` `args: { caso: "co-industrias-delta", campos: [...] }`
  3. `proveedor_generar_formulario` `args: { caso: "co-industrias-delta", mapeo: {...} }`
  4. `proveedor_armar_paquete` `args: { caso: "co-industrias-delta" }`

- **Métricas Reales de Consumo (`usageMetadata`):**
  - **Prompt Tokens:** 15,618
  - **Completion Tokens:** 1,155
  - **Total Tokens Consumidos:** 16,773
  - **Tiempo de Ejecución:** 62.2 segundos (4 rondas de razonamiento y despacho de herramientas)

- **Respuesta Grounded del Modelo (Extracto Verificado):**
  > *"He procesado la solicitud para el caso `co-industrias-delta` (Cliente: Industrias Delta S.A.S., Colombia)... El paquete de registro fue armado exitosamente en `out/co-industrias-delta/paquete/` con el formulario `formulario.xlsx`, el checklist y el borrador de correo. Sin embargo, el paquete **NO está listo para firma (FIRMA BLOQUEADA)** debido a que el certificado de Cámara de Comercio se encuentra vencido con respecto a la fecha actual."*

---

## 7. Validación de Seguridad y Buenas Prácticas

1. **Defensa contra Envíos No Autorizados:**
   - La herramienta `simular_envio` verificó en el backend que no existiese un paquete apto para despacho (`listo_para_firma: false`), denegando la generación de `ENVIO-SIMULADO.md` de manera estricta.
2. **Protección de Datos Bancarios (RN2):**
   - El archivo descargado `out/co-industrias-delta/paquete/borrador-correo.md` fue inspeccionado bit a bit: **no contiene números de cuenta bancaria** (ej. `9876543210` o `1234567890`).
3. **Cero Exposición de Secretos:**
   - Ni la clave `GEMINI_API_KEY`, ni rutas absolutas no autorizadas, ni secretos fueron expuestos en el DOM, en la consola de Chrome ni en las respuestas de la API.
4. **Resistencia a Errores de Página:**
   - Playwright registró exactamente **0 errores de JavaScript** (`pageerror`) y **0 errores críticos de consola** durante la navegación por los cuatro casos.

---

## 8. Hallazgos y Correcciones Realizadas durante la Validación

1. **Colisión de Listener de Servidor en Tests:**
   - *Problema:* El archivo `src/server.ts` evaluaba `process.argv[1]?.includes("server")`, lo que provocaba que al ejecutar `tsx --test test/server.test.ts` intentara iniciar el listener de red en el puerto 3000.
   - *Corrección:* Se implementó `isDirectRun` excluyendo archivos `.test.` y verificando terminaciones explícitas (`server.ts` / `server.js`).
2. **Contrato de Argumentos en `proveedor_mapear_campos`:**
   - *Problema:* El simulador `MockAdapter` enviaba objetos completos `CampoIdentificado[]` en lugar del arreglo de strings `z.array(z.string())` requerido por `MapearCamposArgsSchema`.
   - *Corrección:* Se extrajeron únicamente las etiquetas (`c.etiqueta`) para garantizar el cumplimiento del esquema Zod.
3. **Sincronización de Estado Visual en Sidebar Derecho:**
   - *Problema:* La aserción de prueba esperaba la cadena `"BLOQUEADO"` textualmente mientras que el badge renderizaba `"FIRMA BLOQUEADA"`.
   - *Corrección:* Se alineó la aserción con la semántica del badge para validar el bloqueo legal de firma de forma robusta.

---

## 9. Matriz de Cumplimiento de Criterios (Fase 3.1)

| Requisito | Estado | Evidencia |
|---|---|---|
| Carga sin errores de JS ni red en navegador | **APROBADO** | Playwright Chrome: 0 `pageerror`, 0 `ConsoleError`. |
| Renderizado de los 3 paneles empresariales | **APROBADO** | [`docs/evidencias/01_chat_inicial.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/01_chat_inicial.png) |
| Ejecución y visualización de Tool Calls con JSON | **APROBADO** | [`docs/evidencias/02_tool_calls_expandidos.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/02_tool_calls_expandidos.png) |
| Comprobación caso Colombia (XLSX, 17 llenos, bloqueo) | **APROBADO** | [`docs/evidencias/03_caso_colombia_soportes.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/03_caso_colombia_soportes.png) |
| Comprobación caso Ecuador (PDF, 13 llenos, ausente) | **APROBADO** | [`docs/evidencias/04_caso_ecuador.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/04_caso_ecuador.png) |
| Comprobación caso Honduras (XLSX, 9 llenos, vencidos) | **APROBADO** | [`docs/evidencias/05_caso_honduras.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/05_caso_honduras.png) |
| Comprobación caso Panamá (Portal, 8 llenos, MD) | **APROBADO** | [`docs/evidencias/06_caso_panama.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/06_caso_panama.png) |
| Descarga y validación física de artefactos | **APROBADO** | [`docs/evidencias/07_descarga_documentos.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/07_descarga_documentos.png) |
| Banner interactivo de Confirmación Humana (RN4) | **APROBADO** | [`docs/evidencias/08_confirmacion_humana.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/08_confirmacion_humana.png) |
| Adaptación responsiva móvil (390x844) | **APROBADO** | [`docs/evidencias/09_vista_responsive_movil.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/09_vista_responsive_movil.png) |
| Prueba E2E controlada con Gemini Flash-Lite | **APROBADO** | 4 tool calls reales ejecutados, 16,773 tokens registrados. |

---

## 10. Conclusión

La aplicación web y el agente han demostrado solvencia funcional y técnica plena en un entorno de navegador real con Google Chrome. Todas las reglas de negocio (RN1 a RN5), la interfaz React 19 y las herramientas de backend se encuentran perfectamente sincronizadas.

**Condición para avanzar:** El proyecto se encuentra formalmente listo para iniciar la **Fase 4 (Bonus Módulo Reutilizable `modulo/`, `SOLUCION.md` y `README.md`)**, sujeto a tu autorización.

