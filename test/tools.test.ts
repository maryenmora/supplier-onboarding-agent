import test from "node:test";
import assert from "node:assert/strict";
import { leer_solicitud, mapear_campos, generar_formulario, armar_paquete } from "../src/tools/proveedor.js";
import { ToolContext } from "../src/types/index.js";

const ctx: ToolContext = {
  directory: process.cwd(),
  referenceDate: new Date("2026-08-25T10:00:00Z"), // Reloj inyectado histórico donde los soportes están vigentes
  sessionConfirmed: true
};

test("proveedor_leer_solicitud: lee caso co-industrias-delta correctamente", async () => {
  const raw = await leer_solicitud.execute({ caso: "co-industrias-delta" }, ctx);
  const res = JSON.parse(raw);

  assert.equal(res.ok, true);
  assert.equal(res.data.pais, "CO");
  assert.equal(res.data.cliente, "Industrias Delta S.A.S.");
  assert.equal(res.data.formato, "xlsx");
  assert.equal(res.data.campos.length, 17);
  assert.deepEqual(res.data.soportes, [
    "camara_comercio",
    "rut",
    "certificacion_bancaria",
    "estados_financieros"
  ]);
});

test("proveedor_leer_solicitud: error controlado ante caso inexistente", async () => {
  const raw = await leer_solicitud.execute({ caso: "caso-inexistente-xyz" }, ctx);
  const res = JSON.parse(raw);

  assert.equal(res.ok, false);
  assert.match(res.error, /Caso no encontrado/);
});

test("proveedor_mapear_campos: mapea 100% en Colombia y mantiene trazabilidad", async () => {
  const rawLeer = await leer_solicitud.execute({ caso: "co-industrias-delta" }, ctx);
  const dataLeer = JSON.parse(rawLeer).data;
  const etiquetas = dataLeer.campos.map((c: { etiqueta: string }) => c.etiqueta);

  const raw = await mapear_campos.execute({ caso: "co-industrias-delta", campos: etiquetas }, ctx);
  const res = JSON.parse(raw);

  assert.equal(res.ok, true);
  assert.equal(res.data.llenos.length, 17);
  assert.equal(res.data.faltantes.length, 0);
  assert.equal(res.data.requiere_confirmacion.length, 0);

  // Verificar trazabilidad de ruta al maestro
  const razonSocial = res.data.llenos.find((f: { etiqueta: string }) => f.etiqueta === "Razón social");
  assert.equal(razonSocial.valor, "Periferia IT Group S.A.S.");
  assert.equal(razonSocial.ruta_maestro, "razon_social");

  const nit = res.data.llenos.find((f: { etiqueta: string }) => f.etiqueta === "NIT");
  assert.equal(nit.valor, "900123456");
  assert.equal(nit.ruta_maestro, "nit");
});

test("proveedor_mapear_campos: regla RN1 para país extranjero (Ecuador - RUC)", async () => {
  const rawLeer = await leer_solicitud.execute({ caso: "ec-corp-andina" }, ctx);
  const dataLeer = JSON.parse(rawLeer).data;
  const etiquetas = dataLeer.campos.map((c: { etiqueta: string }) => c.etiqueta);

  const raw = await mapear_campos.execute({ caso: "ec-corp-andina", campos: etiquetas }, ctx);
  const res = JSON.parse(raw);

  assert.equal(res.ok, true);
  // RUC extranjero se propone con NIT y se marca en requiere_confirmacion
  const reqConf = res.data.requiere_confirmacion.find((f: { etiqueta: string }) => f.etiqueta === "RUC");
  assert.ok(reqConf, "Debe existir RUC en requiere_confirmacion");
  assert.equal(reqConf.valor_propuesto, "900123456");
  assert.match(reqConf.motivo, /identificador extranjero/);

  // Campo no existente en maestro debe quedar como faltante
  const faltante = res.data.faltantes.find((f: { etiqueta: string }) => f.etiqueta === "Número de contribuyente especial");
  assert.ok(faltante, "Número de contribuyente especial debe ser faltante");
});

test("proveedor_generar_formulario: genera archivo xlsx físico para co-industrias-delta", async () => {
  const rawLeer = await leer_solicitud.execute({ caso: "co-industrias-delta" }, ctx);
  const dataLeer = JSON.parse(rawLeer).data;
  const etiquetas = dataLeer.campos.map((c: { etiqueta: string }) => c.etiqueta);

  const rawMapear = await mapear_campos.execute({ caso: "co-industrias-delta", campos: etiquetas }, ctx);
  const dataMapear = JSON.parse(rawMapear).data;

  const rawGen = await generar_formulario.execute({
    caso: "co-industrias-delta",
    mapeo: {
      llenos: dataMapear.llenos,
      requiere_confirmacion: dataMapear.requiere_confirmacion
    }
  }, ctx);
  const resGen = JSON.parse(rawGen);

  assert.equal(resGen.ok, true);
  assert.equal(resGen.data.formato, "xlsx");
  assert.match(resGen.data.ruta, /formulario\.xlsx$/);
});

test("proveedor_armar_paquete: empaqueta y reporta listo_para_firma con reloj inyectado", async () => {
  const raw = await armar_paquete.execute({ caso: "co-industrias-delta" }, ctx);
  const res = JSON.parse(raw);

  assert.equal(res.ok, true);
  // Con fecha 2026-08-25, Cámara de Comercio (vence 2026-09-30) está vigente
  assert.equal(res.data.listo_para_firma, true);
  assert.equal(res.data.checklist.soportes_vencidos.length, 0);
  assert.equal(res.data.checklist.soportes_ausentes.length, 0);
});

