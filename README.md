# PRD-01: Registro como Proveedor — Agente Conversacional Autónomo
## Periferia IT Group S.A.S. · Reto Técnico Perxia 2.0

Aplicación full-stack de inteligencia artificial que automatiza integralmente el proceso de recepción, diligenciamiento, validación legal y armado de paquetes de registro como proveedor ante clientes corporativos en **Colombia, Ecuador, Honduras y Panamá**.

---

## 1. Características Principales

- **Arquitectura Full-Stack:** Frontend reactivo en **React 19 + Tailwind CSS** (panel tripartito responsivo) y backend de alto rendimiento en **TypeScript estricto con Hono**.
- **Motor LLM con Function Calling:** Integración nativa con **Google Gemini 3.5 Flash-Lite** (`@google/genai`) con soporte de *thoughtSignature*, y adaptador **Mock determinista offline** para pruebas sin costo de API.
- **5 Herramientas Especializadas Tipadas con Zod:**
  1. `proveedor_leer_solicitud`: Lectura y extracción estructurada de solicitudes.
  2. `proveedor_mapear_campos`: Mapeo transfronterizo contra glosario de 38 términos y repositorio maestro, con aplicación de regla fiscal **RN1** (identificadores extranjeros).
  3. `proveedor_generar_formulario`: Generación binaria física de hojas de cálculo `.xlsx` con celdas reales (`exceljs`), documentos `.pdf` nativos (`pdfkit`) y guías de portal web `valores-portal.md`.
  4. `proveedor_armar_paquete`: Empaquetado físico de soportes, generación de `checklist.md` con semáforo de vigencias (regla **RN3**) y redacción de `borrador-correo.md` protegiendo datos bancarios (regla **RN2**).
  5. `proveedor_simular_envio`: Despacho controlado que exige confirmación humana obligatoria (regla **RN4**) y bloquea envíos con documentación vencida o ausente.
- **Seguridad en Dos Fases (Human-in-the-Loop):** Tokens criptográficos temporales vinculados a la sesión y caso, con inhabilitación visual y rechazo HTTP 400 para paquetes bloqueados.
- **Módulo Reutilizable (`modulo/` Bonus):** Componentes listos para importar en plataformas de agentes externas sin depender del servidor HTTP.

---

## 2. Requisitos Previos

- **Node.js:** Versión `>= 20.0.0` (recomendado Node.js 20 LTS o 22 LTS).
- **Gestor de Paquetes:** `npm` (incluido con Node.js).
- **Google Chrome / Chromium:** Para la ejecución de pruebas E2E con Playwright (opcional para desarrollo básico).

---

## 3. Instalación y Configuración

### 3.1 Clonar o descomprimir el proyecto
```bash
cd dia5
```

### 3.2 Instalar dependencias
```bash
npm install
npm install --prefix web
```

### 3.3 Configurar variables de entorno
Copia la plantilla de entorno:
```bash
cp .env.example .env
```

Edita `.env` según el modo que desees utilizar:

```ini
# Clave privada de Google Gemini (requerida únicamente para Modo Live)
GEMINI_API_KEY=tu_clave_de_gemini_aqui

# Modelo recomendado por eficiencia de costos y latencia
GEMINI_MODEL=gemini-3.5-flash-lite

# Puerto HTTP del servidor
PORT=3000

# Parámetros de seguridad del agente
MAX_AGENT_ITERATIONS=15
MAX_SESSION_TOKENS=50000
NODE_ENV=development
```

> **Nota de Seguridad:** Si no configuras `GEMINI_API_KEY`, el sistema iniciará automáticamente en **Modo Mock Determinista**, permitiendo probar la aplicación completa, el chat, las herramientas y las descargas con costo \$0 USD.

---

## 4. Arranque de la Aplicación en un Solo Comando

Para compilar el frontend y levantar el servidor backend unificado:

```bash
npm start
```

Abre tu navegador en:
👉 **`http://localhost:3000`**

### ¿Qué hace `npm start`?
- Inicia el servidor Hono en el puerto `3000`.
- Sirve la API REST en `/api/*`.
- Sirve la aplicación React 19 compilada en `/` desde `web/dist`.
- Habilita las descargas seguras de artefactos en `/api/artifacts/:caso/:file`.

---

## 5. Modos de Ejecución

