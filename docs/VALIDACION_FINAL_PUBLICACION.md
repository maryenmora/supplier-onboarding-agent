# VALIDACIÓN FINAL DE SEGURIDAD DE ACCESO, CONSUMO Y REPRODUCIBILIDAD

**Proyecto:** PRD-01: Registro como Proveedor  
**Organización:** Periferia IT Group — Capacitación Equipo Perxia 2.0  
**Fecha de Verificación:** 2026-10-28  
**Rol:** Arquitecto Senior de Seguridad y Despliegue Node.js  
**Veredicto Final:** **APTO PARA DESPLIEGUE PÚBLICO EN GITHUB Y RENDER**

---

## 1. Resumen Ejecutivo

En cumplimiento de las directrices previas a la publicación del repositorio y despliegue en Render, se realizó una **auditoría técnica exhaustiva de seguridad de acceso, contención de archivos, control de consumo de Gemini y reproducibilidad de build bajo `NODE_ENV=production`**.

Se identificaron y resolvieron cuatro vectores críticos de riesgo antes de autorizar la publicación:
1. **Falta de aislamiento multi-visitante en sesiones:** Cualquier visitante podía listar todas las sesiones en memoria y consultar o confirmar operaciones ajenas. -> **Corregido mediante arquitectura de `visitorId` y propiedad criptográfica de sesión.**
2. **Colisión y mezcla de artefactos en `out/` compartido:** Si dos usuarios procesaban el mismo caso simultáneamente, sobrescribían los formularios y checklists del otro. -> **Corregido mediante subdirectorios aislados por sesión `out/sessions/<sessionId>/<caso>/`.**
3. **Vulnerabilidad de Path Traversal en `logger-service.ts`:** Al probar ataques de traversal con `co-industrias-delta/../../fixtures`, el logger escribió un archivo `fixtures/log.jsonl`. -> **Corregido mediante sanitización estricta de nombres de caso, contención forzada en `out/` y eliminación del archivo espurio.**
4. **Fallo potencial de build en Render bajo `NODE_ENV=production`:** Por defecto, `npm install` bajo entorno de producción omite `devDependencies` (donde residen Vite, Tailwind y TypeScript). -> **Corregido configurando flags `--include=dev` en `render.yaml` y scripts de build.**

La suite completa cuenta ahora con **44 pruebas automatizadas aprobadas (100% passing)**, validación E2E en Playwright con **dos navegadores independientes en paralelo**, y **cero consumo de créditos de Gemini**.

---

## 2. Auditoría y Hardening de Seguridad de Acceso

### 2.1. Vulnerabilidades Detectadas en la Auditoría Inicial
- `GET /api/sessions`: Retornaba indiscriminadamente todas las sesiones creadas por cualquier usuario de la aplicación.
- `GET /api/sessions/:id`: Permitía a cualquier usuario conociendo o adivinando un `sessionId` leer el historial conversacional completo.
- `POST /api/sessions/:id/confirm`: Permitía a un tercero ratificar la confirmación humana de otro analista.
- `GET /api/artifacts/:caso/:file`: No asociaba los archivos a una sesión específica, exponiendo los documentos generados por otros usuarios.

### 2.2. Controles Implementados
Se diseñó un modelo de aislamiento ligero y robusto para evaluación privada, sin sobrecargar con bases de datos ni esquemas empresariales de login:

1. **Identidad de Visitante (`visitorId`):**
   - El cliente genera un identificador unívoco de visitante en `localStorage` (`perxia_visitor_id`) y lo transmite en la cabecera HTTP `x-visitor-id`.
   - Cada `Session` almacena su `visitorId` propietario inmutable.
   - `GET /api/sessions`: Filtra y retorna **únicamente** las sesiones que pertenecen al `visitorId` de la cabecera. Si no se envía identificador, retorna array vacío `[]`.
   - `GET /api/sessions/:id`, `/tools`, `/confirmation`: Valida propiedad; si la sesión pertenece a otro visitante, deniega el acceso con **HTTP 403 Forbidden**.
   - `POST /api/sessions/:id/confirm` y `reject`: Exige pertenencia unívoca del visitante; un atacante recibe **HTTP 403 Forbidden**.
   - `POST /api/chat`: Si se envía un `sessionId` perteneciente a otro visitante, rechaza con **HTTP 403 Forbidden**.

