# FASE 5: AUDITORÍA DE PREPUBLICACIÓN Y PREPARACIÓN PARA GITHUB + RENDER

**Proyecto:** PRD-01: Registro como Proveedor  
**Organización:** Periferia IT Group — Capacitación Equipo Perxia 2.0  
**Fecha de Auditoría:** 2026-10-28  
**Autor:** Maryen Mora — Arquitecto Full-Stack Senior, DevSecOps y Especialista en Agentes de IA  
**Veredicto:** **APTO PARA DESPLIEGUE**

---

## 1. Objetivo y Alcance

La **Fase 5** constituye la auditoría de prepublicación, aseguramiento de seguridad y preparación operativa para la publicación controlada del proyecto en un repositorio público de GitHub y su despliegue continuo en la plataforma en la nube Render.

El alcance comprende:
1. **Auditoría y corrección de métricas de costos y autoevaluación:** Ajuste formal a tarifas oficiales de Google Gemini 3.5 Flash-Lite, diferenciación entre costo estimado e importe facturado real, eliminación de afirmaciones de ahorro no sustentadas empíricamente, y tipificación adecuada de la autoevaluación de puntaje (110/100 proyectado).
2. **Aseguramiento de seguridad para despliegue público (DevSecOps):** Blindaje contra manipulación temporal (`referenceDate`), control de cuota por sesión (`MAX_SESSION_TOKENS`), bloqueo estricto de firmas inválidas, aislamiento de memoria, sanitización contra Path Traversal y mitigación de fallos upstream en el LLM.
3. **Configuración para Render Cloud:** Orquestación mediante `render.yaml`, unificación de scripts de build (`npm run build`), binding en `0.0.0.0`, soporte de puerto dinámico `PORT`, health check `/api/health`, servicio SPA con fallback resiliente, y promoción de `tsx` a dependencias directas de producción.
4. **Auditoría de Control de Versiones (Git):** Verificación exhaustiva de `.gitignore`, inicialización del repositorio local y preparación de commit inicial libre de secretos, credenciales o archivos temporales. **Cumplimiento estricto: Cero pushes no autorizados a repositorios remotos.**
5. **Validación técnica integral:** 39 pruebas automatizadas aprobadas, build limpio, demo determinista exitosa y suite E2E de Playwright con 9 evidencias visuales.

---

## 2. Auditoría y Corrección de Métricas de Costos y Evaluación

### 2.1. Tarifas Oficiales Google Gemini 3.5 Flash-Lite
De acuerdo con las tarifas vigentes verificadas para el modelo `gemini-3.5-flash-lite`:
- **Tarifa Input (Prompt):** USD 0,30 por millón de tokens ($0.00000030 / token).
- **Tarifa Output (Completion / Generation):** USD 2,50 por millón de tokens ($0.00000250 / token).

### 2.2. Desglose del Consumo Real en Prueba E2E (Caso Colombia con 4 Tool Calls)
- **Prompt Tokens acumulados:** 15.618 tokens.
- **Candidates (Completion) Tokens:** 1.155 tokens.
- **Total de Tokens:** 16.773 tokens.
- **Cálculo de Costo Estimado Comercial:**
  $$\text{Costo Input} = 15.618 \times \frac{0,30}{1.000.000} = \text{USD } 0,0046854$$
  $$\text{Costo Output} = 1.155 \times \frac{2,50}{1.000.000} = \text{USD } 0,0028875$$
  $$\textbf{Costo Total Estimado} = \text{USD } 0,0075729$$

### 2.3. Diferenciación de Costo Facturado Real vs. Estimado
- **Costo Facturado Real:** **USD 0,00**. Google AI Studio ofrece un nivel gratuito (Free Tier) dentro de los límites de rate limit estándar para desarrollo y pruebas técnicas, por lo que la ejecución no generó cargos bancarios a la organización.
- **Costo en Entorno Productivo:** Proyectado en menos de **USD 0,008** por caso de registro completo (un tercio de centavo de dólar por expediente auditado).

### 2.4. Supresión de Supuestos No Medidos y Corrección de Puntuación
- **Ahorros de personal:** Se eliminaron estimaciones de "ahorro de horas hombre" o "90% de reducción de personal" que carecen de medición observacional en un entorno de producción real.
- **Calificación Obtenida:** Se corrigió cualquier afirmación que presentara "110 puntos obtenidos" como una calificación definitiva. Se estipuló que 110/100 (100 base + 10 bono de empaquetado) representa la **autoevaluación técnica y proyección de cumplimiento del equipo**, cuya calificación final dependerá de la evaluación externa de los evaluadores técnicos de Periferia IT Group.

---

## 3. Auditoría de Seguridad para Despliegue Público (DevSecOps)

