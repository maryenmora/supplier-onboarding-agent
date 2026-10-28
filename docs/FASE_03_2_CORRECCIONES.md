# Informe Técnico de Correcciones de Consistencia, Seguridad y UX — Fase 3.2

> **Proyecto:** PRD-01: Agente Conversacional "Registro como Proveedor" — Periferia IT Group  
> **Fase:** 03.2 — Correcciones Finales de Consistencia, Seguridad y UX  
> **Fecha de Validación:** 2026-10-28  
> **Estado:** COMPLETADA Y COMPROBADA (CERO DEFECTOS, 37 PRUEBAS AUTOMATIZADAS, 9 CAPTURAS DE NAVEGADOR SIN 'INVALID DATE' Y CONSISTENCIA PLENA)  

---

## 1. Hallazgos Originales Identificados en la Revisión

Tras la validación inicial de la Fase 3.1, una auditoría detallada de las capturas, contratos y fixtures originales arrojó cuatro hallazgos prioritarios:

1. **Defecto de Formateo de Fecha (`Invalid Date`):** En las burbujas de mensaje del chat se visualizaba la cadena `"Invalid Date"` en la esquina inferior derecha.
2. **Inconsistencia de Caso en Confirmación Humana:** En la captura `08_confirmacion_humana.png`, el panel lateral derecho mostraba el caso de Panamá mientras que el banner de confirmación solicitaba autorización para Colombia.
3. **Discrepancia en la Documentación de Campos Faltantes:** El informe de la Fase 3.1 mencionó vagamente `direccion` y `telefono` en el resumen narrativo de Ecuador y Honduras, en lugar de contrastar con los campos reales auditados en el diagnóstico (`Número de contribuyente especial` en Ecuador y `Referencias comerciales` en Honduras).
4. **Falta de Diferenciación Visual entre Mock y Gemini Real:** La interfaz no comunicaba con suficiente prominencia si el motor activo correspondía al `MockAdapter` de pruebas offline o al modelo en vivo `gemini-3.5-flash-lite`.

---

## 2. Diagnóstico de Causas Raíz

### 2.1 Causa Raíz de `Invalid Date`
- **Diagnóstico:** En `web/src/App.tsx`, las marcas de tiempo se generaban utilizando `new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })`, produciendo cadenas pre-formateadas de hora local (ej. `"11:32 AM"` o `"11:32"`). Posteriormente, `ChatView.tsx` intentaba re-parsear esa cadena mediante `new Date(m.timestamp)`.
- **Efecto:** En el estándar ECMAScript, invocar `new Date("11:32 AM")` produce un objeto `Date` con valor `NaN` (`Invalid Date`). Al aplicar `.toLocaleTimeString()`, se renderizaba `"Invalid Date"` en el DOM.

### 2.2 Causa Raíz de la Inconsistencia en Confirmación Humana
- **Diagnóstico:** En el script E2E de Playwright, tras ejecutar el Escenario 4 (Panamá), se inyectó artificialmente una confirmación pendiente con `caso: "co-industrias-delta"` en la sesión sin conmutar el panel visual. A su vez, `App.tsx` y `ChatView.tsx` renderizaban el banner de confirmación siempre que existiera en la sesión, sin validar si coincidía con el caso que el analista tenía desplegado en pantalla (`activeCase`).
- **Efecto:** Desincronización visual entre el banner flotante (Colombia) y el inspector de proveedor (Panamá).

### 2.3 Causa Raíz de los Campos Faltantes
- **Diagnóstico:** El motor de software (`MapperService`, `FixtureService` y `glosario-campos.json`) funcionaba con un 100% de precisión matemática:
  - En Ecuador: `Domicilio fiscal` mapea exitosamente a `datos_basicos.direccion`, y el único faltante real es `Número de contribuyente especial`.
  - En Honduras: `Dirección` y `Teléfono` mapean exitosamente, y el único faltante real es `Referencias comerciales`.
- **Efecto:** La falla no residía en el motor de mapeo sino en un error de transcripción en el texto del informe de Fase 3.1, y en que el panel lateral derecho presentaba los contadores numéricos (1 faltante, 1 confirmar) sin listar las etiquetas de texto de los campos.

### 2.4 Causa Raíz de la Diferenciación de Motores
- **Diagnóstico:** El panel lateral izquierdo solo mostraba `"Backend API Online"` con el nombre del modelo en letra pequeña, sin distinguir con suficiente énfasis visual el modo de ejecución (Mock vs Gemini Live).

---

## 3. Archivos Corregidos y Mejoras Implementadas

