import fs from "node:fs";
import path from "node:path";

export interface LogEntry {
  ts: string;
  herramienta: string;
  ok: boolean;
  resumen: string;
}

/**
 * Sanitiza texto para evitar registrar datos bancarios sensibles (RN2)
 */
export function sanitizeLogText(text: string): string {
  // Enmascarar números de cuenta o datos bancarios explícitos si aparecen
  return text.replace(/\b(\d{6,16})\b/g, (match) => {
    if (match.length >= 10) {
      return match.slice(0, 3) + "******" + match.slice(-2);
    }
    return match;
  });
}

/**
 * Escribe una entrada estructurada en out/<caso>/log.jsonl (RN5)
 */
export async function logExecution(
  baseDir: string,
  caso: string,
  herramienta: string,
  ok: boolean,
  resumen: string
): Promise<void> {
  try {
    const casoDir = path.resolve(baseDir, "out", caso);
    if (!fs.existsSync(casoDir)) {
      fs.mkdirSync(casoDir, { recursive: true });
    }

    const logPath = path.join(casoDir, "log.jsonl");
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      herramienta,
      ok,
      resumen: sanitizeLogText(resumen)
    };

    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(logPath, line, "utf-8");
  } catch (err) {
    // El logger nunca debe arrojar excepciones hacia el flujo principal
    console.error(`[Logger Error] No se pudo escribir log para caso ${caso}:`, err);
  }
}