### Modo A: Modo Mock Determinista (Offline / Zero-Cost)
- **Activación:** Se activa por defecto si no hay `GEMINI_API_KEY` o pasando la bandera de configuración mock.
- **Comportamiento:** Simula el razonamiento del modelo y el bucle de herramientas con respuestas deterministas idénticas, consumiendo **cero tokens** y funcionando sin conexión a internet.

### Modo B: Modo Live con Google Gemini 3.5 Flash-Lite
- **Activación:** Configurando `GEMINI_API_KEY` en `.env`.
- **Comportamiento:** Se comunica en tiempo real con la API de Google Gemini utilizando Function Calling nativo. La clave privada permanece estrictamente protegida en el backend y nunca es transmitida al navegador.

---

## 6. Demostración Determinista por Consola (`demo.ts`)

Para ejecutar la verificación determinista de las 5 herramientas en los 4 casos del PRD sin requerir navegador ni LLM:

```bash
npm run demo
```

### Salida esperada de `demo.ts`:
- Limpieza inicial automática del directorio `out/`.
- Procesamiento secuencial de `co-industrias-delta`, `ec-corp-andina`, `hn-agroexport-sula` y `pa-logistica-istmo`.
- Reporte detallado de campos mapeados, faltantes y soportes evaluados.
- Verificación de bloqueo de firma por soportes vencidos según la fecha real de ejecución (2026-10-28).
- Tabla consolidada final y generación física de archivos en `out/`.

---

## 7. Ejecución de Pruebas Automatizadas

El proyecto cuenta con una cobertura integral de pruebas dividida en tres suites:

### 7.1 Pruebas Unitarias y de Integración (Offline - 37 pruebas)
Ejecuta la suite completa sin consumir créditos de API:
```bash
npm run test
```
*Valida:* Mapeo transfronterizo, regla RN1, seguridad bancaria RN2, bloqueo de firma RN3, confirmaciones cruzadas RN4, reloj inyectable, sanitización de fechas y seguridad de endpoints HTTP.

### 7.2 Pruebas E2E en Navegador Real (Playwright + Chrome)
Valida la experiencia de usuario, interfaz visual y flujos conversacionales:
```bash
npm run test:e2e
```
*Acciones automáticas:*
- Lanza una instancia real de Google Chrome sin cabeza.
- Valida los 4 escenarios de prueba.
- Prueba la inhabilitación del banner de confirmación en paquetes bloqueados (Evidencia `08a`).
- Prueba la confirmación humana y simulación exitosa en un escenario elegible (Evidencia `08`).
- Captura 9 evidencias fotográficas en `docs/evidencias/`.
- Verifica la ausencia total de errores `'Invalid Date'`.

### 7.3 Prueba E2E en Vivo con Gemini (Live)
Para verificar la conexión real contra la API de Google Gemini:
```bash
npm run test:live
```
*(Requiere `GEMINI_API_KEY` configurada en `.env`)*.

---

## 8. Casos de Prueba del PRD

La aplicación cubre los 4 escenarios transfronterizos exigidos:

| Caso | Cliente | País | Formato | Soportes Clave | Estado de Firma (a Oct 2026) |
|---|---|:---:|:---:|---|:---:|
| `co-industrias-delta` | Industrias Delta S.A.S. | 🇨🇴 CO | **XLSX** | Cámara Comercio, RUT, Cert. Bancaria, Estados Financieros | **Firma Bloqueada** (Cámara venció 2026-09-30) |
| `ec-corp-andina` | Corp. Andina de Servicios | 🇪🇨 EC | **PDF** | RUC (RN1), Cert. Bancaria, Cumplimiento Tributario | **Firma Bloqueada** (Cámara vencida + Cert. Tributario ausente) |
| `hn-agroexport-sula` | Agroexport Sula S. de R.L. | 🇭🇳 HN | **XLSX** | RTN (RN1), Parafiscales, Constitución | **Firma Bloqueada** (Cámara y Parafiscales vencidos) |
| `pa-logistica-istmo` | Logística del Istmo S.A. | 🇵🇦 PA | **Portal** | RUC (RN1), Registro Público, Formulario Web | **Firma Bloqueada** (Cámara vencida) |

---

## 9. Inspección de Artefactos Físicos Generados

Todos los archivos generados se organizan de forma aislada en la carpeta `out/`:

