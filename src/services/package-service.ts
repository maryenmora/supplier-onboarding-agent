import fs from "node:fs";
import path from "node:path";
import { SoporteEvaluado, CampoFaltante, Solicitud } from "../types/index.js";
import { FixtureService } from "./fixture-service.js";

export class PackageService {
  private fixtureService: FixtureService;

  constructor(fixtureService: FixtureService) {
    this.fixtureService = fixtureService;
  }

  /**
   * Arma el paquete completo en out/<caso>/paquete/
   */
  public armarPaquete(
    baseDir: string,
    caso: string,
    solicitud: Solicitud,
    evaluacionSoportes: {
      evaluados: SoporteEvaluado[];
      soportesPresentes: string[];
      soportesAusentes: string[];
      soportesVencidos: string[];
      listoParaFirma: boolean;
    },
    camposFaltantes: CampoFaltante[],
    referenceDate: Date = new Date()
  ): {
    paqueteDir: string;
    rutaBorradorCorreo: string;
    rutaChecklist: string;
  } {
    const casoDir = path.resolve(baseDir, "out", caso);
    const paqueteDir = path.join(casoDir, "paquete");

    if (!fs.existsSync(paqueteDir)) {
      fs.mkdirSync(paqueteDir, { recursive: true });
    }

    // 1. Copiar archivo de formulario generado hacia la carpeta de paquete
    const posiblesArchivos = [
      "formulario.xlsx",
      "formulario.pdf",
      "valores-portal.md"
    ];
    for (const nombre of posiblesArchivos) {
      const origen = path.join(casoDir, nombre);
      if (fs.existsSync(origen)) {
        fs.copyFileSync(origen, path.join(paqueteDir, nombre));
      }
    }

    // 2. Copiar soportes físicos existentes
    for (const soporte of evaluacionSoportes.evaluados) {
      if (soporte.archivo) {
        const origen = this.fixtureService.getSoporteFilePath(soporte.archivo);
        if (origen && fs.existsSync(origen)) {
          fs.copyFileSync(origen, path.join(paqueteDir, path.basename(soporte.archivo)));
        }
      }
    }

    // 3. Generar checklist.md
    const rutaChecklist = path.join(paqueteDir, "checklist.md");
    const checklistContent = this.generarChecklistContent(
      caso,
      solicitud,
      evaluacionSoportes,
      camposFaltantes,
      referenceDate
    );
    fs.writeFileSync(rutaChecklist, checklistContent, "utf-8");

    // 4. Generar borrador-correo.md (RN2: SIN DATOS BANCARIOS)
    const rutaBorradorCorreo = path.join(paqueteDir, "borrador-correo.md");
    const correoContent = this.generarBorradorCorreoContent(
      solicitud,
      evaluacionSoportes,
      camposFaltantes
    );
    fs.writeFileSync(rutaBorradorCorreo, correoContent, "utf-8");

    return {
      paqueteDir,
      rutaBorradorCorreo,
      rutaChecklist
    };
  }

