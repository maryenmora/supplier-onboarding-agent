import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { PlantillaCeldaItem } from "../types/index.js";

export class ExcelGenerator {
  /**
   * Genera el archivo out/<caso>/formulario.xlsx escribiendo etiquetas y valores
   * en las celdas exactas especificadas por la plantilla.
   */
  public async generarExcel(
    baseDir: string,
    caso: string,
    plantillaCeldas: PlantillaCeldaItem[],
    valoresMapeados: Map<string, string | number | boolean>
  ): Promise<string> {
    const casoDir = path.resolve(baseDir, "out", caso);
    if (!fs.existsSync(casoDir)) {
      fs.mkdirSync(casoDir, { recursive: true });
    }

    const outputPath = path.join(casoDir, "formulario.xlsx");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Periferia IT Group - Agente Registro";
    workbook.created = new Date();

    // Agrupar items por hoja
    const hojasMap = new Map<string, PlantillaCeldaItem[]>();
    for (const item of plantillaCeldas) {
      if (!hojasMap.has(item.hoja)) {
        hojasMap.set(item.hoja, []);
      }
      hojasMap.get(item.hoja)!.push(item);
    }

    for (const [nombreHoja, items] of hojasMap.entries()) {
      const worksheet = workbook.addWorksheet(nombreHoja);

      // Ajustar anchos iniciales de columnas clave
      worksheet.getColumn("A").width = 15;
      worksheet.getColumn("B").width = 35;
      worksheet.getColumn("C").width = 45;

      for (const item of items) {
        // Escribir celda etiqueta
        const celdaEtiqueta = worksheet.getCell(item.celda_etiqueta);
        celdaEtiqueta.value = item.etiqueta;
        celdaEtiqueta.font = { bold: true, color: { argb: "FF1A365D" } };
        celdaEtiqueta.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF7FAFC" }
        };
        celdaEtiqueta.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };

        // Escribir celda valor
        const valor = valoresMapeados.get(item.etiqueta);
        const celdaValor = worksheet.getCell(item.celda_valor);
        celdaValor.value = valor !== undefined ? valor : "[FALTANTE]";
        celdaValor.font = {
          italic: valor === undefined,
          color: { argb: valor !== undefined ? "FF2D3748" : "FFE53E3E" }
        };
        celdaValor.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      }
    }

    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }
}