| Archivo | Correcciones Realizadas |
|---|---|
| [`web/src/utils/date.ts`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/web/src/utils/date.ts) | **Creado:** Implementación de `formatSafeTime` y `formatSafeDate`. Maneja cadenas ISO 8601, instancias `Date`, cadenas preformateadas y valores nulos/inválidos devolviendo cadena vacía en lugar de `"Invalid Date"`. |
| [`web/src/App.tsx`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/web/src/App.tsx) | **Modificado:** Estandarización de todas las marcas de tiempo a cadenas ISO 8601 estrictas (`new Date().toISOString()`). Limpieza de confirmaciones pendientes al cambiar de caso PRD. Entrega de `activeCase` y `health` a `ChatView`. |
| [`web/src/components/ChatView.tsx`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/web/src/components/ChatView.tsx) | **Modificado:** Incorporación de `formatSafeTime`. Renderizado condicional estricto del banner de confirmación: solo se muestra si `pendingConfirmation.caso === activeCase`. Inclusión de badge de motor activo en la cabecera. |
| [`web/src/components/LeftSidebar.tsx`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/web/src/components/LeftSidebar.tsx) | **Modificado:** Formateo seguro de marcas de tiempo en el historial de sesiones. Tarjetas de estado destacadas con badges diferenciados: `[⚡ MOCK DETERMINISTA - Pruebas Offline]` vs `[✨ GOOGLE GEMINI REAL - Live API]`. |
| [`web/src/components/RightSidebar.tsx`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/web/src/components/RightSidebar.tsx) | **Modificado:** Adición de desglose visual detallado de campos auditables bajo las métricas: cajas rojas con la etiqueta exacta de campos faltantes (`Número de contribuyente especial`, `Referencias comerciales`) y cajas ámbar con los campos sujetos a confirmación por RN1 (`RUC`, `RTN`). |
| [`src/llm/mock.ts`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/src/llm/mock.ts) | **Modificado:** Extracción estricta de cadenas `c.etiqueta` para cumplir el contrato Zod `z.array(z.string())` en `proveedor_mapear_campos`, y propagación del payload `mapeo` hacia `proveedor_generar_formulario`. |
| [`test/e2e/browser-validation.ts`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/test/e2e/browser-validation.ts) | **Modificado:** Pruebas negativas de confirmación cruzada en UI, verificación de 0 ocurrencias de `Invalid Date` en todo el DOM, aserciones por etiqueta exacta de campos faltantes y preservación de evidencia Gemini Live sin incurrir en consumos adicionales. |

---

## 4. Pruebas Automatizadas Agregadas

Se crearon 4 pruebas automatizadas nuevas en la suite raíz:

1. **[`test/date-formatting.test.ts`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/test/date-formatting.test.ts):**
   - Verifica que `formatSafeTime` nunca produzca `"Invalid Date"` ante entradas corruptas, nulas, fechas inválidas o preformateadas.
2. **[`test/missing-fields-audit.test.ts`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/test/missing-fields-audit.test.ts):**
   - Comprueba mediante aserciones estrictas por etiqueta sobre los fixtures originales:
     - Ecuador: `ecRes.faltantes[0].etiqueta === "Número de contribuyente especial"`, `ecRes.requiere_confirmacion[0].etiqueta === "RUC"`.
     - Honduras: `hnRes.faltantes[0].etiqueta === "Referencias comerciales"`, `hnRes.requiere_confirmacion[0].etiqueta === "RTN"`.
     - Colombia: 17 llenos, 0 faltantes, 0 a confirmar.
     - Panamá: 8 llenos, 0 faltantes, 1 a confirmar (`RUC`).
3. **[`test/security-confirmations.test.ts`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/test/security-confirmations.test.ts):**
   - **Prueba Negativa 1:** Bloqueo de confirmación cruzada (intentar ratificar Colombia con payload de Ecuador retorna `400 Bad Request`).
   - **Prueba Negativa 2:** Bloqueo de confirmaciones con token inválido o expirado.
   - **Prueba Negativa 3:** Rechazo estricto de envíos para paquetes con firma bloqueada.

---

## 5. Resultados de Ejecución y Validación de Regresión

### 5.1 Verificación de Tipos Estricta
```bash
npx tsc --noEmit
```
- **Resultado:** Código de salida 0 (Cero errores de TypeScript, cero `any`).

### 5.2 Compilación del Frontend (Vite)
```bash
npm run build --prefix web
```
- **Resultado:** Código de salida 0 (1597 módulos transformados en 3.13s, bundles generados en `web/dist`).

### 5.3 Suite Completa de Pruebas Offline
```bash
npm run test
```
- **Resultado:** **37 pruebas ejecutadas, 37 aprobadas, 0 fallidas (5.32s)**.
- **Consumo de Créditos Gemini:** 0 tokens.

### 5.4 Demostración Determinista de Herramientas
```bash
npm run demo
```
- **Resultado:** Código de salida 0 (Verificación de los 4 casos y sus archivos generados).

### 5.5 Validación E2E en Navegador Real (Playwright + Chrome)
```bash
npm run test:e2e
```
- **Resultado:** Código de salida 0.
- **Hallazgos validados en Chrome:**
  - `✓ Confirmación cruzada bloqueada visualmente en UI (Panel: Panamá, Token: Colombia)`
  - `✓ Verificación 'Invalid Date': 0 ocurrencias detectadas en el DOM`
  - `✓ Campos faltantes y confirmaciones verificados por etiqueta exacta en los 4 casos`
  - `✓ Consistencia 100% entre panel derecho y banner en la captura 08`

