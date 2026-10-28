import fs from "node:fs";
import path from "node:path";
import {
  ToolContext,
  LeerSolicitudArgsSchema,
  MapearCamposArgsSchema,
  GenerarFormularioArgsSchema,
  ArmarPaqueteArgsSchema,
  SimularEnvioArgsSchema,
  PlantillaCeldaItem,
  PlantillaCampoItem
} from "../types/index.js";
import { FixtureService } from "../services/fixture-service.js";
import { MapperService } from "../services/mapper-service.js";
import { SupportService } from "../services/support-service.js";
import { ExcelGenerator } from "../generators/excel-generator.js";
import { PdfGenerator } from "../generators/pdf-generator.js";
import { PortalGenerator } from "../generators/portal-generator.js";
import { PackageService } from "../services/package-service.js";
import { logExecution } from "../services/logger-service.js";

// Instancias de generadores reutilizables
const excelGen = new ExcelGenerator();
const pdfGen = new PdfGenerator();
const portalGen = new PortalGenerator();

/**
 * HERRAMIENTA 1: proveedor_leer_solicitud
 */
export const leer_solicitud = {
  description: "Lee la solicitud por correo del cliente y su plantilla asociada para extraer país, formato, campos pedidos y soportes exigidos.",
  args: {
    caso: LeerSolicitudArgsSchema.shape.caso
  },
  async execute(rawArgs: unknown, ctx: ToolContext): Promise<string> {
    const baseDir = ctx.directory || process.cwd();
    try {
      const args = LeerSolicitudArgsSchema.parse(rawArgs);
      const fixtureService = new FixtureService(baseDir);

      const solicitud = fixtureService.getSolicitud(args.caso);
      const campos = fixtureService.getCamposSolicitados(args.caso, solicitud.formato);
      const soportes = fixtureService.getSoportesExigidos(args.caso);

      const data = {
        pais: solicitud.pais,
        cliente: solicitud.cliente,
        formato: solicitud.formato,
        campos,
        soportes
      };

      await logExecution(
        baseDir,
        args.caso,
        "proveedor_leer_solicitud",
        true,
        `Solicitud leída: ${solicitud.cliente} (${solicitud.pais}), formato: ${solicitud.formato}, campos: ${campos.length}, soportes: ${soportes.length}`
      );

      return JSON.stringify({ ok: true, data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const caso = typeof rawArgs === "object" && rawArgs !== null && "caso" in rawArgs ? String((rawArgs as { caso: unknown }).caso) : "desconocido";
      await logExecution(baseDir, caso, "proveedor_leer_solicitud", false, `Error: ${msg}`);
      return JSON.stringify({ ok: false, error: msg });
    }
  }
};

/**
 * HERRAMIENTA 2: proveedor_mapear_campos
 */
export const mapear_campos = {
  description: "Cruza cada campo solicitado con el repositorio maestro usando el glosario de sinónimos y reglas de país (RN1).",
  args: {
    caso: MapearCamposArgsSchema.shape.caso,
    campos: MapearCamposArgsSchema.shape.campos
  },
  async execute(rawArgs: unknown, ctx: ToolContext): Promise<string> {
    const baseDir = ctx.directory || process.cwd();
    try {
      const args = MapearCamposArgsSchema.parse(rawArgs);
      const fixtureService = new FixtureService(baseDir);

      const solicitud = fixtureService.getSolicitud(args.caso);
      const maestro = fixtureService.getMaestro();
      const glosario = fixtureService.getGlosario();

      const mapperService = new MapperService(maestro, glosario);
      const resultado = mapperService.mapear(args.campos, solicitud.pais);

      await logExecution(
        baseDir,
        args.caso,
        "proveedor_mapear_campos",
        true,
        `Mapeo completado: ${resultado.llenos.length} llenos, ${resultado.faltantes.length} faltantes, ${resultado.requiere_confirmacion.length} requieren confirmación`
      );

      return JSON.stringify({ ok: true, data: resultado });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const caso = typeof rawArgs === "object" && rawArgs !== null && "caso" in rawArgs ? String((rawArgs as { caso: unknown }).caso) : "desconocido";
      await logExecution(baseDir, caso, "proveedor_mapear_campos", false, `Error: ${msg}`);
      return JSON.stringify({ ok: false, error: msg });
    }
  }
};

/**
 * HERRAMIENTA 3: proveedor_generar_formulario
 */
export const generar_formulario = {
  description: "Genera el archivo del formulario diligenciado según el formato del cliente (xlsx o pdf). Si es portal, genera archivo markdown copiable.",
  args: {
    caso: GenerarFormularioArgsSchema.shape.caso,
    mapeo: GenerarFormularioArgsSchema.shape.mapeo
  },
  async execute(rawArgs: unknown, ctx: ToolContext): Promise<string> {
    const baseDir = ctx.directory || process.cwd();
    try {
      const args = GenerarFormularioArgsSchema.parse(rawArgs);
      const fixtureService = new FixtureService(baseDir);

      const solicitud = fixtureService.getSolicitud(args.caso);

      // Consolidar mapa de valores (llenos + sugeridos de requiere_confirmacion)
      const valoresMap = new Map<string, string | number | boolean>();
      for (const item of args.mapeo.llenos) {
        valoresMap.set(item.etiqueta, item.valor);
      }
      if (args.mapeo.requiere_confirmacion) {
        for (const item of args.mapeo.requiere_confirmacion) {
          if (!valoresMap.has(item.etiqueta)) {
            valoresMap.set(item.etiqueta, item.valor_propuesto);
          }
        }
      }

      let rutaGenerada = "";

      if (solicitud.formato === "xlsx") {
        const casoDir = fixtureService.getCasoDir(args.caso);
        const celdasRaw = JSON.parse(fs.readFileSync(path.join(casoDir, "plantilla-celdas.json"), "utf-8")) as PlantillaCeldaItem[];
        rutaGenerada = await excelGen.generarExcel(baseDir, args.caso, celdasRaw, valoresMap, ctx.sessionId);
      } else if (solicitud.formato === "pdf") {
        const casoDir = fixtureService.getCasoDir(args.caso);
        const camposRaw = JSON.parse(fs.readFileSync(path.join(casoDir, "plantilla-campos.json"), "utf-8")) as PlantillaCampoItem[];
        rutaGenerada = await pdfGen.generarPdf(baseDir, args.caso, camposRaw, valoresMap, solicitud.cliente, ctx.sessionId);
      } else if (solicitud.formato === "portal") {
        const campos = fixtureService.getCamposSolicitados(args.caso, "portal");
        rutaGenerada = portalGen.generarValoresPortal(baseDir, args.caso, campos, valoresMap, solicitud.cliente, ctx.sessionId);
      }

      const relativeRuta = path.relative(baseDir, rutaGenerada).replace(/\\/g, "/");

      await logExecution(
        baseDir,
        args.caso,
        "proveedor_generar_formulario",
        true,
        `Formulario generado en ${relativeRuta} (formato: ${solicitud.formato})`,
        ctx.sessionId
      );

      return JSON.stringify({
        ok: true,
        data: {
          ruta: relativeRuta,
          formato: solicitud.formato,
          advertencia: solicitud.formato === "portal" ? "Portal web no automatizado directamente; se generó guía de copia rápida" : undefined
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const caso = typeof rawArgs === "object" && rawArgs !== null && "caso" in rawArgs ? String((rawArgs as { caso: unknown }).caso) : "desconocido";
      await logExecution(baseDir, caso, "proveedor_generar_formulario", false, `Error: ${msg}`);
      return JSON.stringify({ ok: false, error: msg });
    }
  }
};

/**
 * HERRAMIENTA 4: proveedor_armar_paquete
 */
export const armar_paquete = {
  description: "Crea el paquete para firma con copias de soportes, checklist de vigencias y borrador de correo.",
  args: {
    caso: ArmarPaqueteArgsSchema.shape.caso
  },
  async execute(rawArgs: unknown, ctx: ToolContext): Promise<string> {
    const baseDir = ctx.directory || process.cwd();
    const referenceDate = ctx.referenceDate || new Date();

    try {
      const args = ArmarPaqueteArgsSchema.parse(rawArgs);
      const fixtureService = new FixtureService(baseDir);
      const supportService = new SupportService(fixtureService);
      const packageService = new PackageService(fixtureService);

      const solicitud = fixtureService.getSolicitud(args.caso);
      const soportesExigidos = fixtureService.getSoportesExigidos(args.caso);
      const evaluacion = supportService.evaluarSoportes(soportesExigidos, referenceDate);

      // Mapear campos para identificar faltantes
      const maestro = fixtureService.getMaestro();
      const glosario = fixtureService.getGlosario();
      const mapperService = new MapperService(maestro, glosario);
      const camposSolicitados = fixtureService.getCamposSolicitados(args.caso, solicitud.formato);
      const mapeo = mapperService.mapear(camposSolicitados.map((c) => c.etiqueta), solicitud.pais);

      const resultadoPaquete = packageService.armarPaquete(
        baseDir,
        args.caso,
        solicitud,
        evaluacion,
        mapeo.faltantes,
        referenceDate,
        ctx.sessionId
      );

      const relativePaquete = path.relative(baseDir, resultadoPaquete.paqueteDir).replace(/\\/g, "/");
      const relativeBorrador = path.relative(baseDir, resultadoPaquete.rutaBorradorCorreo).replace(/\\/g, "/");

      await logExecution(
        baseDir,
        args.caso,
        "proveedor_armar_paquete",
        true,
        `Paquete armado en ${relativePaquete}. Listo para firma: ${evaluacion.listoParaFirma ? "SÍ" : "NO (BLOQUEADO)"}. Soportes vencidos: ${evaluacion.soportesVencidos.length}, ausentes: ${evaluacion.soportesAusentes.length}`,
        ctx.sessionId
      );

      return JSON.stringify({
        ok: true,
        data: {
          ruta: relativePaquete,
          listo_para_firma: evaluacion.listoParaFirma,
          checklist: {
            soportes_presentes: evaluacion.soportesPresentes,
            soportes_ausentes: evaluacion.soportesAusentes,
            soportes_vencidos: evaluacion.soportesVencidos,
            campos_faltantes: mapeo.faltantes.map((f) => f.etiqueta)
          },
          ruta_borrador_correo: relativeBorrador
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const caso = typeof rawArgs === "object" && rawArgs !== null && "caso" in rawArgs ? String((rawArgs as { caso: unknown }).caso) : "desconocido";
      await logExecution(baseDir, caso, "proveedor_armar_paquete", false, `Error: ${msg}`);
      return JSON.stringify({ ok: false, error: msg });
    }
  }
};

/**
 * HERRAMIENTA 5: proveedor_simular_envio
 */
export const simular_envio = {
  description: "Simula el despacho del paquete hacia el cliente escribiendo ENVIO-SIMULADO.md. Exige confirmación humana previa y no permite envíos con paquetes bloqueados.",
  args: {
    caso: SimularEnvioArgsSchema.shape.caso,
    confirmado: SimularEnvioArgsSchema.shape.confirmado
  },
  async execute(rawArgs: unknown, ctx: ToolContext): Promise<string> {
    const baseDir = ctx.directory || process.cwd();
    const referenceDate = ctx.referenceDate || new Date();

    try {
      const args = SimularEnvioArgsSchema.parse(rawArgs);

      // REGLA DE SEGURIDAD 1: Booleano obligatorio
      if (!args.confirmado) {
        await logExecution(baseDir, args.caso, "proveedor_simular_envio", false, "Rechazado: confirmado no es true");
        return JSON.stringify({ ok: false, error: "requiere confirmación explícita del usuario" });
      }

      // REGLA DE SEGURIDAD 2: La sesión debe haber validado confirmación en el turno anterior
      if (ctx.sessionConfirmed === false) {
        await logExecution(baseDir, args.caso, "proveedor_simular_envio", false, "Rechazado: sin confirmación explícita previa en sesión");
        return JSON.stringify({ ok: false, error: "rechazado por seguridad: el analista no confirmó la operación en el turno previo" });
      }

      // REGLA DE SEGURIDAD 3: Verificar que el paquete NO esté bloqueado
      const fixtureService = new FixtureService(baseDir);
      const supportService = new SupportService(fixtureService);
      const soportesExigidos = fixtureService.getSoportesExigidos(args.caso);
      const evaluacion = supportService.evaluarSoportes(soportesExigidos, referenceDate);

      if (!evaluacion.listoParaFirma) {
        const motivos: string[] = [];
        if (evaluacion.soportesVencidos.length > 0) motivos.push(`soportes vencidos (${evaluacion.soportesVencidos.join(", ")})`);
        if (evaluacion.soportesAusentes.length > 0) motivos.push(`soportes ausentes (${evaluacion.soportesAusentes.join(", ")})`);

        const errorMsg = `No se puede simular el envío: el paquete está bloqueado para firma debido a ${motivos.join(" y ")}`;
        await logExecution(baseDir, args.caso, "proveedor_simular_envio", false, errorMsg);
        return JSON.stringify({ ok: false, error: errorMsg });
      }

      // Generar archivo ENVIO-SIMULADO.md con aislamiento de sesión
      const safeCaso = args.caso.replace(/[^a-zA-Z0-9_-]/g, "_") || "desconocido";
      const safeSession = ctx.sessionId ? ctx.sessionId.replace(/[^a-zA-Z0-9_-]/g, "_") : null;
      const outDir = path.resolve(baseDir, "out");
      const casoDir = safeSession
        ? path.join(outDir, "sessions", safeSession, safeCaso)
        : path.join(outDir, safeCaso);

      if (!casoDir.startsWith(outDir)) {
        throw new Error("Ruta de salida no autorizada");
      }

      if (!fs.existsSync(casoDir)) {
        fs.mkdirSync(casoDir, { recursive: true });
      }

      const solicitud = fixtureService.getSolicitud(args.caso);
      const envioPath = path.join(casoDir, "ENVIO-SIMULADO.md");
      const ts = new Date().toISOString();

      const contenido = [
        `# Simulación de Envío de Registro de Proveedor`,
        ``,
        `> **Estado:** DESPACHADO (SIMULACIÓN AUTORIZADA)  `,
        `> **Timestamp:** ${ts}  `,
        `> **Caso:** \`${args.caso}\`  `,
        `> **Destinatario:** \`${solicitud.de}\`  `,
        `> **Cliente:** ${solicitud.cliente} (${solicitud.pais})  `,
        ``,
        `## 1. Confirmación de Aprobación`,
        `- **Aprobación de Analista:** Verificada explícitamente en sesión conversacional.`,
        `- **Estado de Firma:** Paquete verificado con \`listo_para_firma = true\`.`,
        `- **Soportes Incluidos:** ${evaluacion.soportesPresentes.join(", ")}.`,
        ``,
        `## 2. Contenido del Despacho`,
        `- Formulario diligenciado correspondiente al formato \`${solicitud.formato}\`.`,
        `- Checklist de verificación adjunto.`,
        `- Borrador de correo procesado.`,
        ``,
        `*Nota: Esta operación fue generada en entorno controlado de prueba técnica sin conexiones reales a servidores SMTP o portales web.*`
      ].join("\n");

      fs.writeFileSync(envioPath, contenido, "utf-8");

      const relativeRuta = path.relative(baseDir, envioPath).replace(/\\/g, "/");

      await logExecution(
        baseDir,
        args.caso,
        "proveedor_simular_envio",
        true,
        `Envío simulado exitoso a ${solicitud.de} en ${relativeRuta}`,
        ctx.sessionId
      );

      return JSON.stringify({
        ok: true,
        data: {
          ruta: relativeRuta,
          enviado_a: solicitud.de,
          timestamp: ts
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const caso = typeof rawArgs === "object" && rawArgs !== null && "caso" in rawArgs ? String((rawArgs as { caso: unknown }).caso) : "desconocido";
      await logExecution(baseDir, caso, "proveedor_simular_envio", false, `Error: ${msg}`);
      return JSON.stringify({ ok: false, error: msg });
    }
  }
};