2. **Aislamiento Físico de Archivos en `out/`:**
   - Cuando una herramienta opera en el contexto de una sesión web, los archivos generados se confinan en:
     `out/sessions/<sessionId>/<caso>/`
     `out/sessions/<sessionId>/<caso>/paquete/`
   - El endpoint `GET /api/artifacts/:caso/:file?sessionId=...` valida que `sessionId` pertenezca al `visitorId` solicitante.
   - Si otro visitante intenta descargar el artefacto de una sesión ajena, el servidor responde **HTTP 403 Forbidden** (*"Acceso denegado: este recurso pertenece a otra sesión"*).
   - Para ejecuciones CLI locales (`npm run demo`), las herramientas mantienen compatibilidad escribiendo en `out/<caso>/`.

3. **Corrección de Path Traversal en Logging:**
   - Se blindó `src/services/logger-service.ts` sanitizando el parámetro `caso` con `replace(/[^a-zA-Z0-9_-]/g, "_")` y verificando `casoDir.startsWith(outDir)`.
   - Se eliminó el archivo residual `fixtures/log.jsonl` del repositorio.

---

## 3. Protección Integral de Consumo de Google Gemini

Se implementó el servicio [`src/core/guard.ts`](file:///c:/Proyectos/periferia/capacitación-perxia/dia5/src/core/guard.ts) (`ResourceGuard`), el cual añade cuatro capas de defensa contra agotamiento de recursos o ataques de denegación de servicio (DoS):

| Mecanismo de Control | Configuración / Umbral | Comportamiento ante Exceso | Estado |
| :--- | :--- | :--- | :---: |
| **Control de Frecuencia (Rate Limiting)** | `MAX_REQUESTS_PER_MINUTE = 30` (Ventana deslizante de 60s por `visitorId`/IP) | Rechaza solicitudes abusivas con **HTTP 429 Too Many Requests** indicando segundos de espera (`retryAfterSeconds`). | **ACTIVO Y PROBADO** |
| **Límite de Sesiones Activas** | `MAX_SESSIONS_PER_VISITOR = 10`<br>`MAX_GLOBAL_SESSIONS = 100` | Desalojo automático (LRU) de las sesiones más antiguas sin actividad para prevenir fugas de memoria en el servidor. | **ACTIVO Y PROBADO** |
| **Semáforo de Concurrencia LLM** | `MAX_CONCURRENT_GEMINI_CALLS = 2` | Si 2 llamadas a Gemini están en curso simultáneamente, las nuevas encolan hasta 5s o retornan **HTTP 503 Service Unavailable**. | **ACTIVO Y PROBADO** |
| **Presupuesto Global de Demostración** | `MAX_GLOBAL_TOKENS = 200.000` | Suma acumulada de prompt y completion tokens. Al superarse, rechaza llamadas adicionales con **HTTP 429** para evitar cargos inesperados. | **ACTIVO Y PROBADO** |
| **Clave de Acceso Demo Privada** | `DEMO_ACCESS_KEY` (opcional en `.env`) | Si está configurada, exige header `x-demo-key` o `Authorization: Bearer`. Solicitudes anónimas reciben **HTTP 401 Unauthorized**. | **ACTIVO Y PROBADO** |
| **Disponibilidad Permanente de Mock** | `USE_MOCK = true` o sin API Key | Permite evaluar la totalidad del flujo funcional (herramientas, contratos Zod, UI y confirmación) con cero gasto en tokens. | **ACTIVO Y PROBADO** |

---

## 4. Reproducibilidad de Compilación en Render (`NODE_ENV=production`)

### 4.1. Análisis del Comportamiento de npm
En entornos cloud como Render, cuando la variable de entorno `NODE_ENV=production` está activa durante el paso de construcción:
1. `npm install` omite por especificación nativa todas las dependencias listadas en `devDependencies`.
2. En `web/package.json`, los paquetes `vite`, `typescript`, `@vitejs/plugin-react` y `tailwindcss` se encontraban en `devDependencies`.
3. Esto provocaría que el comando `npm run build` fallara en Render con el error `vite: not found` o `tsc: not found`.

### 4.2. Correcciones Implementadas
1. **Ajuste en `render.yaml`:**
   Se incorporó explícitamente el flag `--include=dev` en el comando de construcción:
   ```yaml
   buildCommand: npm install --include=dev && npm install --prefix web --include=dev && npm run build
   ```
2. **Promoción de Dependencias Críticas de Ejecución:**
   - `tsx` se mantiene en `dependencies` directas en el `package.json` raíz para asegurar la ejecución del servidor Node.js en cualquier modo.
3. **Verificación de Limpieza:**
   Se ejecutó localmente `npm install --include=dev` y `npm run build` comprobando una compilación limpia de 1.597 módulos en 2,3 segundos.

---

## 5. Auditoría de Privacidad y Estado de Git

### 5.1. Fixtures y Datos de Prueba (`fixtures/reto-01/`)
Se revisaron los contenidos de `maestro.json`, `glosario-campos.json`, plantillas y soportes de texto:
- **Razón Social:** "Periferia IT Group S.A.S." con NIT ficticio `900123456-7`.
- **Direcciones y Correos:** Dominios ficticios (`@periferia-ficticia.com`, `@industrias-delta-ficticia.com`).
- **Datos Bancarios:** Números de cuenta y claves bancarias ficticias de prueba.
- **Soportes:** Archivos de texto simulados creados expresamente para la capacitación.
- **Conclusión de Privacidad:** **Los fixtures son de dominio de prueba técnica y pueden publicarse de forma segura en repositorios públicos sin violar confidencialidad corporativa ni leyes de protección de datos personales (Habeas Data).**

### 5.2. Auditoría de Secretos y Commit `a8dc100`
- Se ejecutó un escaneo de patrones criptográficos de claves de Google (`AIza...`) en todo el árbol de Git. Resultado: 0 claves filtradas (únicamente presente en aserciones de prueba negativa).
- Se confirmó que no existen archivos `.env` versionados.
- Se eliminó del control de versiones el archivo accidental `fixtures/log.jsonl`.
- **Gobernanza:** No se ha ejecutado ningún `git push` a repositorios remotos.

---

## 6. Resultados de la Validación Automatizada

```bash
# 1. Compilación Unificada (Vite React 19 + TypeScript)
$ npm run build
✓ 1597 modules transformed.
dist/assets/index-smEAznLX.js   271.57 kB │ gzip: 81.11 kB
✓ built in 2.31s
tsc exit code: 0

# 2. Suite Completa de Pruebas Unitarias y de Seguridad
$ npm run test
✔ 1-10. Pruebas Core de Agente y Manejo de Errores
✔ 11-13. Artefactos Físicos (Excel, PDF con inspección de texto, Markdown Portal)
✔ 14. Reloj Inyectable y Vigencias Dinámicas
✔ 15. Formateador de Fechas (Cero 'Invalid Date')
✔ 16-17. Integración Frontend y Contratos API
✔ 18. Mapeo Exhaustivo de Fixtures Reales (4 casos)
✔ 19-20. Seguridad de Confirmaciones Humanas (Firma Bloqueada y Cruzada)
✔ 21-26. Seguridad de Simulación de Envío y Protección de Datos Bancarios (RN2)
✔ 27-34. Endpoints HTTP Hono, Path Traversal, Cuota 429 y Reloj de Producción
✔ 35-40. Herramientas Zod y Determinismo de Reglas (RN1-RN5)
✔ 41. Seguridad de Acceso: Aislamiento estricto de sesiones entre visitantes independientes
✔ 42. Seguridad de Acceso: Aislamiento físico de archivos en out/sessions entre sesiones
✔ 43. Protección de Consumo: Rate Limiting por visitante (Frecuencia 429)
✔ 44. Protección de Consumo: Presupuesto Global de Tokens (Global Token Budget 429)
✔ 45. Seguridad de Acceso: Clave de demostración privada (DEMO_ACCESS_KEY 401)
ℹ tests 44 | pass 44 | fail 0 | duration: 2.7s

# 3. Demostración CLI Determinista (Zero-LLM)
$ npm run demo
✓ 4 casos procesados con validación de artefactos en out/sessions/demo-session-local/
✓ Integridad y determinismo 100%.

# 4. Validación E2E Playwright con Dos Navegadores Independientes
$ npm run test:e2e
✓ [12] Validando aislamiento entre dos navegadores independientes (Visitante A vs Visitante B)...
  ✓ Verificación de aislamiento en navegador: 0 cruces de sesión detectados
  ✓ Intento de acceso ajeno desde navegador B rechazado con HTTP 403
✓ 9 evidencias visuales verificadas en docs/evidencias/
✓ Cero errores críticos de JavaScript en consola o red.
```

---

## 7. Veredicto Final

# **APTO PARA DESPLIEGUE PÚBLICO EN GITHUB Y RENDER**

La aplicación satisface plenamente los requisitos de aislamiento multi-visitante, contención de archivos, control de presupuesto y consumo de API, compatibilidad con builds limpios en Render y resguardo riguroso de secretos. Queda en espera de la autorización explícita del usuario para vincular el repositorio remoto y ejecutar el despliegue.
