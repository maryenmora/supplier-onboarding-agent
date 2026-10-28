# Corrección Puntual Predespliegue: Seguridad de Descargas, Clave de Evaluación y Blindaje de Rate Limiting

> **Proyecto:** PRD-01: Agente Conversacional "Registro como Proveedor" — Periferia IT Group  
> **Repositorio:** `https://github.com/maryenmora/supplier-onboarding-agent` (`main`)  
> **Fecha:** 2026-10-28  
> **Responsable:** Full-Stack Senior Architect & Web Security Specialist  
> **Estado:** **CORREGIDO, AUDITADO Y VALIDADO E2E (APTO PARA DESPLIEGUE FINAL)**

---

## 1. Resumen Ejecutivo de la Intervención

Antes de proceder con el aprovisionamiento en Render, se realizó una auditoría y corrección quirúrgica sobre tres aspectos críticos de seguridad y experiencia de usuario identificados en la revisión previa al despliegue:

1. **Aislamiento Criptográfico en Descargas de Artefactos:** Se eliminó cualquier mecanismo de fallback global o búsqueda entre sesiones recientes. Toda solicitud HTTP a `/api/artifacts/:caso/:file` ahora exige obligatoriamente un `sessionId` válido y un token opaco de sesión (`sessionToken`) emitido y validado por el servidor.
2. **Interfaz de Acceso a Demo Privada (`DEMO_ACCESS_KEY`):** Se implementó una pantalla modal accesible, profesional y responsiva en React 19 (`DemoAccessModal.tsx`) para introducir la clave de demostración cuando `/api/health` reporte `keyRequired: true`. La clave nunca se expone en código, URL ni logs, y se mantiene únicamente en `sessionStorage` (sesión del navegador).
3. **Blindaje de Rate Limiting contra Rotación Arbitraria de Identidades:** Se reforzó el control de frecuencia (`ResourceGuard`) mediante el seguimiento por IP/conexión de red (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`), impidiendo que un atacante eluda las cuotas simplemente rotando el valor de `visitorId` en las peticiones.

---

## 2. Detalle de Correcciones Implementadas

### Hallazgo 1: Descargas Seguras y Credencial Opaca de Sesión

| Aspecto | Estado Previo | Corrección Implementada |
|---|---|---|
| **Petición sin `sessionId`** | Recorría carpetas de sesiones recientes en `out/sessions/` | Rechazo inmediato con **HTTP 400 Bad Request** (`Se requiere un identificador de sesión válido`). |
| **Petición sin credencial** | Dependía únicamente del `visitorId` enviado por el cliente | Rechazo con **HTTP 401 Unauthorized** si no se proporciona el token de propietario emitido por el servidor. |
| **Credencial de sesión** | No existía token de sesión independiente | Cada `Session` genera en el servidor un token criptográfico opaco (`stk_<random_bytes>`), validado mediante `validateToken()`. |
| **Acceso cruzado** | Posible si un tercero adivinaba el `visitorId` | Bloqueo estricto con **HTTP 403 Forbidden** si el token no coincide o si la sesión pertenece a otro visitante. |
| **Fallback global** | Buscaba en `out/<caso>` global | **Eliminado totalmente en peticiones HTTP.** La búsqueda se limita estrictamente a `out/sessions/<sessionId>/<caso>/`. |
| **Ejecución CLI `demo.ts`** | Compartía rutas | `demo.ts` opera de manera 100% offline escribiendo en `out/`, sin exponer sus carpetas por la API web. |

#### Código relevante en `src/server.ts`:
```typescript
// 1. Toda descarga web EXIGE un sessionId válido
if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
  return c.json({ ok: false, error: "Se requiere un identificador de sesión válido para descargar artefactos" }, 400);
}

// 2. Toda descarga web EXIGE credencial opaca de sesión emitida por el servidor (token de propietario)
if (!token) {
  return c.json({ ok: false, error: "Acceso denegado: se requiere credencial de sesión (token de propietario)" }, 401);
}

// 3. Buscar sesión y validar credencial
const session = agentEngine.getSessionManager().get(sessionId);
if (!session) return c.json({ ok: false, error: "Sesión no encontrada" }, 404);
if (!session.validateToken(token)) {
  return c.json({ ok: false, error: "Acceso denegado: credencial de propietario inválida" }, 403);
}

