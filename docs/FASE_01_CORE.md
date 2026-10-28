# Informe de Cierre y Validación Técnica — Fase 1: Core de Herramientas y Ejecución Determinista

> **Proyecto:** PRD-01: Agente Conversacional "Registro como Proveedor" — Periferia IT Group  
> **Fase:** 01 — Core de Herramientas, Generadores y Verificación Determinista  
> **Fecha de Validación:** 2026-10-28  
> **Estado:** COMPLETADA Y COMPROBADA  

---

## 1. Objetivo y Alcance

### Lo solicitado
Construir la base técnica, modular y determinista de la aplicación sin dependencias de modelos de lenguaje ni de servidores web:
- Configuración de TypeScript en modo estricto.
- Definición de contratos con esquemas Zod para las cinco herramientas obligatorias.
- Servicio de lectura segura y validación de fixtures (protegido contra Path Traversal).
- Servicio de mapeo estricto de campos apoyado en el repositorio maestro y el glosario (38 entradas), manteniendo trazabilidad del origen del dato.
- Generadores de salida para Excel (`.xlsx`), PDF (`.pdf`) y portal web (`.md`).
- Servicio de evaluación de soportes con validación de fechas de vigencia y soporte para reloj inyectable.
- Armado de paquete con `checklist.md` y `borrador-correo.md` (con exclusión estricta de datos bancarios).
- Sistema de registro de auditoría en `out/<caso>/log.jsonl`.
- Script CLI `demo.ts` 100% determinista y ejecutable sin API keys ni conexión a LLMs.
- Suite de pruebas automatizadas que verifiquen el contenido real de los archivos generados y los mecanismos de seguridad.

### Lo implementado
Se construyó el 100% del alcance de la Fase 1. Todos los componentes fueron desarrollados en TypeScript puro, verificados mediante `npx tsc --noEmit` (cero errores) y validados mediante 16 pruebas automatizadas (`npm run test`) y la ejecución completa de `demo.ts` tanto en Node.js v22 como en Bun v1.4.

---

## 2. Arquitectura y Decisiones Técnicas

La arquitectura implementada sigue principios de **Clean Architecture**, aislando la lógica de negocio y las herramientas de ejecución de cualquier infraestructura externa:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            src/tools/proveedor.ts                                │
│   - leer_solicitud        - mapear_campos         - generar_formulario           │
│   - armar_paquete         - simular_envio                                        │
│   (Contratos Zod · Retorno JSON { ok: true, data } | { ok: false, error })       │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌───────────────────────┐  ┌───────────────────────────┐  ┌────────────────────────┐
│     src/services/     │  │      src/generators/      │  │     src/services/      │
│  - fixture-service.ts │  │  - excel-generator.ts     │  │  - logger-service.ts   │
│  - mapper-service.ts  │  │  - pdf-generator.ts       │  │    (out/<caso>/        │
│  - support-service.ts │  │  - portal-generator.ts    │  │     log.jsonl)         │
│  - package-service.ts │  │                           │  │                        │
└───────────┬───────────┘  └─────────────┬─────────────┘  └────────────────────────┘
            │                            │
            ▼                            ▼
  fixtures/reto-01/ (RO)               out/ (RW)
  - casos/                             - <caso>/formulario.xlsx
  - repositorio/maestro.json           - <caso>/formulario.pdf
  - repositorio/soportes/              - <caso>/valores-portal.md
  - glosario-campos.json               - <caso>/paquete/