Se implementaron y auditaron controles de seguridad en profundidad:

| Vector de Riesgo | Amenaza Potencial | Control Implementado | Estado |
| :--- | :--- | :--- | :---: |
| **Manipulación Temporal** | Un usuario malicioso podría enviar `referenceDate` en el payload de `/api/chat` para validar soportes vencidos en producción. | `src/server.ts` evalúa `NODE_ENV`. Si `NODE_ENV === "production"` y `ALLOW_REFERENCE_DATE !== "true"`, el servidor descarta el parámetro del cliente y fuerza la fecha real del sistema (`new Date()`). | **MITIGADO** |
| **Agotamiento de Cuota (DoS)** | Un usuario o bucle descontrolado podría enviar miles de mensajes agotando el presupuesto de tokens de Gemini. | Se implementó validación de `MAX_SESSION_TOKENS` (50.000 tokens por defecto). Si la sesión supera este límite, `/api/chat` rechaza la solicitud inmediatamente con **HTTP 429 Too Many Requests**. | **MITIGADO** |
| **Confirmación de Paquetes Inválidos** | Un usuario podría intentar forzar la simulación de envío de un paquete con firma bloqueada (ej. soportes vencidos). | Validación en dos niveles: 1) `agent.ts` y `server.ts` inspeccionan `checklist.md` en disco; si contiene `¿Listo para firma?: NO` o `BLOQUEADO`, rechazan con **HTTP 400**. 2) El botón en la UI permanece deshabilitado. | **MITIGADO** |
| **Confirmación Cruzada de Sesiones** | Ratificar una acción para el caso B utilizando un token emitido para el caso A. | `session.confirmPending(token, caso)` exige coincidencia estricta del ID del caso y del token criptográfico unívoco, invalidándolo tras su primer uso (**Single-Use**). | **MITIGADO** |
| **Path Traversal en Descargas** | Peticiones a `/api/artifacts/:caso/:file` con secuencias `../` para extraer archivos sensibles del sistema (ej. `.env`). | Validación mediante expresiones regulares estrictas (`/^[a-zA-Z0-9_-]+$/` y `/^[a-zA-Z0-9._-]+$/`) y verificación de prefijo de ruta absoluta `startsWith(outDir)`. | **MITIGADO** |
| **Exposición de Credenciales** | Fugas accidentales de `GEMINI_API_KEY` en logs, respuestas de API o commits de Git. | 1) `/api/health` retorna metadatos de configuración pública (`model`, `provider`, `modelAvailable`) pero jamás la clave. 2) `.gitignore` estricto ignora `.env*`. 3) `render.yaml` declara `sync: false` para secrets. | **MITIGADO** |
| **Envío No Autorizado de Correos** | Riesgo de que la aplicación emita correos reales a clientes durante las pruebas. | La herramienta `proveedor_simular_envio` opera en sandbox local: redacta el archivo `ENVIO-SIMULADO.md` en `out/<caso>/paquete/` y jamás establece conexiones SMTP ni invoca servicios externos de correo. | **MITIGADO** |
| **Saturación o Caída del LLM (429/503)** | Límites de tasa o interrupciones momentáneas de la API de Google Gemini. | `GeminiAdapter` implementa reintentos con retroceso exponencial (`exponential backoff`) de 3 intentos ante códigos 429, 503 o `RESOURCE_EXHAUSTED`. | **MITIGADO** |

---

## 4. Arquitectura y Preparación para Render Cloud

### 4.1. Archivo `render.yaml` (Blueprint Declarativo)
Se configuró el archivo `render.yaml` en la raíz del proyecto para permitir el aprovisionamiento automatizado tipo Infrastructure as Code:

```yaml
services:
  - type: web
    name: retoperxia-registro-proveedor
    runtime: node
    plan: free
    region: oregon
    buildCommand: npm install && npm install --prefix web && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: HOST
        value: 0.0.0.0
      - key: GEMINI_MODEL
        value: gemini-3.5-flash-lite
      - key: MAX_AGENT_ITERATIONS
        value: "15"
      - key: MAX_SESSION_TOKENS
        value: "50000"
      - key: ALLOW_REFERENCE_DATE
        value: "false"
      - key: GEMINI_API_KEY
        sync: false
```

### 4.2. Decisiones Técnicas para Render
1. **Binding en `0.0.0.0` y Puerto Dinámico:**
   En `src/server.ts`, el servidor `@hono/node-server` se enlaza a `hostname: process.env.HOST || "0.0.0.0"` y `port: Number(process.env.PORT || 3000)`. Esto garantiza que el balanceador de carga de Render enrute el tráfico correctamente hacia el contenedor.