```
out/
├── co-industrias-delta/
│   ├── formulario.xlsx             # Hoja de cálculo con celdas mapeadas
│   ├── paquete/
│   │   ├── checklist.md            # Auditoría de vigencias de soportes
│   │   ├── borrador-correo.md      # Correo redactado (sin datos bancarios)
│   │   ├── camara-comercio-2026-08.txt
│   │   └── ... (copias de soportes existentes)
│   └── log.jsonl                   # Registro de auditoría
├── ec-corp-andina/
│   ├── formulario.pdf              # PDF nativo renderizado
│   └── paquete/ ...
├── hn-agroexport-sula/
│   ├── formulario.xlsx             # Hoja de cálculo
│   └── paquete/ ...
└── pa-logistica-istmo/
    ├── valores-portal.md           # Guía estructurada para copia rápida
    └── paquete/ ...
```

Los artefactos pueden descargarse directamente desde la interfaz web o mediante el endpoint HTTP:
`GET http://localhost:3000/api/artifacts/:caso/:archivo`

---

## 10. Módulo Reutilizable (`modulo/` Bonus)

Para integrar las herramientas y la habilidad del agente en orquestadores externos sin requerir el servidor HTTP, se incluye el paquete `modulo/`:

```
modulo/
├── agent.md                        # Frontmatter de permisos y System Prompt maestro
├── tools/proveedor.ts              # Re-exportación directa de las 5 herramientas Zod
└── skill/registro-proveedor/
    └── SKILL.md                    # Habilidad con reglas RN1-RN5 y homologaciones
```

---

## 11. Guía de Despliegue a Producción

La aplicación está diseñada para desplegarse fácilmente en plataformas PaaS modernas (Render, Railway, Fly.io, Azure App Service o Vercel):

### 11.1 Despliegue en Render / Railway
1. **Build Command:** `npm run build && npm run web:build`
2. **Start Command:** `npm start`
3. **Variables de Entorno en el Dashboard:**
   - `NODE_ENV=production`
   - `PORT=3000`
   - `GEMINI_API_KEY=tu_clave_de_produccion`
   - `GEMINI_MODEL=gemini-3.5-flash-lite`

### 11.2 URL Pública de Demostración
> **Enlace del Despliegue en Vivo:**  
> `[URL de Despliegue Público]` *(Se suministrará durante la defensa técnica según la disponibilidad de hosting)*  
> En caso de evaluación local, ejecutar `npm start` y acceder a `http://localhost:3000`.

---

## 12. Estructura del Repositorio

```
dia5/
├── agent/prompt.md                 # System Prompt original del agente
├── docs/                           # Documentación técnica por fases
│   ├── FASE_01_CORE.md
│   ├── FASE_02_BACKEND.md
│   ├── FASE_03_FRONTEND.md
│   ├── FASE_03_1_VALIDACION_E2E.md
│   ├── FASE_03_2_CORRECCIONES.md
│   ├── FASE_04_ENTREGA.md
│   ├── ESTADO_PROYECTO.md
│   └── evidencias/                 # Capturas E2E de Playwright
├── fixtures/reto-01/               # Fuentes de verdad (Maestro, Glosario, Soportes)
├── modulo/                         # Bonus: Módulo empaquetado reutilizable
│   ├── agent.md
│   ├── tools/proveedor.ts
│   └── skill/registro-proveedor/SKILL.md
├── src/                            # Código fuente Backend (TypeScript)
│   ├── core/                       # Motor del agente y sesiones
│   ├── llm/                        # Adaptadores Gemini y Mock
│   ├── services/                   # Mappers, generadores y soportes
│   ├── tools/                      # 5 herramientas tipadas Zod
│   ├── types/                      # Contratos TypeScript
│   └── server.ts                   # Servidor Hono API + SPA
├── test/                           # Suites de pruebas automatizadas
│   ├── e2e/                        # Pruebas con Playwright en Chrome
│   ├── live/                       # Pruebas en vivo con Gemini
│   └── *.test.ts                   # 37 pruebas unitarias e integración
├── web/                            # Frontend SPA (React 19 + Tailwind CSS)
├── demo.ts                         # Demostración determinista CLI
├── README.md                       # Guía de instalación y uso
├── SOLUCION.md                     # Documento maestro de arquitectura y diseño
└── DIAGNOSTICO.md                  # Diagnóstico inicial y fuentes de verdad
```

