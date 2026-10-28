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
 * Protege contra Path Traversal sanitizando el identificador y asegurando contención en out/
 */
export async function logExecution(
  baseDir: string,
  caso: string,
  herramienta: string,
  ok: boolean,
  resumen: string,
  sessionId?: string
): Promise<void> {
  try {
    const safeCaso = caso.replace(/[^a-zA-Z0-9_-]/g, "_") || "desconocido";
    const outDir = path.resolve(baseDir, "out");

    // Aislamiento por sesión si está disponible
    const safeSession = sessionId ? sessionId.replace(/[^a-zA-Z0-9_-]/g, "_") : null;
    const casoDir = safeSession
      ? path.join(outDir, "sessions", safeSession, safeCaso)
      : path.join(outDir, safeCaso);

    if (!casoDir.startsWith(outDir)) {
      return;
    }

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