2. **Dependencia Directa de `tsx`:**
   En `package.json`, `tsx` fue trasladado de `devDependencies` a `dependencies`. Esto evita errores de ejecución en entornos donde el gestor de paquetes de Render instala con `--omit=dev` o `NODE_ENV=production`.
3. **Pipeline de Construcción Unificado (`npm run build`):**
   El comando `npm run build` ejecuta en secuencia:
   1. `npm run build --prefix web`: Ejecuta `tsc` del frontend y `vite build`, empaquetando los activos en `web/dist/`.
   2. `tsc`: Valida el tipado estricto del backend TypeScript.
4. **Servicio SPA con Fallback:**
   `src/server.ts` sirve los archivos estáticos de `web/dist/` mediante `serveStatic` y cuenta con un manejador comodín `app.get("*")` que sirve `web/dist/index.html` para cualquier ruta del frontend (excluyendo `/api/*`), permitiendo navegación directa y recargas sin errores 404.
5. **Ruta de Verificación de Salud (`healthCheckPath`):**
   Render sondea periódicamente `/api/health`. El endpoint verifica la disponibilidad del adaptador LLM y retorna `HTTP 200` confirmando que la aplicación está lista para recibir tráfico.

### 4.3. Guía Paso a Paso para Despliegue en Render
1. **Opción A (Recomendada - Render Blueprint):**
   - Conectar la cuenta de GitHub con Render.
   - En el dashboard de Render, seleccionar **New +** > **Blueprint**.
   - Conectar el repositorio `retoperxia-registro-proveedor`.
   - Render detectará automáticamente `render.yaml`.
   - En el formulario inicial, Render solicitará el valor de `GEMINI_API_KEY` (marcado como `sync: false`). Ingresar la clave de Google AI Studio.
   - Hacer clic en **Apply**.
2. **Opción B (Manual - Web Service):**
   - Seleccionar **New +** > **Web Service**.
   - Conectar el repositorio de GitHub.
   - Configuración:
     - **Runtime:** `Node`.
     - **Build Command:** `npm install && npm install --prefix web && npm run build`.
     - **Start Command:** `npm start`.
     - **Health Check Path:** `/api/health`.
   - **Environment Variables:**
     - `NODE_ENV` = `production`
     - `GEMINI_API_KEY` = `<tu-api-key-secreta>`
     - `GEMINI_MODEL` = `gemini-3.5-flash-lite`
     - `MAX_AGENT_ITERATIONS` = `15`
     - `MAX_SESSION_TOKENS` = `50000`
     - `ALLOW_REFERENCE_DATE` = `false`

---

## 5. Auditoría de Git y Control de Versiones

### 5.1. Verificación de `.gitignore`
Se auditó y fortaleció el archivo `.gitignore` para garantizar que ningún secreto, dependencia o directorio efímero pueda ser versionado:

```gitignore
# Dependencias
node_modules/
web/node_modules/

# Compilados y artefactos de build
dist/
web/dist/

# Directorios de salida de ejecuciones locales y pruebas
out/
test-results/
playwright-report/

# Variables de entorno y secretos (NUNCA versionar)
.env
.env.*
!.env.example

# Logs y volcados de depuración
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Sistema operativo y metadatos locales
.DS_Store
Thumbs.db
.system_generated/
```

### 5.2. Estado del Repositorio Local
- Se inicializó el repositorio Git local (`git init`).
- Se verificó mediante `git status --short` y `git add -n .` que el árbol de trabajo contiene únicamente:
  - Código fuente del backend (`src/`) y frontend (`web/src/`).
  - Pruebas automatizadas (`test/`).
  - Módulo reutilizable de empaquetado (`modulo/`).
  - Fixtures de prueba originales e inmutables (`fixtures/reto-01/`).
  - Documentación técnica exhaustiva (`docs/`, `SOLUCION.md`, `README.md`, `DIAGNOSTICO.md`).
  - Evidencias fotográficas requeridas (`docs/evidencias/`).
  - Configuraciones de entorno y despliegue (`.env.example`, `render.yaml`, `package.json`, `tsconfig.json`).
- **Verificación de Seguridad:** No existe ningún archivo `.env` con credenciales reales rastreado ni en el sistema.

### 5.3. Restricción de Publicación
> [!IMPORTANT]
> **Conforme a la regla de gobernanza y las instrucciones del usuario, NO se ha ejecutado ningún `git push` ni se ha configurado ningún repositorio remoto.** El repositorio permanece local y listo para el commit inicial una vez que el usuario otorgue su autorización explícita.

---

## 6. Resultados de las Pruebas y Verificación Integral

Se ejecutó la suite completa de aseguramiento de calidad antes de emitir el veredicto:

