import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { PlantillaCampoItem } from "../types/index.js";

export class PdfGenerator {
  /**
   * Genera el archivo out/<caso>/formulario.pdf estructurado, conteniendo
   * todos los campos pedidos en orden con sus etiquetas y valores.
   */
  public async generarPdf(
    baseDir: string,
    caso: string,
    plantillaCampos: PlantillaCampoItem[],
    valoresMapeados: Map<string, string | number | boolean>,
    clienteNombre: string
  ): Promise<string> {
    const casoDir = path.resolve(baseDir, "out", caso);
    if (!fs.existsSync(casoDir)) {
      fs.mkdirSync(casoDir, { recursive: true });
    }

    const outputPath = path.join(casoDir, "formulario.pdf");

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "LETTER" });
        const writeStream = fs.createWriteStream(outputPath);

        doc.pipe(writeStream);

        // Encabezado
        doc.fontSize(16).fillColor("#1A365D").text("PERIFERIA IT GROUP S.A.S.", { align: "center" });
        doc.fontSize(11).fillColor("#4A5568").text("FORMULARIO DE REGISTRO COMO PROVEEDOR", { align: "center" });
        doc.fontSize(9).fillColor("#718096").text(`Cliente solicitante: ${clienteNombre} | Caso: ${caso}`, { align: "center" });
        doc.moveDown(1.5);

        // Línea divisoria
        doc.strokeColor("#CBD5E0").lineWidth(1).moveTo(40, doc.y).lineTo(570, doc.y).stroke();
        doc.moveDown(1);

        // Tabla de campos
        doc.fontSize(10);
        let startY = doc.y;

        for (const item of plantillaCampos) {
          // Chequear salto de página si se acerca al final
          if (doc.y > 680) {
            doc.addPage();
            startY = doc.y;
          }

          const currentY = doc.y;
          const valor = valoresMapeados.get(item.etiqueta);
          const valorStr = valor !== undefined ? String(valor) : "[FALTANTE EN MAESTRO]";

          // Fondo alternado o caja
          doc.rect(40, currentY - 2, 530, 20).fill("#F7FAFC");

          // Etiqueta
          doc.fillColor("#2D3748").font("Helvetica-Bold").text(
            `${item.etiqueta}${item.obligatorio ? " *" : ""}:`,
            50,
            currentY + 2,
            { width: 220, ellipsis: true }
          );

          // Valor
          if (valor !== undefined) {
            doc.fillColor("#1A202C").font("Helvetica").text(valorStr, 280, currentY + 2, { width: 280, ellipsis: true });
          } else {
            doc.fillColor("#E53E3E").font("Helvetica-Oblique").text(valorStr, 280, currentY + 2, { width: 280, ellipsis: true });
          }

          doc.y = currentY + 22;
        }

        // Espacio para firma al pie
        doc.moveDown(2);
        if (doc.y > 650) {
          doc.addPage();
        }

        const firmaY = doc.y + 30;
        doc.strokeColor("#4A5568").lineWidth(1).moveTo(180, firmaY).lineTo(430, firmaY).stroke();
        doc.fontSize(9).fillColor("#2D3748").font("Helvetica-Bold").text("FIRMA DEL REPRESENTANTE LEGAL", 180, firmaY + 6, {
          width: 250,
          align: "center"
        });
        doc.fontSize(8).fillColor("#718096").font("Helvetica").text("Roberto Andrade Salazar - C.C. 71555123", 180, firmaY + 18, {
          width: 250,
          align: "center"
        });

        doc.end();

        writeStream.on("finish", () => resolve(outputPath));
        writeStream.on("error", (err) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }
}