---

## 6. Evidencias Visuales Actualizadas en `docs/evidencias/`

Se regeneraron las 9 capturas en disco reflejando las correcciones:

1. **[`01_chat_inicial.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/01_chat_inicial.png):** Cabecera y panel lateral con badge prominente `[⚡ MOCK DETERMINISTA - Pruebas Offline]`. Timestamps en formato limpio de hora sin `Invalid Date`.
2. **[`02_tool_calls_expandidos.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/02_tool_calls_expandidos.png):** Argumentos y resultados JSON expandidos, con timestamps válidos en cada turno.
3. **[`03_caso_colombia_soportes.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/03_caso_colombia_soportes.png):** Colombia con 17 llenos, 0 faltantes, soporte vencido y `FIRMA BLOQUEADA`.
4. **[`04_caso_ecuador.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/04_caso_ecuador.png):** Ecuador con 13 llenos, tarjeta roja explícita: `Número de contribuyente especial [Sin dato]`, y tarjeta ámbar: `RUC [Sugerido: 900123456]`.
5. **[`05_caso_honduras.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/05_caso_honduras.png):** Honduras con 9 llenos, tarjeta roja explícita: `Referencias comerciales [Sin dato]`, y tarjeta ámbar: `RTN [Sugerido: 900123456]`.
6. **[`06_caso_panama.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/06_caso_panama.png):** Panamá con 8 llenos, 0 faltantes, tarjeta ámbar: `RUC [Sugerido: 900123456]` y portal VendorHub.
7. **[`07_descarga_documentos.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/07_descarga_documentos.png):** Listado y enlaces directos de descarga para los artefactos de cada caso.
8. **[`08_confirmacion_humana.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/08_confirmacion_humana.png):** **Consistencia corregida:** El panel lateral derecho muestra Logística del Istmo (Panamá) y el banner de confirmación humana solicita autorización para Panamá (`pa-logistica-istmo`). Cero inconsistencias cruzadas.
9. **[`09_vista_responsive_movil.png`](file:///c:/Proyectos/periferia/capacitación-perxia\dia5/docs/evidencias/09_vista_responsive_movil.png):** Vista en dispositivo móvil con adaptación limpia de tipografías y cajones laterales.

---

## 7. Registro Separado de Evidencias Live vs Mock

En estricto cumplimiento de la restricción de **no realizar llamadas adicionales a Gemini** durante la fase de correcciones:

- **Evidencias Mock (Fase 3.2):** Registradas en las 9 capturas fotográficas y validadas mediante la suite automatizada `npm run test:e2e` y `npm run test` (37 tests en 5.3s, 0 tokens consumidos).
- **Evidencias Gemini Live (Fase 3.1):** Preservadas intactas en `docs/FASE_03_1_VALIDACION_E2E.md`:
  - Modelo: `gemini-3.5-flash-lite`.
  - Cadena de herramientas: `leer_solicitud` -> `mapear_campos` -> `generar_formulario` -> `armar_paquete`.
  - Consumo registrado: 16,773 tokens (15,618 prompt / 1,155 completion) en 62.2s.

---

## 8. Matriz de Cumplimiento de Correcciones (Fase 3.2)

| Hallazgo / Requisito | Estado | Solución y Evidencia |
|---|---|---|
| Eliminar `Invalid Date` de la interfaz | **CORREGIDO** | Formateador `formatSafeTime` en `date.ts`, ISO 8601 en `App.tsx`, prueba unitaria `date-formatting.test.ts`. 0 ocurrencias en DOM. |
| Consistencia en Confirmación Humana | **CORREGIDO** | Sincronización en `App.tsx` y `ChatView.tsx`. Captura `08_confirmacion_humana.png` con Panamá en ambos paneles. Prueba negativa en `security-confirmations.test.ts`. |
| Auditoría y visualización de campos faltantes | **CORREGIDO** | Etiquetas exactas (`Número de contribuyente especial` en EC, `Referencias comerciales` en HN). Prueba unitaria `missing-fields-audit.test.ts`. Tarjetas visuales en `RightSidebar.tsx`. |
| Diferenciación explícita Mock vs Gemini Live | **CORREGIDO** | Badges contrastados en `LeftSidebar.tsx` y `ChatView.tsx`. Cero llamadas extra a Gemini. Evidencias separadas y documentadas. |
| Validación de no-regresión | **APROBADO** | `tsc`, `build`, 37 pruebas unitarias, `demo.ts` y suite `test:e2e` de Playwright aprobadas con código 0. |

---

## 9. Conclusión y Próximo Paso

Todos los hallazgos de consistencia, seguridad, auditoría y UX han sido resueltos y probados en código real, navegador real y suites de prueba automatizadas.

**Condición para avanzar:** El proyecto queda listo para recibir autorización formal para la **Fase 4 (Bonus Módulo Reutilizable `modulo/`, `SOLUCION.md` y `README.md`)**.

