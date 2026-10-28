# Diagnóstico Técnico y Propuesta de Arquitectura (v2 — Corregido)
## PRD-01: Agente Conversacional "Registro como Proveedor" — Periferia IT Group

---

## 1. Ficha Técnica del Diagnóstico

- **Proyecto:** Reto Técnico 01 — Agente Conversacional "Registro como Proveedor" (Equipo Perxia 2.0).
- **Rol:** Arquitecto de Software Senior (TypeScript, React, Tool-Calling Agents).
- **Objetivo:** Construir una solución completa, desacoplada e independiente para automatizar el diligenciamiento de formularios de registro de proveedores ante clientes de Periferia IT Group en Colombia, Ecuador, Honduras y Panamá.
- **Entorno de Ejecución:** Node.js v22+ / Bun v1.4+, TypeScript estricto (`noImplicitAny`, cero `any`), Zod en todos los contratos de entrada/salida.
- **Proveedor LLM Único:** Google Gemini (configurable mediante `GEMINI_MODEL`, con fallback y comprobación de disponibilidad). Adaptador Mock determinista para pruebas offline y tests automatizados.

---

## 2. Requisitos Obligatorios y Criterios de Aceptación

### 2.1 Historias de Usuario

| ID | Historia de Usuario | Criterios de Aceptación del PRD | Mecanismo de Validación |
|---|---|---|---|
| **HU-1** | **Leer la solicitud** | - Lee `solicitud.json` y la plantilla correspondiente (`plantilla-celdas.json` o `plantilla-campos.json`).<br>- Retorna: país del cliente, cliente, formato (`xlsx`, `pdf`, `portal`), lista de campos solicitados y lista de soportes exigidos.<br>- Detecta campos ambiguos y sugiere el identificador del país (NIT: CO, RUC: EC/PE/PA, RTN: HN). | Ejecución tipada de `proveedor_leer_solicitud`. Salida JSON serializada. |
| **HU-2** | **Mapear campos al maestro** | - Cruza cada campo con `maestro.json` apoyado en `glosario-campos.json` (38 entradas normalizadas).<br>- Clasifica cada campo en exactamente uno de tres estados:<br>&nbsp;&nbsp;1. `lleno`: contiene el valor y la **ruta trazable en el maestro** (ej. `representante_legal.nombre`).<br>&nbsp;&nbsp;2. `faltante`: no existe en el maestro. **Estrictamente prohibido alucinar/inventar valores**.<br>&nbsp;&nbsp;3. `requiere_confirmacion`: confianza < 0.8 o regla RN1 de ID tributario extranjero.<br>- Resuelve sinónimos del glosario con normalización estricta. | Salida de `proveedor_mapear_campos`. Ningún campo sin fuente puede clasificarse como lleno. Trazabilidad garantizada. |
| **HU-3** | **Generar formulario en formato pedido** | - **P0 (Excel):** genera `out/<caso>/formulario.xlsx` con `exceljs`, escribiendo etiqueta y valor en celdas exactas según `plantilla-celdas.json`.<br>- **P1 (PDF):** genera `out/<caso>/formulario.pdf` con `pdfkit`, ordenando los campos con etiqueta y valor según `plantilla-campos.json`.<br>- **P2 (Portal Web):** responde `formato no soportado` y genera `out/<caso>/valores-portal.md` con los valores listos para copiar. Incluye diseño técnico en `SOLUCION.md`. | Validación del contenido real de celdas en XLSX y texto en PDF (no solo existencia del archivo). |
| **HU-4** | **Armar paquete para firma** | - Crea la carpeta `out/<caso>/paquete/` con:<br>&nbsp;&nbsp;1. El formulario generado (`.xlsx`, `.pdf` o `valores-portal.md`).<br>&nbsp;&nbsp;2. Copias de soportes exigidos existentes en `repositorio/soportes/`.<br>&nbsp;&nbsp;3. `checklist.md` con soportes presentes, ausentes y vencidos.<br>&nbsp;&nbsp;4. `borrador-correo.md` sin datos bancarios.<br>- Si un soporte exigido está ausente o vencido según la fecha real de ejecución (o reloj inyectado), bloquea `listo_para_firma = false`.<br>- Exige confirmación explícita previa antes de cualquier acción de envío. | Existencia y contenido de archivos; validación de bandera booleana `listo_para_firma`. |
| **HU-5** | **Manejo de errores** | - Errores de plantilla corrupta, caso inexistente o formato no soportado devuelven mensajes claros sin stack traces crudos.<br>- Las herramientas devuelven siempre `{ ok: true, data }` o `{ ok: false, error }`, **nunca lanzan excepciones** no capturadas. | Pruebas de integración de casos de borde y errores controlados. |

