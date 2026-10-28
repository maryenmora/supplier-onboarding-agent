import test from "node:test";
import assert from "node:assert/strict";
import { FixtureService } from "../src/services/fixture-service.js";
import { MapperService } from "../src/services/mapper-service.js";

test("Auditoría de Fixtures Reales: Mapeo exacto por etiquetas en los 4 casos del PRD", () => {
  const fs = new FixtureService(process.cwd());
  const ms = new MapperService(fs.getMaestro(), fs.getGlosario());

  // 1. Caso Colombia: co-industrias-delta
  const coSol = fs.getSolicitud("co-industrias-delta");
  const coCampos = fs.getCamposSolicitados("co-industrias-delta", coSol.formato);
  const coRes = ms.mapear(coCampos.map((c) => c.etiqueta), coSol.pais);
  assert.equal(coRes.llenos.length, 17, "Colombia debe tener exactamente 17 campos llenos");
  assert.equal(coRes.faltantes.length, 0, "Colombia no debe tener campos faltantes");
  assert.equal(coRes.requiere_confirmacion.length, 0, "Colombia no debe requerir confirmación");

  // 2. Caso Ecuador: ec-corp-andina
  const ecSol = fs.getSolicitud("ec-corp-andina");
  const ecCampos = fs.getCamposSolicitados("ec-corp-andina", ecSol.formato);
  const ecRes = ms.mapear(ecCampos.map((c) => c.etiqueta), ecSol.pais);
  assert.equal(ecRes.llenos.length, 13, "Ecuador debe tener exactamente 13 campos llenos");
  assert.equal(ecRes.faltantes.length, 1, "Ecuador debe tener exactamente 1 campo faltante");
  assert.equal(
    ecRes.faltantes[0].etiqueta,
    "Número de contribuyente especial",
    "El único campo faltante en Ecuador debe ser 'Número de contribuyente especial'"
  );
  assert.equal(ecRes.requiere_confirmacion.length, 1, "Ecuador debe tener 1 campo a confirmar");
  assert.equal(
    ecRes.requiere_confirmacion[0].etiqueta,
    "RUC",
    "El campo que requiere confirmación en Ecuador debe ser 'RUC' (RN1)"
  );

  // 3. Caso Honduras: hn-agroexport-sula
  const hnSol = fs.getSolicitud("hn-agroexport-sula");
  const hnCampos = fs.getCamposSolicitados("hn-agroexport-sula", hnSol.formato);
  const hnRes = ms.mapear(hnCampos.map((c) => c.etiqueta), hnSol.pais);
  assert.equal(hnRes.llenos.length, 9, "Honduras debe tener exactamente 9 campos llenos");
  assert.equal(hnRes.faltantes.length, 1, "Honduras debe tener exactamente 1 campo faltante");
  assert.equal(
    hnRes.faltantes[0].etiqueta,
    "Referencias comerciales",
    "El único campo faltante en Honduras debe ser 'Referencias comerciales'"
  );
  assert.equal(hnRes.requiere_confirmacion.length, 1, "Honduras debe tener 1 campo a confirmar");
  assert.equal(
    hnRes.requiere_confirmacion[0].etiqueta,
    "RTN",
    "El campo que requiere confirmación en Honduras debe ser 'RTN' (RN1)"
  );

  // 4. Caso Panamá: pa-logistica-istmo
  const paSol = fs.getSolicitud("pa-logistica-istmo");
  const paCampos = fs.getCamposSolicitados("pa-logistica-istmo", paSol.formato);
  const paRes = ms.mapear(paCampos.map((c) => c.etiqueta), paSol.pais);
  assert.equal(paRes.llenos.length, 8, "Panamá debe tener exactamente 8 campos llenos");
  assert.equal(paRes.faltantes.length, 0, "Panamá no debe tener campos faltantes");
  assert.equal(paRes.requiere_confirmacion.length, 1, "Panamá debe tener 1 campo a confirmar");
  assert.equal(
    paRes.requiere_confirmacion[0].etiqueta,
    "RUC",
    "El campo que requiere confirmación en Panamá debe ser 'RUC' (RN1)"
  );
});

