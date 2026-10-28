import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { simular_envio, armar_paquete, leer_solicitud } from "../src/tools/proveedor.js";
import { ToolContext } from "../src/types/index.js";

const rootDir = process.cwd();

test("Seguridad: simular_envio rechaza si confirmado es false", async () => {
  const ctx: ToolContext = {
    directory: rootDir,
    sessionConfirmed: true,
    referenceDate: new Date("2026-08-25")
  };

  const raw = await simular_envio.execute({ caso: "co-industrias-delta", confirmado: false }, ctx);
  const res = JSON.parse(raw);

  assert.equal(res.ok, false);
  assert.equal(res.error, "requiere confirmación explícita del usuario");
});

test("Seguridad: simular_envio rechaza si el backend no registra confirmación previa en sesión", async () => {
  const ctx: ToolContext = {
    directory: rootDir,
    sessionConfirmed: false, // El usuario no confirmó en el turno previo
    referenceDate: new Date("2026-08-25")
  };

  const raw = await simular_envio.execute({ caso: "co-industrias-delta", confirmado: true }, ctx);
  const res = JSON.parse(raw);

  assert.equal(res.ok, false);
  assert.match(res.error, /rechazado por seguridad: el analista no confirmó la operación/);
});

test("Seguridad: simular_envio NUNCA despacha paquetes bloqueados para firma", async () => {
  // Con fecha real (octubre 2026), co-industrias-delta tiene Cámara de Comercio vencida
  const ctxBloqueado: ToolContext = {
    directory: rootDir,
    sessionConfirmed: true,
    referenceDate: new Date("2026-10-28")
  };

  const raw = await simular_envio.execute({ caso: "co-industrias-delta", confirmado: true }, ctxBloqueado);
  const res = JSON.parse(raw);

  assert.equal(res.ok, false);
  assert.match(res.error, /el paquete está bloqueado para firma debido a soportes vencidos/);
});

test("Seguridad: simular_envio exitoso cuando está autorizado y el paquete no está bloqueado", async () => {
  // Usando reloj inyectado donde los soportes están vigentes
  const ctxAprobado: ToolContext = {
    directory: rootDir,
    sessionConfirmed: true,
    referenceDate: new Date("2026-08-25")
  };

  const raw = await simular_envio.execute({ caso: "co-industrias-delta", confirmado: true }, ctxAprobado);
  const res = JSON.parse(raw);

  assert.equal(res.ok, true);
  assert.match(res.data.ruta, /ENVIO-SIMULADO\.md$/);
  assert.equal(res.data.enviado_a, "compras@industrias-delta-ficticia.com");
});

test("Seguridad: defensa contra Path Traversal en parámetros de caso", async () => {
  const ctx: ToolContext = { directory: rootDir };

  const raw1 = await leer_solicitud.execute({ caso: "../../../etc" }, ctx);
  const res1 = JSON.parse(raw1);
  assert.equal(res1.ok, false);
  assert.match(res1.error, /inválido|peligroso|no encontrado/i);

  const raw2 = await armar_paquete.execute({ caso: "co-industrias-delta/../../fixtures" }, ctx);
  const res2 = JSON.parse(raw2);
  assert.equal(res2.ok, false);
});

test("Seguridad (RN2): borrador-correo.md NUNCA expone datos bancarios sensibles", async () => {
  const ctx: ToolContext = { directory: rootDir };
  await armar_paquete.execute({ caso: "co-industrias-delta" }, ctx);

  const borradorPath = path.join(rootDir, "out", "co-industrias-delta", "paquete", "borrador-correo.md");
  assert.ok(fs.existsSync(borradorPath), "borrador-correo.md debe existir");

  const content = fs.readFileSync(borradorPath, "utf-8");

  // Verificar que NO aparezcan datos bancarios
  assert.doesNotMatch(content, /03100012345/, "El número de cuenta bancaria jamás debe aparecer en el correo");
  assert.doesNotMatch(content, /COLOCOBM/, "El código SWIFT jamás debe aparecer en el correo");
  assert.doesNotMatch(content, /Ahorros/, "El tipo de cuenta jamás debe aparecer en el correo");
});

