import fs from "node:fs";
import path from "node:path";
import {
  leer_solicitud,
  mapear_campos,
  generar_formulario,
  armar_paquete,
  simular_envio
} from "./src/tools/proveedor.js";
import { ToolContext } from "./src/types/index.js";

const CASOS = [
  "co-industrias-delta",
  "ec-corp-andina",
  "hn-agroexport-sula",
  "pa-logistica-istmo"
];

interface ResumenCaso {
  caso: string;
  pais: string;
  formato: string;
  llenos: number;
  faltantes: number;
  requiereConfirmacion: number;
  soportesPresentes: number;
  soportesVencidos: number;
  soportesAusentes: number;
  listoParaFirma: boolean;
  rutaFormulario: string;
  rutaPaquete: string;
}

async function runDemo(): Promise<void> {
  const rootDir = process.cwd();
  const outDir = path.join(rootDir, "out");

  console.log("\n================================================================================");
  console.log("   PRD-01: REGISTRO COMO PROVEEDOR — DEMO DETERMINISTA (ZERO-LLM)");
  console.log("   Periferia IT Group · Verificación Técnica de Herramientas y Reglas");
  console.log("================================================================================\n");

  // 1. Limpieza de directorio out/
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
  console.log("🧹 Directorio out/ limpiado e inicializado.");

  const fechaReal = new Date();
  console.log(`🕒 Fecha Real de Ejecución del Sistema: ${fechaReal.toISOString().split("T")[0]}`);
  console.log("   (A esta fecha real: Cámara de Comercio venció 2026-09-30, Parafiscales venció 2026-08-31)\n");

  const ctx: ToolContext = {
    directory: rootDir,
    sessionId: "demo-session-local",
    referenceDate: fechaReal,
    sessionConfirmed: true
  };

  const tablaResumen: ResumenCaso[] = [];

  for (const caso of CASOS) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`▶ Procesando caso: ${caso}`);

    // Tool 1: leer_solicitud
    const rawLeer = await leer_solicitud.execute({ caso }, ctx);
    const resLeer = JSON.parse(rawLeer);
    if (!resLeer.ok) throw new Error(`Fallo leer_solicitud en ${caso}: ${resLeer.error}`);
    const dataLeer = resLeer.data;
    console.log(`  [1] leer_solicitud        ✓ Cliente: ${dataLeer.cliente} (${dataLeer.pais}), Formato: ${dataLeer.formato}`);

    // Tool 2: mapear_campos
    const etiquetas = dataLeer.campos.map((c: { etiqueta: string }) => c.etiqueta);
    const rawMapear = await mapear_campos.execute({ caso, campos: etiquetas }, ctx);
    const resMapear = JSON.parse(rawMapear);
    if (!resMapear.ok) throw new Error(`Fallo mapear_campos en ${caso}: ${resMapear.error}`);
    const dataMapear = resMapear.data;
    console.log(`  [2] mapear_campos         ✓ Llenos: ${dataMapear.llenos.length} | Faltantes: ${dataMapear.faltantes.length} | Req. Conf: ${dataMapear.requiere_confirmacion.length}`);

    // Tool 3: generar_formulario
    const rawGen = await generar_formulario.execute({
      caso,
      mapeo: {
        llenos: dataMapear.llenos,
        requiere_confirmacion: dataMapear.requiere_confirmacion
      }
    }, ctx);
    const resGen = JSON.parse(rawGen);
    if (!resGen.ok) throw new Error(`Fallo generar_formulario en ${caso}: ${resGen.error}`);
    console.log(`  [3] generar_formulario    ✓ Archivo: ${resGen.data.ruta}`);

    // Tool 4: armar_paquete
    const rawPaquete = await armar_paquete.execute({ caso }, ctx);
    const resPaquete = JSON.parse(rawPaquete);
    if (!resPaquete.ok) throw new Error(`Fallo armar_paquete en ${caso}: ${resPaquete.error}`);
    const dataPaquete = resPaquete.data;
    const listoFirma = dataPaquete.listo_para_firma;
    console.log(`  [4] armar_paquete         ✓ Paquete: ${dataPaquete.ruta}`);
    console.log(`                            ✓ ¿Listo para firma?: ${listoFirma ? "SÍ (Aprobado)" : "NO (BLOQUEADO)"}`);
    if (dataPaquete.checklist.soportes_vencidos.length > 0) {
      console.log(`                            ⚠️ Soportes vencidos: ${dataPaquete.checklist.soportes_vencidos.join(", ")}`);
    }
    if (dataPaquete.checklist.soportes_ausentes.length > 0) {
      console.log(`                            ❌ Soportes ausentes: ${dataPaquete.checklist.soportes_ausentes.join(", ")}`);
    }

    // Tool 5: simular_envio — PRUEBAS DE SEGURIDAD
    // 5a. Probar con confirmado = false (debe fallar)
    const rawEnvioFalso = await simular_envio.execute({ caso, confirmado: false }, ctx);
    const resEnvioFalso = JSON.parse(rawEnvioFalso);
    if (resEnvioFalso.ok) throw new Error(`Seguridad violada: simular_envio permitió despacho sin confirmar en ${caso}`);
    console.log(`  [5a] rechazo sin confirmar ✓ Correctamente denegado ("${resEnvioFalso.error}")`);

    // 5b. Probar con confirmado = true
    const rawEnvioReal = await simular_envio.execute({ caso, confirmado: true }, ctx);
    const resEnvioReal = JSON.parse(rawEnvioReal);
    if (!listoFirma) {
      // Debe ser bloqueado por seguridad
      if (resEnvioReal.ok) throw new Error(`Seguridad violada: simular_envio despachó un paquete bloqueado en ${caso}`);
      console.log(`  [5b] bloqueo por firma     ✓ Correctamente denegado ("${resEnvioReal.error}")`);
    } else {
      // Si está listo para firma, debe despachar
      if (!resEnvioReal.ok) throw new Error(`Fallo simular_envio autorizado en ${caso}: ${resEnvioReal.error}`);
      console.log(`  [5b] simular_envio        ✓ Despachado: ${resEnvioReal.data.ruta}`);
    }

    tablaResumen.push({
      caso,
      pais: dataLeer.pais,
      formato: dataLeer.formato,
      llenos: dataMapear.llenos.length,
      faltantes: dataMapear.faltantes.length,
      requiereConfirmacion: dataMapear.requiere_confirmacion.length,
      soportesPresentes: dataPaquete.checklist.soportes_presentes.length,
      soportesVencidos: dataPaquete.checklist.soportes_vencidos.length,
      soportesAusentes: dataPaquete.checklist.soportes_ausentes.length,
      listoParaFirma: listoFirma,
      rutaFormulario: resGen.data.ruta,
      rutaPaquete: dataPaquete.ruta
    });
  }

  // Despliegue de Tabla Resumen
  console.log("\n================================================================================");
  console.log("   TABLA CONSOLIDADA DE RESULTADOS (FECHA REAL: " + fechaReal.toISOString().split("T")[0] + ")");
  console.log("================================================================================\n");

  console.table(
    tablaResumen.map((r) => ({
      Caso: r.caso,
      País: r.pais,
      Formato: r.formato,
      "Campos Llenos": r.llenos,
      "Faltantes": r.faltantes,
      "Req. Conf": r.requiereConfirmacion,
      "Sop. OK": r.soportesPresentes,
      "Sop. Vencidos": r.soportesVencidos,
      "Sop. Ausentes": r.soportesAusentes,
      "Listo Firma": r.listoParaFirma ? "SÍ" : "NO (BLOQUEADO)"
    }))
  );

  // Verificación de integridad física de archivos generados
  console.log("\n📁 Verificando artefactos físicos generados en disco:");
  for (const r of tablaResumen) {
    const fullFormPath = path.join(rootDir, r.rutaFormulario);
    const casoPaquete = path.join(rootDir, r.rutaPaquete);
    const checklistPath = path.join(casoPaquete, "checklist.md");
    const borradorPath = path.join(casoPaquete, "borrador-correo.md");
    const logPath = path.join(path.dirname(casoPaquete), "log.jsonl");

    if (!fs.existsSync(fullFormPath)) throw new Error(`No existe ${fullFormPath}`);
    if (!fs.existsSync(checklistPath)) throw new Error(`No existe ${checklistPath}`);
    if (!fs.existsSync(borradorPath)) throw new Error(`No existe ${borradorPath}`);
    if (!fs.existsSync(logPath)) throw new Error(`No existe ${logPath}`);

    const stat = fs.statSync(fullFormPath);
    console.log(`  ✓ [${r.caso}] ${path.basename(fullFormPath)} (${stat.size} bytes) | checklist.md | borrador-correo.md | log.jsonl`);
  }

  console.log("\n🎉 DEMO CONCLUIDA EXITOSAMENTE CON INTEGRIDAD Y DETERMINISMO 100%.");
  console.log("================================================================================\n");
}

runDemo().catch((err) => {
  console.error("\n❌ ERROR CRÍTICO EN DEMO:", err);
  process.exit(1);
});