### 2.2 Reglas de Negocio y Seguridad Obligatorias

- **RN1 (Identificador Tributario por País):** CO → NIT, EC → RUC, PE → RUC, PA → RUC, HN → RTN. Periferia solo tiene NIT colombiano. Para otros países el campo se llena con el NIT y se marca obligatoriamente como `requiere_confirmacion` con la nota `"identificador extranjero"`.
- **RN2 (Protección de Datos Bancarios):** Se completan en el formulario solo si la plantilla los pide explícitamente. **Nunca se incluyen en `borrador-correo.md` ni en logs** (prevención de fuga de datos sensibles).
- **RN3 (Reglas de Bloqueo de `listo_para_firma`):**
  - Soporte exigido **ausente** $\rightarrow$ **Bloquea** (`listo_para_firma = false`).
  - Soporte exigido **vencido** (`vigencia_hasta < fecha_referencia`) $\rightarrow$ **Bloquea** (`listo_para_firma = false`).
  - Campo del formulario **faltante** $\rightarrow$ **NO bloquea**, pero debe listarse obligatoriamente en el checklist.
- **RN4 (Confirmación Humana Estricta y Seguridad de Envío):**
  - El booleano `confirmado: true` en la herramienta **NO autoriza el envío por sí solo**.
  - El backend valida que exista una confirmación explícita del usuario en el turno inmediatamente anterior y que corresponda al caso exacto.
  - **Nunca se simula un envío si el paquete está bloqueado (`listo_para_firma === false`)**. Si el usuario pide enviar un paquete bloqueado, el agente rechaza la operación informando los motivos.
- **RN5 (Trazabilidad y Sandboxing de Rutas):**
  - Toda herramienta ejecutada escribe en `out/<caso>/log.jsonl` un registro con `{ ts, herramienta, ok, resumen }`.
  - Validación de rutas con prevención de Path Traversal: ningún argumento `caso` puede contener `..`, separadores absolutos o escapar del directorio de fixtures/out.

---

## 3. Inspección Forense de Fixtures y Vigencias Reales

Se inspeccionaron directamente los archivos en `fixtures/reto-01/`.

### 3.1 Catálogo de Soportes y Vigencias (`fixtures/reto-01/repositorio/soportes/index.json`)

| Tipo de Soporte | Archivo | Vigencia Hasta | Estado a Fecha Real (Octubre 2026) |
|---|---|---|---|
| `camara_comercio` | `camara-comercio-2026-08.txt` | **2026-09-30** | **VENCIDO** (Venció el 30 de septiembre de 2026) |
| `parafiscales` | `parafiscales-2026-07.txt` | **2026-08-31** | **VENCIDO** (Venció el 31 de agosto de 2026) |
| `rut` | `rut-2026.txt` | `null` | **VIGENTE** (Sin fecha de expiración) |
| `certificacion_bancaria` | `certificacion-bancaria-2026-08.txt` | 2026-12-31 | **VIGENTE** |
| `estados_financieros` | `estados-financieros-2025.txt` | 2027-03-31 | **VIGENTE** |
| `certificado_iso_9001` | `iso-9001-2025.txt` | 2028-05-20 | **VIGENTE** |

### 3.2 Glosario de Campos (`fixtures/reto-01/glosario-campos.json`)
Contiene exactamente **38 entradas** de sinónimos mapeadas a claves de `maestro.json`. Cada mapeo mantiene la ruta JSON exacta de origen para asegurar trazabilidad total.

### 3.3 Matriz de Comportamiento de los Cuatro Escenarios