```bash
# 1. Compilación unificada Frontend + Backend
$ npm run build
✓ 1597 modules transformed (Vite React 19).
dist/index.html                   0.70 kB │ gzip:  0.47 kB
dist/assets/index-B8WuAQUd.css   23.50 kB │ gzip:  4.83 kB
dist/assets/index-ADYFimOx.js   270.91 kB │ gzip: 80.85 kB
✓ built in 2.65s
tsc exit code: 0

# 2. Suite de Pruebas Unitarias y de Seguridad (Offline - Cero consumo de créditos)
$ npm run test
ℹ tests 39
ℹ pass 39
ℹ fail 0
ℹ duration_ms 3849.0584

# 3. Demostración Determinista de Herramientas (Zero-LLM)
$ npm run demo
✓ co-industrias-delta: xlsx generado, checklist bloqueado por cámara de comercio.
✓ ec-corp-andina: pdf generado, checklist bloqueado por cámara y cumplimiento tributario.
✓ hn-agroexport-sula: xlsx generado, checklist bloqueado por cámara y parafiscales.
✓ pa-logistica-istmo: portal md generado, checklist bloqueado por cámara de comercio.
✓ Integridad y determinismo 100%.

# 4. Suite E2E de Playwright en Navegador Real (Google Chrome)
$ npm run test:e2e
✓ 9 evidencias visuales guardadas en docs/evidencias/
✓ Verificación 'Invalid Date': 0 ocurrencias en el DOM.
✓ Bloqueo de confirmación cruzada y paquetes bloqueados en UI y backend.
✓ Cero errores de página o excepciones no controladas.
```

---

## 7. Matriz de Cumplimiento, Riesgos y Acciones Correctivas

| Requisito / Dimensión | Criterio de Aceptación | Estado | Evidencia / Mecanismo de Control |
| :--- | :--- | :---: | :--- |
| **Corrección de Costos** | Tarifas $0.30/M input, $2.50/M output, total $0.0075729 USD. | **CUMPLIDO** | `SOLUCION.md`, `FASE_04_ENTREGA.md`, `ESTADO_PROYECTO.md`. |
| **Diferenciación de Facturación** | Separar costo estimado de importe facturado real ($0.00 USD). | **CUMPLIDO** | Sección 4 de `SOLUCION.md` y Sección 2 de este documento. |
| **Autoevaluación de Puntaje** | Reportar 110/100 como proyección de autoevaluación técnica. | **CUMPLIDO** | Documentos actualizados aclarando la sujeción a evaluación del jurado. |
| **Restricción de referenceDate** | Prohibir manipulación de reloj en producción. | **CUMPLIDO** | `src/server.ts` con guarda `NODE_ENV === "production"`. Test aprobado en `server.test.ts`. |
| **Control de Presupuesto** | Límite `MAX_SESSION_TOKENS` con respuesta 429. | **CUMPLIDO** | `src/server.ts` rechaza con 429 si se excede el límite. Test aprobado. |
| **Preparación Render** | `render.yaml`, `0.0.0.0`, fallback SPA, health check. | **CUMPLIDO** | `render.yaml` creado, `server.ts` ajustado y probado con `web:build`. |
| **Dependencia `tsx`** | `tsx` disponible en dependencias de producción. | **CUMPLIDO** | `package.json` actualizado en `dependencies`. |
| **Auditoría Git** | `.gitignore` limpio, cero secretos, repo local inicializado. | **CUMPLIDO** | `git init` ejecutado, `git add -n .` limpio de secretos y `.env`. |
| **Respeto a Reglas de Despliegue** | NO publicar ni hacer push sin autorización expresa. | **CUMPLIDO** | Ningún repositorio remoto añadido ni push ejecutado. |

---

## 8. Veredicto Final

### **APTO PARA DESPLIEGUE**

**Fundamentación Técnica:**
1. **Seguridad y DevSecOps:** El sistema se encuentra totalmente blindado contra manipulaciones temporales de evaluación, sobreconsumo de tokens, descargas no autorizadas (Path Traversal), confirmaciones cruzadas entre clientes y falsificación de ratificaciones humanas.
2. **Calidad y Estabilidad:** 39 de 39 pruebas automatizadas pasan al 100%. La compilación de React 19 y TypeScript es completamente limpia y reproducible.
3. **Compatibilidad Cloud:** La configuración declarativa en `render.yaml` y la unificación de scripts permiten un despliegue sin fricciones en Render bajo Node.js 20+.
4. **Transparencia y Rigor:** La documentación de costos, consumo de tokens y evaluación se encuentra completamente alineada con la realidad observada y sustentada matemáticamente.
5. **Gobernanza:** Todos los secretos permanecen resguardados exclusivamente en variables de entorno locales, y el control de versiones está en estado óptimo a la espera de la autorización final del usuario para el primer commit y posterior publicación.
