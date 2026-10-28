import fs from "node:fs";
import path from "node:path";
import { CampoIdentificado } from "../types/index.js";

export class PortalGenerator {
  /**
   * Genera out/<caso>/valores-portal.md con tablas y bloques copiables
   */
  public generarValoresPortal(
    baseDir: string,
    caso: string,
    campos: CampoIdentificado[],
    valoresMapeados: Map<string, string | number | boolean>,
    clienteNombre: string
  ): string {
    const casoDir = path.resolve(baseDir, "out", caso);
    if (!fs.existsSync(casoDir)) {
      fs.mkdirSync(casoDir, { recursive: true });
    }

    const outputPath = path.join(casoDir, "valores-portal.md");

    const lines: string[] = [
      `# Valores para Diligenciamiento en Portal Web`,
      ``,
      `> **Caso:** \`${caso}\`  `,
      `> **Cliente:** ${clienteNombre}  `,
      `> **Generado:** ${new Date().toISOString()}  `,
      ``,
      `> [!NOTE]`,
      `> Este cliente requiere registro a través de un portal web externo con credenciales.`,
      `> El agente no interactúa directamente con el portal web por seguridad. Copie y pegue`,
      `> los siguientes valores en los campos correspondientes del formulario en línea.`,
      ``,
      `## 1. Tabla de Correspondencia de Campos`,
      ``,
      `| # | Campo en Portal | Valor a Ingresar | Estado |`,
      `|---|---|---|---|`
    ];

    campos.forEach((c, idx) => {
      const valor = valoresMapeados.get(c.etiqueta);
      const valorStr = valor !== undefined ? String(valor) : "[FALTANTE EN MAESTRO]";
      const estado = valor !== undefined ? "✅ Listo" : "⚠️ Faltante";
      lines.push(`| ${idx + 1} | **${c.etiqueta}** | \`${valorStr}\` | ${estado} |`);
    });

    lines.push(``);
    lines.push(`## 2. Bloques de Copia Rápida (1 Clic)`);
    lines.push(``);

    for (const c of campos) {
      const valor = valoresMapeados.get(c.etiqueta);
      if (valor !== undefined) {
        lines.push(`### ${c.etiqueta}`);
        lines.push("```text");
        lines.push(String(valor));
        lines.push("```");
        lines.push(``);
      }
    }

    lines.push(`## 3. Próximos Pasos`);
    lines.push(`1. Ingrese al portal del cliente con las credenciales correspondientes.`);
    lines.push(`2. Copie los valores de la sección anterior en cada casilla.`);
    lines.push(`3. Adjunte los soportes correspondientes recopilados en la carpeta \`paquete/\`.`);
    lines.push(`4. Verifique visualmente antes de presionar el botón "Enviar" en el portal.`);
    lines.push(``);

    fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");
    return outputPath;
  }
}