  private generarChecklistContent(
    caso: string,
    solicitud: Solicitud,
    evaluacion: {
      evaluados: SoporteEvaluado[];
      soportesPresentes: string[];
      soportesAusentes: string[];
      soportesVencidos: string[];
      listoParaFirma: boolean;
    },
    camposFaltantes: CampoFaltante[],
    referenceDate: Date
  ): string {
    const lines: string[] = [
      `# Checklist de Paquete para Firma — Caso: ${caso}`,
      ``,
      `> **Cliente:** ${solicitud.cliente}  `,
      `> **País:** ${solicitud.pais}  `,
      `> **Fecha de Evaluación:** ${referenceDate.toISOString().split("T")[0]}  `,
      `> **Veredicto Listo para Firma:** ${evaluacion.listoParaFirma ? "✅ SÍ" : "❌ NO (BLOQUEADO)"}  `,
      ``,
      `## 1. Estado de Soportes Exigidos`,
      ``,
      `| Tipo de Soporte | Archivo | Vigencia | Estado | Observación |`,
      `|---|---|---|---|---|`
    ];

    for (const s of evaluacion.evaluados) {
      let estadoBadge = "✅ Vigente";
      if (s.estado === "presente_vencido") estadoBadge = "⚠️ VENCIDO";
      if (s.estado === "ausente") estadoBadge = "❌ AUSENTE";

      lines.push(
        `| **${s.tipo}** | ${s.archivo || "N/A"} | ${s.vigencia_hasta || "Permanente"} | ${estadoBadge} | ${s.motivo || "Conforme"} |`
      );
    }

    lines.push(``);
    lines.push(`## 2. Resumen de Campos Faltantes en Formulario`);
    lines.push(`*(Nota: Por RN3, los campos faltantes no bloquean la firma, pero deben advertirse)*`);
    lines.push(``);

    if (camposFaltantes.length === 0) {
      lines.push(`- Ninguno. Todos los campos solicitados existen en el repositorio maestro.`);
    } else {
      for (const cf of camposFaltantes) {
        lines.push(`- ⚠️ **${cf.etiqueta}:** ${cf.motivo}`);
      }
    }

    lines.push(``);
    lines.push(`## 3. Conclusión y Acciones Requeridas`);
    if (evaluacion.listoParaFirma) {
      lines.push(`- **Aprobado para Firma:** Todos los soportes exigidos están presentes y vigentes.`);
      lines.push(`- Remitir el formulario y soportes al Representante Legal para suscripción.`);
    } else {
      lines.push(`- **ACCIONES DE BLOQUEO PENDIENTES:**`);
      if (evaluacion.soportesVencidos.length > 0) {
        lines.push(`  - Actualizar soportes vencidos: ${evaluacion.soportesVencidos.join(", ")}.`);
      }
      if (evaluacion.soportesAusentes.length > 0) {
        lines.push(`  - Solicitar / emitir soportes ausentes: ${evaluacion.soportesAusentes.join(", ")}.`);
      }
      lines.push(`  - **No proceder a firma ni a envío hasta subsanar las alertas.**`);
    }
    lines.push(``);

    return lines.join("\n");
  }

  private generarBorradorCorreoContent(
    solicitud: Solicitud,
    evaluacion: {
      soportesPresentes: string[];
      soportesAusentes: string[];
      soportesVencidos: string[];
      listoParaFirma: boolean;
    },
    camposFaltantes: CampoFaltante[]
  ): string {
    const adjuntosList = [
      `- Formulario de registro diligenciado y firmado por el Representante Legal`,
      ...evaluacion.soportesPresentes.map((s) => `- ${s.replace(/_/g, " ").toUpperCase()} vigente`)
    ];

    // Regla RN2: NINGÚN DATO BANCARIO en el borrador de correo
    const lines: string[] = [
      `# Borrador de Correo de Respuesta`,
      ``,
      `**Para:** ${solicitud.de}`,
      `**Asunto:** Re: ${solicitud.asunto}`,
      ``,
      `---`,
      ``,
      `Estimado equipo de compras y registro de proveedores de **${solicitud.cliente}**,`,
      ``,
      `Agradecemos la oportunidad de iniciar relaciones comerciales. En atención a su solicitud de registro, nos permitimos remitir la documentación requerida por parte de **Periferia IT Group S.A.S.**, debidamente suscrita por nuestro Representante Legal.`,
      ``,
      `**Documentos adjuntos:**`,
      ...adjuntosList,
      ``
    ];

    if (!evaluacion.listoParaFirma) {
      lines.push(`> [!WARNING]`);
      lines.push(`> **Nota interna antes de enviar:** El paquete aún requiere actualización de soportes:`);
      if (evaluacion.soportesVencidos.length > 0) {
        lines.push(`> - Vencidos: ${evaluacion.soportesVencidos.join(", ")}`);
      }
      if (evaluacion.soportesAusentes.length > 0) {
        lines.push(`> - Pendientes por tramitar: ${evaluacion.soportesAusentes.join(", ")}`);
      }
      lines.push(``);
    }

    if (camposFaltantes.length > 0) {
      lines.push(`Respecto a los campos ${camposFaltantes.map((c) => `"${c.etiqueta}"`).join(", ")}, les informamos que no aplican o serán complementados conforme a los acuerdos del servicio.`);
      lines.push(``);
    }

    lines.push(`Quedamos atentos a la confirmación de recibido y a cualquier requerimiento adicional.`);
    lines.push(``);
    lines.push(`Cordialmente,`);
    lines.push(``);
    lines.push(`**Área Administrativa y Financiera**  `);
    lines.push(`Periferia IT Group S.A.S.  `);
    lines.push(`contacto@periferia-it.com`);
    lines.push(``);

    return lines.join("\n");
  }
}

