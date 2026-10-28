import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ExcelJS from "exceljs";
import {
  generar_formulario,
  mapear_campos,
  leer_solicitud
} from "../src/tools/proveedor.js";
import { SupportService } from "../src/services/support-service.js";
import { FixtureService } from "../src/services/fixture-service.js";
import { ToolContext } from "../src/types/index.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PDFParse } = require("pdf-parse") as { PDFParse: new (data: Uint8Array) => { getText: () => Promise<{ text: string }> } };

const rootDir = process.cwd();

test("Artefactos: Validación de contenido REAL de celdas en formulario.xlsx", async () => {
  const ctx: ToolContext = { directory: rootDir };

  // Leer y mapear co-industrias-delta
  const rawLeer = await leer_solicitud.execute({ caso: "co-industrias-delta" }, ctx);
  const dataLeer = JSON.parse(rawLeer).data;
  const etiquetas = dataLeer.campos.map((c: { etiqueta: string }) => c.etiqueta);

  const rawMapear = await mapear_campos.execute({ caso: "co-industrias-delta", campos: etiquetas }, ctx);
  const dataMapear = JSON.parse(rawMapear).data;

  // Generar Excel
  await generar_formulario.execute({
    caso: "co-industrias-delta",
    mapeo: { llenos: dataMapear.llenos }
  }, ctx);

  const xlsxPath = path.join(rootDir, "out", "co-industrias-delta", "formulario.xlsx");
  assert.ok(fs.existsSync(xlsxPath), "El archivo formulario.xlsx debe existir");

  // Leer el archivo XLSX con exceljs para verificar su estructura interna
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  // Verificar pestañas
  const wsProveedor = workbook.getWorksheet("Datos Proveedor");
  const wsBancos = workbook.getWorksheet("Datos Bancarios");
  assert.ok(wsProveedor, "Debe existir la hoja 'Datos Proveedor'");
  assert.ok(wsBancos, "Debe existir la hoja 'Datos Bancarios'");

  // Verificar celdas exactas según plantilla-celdas.json
  assert.equal(wsProveedor.getCell("B3").value, "Razón social");
  assert.equal(wsProveedor.getCell("C3").value, "Periferia IT Group S.A.S.");

  assert.equal(wsProveedor.getCell("B4").value, "NIT");
  assert.equal(wsProveedor.getCell("C4").value, "900123456");

  assert.equal(wsProveedor.getCell("B5").value, "Dígito de verificación");
  assert.equal(wsProveedor.getCell("C5").value, "7");

  assert.equal(wsBancos.getCell("B3").value, "Banco");
  assert.equal(wsBancos.getCell("C3").value, "Bancolombia S.A.");

  assert.equal(wsBancos.getCell("B5").value, "Número de cuenta");
  assert.equal(wsBancos.getCell("C5").value, "03100012345");
});

test("Artefactos: Validación de campos y valores renderizados en formulario.pdf (inspección de texto)", async () => {
  const ctx: ToolContext = { directory: rootDir };

  const rawLeer = await leer_solicitud.execute({ caso: "ec-corp-andina" }, ctx);
  const dataLeer = JSON.parse(rawLeer).data;
  const etiquetas = dataLeer.campos.map((c: { etiqueta: string }) => c.etiqueta);

  const rawMapear = await mapear_campos.execute({ caso: "ec-corp-andina", campos: etiquetas }, ctx);
  const dataMapear = JSON.parse(rawMapear).data;

  await generar_formulario.execute({
    caso: "ec-corp-andina",
    mapeo: {
      llenos: dataMapear.llenos,
      requiere_confirmacion: dataMapear.requiere_confirmacion
    }
  }, ctx);

  const pdfPath = path.join(rootDir, "out", "ec-corp-andina", "formulario.pdf");
  assert.ok(fs.existsSync(pdfPath), "El archivo formulario.pdf debe existir");

  const buffer = fs.readFileSync(pdfPath);
  assert.ok(buffer.length > 2000, "El PDF generado debe tener contenido válido (> 2KB)");
  assert.equal(buffer.subarray(0, 5).toString("utf-8"), "%PDF-");

  // Extracción e inspección forense del texto renderizado dentro del PDF
  const parser = new PDFParse(new Uint8Array(buffer));
  const parsed = await parser.getText();
  const pdfText = parsed.text;

  // Verificaciones de contenido real renderizado
  assert.match(pdfText, /PERIFERIA IT GROUP S\.A\.S\./, "Debe contener el encabezado corporativo");
  assert.match(pdfText, /Corporación Andina de Servicios S\.A\./, "Debe contener el nombre del cliente");
  assert.match(pdfText, /RUC \*: 900123456/, "Debe contener el RUC con el valor del NIT mapeado");
  assert.match(pdfText, /\[FALTANTE EN MAESTRO\]/, "Debe indicar campo faltante para Número de contribuyente especial");
  assert.match(pdfText, /Roberto Andrade Salazar/, "Debe contener el nombre del representante legal");
  assert.match(pdfText, /FIRMA DEL REPRESENTANTE LEGAL/, "Debe contener la sección de firma");
});