A continuación se contrastan los resultados según la fecha de referencia: **Fecha Real de Ejecución (Octubre 2026)** vs **Reloj Histórico Simulado (Agosto 2026)**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│              RESULTADOS SEGÚN FECHA REAL DE EJECUCIÓN (OCTUBRE 2026)                   │
├─────────────────────┬────────┬─────────┬───────────────────┬──────────────┬────────────┤
│ Caso                │ País   │ Formato │ Campos            │ Soportes     │ Listo para │
│                     │        │         │ Maestro           │ Exigidos     │ Firma      │
├─────────────────────┼────────┼─────────┼───────────────────┼──────────────┼────────────┤
│ co-industrias-delta │ CO     │ xlsx    │ 17 solicitados    │ CC (VENCIDO) │ FALSE      │
│                     │        │         │ 17 llenos (100%)  │ RUT, Banc, EF│ (Bloqueado │
│                     │        │         │ 0 faltantes       │ (Vigentes)   │ por CC)    │
├─────────────────────┼────────┼─────────┼───────────────────┼──────────────┼────────────┤
│ ec-corp-andina      │ EC     │ pdf     │ 15 solicitados    │ CC (VENCIDO) │ FALSE      │
│                     │        │         │ 13 llenos         │ Cumpl. Trib. │ (Bloqueado │
│                     │        │         │ 1 req. conf (RUC) │ (AUSENTE)    │ por CC y   │
│                     │        │         │ 1 faltante (NCE)  │ 3 vigentes   │ Ausente)   │
├─────────────────────┼────────┼─────────┼───────────────────┼──────────────┼────────────┤
│ hn-agroexport-sula  │ HN     │ xlsx    │ 11 solicitados    │ CC (VENCIDO) │ FALSE      │
│                     │        │         │ 9 llenos          │ Parafiscales │ (Bloqueado │
│                     │        │         │ 1 req. conf (RTN) │ (VENCIDO)    │ por CC y   │
│                     │        │         │ 1 faltante (RefC) │ RUT (Vigente)│ Parafisc.) │
├─────────────────────┼────────┼─────────┼───────────────────┼──────────────┼────────────┤
│ pa-logistica-istmo  │ PA     │ portal  │ 9 solicitados     │ CC (VENCIDO) │ FALSE      │
│                     │        │         │ 8 llenos          │ RUT (Vigente)│ (Bloqueado │
│                     │        │         │ 1 req. conf (RUC) │              │ por CC)    │
└─────────────────────┴────────┴─────────┴───────────────────┴──────────────┴────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             RESULTADOS CON RELOJ SIMULADO HISTÓRICO (2026-08-25)                       │
├─────────────────────┬────────┬─────────┬───────────────────┬──────────────┬────────────┤
│ Caso                │ País   │ Formato │ Campos            │ Soportes     │ Listo para │
│                     │        │         │ Maestro           │ Exigidos     │ Firma      │
├─────────────────────┼────────┼─────────┼───────────────────┼──────────────┼────────────┤
│ co-industrias-delta │ CO     │ xlsx    │ 17 llenos         │ 4 vigentes   │ TRUE       │
├─────────────────────┼────────┼─────────┼───────────────────┼──────────────┼────────────┤
│ ec-corp-andina      │ EC     │ pdf     │ 13 llenos, 1 f/c  │ 1 AUSENTE    │ FALSE      │
├─────────────────────┼────────┼─────────┼───────────────────┼──────────────┼────────────┤
│ hn-agroexport-sula  │ HN     │ xlsx    │ 9 llenos, 1 f/c   │ 3 vigentes   │ TRUE       │
├─────────────────────┼────────┼─────────┼───────────────────┼──────────────┼────────────┤
│ pa-logistica-istmo  │ PA     │ portal  │ 8 llenos, 1 conf  │ 2 vigentes   │ TRUE       │
└─────────────────────┴────────┴─────────┴───────────────────┴──────────────┴────────────┘
```

> **Principio de Diseño:** La validación de vigencias recibe un reloj inyectable (`referenceDate: Date = new Date()`). De este modo, en producción y en `demo.ts` por defecto se evalúa contra la fecha real del sistema, mientras que la suite de pruebas unitarias verifica ambos comportamientos inyectando fechas históricas controladas.

---

## 4. Arquitectura Simplificada y Segura

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND NODE.JS + TYPESCRIPT STRICT                         │
│                                                                                       │
│  ┌────────────────────────┐      ┌────────────────────────┐     ┌──────────────────┐  │
│  │   HTTP Server (Hono)   │ ───▶ │   Agent Loop Engine    │ ──▶ │   Session Store  │  │
│  │   - POST /api/chat     │      │   - Max 25 iteraciones │     │   - Confirmation │  │
│  │   - GET /api/sessions  │      │   - Grounding check    │     │     validation   │  │
│  │   - GET /api/health    │      │   - Turn-based confirm │     └──────────────────┘  │
│  └────────────────────────┘      └───────────┬────────────┘                           │
│                                              │                                        │
│                 ┌────────────────────────────┴────────────────────────────┐           │
│                 ▼                                                         ▼           │
│  ┌──────────────────────────────┐                       ┌───────────────────────────┐ │
│  │    LLM Adapter Interface     │                       │    Tools Registry (Zod)   │ │
│  │  - GeminiAdapter (Único)     │                       │    proveedor.ts:          │ │
│  │  - MockDeterministicAdapter  │                       │    - leer_solicitud       │ │
│  │    (Solo tests y demo.ts)    │                       │    - mapear_campos        │ │
│  └──────────────────────────────┘                       │    - generar_formulario   │ │
│                                                         │    - armar_paquete        │ │
│                                                         │    - simular_envio        │ │
│                                                         └─────────────┬─────────────┘ │
└───────────────────────────────────────────────────────────────────────┼───────────────┘
                                                                        │
                                     ┌──────────────────────────────────┴───────────────┐
                                     ▼                                                  ▼
                      ┌──────────────────────────────┐                   ┌──────────────────────────────┐
                      │    fixtures/reto-01/ (RO)    │                   │          out/ (RW)           │
                      │  - casos/                    │                   │  - <caso>/formulario.xlsx    │
                      │  - repositorio/maestro.json  │                   │  - <caso>/formulario.pdf     │
                      │  - repositorio/soportes/     │                   │  - <caso>/valores-portal.md  │
                      │  - glosario-campos.json (38) │                   │  - <caso>/paquete/           │
                      └──────────────────────────────┘                   │  - <caso>/log.jsonl          │
                                                                         └──────────────────────────────┘
```

