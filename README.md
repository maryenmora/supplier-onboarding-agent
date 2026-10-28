# PRD-01: Registro como Proveedor — Agente Conversacional Autónomo
## Periferia IT Group S.A.S. · Reto Técnico Perxia 2.0

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-4.13-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![Gemini](https://img.shields.io/badge/Gemini-3.5--Flash--Lite-8E75B2?logo=google&logoColor=white)](https://ai.google.dev/)
[![Tests](https://img.shields.io/badge/Tests-47%2F47%20passing%20(100%25)-brightgreen)](https://github.com/maryenmora/supplier-onboarding-agent)
[![Deploy](https://img.shields.io/badge/Render-Live-46E3B7?logo=render&logoColor=white)](https://retoperxia-registro-proveedor.onrender.com)

Aplicación Full-Stack de inteligencia artificial que automatiza integralmente el proceso de recepción, diligenciamiento, validación legal y armado de paquetes de registro como proveedor ante clientes corporativos internacionales en **Colombia, Ecuador, Honduras y Panamá**.

---

## 1. Demo Desplegada en Producción (Render)

* 🌐 **URL Pública de la Aplicación:** [https://retoperxia-registro-proveedor.onrender.com](https://retoperxia-registro-proveedor.onrender.com)
* 🐙 **Repositorio Oficial:** [https://github.com/maryenmora/supplier-onboarding-agent](https://github.com/maryenmora/supplier-onboarding-agent) (Rama `main`)

### 1.1 Acceso de Evaluadores con `DEMO_ACCESS_KEY`
Para proteger el consumo de cuotas y garantizar la privacidad de las sesiones de evaluación, la aplicación cuenta con un modal de control de acceso:
1. Al abrir la URL pública, el sistema solicitará la clave de acceso de evaluación.
2. Ingresa la clave **`DEMO_ACCESS_KEY`** (suministrada por separado al equipo evaluador).
3. **Diferenciación de Credenciales:** `DEMO_ACCESS_KEY` es la credencial privada para que los evaluadores accedan a la interfaz web desplegada en Render; es completamente distinta e independiente de `GEMINI_API_KEY`, que es el secreto interno de Google AI Studio alojado de forma segura en las variables de entorno del servidor de Render para procesar el modelo de IA.

### 1.2 Advertencias de Infraestructura (Render Free Tier)
* **Arranque en Frío (Cold Start):** El servicio gratuito de Render entra en reposo tras 15 minutos de inactividad. Si el contenedor se encuentra suspendido, la primera petición tardará aproximadamente **~45 a 60 segundos** mientras se inicializa el contenedor Node.js.
* **Almacenamiento Temporal / Efímero:** El sistema de archivos de Render es efímero. Los archivos generados en `out/sessions/` durante las demostraciones permanecen disponibles para descarga mientras el contenedor continúe activo, pero se reinician si el contenedor entra en reposo o si se despliega un nuevo commit.

---

## 2. Presentación y Arquitectura del Proyecto

### 2.1 Tecnologías Principales
* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons (interfaz responsiva de tres paneles: historial, chat interactivo y métricas de proveedor con descargas).
* **Backend:** Node.js `>= 20.0.0`, TypeScript estricto, Hono Framework (servidor de alto rendimiento que sirve simultáneamente la API REST y el SPA compilado).
* **Motor LLM:** Google Gemini 3.5 Flash-Lite (`@google/genai`) con Function Calling nativo en vivo y preservación de `thoughtSignature`. Incluye adaptador **Mock determinista offline** para pruebas y desarrollo sin consumo de créditos.
* **Generadores de Documentos Binarios:** ExcelJS (hojas de cálculo `.xlsx` con celdas y hojas exactas) y PDFKit (formularios `.pdf` vectoriales de alta precisión).
* **Validación y Seguridad:** Zod (contratos estrictos en las 5 herramientas), Web Crypto / Node Crypto HMAC-SHA256 (tokens de sesión y visitante).

### 2.2 Cobertura Transfronteriza (4 Países Soportados)
| Caso | Cliente | País | Formato | Soportes Clave Evaluados | Veredicto Legal (a Octubre 2026) |
|---|---|:---:|:---:|---|:---:|
| `co-industrias-delta` | Industrias Delta S.A.S. | 🇨🇴 CO | **XLSX** | Cámara Comercio, RUT, Cert. Bancaria, Estados Financieros | **Firma Bloqueada** (Cámara venció 2026-09-30) |
| `ec-corp-andina` | Corp. Andina de Servicios | 🇪🇨 EC | **PDF** | RUC (RN1), Cert. Bancaria, Cumplimiento Tributario | **Firma Bloqueada** (Cámara vencida + Cert. Tributario ausente) |
| `hn-agroexport-sula` | Agroexport Sula S. de R.L. | 🇭🇳 HN | **XLSX** | RTN (RN1), Parafiscales, Constitución | **Firma Bloqueada** (Cámara y Parafiscales vencidos) |
| `pa-logistica-istmo` | Logística del Istmo S.A. | 🇵🇦 PA | **Portal** | RUC (RN1), Registro Público, Formulario Web | **Firma Bloqueada** (Cámara vencida) |

### 2.3 Las Cinco Herramientas del Agente (Zod Contracts)
1. **`proveedor_leer_solicitud`:** Ingesta y análisis estructurado de requerimientos de clientes desde plantillas y metadatos.
2. **`proveedor_mapear_campos`:** Mapeo determinista contra `maestro.json` asistido por un glosario de 38 sinónimos, aplicando la regla fiscal **RN1** (homologación de NIT a RUC/RTN en el extranjero).
3. **`proveedor_generar_formulario`:** Generación binaria física de archivos `.xlsx` reales (`exceljs`), documentos `.pdf` nativos (`pdfkit`) y guías estructuradas `valores-portal.md`.
4. **`proveedor_armar_paquete`:** Consolidación física de soportes exigidos, generación de `checklist.md` con semáforo de vigencias (regla **RN3**) y redacción de `borrador-correo.md` protegiendo datos bancarios (regla **RN2**).
5. **`proveedor_simular_envio`:** Despacho controlado que exige confirmación humana obligatoria en dos fases (regla **RN4**) y bloquea terminantemente el envío ante paquetes con soportes vencidos o ausentes.

---

## 3. Matriz de Validación Técnica y Calidad

El sistema cuenta con verificación integral documentada a través de las distintas capas de la solución:

| Validación | Resultado | Detalle y Alcance Técnico |
|---|:---:|---|
| **Pruebas unitarias e integración** | **47/47 aprobadas (100%)** | Ejecución offline en ~4.18s con 0 consumo de tokens (MockAdapter). Cobertura de herramientas, reglas RN1-RN5, reloj inyectable, formateador de fechas, aislamiento de sesiones y seguridad de credenciales. |
| **Compilación Frontend & Backend** | **Exitosa (0 errores)** | `npm run build` (`npm run web:build && tsc`) compila el bundle SPA en `web/dist` y el backend en TypeScript estricto. |
| **Demo determinista por consola** | **4/4 casos verificados** | `npm run demo` valida secuencialmente los 4 casos del PRD con 100% de integridad, determinismo y generación física de archivos en `out/`. |
| **E2E Playwright en Navegador Real** | **Reportado exitoso** | 13 pasos en Google Chrome headless, 9 capturas fotográficas en `docs/evidencias/`, 0 errores `'Invalid Date'`, 0 cruces multi-visitante. |
| **Gemini Real en Render** | **Flujo Colombia Verificado** | Caso `co-industrias-delta` ejecutado en vivo en Render con Gemini 3.5 Flash-Lite real, encadenando 4 herramientas reales consecutivas y explicando el bloqueo legal por vigencia de soportes. *(Nota: Los otros 3 casos han sido validados de forma integral y determinista en la suite automatizada)*. |
| **Descarga de Excel en Render** | **Validada visualmente y funcional** | Descarga en memoria vía Blob con cabecera `x-session-token`, archivo `formulario.xlsx` generado físicamente, descargado desde la UI y abierto/verificado directamente en Microsoft Excel. |

### 3.1 Métrica de Costos de Google Gemini 3.5 Flash-Lite
* **Tarifas estándar oficiales de pago (Google AI Studio):**
  * Entrada: **USD 0,30 / millón de tokens**.
  * Salida: **USD 2,50 / millón de tokens**.
* **Consumo registrado en ejecución E2E completa:**
  * Entrada: 15.618 tokens.
  * Salida: 1.155 tokens.
  * **Costo comercial estimado total: USD 0,0075729 por caso completo**.
* **Importe efectivamente facturado:** **USD 0,00** (cubierto por el nivel gratuito Free Tier de Google AI Studio durante las pruebas).

---

## 4. Arquitectura de Seguridad y Privacidad

1. **Separación Estricta de Credenciales (Fix Render):**
   * El frontend transmite la clave de demostración **única y exclusivamente** mediante la cabecera `x-demo-key`.
   * El token propietario de sesión se transmite mediante `x-session-token`.
   * El backend otorga prioridad absoluta a `x-session-token` y nunca interpreta una clave de demostración Bearer como credencial de sesión, eliminando colisiones en endpoints protegidos.
2. **Descargas Protegidas en Memoria (Zero URL Secrets):**
   * Las descargas de artefactos se realizan mediante `fetch` asíncrono con cabecera `x-session-token` y generación de `Blob` en memoria efímera (`URL.createObjectURL` / `URL.revokeObjectURL`).
   * El servidor deniega inmediatamente con **`HTTP 401 Unauthorized`** cualquier petición que intente transmitir `?token=`, `?sessionToken=`, `?key=` o `?demoKey=` en la URL.
3. **Control Human-in-the-Loop y Protección Legal:**
   * La ratificación de despacho requiere autorización humana en dos fases mediante token criptográfico temporal vinculado a la sesión y caso (regla **RN4**).
   * Si el paquete presenta soportes vencidos o ausentes, la interfaz inhabilita el botón de confirmación (*"Envío Inhabilitado"*) y el backend rechaza cualquier intento forzado con **`HTTP 400 Bad Request`** (regla **RN3**).
4. **Protección de Datos Sensibles (RN2):**
   * Anonimización automática de datos bancarios en el borrador de correo (`borrador-correo.md`).
   * Todos los fixtures de prueba utilizan identificadores, teléfonos y datos corporativos ficticios.
5. **Rate Limiting Compatible con Proxy Reverso de Render (1 Hop):**
   * Inspección de la última dirección IP válida de la cabecera `X-Forwarded-For` aportada por el proxy confiable de Render, neutralizando la elusión de límites por suplantación de prefijos.

---

## 5. Documentación y Entregables del Proyecto

* 📘 [`SOLUCION.md`](SOLUCION.md): Documento maestro de arquitectura, diseño de bases de datos, homologación transfronteriza y análisis técnico (10 secciones oficiales de la rúbrica).
* 📁 [`docs/`](docs/): Bitácora técnica y auditoría acumulada por fases:
  * `docs/FASE_01_CORE.md`: Core de herramientas y validación determinista inicial.
  * `docs/FASE_02_BACKEND.md`: Integración Gemini, bucle de herramientas y API Hono.
  * `docs/FASE_03_FRONTEND.md`: Arquitectura React 19 y experiencia UX tripartita.
  * `docs/FASE_03_1_VALIDACION_E2E.md`: Reporte de validación Playwright en navegador real.
  * `docs/FASE_03_2_CORRECCIONES.md`: Corrección de fechas ISO 8601, consistencia de casos y firmas.
  * `docs/FASE_04_ENTREGA.md`: Bonus módulo reutilizable y auditoría de rúbrica.
  * `docs/VALIDACION_FINAL_PUBLICACION.md`: Auditoría de prepublicación y costos.
  * `docs/PUBLICACION_GITHUB.md`: Historial de sincronización segura con GitHub `origin/main`.
  * `docs/CORRECCION_FINAL_SEGURIDAD.md`: Auditoría forense de credenciales y proxy Render.
  * `docs/FIX_DESCARGAS_RENDER.md`: Causa raíz y solución del bug de descargas en producción.
  * `docs/ESTADO_PROYECTO.md`: Tablero consolidado de avance y cumplimiento.
  * `docs/evidencias/`: 9 capturas fotográficas en alta resolución de la ejecución en navegador real.
* 📦 **Bonus: Módulo Reutilizable Standalone (`modulo/`):**
  * `modulo/agent.md`: System prompt y configuración del agente para orquestadores externos.
  * `modulo/tools/proveedor.ts`: Re-exportación desacoplada de las 5 herramientas tipadas con Zod.
  * `modulo/skill/registro-proveedor/SKILL.md`: Habilidad empaquetada con reglas RN1-RN5 y homologaciones.

---

## 6. Instalación y Ejecución Local

### 6.1 Requisitos Previos
* **Node.js:** `>= 20.0.0` (recomendado Node.js 20 LTS o 22 LTS).
* **npm:** `>= 10.0.0` (incluido con Node.js).
* **Google Chrome:** Requerido únicamente para ejecutar la suite E2E de Playwright.

### 6.2 Pasos de Instalación
```bash
# 1. Clonar el repositorio
git clone https://github.com/maryenmora/supplier-onboarding-agent.git
cd supplier-onboarding-agent

# 2. Instalar dependencias del backend y del frontend
npm install
npm install --prefix web

# 3. Configurar variables de entorno
cp .env.example .env
```

### 6.3 Configuración del Archivo `.env`
```ini
# Clave privada de Google Gemini (opcional; si se omite, opera en Modo Mock determinista con costo $0)
GEMINI_API_KEY=tu_clave_de_gemini_aqui

# Modelo recomendado por equilibrio entre costo, latencia y Function Calling
GEMINI_MODEL=gemini-3.5-flash-lite

# Puerto HTTP del servidor unificado
PORT=3000

# Parámetros de seguridad y cuotas
MAX_AGENT_ITERATIONS=15
MAX_SESSION_TOKENS=50000
NODE_ENV=development
```

### 6.4 Comandos de Compilación y Ejecución (`package.json`)
```bash
# Compilar frontend (Vite) y backend (TypeScript)
npm run build

# Iniciar servidor backend unificado (API REST + Frontend SPA en http://localhost:3000)
npm start

# Ejecutar la verificación determinista por consola (4/4 casos, sin navegador ni LLM)
npm run demo

# Ejecutar la suite completa de 47 pruebas unitarias e integración (Offline / Zero-Cost)
npm test

# Ejecutar la validación E2E en navegador real (Playwright + Google Chrome Headless)
npm run test:e2e

# Ejecutar prueba E2E en vivo con Gemini real (requiere GEMINI_API_KEY en .env)
npm run test:live

# Desarrollo frontend interactivo con Vite HMR
npm run web:dev
```

---

## 7. Estructura del Repositorio

```
supplier-onboarding-agent/
├── agent/prompt.md                 # System Prompt maestro del agente
├── docs/                           # Informes técnicos por fases y evidencias E2E
│   ├── FASE_01_CORE.md ... FASE_04_ENTREGA.md
│   ├── CORRECCION_FINAL_SEGURIDAD.md
│   ├── FIX_DESCARGAS_RENDER.md
│   ├── ESTADO_PROYECTO.md
│   └── evidencias/                 # 9 capturas E2E de Playwright
├── fixtures/reto-01/               # Fuentes de verdad (Maestro, Glosario, Soportes)
├── modulo/                         # Bonus: Módulo empaquetado reutilizable
│   ├── agent.md
│   ├── tools/proveedor.ts
│   └── skill/registro-proveedor/SKILL.md
├── src/                            # Código fuente Backend (TypeScript estricto)
│   ├── core/                       # Motor conversacional (AgentEngine) y sesiones
│   ├── generators/                 # Generadores físicos de Excel, PDF y Portal Markdown
│   ├── llm/                        # Adaptadores oficiales Gemini (@google/genai) y Mock
│   ├── services/                   # Mappers, evaluación de soportes y bitácora
│   ├── tools/                      # 5 herramientas tipadas con Zod
│   ├── types/                      # Contratos TypeScript
│   └── server.ts                   # Servidor Hono API REST + SPA
├── test/                           # Suites de pruebas automatizadas
│   ├── e2e/browser-validation.ts   # Validación completa con Playwright en Chrome
│   ├── live/                       # Prueba en vivo con Gemini real
│   └── *.test.ts                   # 47 pruebas unitarias y de integración
├── web/                            # Frontend SPA (React 19, TypeScript, Vite, Tailwind)
│   ├── src/components/             # Paneles (LeftSidebar, ChatView, RightSidebar, Modal)
│   ├── src/services/api.ts         # Cliente API seguro con descargas en memoria vía Blob
│   └── dist/                       # SPA compilado para producción
├── demo.ts                         # Script determinista CLI (Zero-LLM)
├── package.json                    # Scripts y dependencias del proyecto
├── render.yaml                     # Blueprint declarativo para despliegue en Render
├── README.md                       # Guía oficial del proyecto y documentación de entrega
└── SOLUCION.md                     # Documento maestro de arquitectura y diseño
```