// 4. Localización física: ÚNICAMENTE dentro del directorio aislado de la sesión
const sessionCaseDir = path.resolve(outDir, "sessions", sessionId, rawCaso);
```

---

### Hallazgo 2: Pantalla de Acceso Privado en React (`DEMO_ACCESS_KEY`)

- **Componente Creado:** [`web/src/components/DemoAccessModal.tsx`](file:///c:/Proyectos/periferia/capacitación-perxia/dia5/web/src/components/DemoAccessModal.tsx).
- **Flujo de Detección:**
  - Al iniciar o refrescar (`/api/health`), si `health.keyRequired === true` y no existe una clave en `sessionStorage`, se abre el diálogo modal de acceso.
  - Si cualquier endpoint devuelve **HTTP 401**, el modal se despliega mostrando el banner de advertencia con el mensaje de error correspondiente para reintentar.
- **Resguardo de Seguridad:**
  - Cero claves en código fuente o empaquetado Vite.
  - Cero exposición en URL (no se usa `?key=...`).
  - Cero escritura en logs de servidor o cliente.
  - Se guarda exclusivamente en `sessionStorage` (`perxia_demo_key`), purgándose automáticamente al cerrar la pestaña/navegador.
  - Se transmite en cabeceras cifradas `x-demo-key` y `Authorization: Bearer <key>`.
  - Si el backend no tiene `DEMO_ACCESS_KEY` configurado (`keyRequired: false`), el modal no se muestra y la aplicación opera de forma directa.

---

### Hallazgo 3: Blindaje de Rate Limiting contra Rotación de `visitorId`

- **Vector Mitigado:** Anteriormente, un cliente que alternara el valor de `visitorId` en cada payload JSON generaba nuevas entradas en la ventana de conteo de 60 segundos.
- **Implementación en `src/core/guard.ts`:**
  - Se integró `extractClientIp` en `src/server.ts` evaluando cabeceras de proxy (`cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`).
  - La ventana deslizante de 60 segundos registra tanto el `visitorId` como el `clientIp`.
  - Si una misma IP excede `maxRequestsPerMinute`, todas las solicitudes sucesivas son denegadas con **HTTP 429 Too Many Requests**, sin importar qué `visitorId` reporte.
  - Adicionalmente, si una IP registra más de 5 `visitorId` distintos en 60 segundos, se dispara la detección de actividad sospechosa bloqueando la IP.

---

## 3. Matriz de Validación Automatizada

Se implementaron y ejecutaron pruebas unitarias, de integración y E2E que cubren exhaustivamente los casos solicitados:

| Caso de Prueba | Tipo | Entrada / Condición | Resultado Esperado | Resultado Obtenido | Estado |
|---|:---:|---|---|---|:---:|
| **Descargar sin sesión** | Negativa | `GET /api/artifacts/co-industrias-delta/formulario.xlsx` | HTTP 400 Bad Request | HTTP 400 (`Se requiere un identificador de sesión válido`) | **APROBADO** |
| **Descargar sin credencial de propietario** | Negativa | `GET /api/artifacts/.../formulario.xlsx?sessionId=sess_123` | HTTP 401 Unauthorized | HTTP 401 (`se requiere credencial de sesión`) | **APROBADO** |
| **Descargar con credencial inválida** | Negativa | `GET ...?sessionId=sess_123&token=token_invalido` | HTTP 403 Forbidden | HTTP 403 (`credencial de propietario inválida`) | **APROBADO** |
| **Descargar documentos de otra sesión** | Negativa | Visitante B intenta descargar con token ajeno | HTTP 403 Forbidden | HTTP 403 (`pertenece a otra sesión`) | **APROBADO** |
| **Descarga válida autorizada** | Positiva | Propietario con `sessionId` y `token` legítimos | HTTP 200 OK | HTTP 200 OK con Content-Type binario correcto | **APROBADO** |
| **Cambiar arbitrariamente `visitorId`** | Negativa | Misma IP rotando `visitor_1`, `visitor_2`, etc. | HTTP 429 Too Many Requests | HTTP 429 (`Límite de solicitudes excedido para la conexión`) | **APROBADO** |
| **Acceder con clave de demo incorrecta** | Negativa | `POST /api/chat` con `x-demo-key: clave_erronea` | HTTP 401 Unauthorized | HTTP 401 (`Clave de acceso de evaluación requerida o inválida`) | **APROBADO** |
| **Acceder con clave de demo correcta** | Positiva | `POST /api/chat` con clave válida configurada | HTTP 200 OK | HTTP 200 OK con respuesta estructurada | **APROBADO** |

---

## 4. Resultados de la Suite Completa de Verificación

```bash
$ npm run build
✓ built in 2.54s (Vite React 19 + TypeScript tsc Backend: 0 errores)

$ npm run test
ℹ tests 44
ℹ pass 44
ℹ fail 0
ℹ duration_ms 3468.1422

$ npm run demo
🎉 DEMO CONCLUIDA EXITOSAMENTE CON INTEGRIDAD Y DETERMINISMO 100%.

$ npm run test:e2e
================================================================================
   TODAS LAS PRUEBAS EN NAVEGADOR Y E2E FUERON EXITOSAS
   - Cero errores críticos de página: 0 errores
   - 9 evidencias fotográficas capturadas en docs/evidencias/
   - Intento de acceso ajeno desde navegador B rechazado con HTTP 403
   - Intento de descarga de artefacto ajeno desde navegador B rechazado con HTTP 401/403
================================================================================
```

---

## 5. Conclusión y Estado de Entrega

El código y los contratos de seguridad cumplen rigurosamente con los requisitos del PRD-01 y las directrices predespliegue. No se ha desplegado en Render ni publicado ningún secreto. El repositorio se encuentra listo para preparar el commit en Git y aguardar la autorización final de despliegue.