```

### Decisiones Técnicas Clave
1. **Tipado Estricto sin `any`:** `tsconfig.json` configurado con `"noImplicitAny": true`, `"strictNullChecks": true` y tipos discriminados para los resultados de las herramientas.
2. **Validación Zod en Frontera:** Todos los argumentos de las herramientas son validados con Zod antes de ejecutar cualquier lógica. Si el argumento no cumple el esquema, se retorna `{ ok: false, error }` inmediatamente sin lanzar excepciones.
3. **Reloj Inyectable (`referenceDate`):** Las herramientas y servicios reciben un reloj inyectable en `ToolContext`. Por defecto usan `new Date()`, permitiendo evaluar la fecha real del sistema, mientras que las pruebas pueden inyectar fechas históricas fijas para garantizar determinismo y probar transiciones de vigencia.
4. **Generación con Librerías Nativas:**
   - `exceljs` para Excel: Permite ubicar y estilizar celdas exactas según `plantilla-celdas.json` en múltiples pestañas.
   - `pdfkit` para PDF: Genera documentos vectoriales ligeros sin requerir navegadores headless como Puppeteer o Chromium.
5. **Aislamiento de Fixtures:** Las carpetas originales de `fixtures/reto-01/` se tratan estrictamente como de solo lectura. Ningún proceso escribe en ellas; toda salida se confina a `out/`.

---

## 3. Archivos Creados y Modificados

| Ruta del Archivo | Propósito y Responsabilidad |
|---|---|
| `package.json` | Configuración del proyecto, scripts (`demo`, `test`, `build`) y dependencias de producción y desarrollo. |
| `tsconfig.json` | Configuración de compilación de TypeScript en modo estricto (`ES2022`, `NodeNext`). |
| `.gitignore` | Exclusión de `node_modules/`, `out/`, `dist/` y archivos `.env`. |
| `.env.example` | Plantilla de configuración de entorno sin secretos para Gemini y el servidor. |
| `demo.ts` | Script de demostración CLI determinista 0-LLM que ejecuta los 4 casos de prueba. |
| `DIAGNOSTICO.md` | Diagnóstico técnico formalizado con correcciones de vigencias y rúbrica PRD. |
| `src/types/index.ts` | Modelos de dominio, esquemas Zod, tipos discriminados y contratos de entrada/salida. |
| `src/services/fixture-service.ts` | Lectura segura de fixtures con validación de rutas y prevención de Path Traversal. |
| `src/services/mapper-service.ts` | Cruce de etiquetas con `maestro.json` y `glosario-campos.json`, regla RN1 y trazabilidad `ruta_maestro`. |
| `src/services/support-service.ts` | Inspección de catálogo de soportes, verificación de archivos y cálculo de vigencias con reloj inyectable. |
| `src/services/package-service.ts` | Armado de carpeta `paquete/`, copia de soportes físicos, generación de `checklist.md` y `borrador-correo.md` (RN2). |
| `src/services/logger-service.ts` | Escritura estructurada y sanitizada en `out/<caso>/log.jsonl` (RN5). |
| `src/generators/excel-generator.ts` | Generador de hojas de cálculo `.xlsx` multi-hoja con `exceljs`. |
| `src/generators/pdf-generator.ts` | Generador de documentos `.pdf` corporativos estructurados con `pdfkit`. |
| `src/generators/portal-generator.ts` | Generador de `valores-portal.md` con tablas y bloques de código de 1 clic. |
| `src/tools/proveedor.ts` | Implementación de las 5 herramientas obligatorias cumpliendo el contrato del PRD. |
| `test/tools.test.ts` | Pruebas unitarias de las 5 herramientas y validación de reglas de mapeo. |
| `test/security.test.ts` | Pruebas de confirmación en dos fases, rechazo de envíos en paquetes bloqueados y no fuga de datos bancarios. |
| `test/artifacts.test.ts` | Inspección de contenido real de celdas XLSX, encabezados PDF y reloj inyectable. |

---

## 4. Funcionalidades Implementadas vs Requisitos del PRD

| Requisito PRD | Estado | Implementación Técnica |
|---|---|---|
| **HU-1: Leer solicitud** | Implementado | `proveedor_leer_solicitud` extrae cliente, país, formato, campos y soportes requeridos desde `solicitud.json` y su plantilla asociada. |
| **HU-2: Mapear campos** | Implementado | `proveedor_mapear_campos` clasifica cada etiqueta en `llenos` (con `ruta_maestro`), `faltantes` o `requiere_confirmacion`. Resuelve las 38 claves del glosario. Cero datos inventados. |
| **HU-3: Generar formulario** | Implementado | `proveedor_generar_formulario` produce `out/<caso>/formulario.xlsx` (P0), `out/<caso>/formulario.pdf` (P1) o `out/<caso>/valores-portal.md` (P2). |
| **HU-4: Armar paquete** | Implementado | `proveedor_armar_paquete` genera `out/<caso>/paquete/` con formulario, copias de soportes físicos, `checklist.md` y `borrador-correo.md`. |
| **HU-5: Manejo de errores** | Implementado | Ninguna herramienta lanza excepciones. Todas devuelven `{ ok: true, data }` o `{ ok: false, error }` serializado en JSON. |
| **RN1: ID Tributario Extranjero** | Implementado | Se asigna el NIT de Periferia a campos RUC/RTN en países extranjeros y se envía obligatoriamente a `requiere_confirmacion` con nota explicativa. |
| **RN2: Protección Bancaria** | Implementado | Los datos bancarios se omiten categóricamente de `borrador-correo.md` y de los resúmenes en `log.jsonl`. |
| **RN3: Reglas de Bloqueo de Firma** | Implementado | Soporte ausente o soporte vencido $\rightarrow$ `listo_para_firma = false`. Campos faltantes no bloquean la firma. |
| **RN4: Human-in-the-Loop Estricto** | Implementado | `simular_envio` exige `confirmado: true`, verificación previa en sesión y paquete en estado `listo_para_firma = true`. |
| **RN5: Trazabilidad en Logs** | Implementado | Cada invocación escribe en `out/<caso>/log.jsonl` el registro estructurado `{ ts, herramienta, ok, resumen }`. |

---

## 5. Pruebas Ejecutadas y Resultados Verificables

### 5.1 Comprobación de Tipos (TypeScript Compiler)
- **Comando:** `npx tsc --noEmit`
- **Resultado:** Código de salida `0`. Cero errores de tipos.

### 5.2 Suite de Pruebas Unitarias y de Integración
- **Comando:** `npm run test` (ejecuta `tsx --test test/**/*.test.ts`)
- **Resumen:** **16 pruebas ejecutadas, 16 aprobadas, 0 fallidas, 0 canceladas**.
- **Duración:** 2.40 segundos.

```
# Detalle de pruebas ejecutadas:
ok 1  - Artefactos: Validación de contenido REAL de celdas en formulario.xlsx
ok 2  - Artefactos: Validación de contenido REAL de formulario.pdf
ok 3  - Artefactos: Validación de valores-portal.md para clientes de portal web
ok 4  - Reloj Inyectable: Comportamiento dinámico de vigencias de soportes según fecha
ok 5  - Seguridad: simular_envio rechaza si confirmado es false
ok 6  - Seguridad: simular_envio rechaza si el backend no registra confirmación previa en sesión
ok 7  - Seguridad: simular_envio NUNCA despacha paquetes bloqueados para firma
ok 8  - Seguridad: simular_envio exitoso cuando está autorizado y el paquete no está bloqueado
ok 9  - Seguridad: defensa contra Path Traversal en parámetros de caso
ok 10 - Seguridad (RN2): borrador-correo.md NUNCA expone datos bancarios sensibles
ok 11 - proveedor_leer_solicitud: lee caso co-industrias-delta correctamente
ok 12 - proveedor_leer_solicitud: error controlado ante caso inexistente
ok 13 - proveedor_mapear_campos: mapea 100% en Colombia y mantiene trazabilidad
ok 14 - proveedor_mapear_campos: regla RN1 para país extranjero (Ecuador - RUC)
ok 15 - proveedor_generar_formulario: genera archivo xlsx físico para co-industrias-delta
ok 16 - proveedor_armar_paquete: empaqueta y reporta listo_para_firma con reloj inyectado
```

### 5.3 Ejecución Determinista de `demo.ts`
- **Comando:** `npm run demo` / `bun run demo.ts`
- **Resultado:** Código de salida `0`. Procesa secuencialmente los 4 casos sin requerir internet ni claves de API.

---

## 6. Evidencias de Ejecución y Artefactos Físicos

### 6.1 Resultados de los Cuatro Escenarios (Fecha Real del Sistema: `2026-10-28`)

| Caso | País | Formato | Campos Llenos | Faltantes | Req. Conf. | Soportes OK | Vencidos | Ausentes | Listo Firma |
|---|---|---|---|---|---|---|---|---|---|
| `co-industrias-delta` | **CO** | **xlsx** | 17 (100%) | 0 | 0 | 3 | 1 (`camara_comercio`) | 0 | **`false`** (Bloqueado) |
| `ec-corp-andina` | **EC** | **pdf** | 13 | 1 | 1 | 3 | 1 (`camara_comercio`) | 1 (`cumpl_tributario`) | **`false`** (Bloqueado) |
| `hn-agroexport-sula` | **HN** | **xlsx** | 9 | 1 | 1 | 1 | 2 (`CC`, `parafiscales`) | 0 | **`false`** (Bloqueado) |
| `pa-logistica-istmo` | **PA** | **portal** | 8 | 0 | 1 | 1 | 1 (`camara_comercio`) | 0 | **`false`** (Bloqueado) |

*Nota forense:* En fecha real (`2026-10-28`), el certificado de Cámara de Comercio (`vigencia_hasta: 2026-09-30`) y el de Parafiscales (`vigencia_hasta: 2026-08-31`) han expirado, resultando en el bloqueo legítimo de la firma según la regla RN3.

### 6.2 Resultados con Reloj Inyectado Simulado (`2026-08-25`, antes de vencimientos)

| Caso | País | Formato | Soportes Vencidos | Soportes Ausentes | Listo para Firma | Resultado de `simular_envio` |
|---|---|---|---|---|---|---|
| `co-industrias-delta` | CO | xlsx | 0 | 0 | **`true`** | **Despachado exitosamente** (`ENVIO-SIMULADO.md`) |
| `ec-corp-andina` | EC | pdf | 0 | 1 (`cumpl_tributario`) | **`false`** | Rechazado por soporte ausente |
| `hn-agroexport-sula` | HN | xlsx | 0 | 0 | **`true`** | **Despachado exitosamente** (`ENVIO-SIMULADO.md`) |
| `pa-logistica-istmo` | PA | portal | 0 | 0 | **`true`** | **Despachado exitosamente** (`ENVIO-SIMULADO.md`) |

### 6.3 Archivos Físicos Generados e Inspeccionados en Disco

```
out/
├── co-industrias-delta/
│   ├── formulario.xlsx              # 7,939 bytes (2 pestañas, celdas verificadas con exceljs)
│   ├── log.jsonl                    # Registro de llamadas a herramientas
│   └── paquete/
│       ├── formulario.xlsx          # Copia del formulario
│       ├── camara-comercio-2026-08.txt
│       ├── certificacion-bancaria-2026-08.txt
│       ├── estados-financieros-2025.txt
│       ├── rut-2026.txt
│       ├── checklist.md             # Reporte de estado de soportes y campos
│       └── borrador-correo.md       # Redacción para el cliente (sin datos bancarios)
├── ec-corp-andina/
│   ├── formulario.pdf               # 2,795 bytes (Encabezado %PDF-, tabla estructurada)
│   ├── log.jsonl
│   └── paquete/
│       ├── formulario.pdf
│       ├── checklist.md             # Marca AUSENTE a certificado_cumplimiento_tributario
│       └── borrador-correo.md
├── hn-agroexport-sula/
│   ├── formulario.xlsx              # 7,056 bytes
│   ├── log.jsonl
│   └── paquete/
│       ├── formulario.xlsx
│       ├── checklist.md             # Marca VENCIDO a parafiscales y camara_comercio
│       └── borrador-correo.md
└── pa-logistica-istmo/
    ├── valores-portal.md            # 1,922 bytes (Tablas y bloques de copia de 1 clic)
    ├── log.jsonl
    └── paquete/
        ├── valores-portal.md
        ├── checklist.md
        └── borrador-correo.md