---

## 5. Medidas de Seguridad y Robustez

1. **Autorización en Dos Fases para Envíos:**
   - La herramienta `simular_envio` verifica que:
     a) El parámetro `confirmado === true`.
     b) La sesión del backend registra que en el turno inmediatamente anterior el usuario respondió afirmativamente.
     c) El caso corresponde exactamente a la solicitud en curso.
     d) El paquete **no está bloqueado** (`listo_para_firma === true`). Si está bloqueado, rechaza el envío con error explícito: `"No se puede simular el envío: el paquete está bloqueado para firma debido a soportes vencidos o ausentes"`.
2. **Defensa contra Path Traversal:**
   - Todo identificador de caso es sanitizado: solo caracteres alfanuméricos y guiones (`/^[a-z0-9-]+$/i`). Se verifica que la ruta resultante resida dentro de los directorios permitidos usando `path.resolve()`.
3. **Cero `any`:**
   - Modo estricto de TypeScript (`"strict": true`, `"noImplicitAny": true`). Tipado riguroso con Zod y tipos discriminados para resultados `{ ok: true, data: T } | { ok: false, error: string }`.
4. **Prevención de Exposición de Datos Sensibles:**
   - `borrador-correo.md` jamás incluye datos bancarios (cuenta, banco, titular, SWIFT).
   - Los logs `log.jsonl` registran resúmenes de operación sin volcar números de cuentas bancarias.
5. **Manejo Controlado de Excepciones:**
   - Cada herramienta está envuelta en un bloque `try/catch` que intercepta fallos de I/O o formato y los transforma en `{ ok: false, error: err.message }`. Ninguna excepción se propaga al bucle del agente.

---

## 6. Plan de la Fase 1 (Construcción Inmediata)

1. `package.json` y `tsconfig.json` con dependencias mínimas necesarias (`zod`, `exceljs`, `pdfkit`, `@types/pdfkit`, `tsx`).
2. `src/types/index.ts`: Definiciones de contratos, tipos discriminados y esquemas Zod.
3. `src/services/fixture-service.ts`: Carga y validación segura de fixtures y catálogo de soportes.
4. `src/services/mapper-service.ts`: Mapeo estricto con glosario (38 entradas), reglas de país (RN1) y trazabilidad de rutas en `maestro.json`.
5. `src/services/support-service.ts`: Validación de vigencias con soporte para reloj inyectable.
6. `src/generators/excel-generator.ts`: Generación de XLSX multi-hoja con `exceljs`.
7. `src/generators/pdf-generator.ts`: Generación de PDF estructurado con `pdfkit`.
8. `src/generators/portal-generator.ts`: Generación de `valores-portal.md`.
9. `src/tools/proveedor.ts`: Implementación de las 5 herramientas obligatorias con firmas PRD.
10. `demo.ts`: Ejecución determinista 100% offline de los 4 casos con tabla resumen en consola.
11. Tests exhaustivos: Pruebas unitarias y de integración que validen el contenido real de los archivos, reloj inyectable y rechazo de envíos en paquetes bloqueados.