test("Artefactos: Validación de valores-portal.md para clientes de portal web", async () => {
  const ctx: ToolContext = { directory: rootDir };

  const rawLeer = await leer_solicitud.execute({ caso: "pa-logistica-istmo" }, ctx);
  const dataLeer = JSON.parse(rawLeer).data;
  const etiquetas = dataLeer.campos.map((c: { etiqueta: string }) => c.etiqueta);

  const rawMapear = await mapear_campos.execute({ caso: "pa-logistica-istmo", campos: etiquetas }, ctx);
  const dataMapear = JSON.parse(rawMapear).data;

  const rawGen = await generar_formulario.execute({
    caso: "pa-logistica-istmo",
    mapeo: {
      llenos: dataMapear.llenos,
      requiere_confirmacion: dataMapear.requiere_confirmacion
    }
  }, ctx);
  const resGen = JSON.parse(rawGen);

  assert.equal(resGen.ok, true);
  assert.equal(resGen.data.formato, "portal");

  const portalPath = path.join(rootDir, "out", "pa-logistica-istmo", "valores-portal.md");
  assert.ok(fs.existsSync(portalPath));
  const content = fs.readFileSync(portalPath, "utf-8");

  assert.match(content, /Valores para Diligenciamiento en Portal Web/);
  assert.match(content, /Periferia IT Group S\.A\.S\./);
  assert.match(content, /COLOCOBM/);
});

test("Reloj Inyectable: Comportamiento dinámico de vigencias de soportes según fecha", () => {
  const fixtureService = new FixtureService(rootDir);
  const supportService = new SupportService(fixtureService);

  const soportesHonduras = ["camara_comercio", "rut", "parafiscales"];

  // Escenario 1: Fecha 2026-08-25 (Ambos parafiscales y CC están vigentes)
  const eval1 = supportService.evaluarSoportes(soportesHonduras, new Date("2026-08-25"));
  assert.equal(eval1.listoParaFirma, true, "En agosto 2026 debe estar listo para firma");
  assert.equal(eval1.soportesVencidos.length, 0);

  // Escenario 2: Fecha 2026-09-15 (Parafiscales venció el 2026-08-31, CC sigue vigente hasta el 2026-09-30)
  const eval2 = supportService.evaluarSoportes(soportesHonduras, new Date("2026-09-15"));
  assert.equal(eval2.listoParaFirma, false, "En septiembre 2026 parafiscales venció");
  assert.deepEqual(eval2.soportesVencidos, ["parafiscales"]);

  // Escenario 3: Fecha 2026-10-28 (Parafiscales y CC vencidos)
  const eval3 = supportService.evaluarSoportes(soportesHonduras, new Date("2026-10-28"));
  assert.equal(eval3.listoParaFirma, false);
  assert.ok(eval3.soportesVencidos.includes("parafiscales"));
  assert.ok(eval3.soportesVencidos.includes("camara_comercio"));
});