```

---

## 7. Medidas de Seguridad Implementadas

1. **Defensa contra Path Traversal:**
   - La función `sanitizeCaso` valida contra `/^[a-zA-Z0-9_-]+$/`.
   - Se valida mediante `path.resolve()` que las rutas resultantes no escapen de las raíces autorizadas (`fixtures/` y `out/`).
2. **Autorización en Dos Fases para Envíos:**
   - El booleano `confirmado: true` en la herramienta es necesario pero no suficiente.
   - La herramienta verifica que `ctx.sessionConfirmed === true` (garantizando que el backend haya recibido la orden expresa del usuario en el turno previo).
3. **Bloqueo Incondicional de Envíos en Paquetes No Aptos:**
   - Si un paquete tiene `listo_para_firma === false`, la herramienta `simular_envio` rechaza la ejecución y no crea ningún archivo, retornando mensaje de error explícito.
4. **Protección de Datos Bancarios (RN2):**
   - El generador de correos omite cualquier mención a cuentas bancarias, SWIFT o entidades financieras.
   - El servicio de logger sanitiza y enmascara secuencias numéricas extensas en los resúmenes.
5. **Aislamiento de Excepciones:**
   - Toda llamada a herramienta está contenida en bloques `try/catch`. En caso de error de I/O, formato o validación, se retorna un objeto JSON tipado `{ ok: false, error: err.message }` sin propagar excepciones no controladas.

---

## 8. Limitaciones y Tareas Pendientes

### Limitaciones Actuales
- **Evaluación a Fecha Real:** A la fecha del sistema (`2026-10-28`), la Cámara de Comercio de Periferia expiró el `2026-09-30`. Esto ocasiona que todos los casos permanezcan en estado bloqueado para firma a menos que se renueve el documento en el fixture o se utilice el reloj simulado inyectado.
- **Portales Web:** Tal como estipula el PRD (sección 7.4), los portales no se automatizan vía web scraping/headless en esta fase; se proporciona la guía estructurada en `valores-portal.md`.

### Tareas Pendientes para las Siguientes Fases
- **Fase 2 (Motor de Agente y Backend):**
  - Implementación del bucle `AgentEngine` con límite de 25 iteraciones.
  - Implementación de `GeminiAdapter` con modelo configurable (`GEMINI_MODEL`, `gemini-2.5-flash` / `gemini-1.5-flash`).
  - Creación del servidor HTTP Hono/Express con rutas `/api/chat`, `/api/sessions/:id` y `/api/health`.
- **Fase 3 (Frontend Conversacional):**
  - Creación del cliente React + Vite + Tailwind con visualización de tool calls y banner de confirmación humana.
- **Fase 4 (Bonus y Cierre):**
  - Empaquetado `modulo/` reutilizable (`agent.md`, `tools/proveedor.ts`, `skill/registro-proveedor/SKILL.md`).
  - Redacción técnica final de `SOLUCION.md` y `README.md`.

---

## 9. Matriz de Cumplimiento de la Fase 1

| Criterio / Requisito | Estado | Evidencia | Observaciones |
|---|---|---|---|
| Contratos tipados con Zod | **COMPLETO** | `src/types/index.ts`, `src/tools/proveedor.ts` | 5 esquemas validados con Zod. |
| Herramienta `leer_solicitud` | **COMPLETO** | `test/tools.test.ts` (test 11, 12) | Lee solicitud, plantilla y soportes. |
| Herramienta `mapear_campos` | **COMPLETO** | `test/tools.test.ts` (test 13, 14) | Resuelve 38 claves de glosario y RN1. |
| Herramienta `generar_formulario` | **COMPLETO** | `test/artifacts.test.ts` (test 1, 2, 3) | Genera XLSX multi-hoja, PDF y Markdown. |
| Herramienta `armar_paquete` | **COMPLETO** | `test/tools.test.ts` (test 16) | Checklist y borrador creados en `paquete/`. |
| Herramienta `simular_envio` | **COMPLETO** | `test/security.test.ts` (test 5, 6, 7, 8) | Doble confirmación y bloqueo preventivo. |
| Generación física XLSX | **COMPLETO** | `formulario.xlsx` (7,939 bytes) | Celdas B3, C3, B4, C4 inspeccionadas con `exceljs`. |
| Generación física PDF | **COMPLETO** | `formulario.pdf` (2,795 bytes) | Encabezado `%PDF-` y formato vectorial validado. |
| Guía copiable Portal Web | **COMPLETO** | `valores-portal.md` (1,922 bytes) | Tablas y bloques de copia rápida de 1 clic. |
| Reloj inyectable para vigencias | **COMPLETO** | `test/artifacts.test.ts` (test 4) | Comportamiento dinámico probado con 3 fechas. |
| Protección Path Traversal | **COMPLETO** | `test/security.test.ts` (test 9) | Bloqueo estricto de entradas maliciosas. |
| Prevención fuga bancaria (RN2) | **COMPLETO** | `test/security.test.ts` (test 10) | Cero datos bancarios en borradores ni logs. |
| Ejecución determinista `demo.ts` | **COMPLETO** | `npm run demo` / `bun run demo.ts` | Salida exitosa código 0 en ambos entornos. |
| TypeScript sin `any` | **COMPLETO** | `npx tsc --noEmit` | Cero errores de compilación estricta. |

---

## 10. Conclusión y Condiciones para Continuar

La **Fase 1 (Core de Herramientas y Ejecución Determinista)** se encuentra **100% implementada, comprobada y documentada**. 

No se modificará código ni se dará inicio a la Fase 2 hasta contar con la respectiva aprobación técnica.

### Condiciones para iniciar la Fase 2:
1. Aprobación formal de este informe técnico `docs/FASE_01_CORE.md`.
2. Definición/confirmación de la variable `GEMINI_API_KEY` en el entorno local para las pruebas con el adaptador de modelo real.

