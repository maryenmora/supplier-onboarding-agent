import { GoogleGenAI } from "@google/genai";
import {
  LlmAdapter,
  LlmMessage,
  LlmToolDeclaration,
  LlmResponse,
  ToolCallItem
} from "./adapter.js";

export class GeminiAdapter implements LlmAdapter {
  private client: GoogleGenAI | null = null;
  private modelName: string;
  private apiKey: string | null = null;

  constructor(apiKey?: string, modelName?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || null;
    this.modelName = modelName || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  public getModelName(): string {
    return this.modelName;
  }

  public async isAvailable(): Promise<boolean> {
    if (!this.client || !this.apiKey) {
      return false;
    }
    try {
      const res = await this.client.models.generateContent({
        model: this.modelName,
        contents: [{ role: "user", parts: [{ text: "ping" }] }]
      });
      return !!res.text;
    } catch (err) {
      console.warn(`[GeminiAdapter] Modelo ${this.modelName} no disponible:`, err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  public async enviar(
    mensajes: LlmMessage[],
    herramientas: LlmToolDeclaration[],
    systemInstruction?: string
  ): Promise<LlmResponse> {
    if (!this.client || !this.apiKey) {
      throw new Error("GEMINI_API_KEY no configurada en el backend");
    }

    // Convertir herramientas a formato FunctionDeclaration de Gemini
    const functionDeclarations = herramientas.map((h) => ({
      name: h.name,
      description: h.description,
      parameters: h.parameters
    }));

    // Mapear historial al formato de contenido de Gemini
    const contents = this.formatMessagesForGemini(mensajes);

    // Reintentos con retroceso exponencial ante 429 / 503
    const maxRetries = 3;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const response = await this.client.models.generateContent({
          model: this.modelName,
          contents,
          config: {
            temperature: 0.1, // Conservador para respuestas deterministas y precisas
            systemInstruction: systemInstruction || undefined,
            tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined
          }
        });

        // Extraer llamadas a herramientas si el modelo las solicitó
        const toolCalls: ToolCallItem[] = [];
        const candidateParts = response.candidates?.[0]?.content?.parts || [];

        if (response.functionCalls && response.functionCalls.length > 0) {
          for (const fc of response.functionCalls) {
            // Localizar el part original para preservar thoughtSignature requerido por Gemini 3.x
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matchingPart = candidateParts.find((p: any) => p.functionCall?.name === fc.name) as any;

            toolCalls.push({
              id: (fc as { id?: string }).id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: fc.name || "desconocido",
              args: (fc.args || {}) as Record<string, unknown>,
              thoughtSignature: matchingPart?.thoughtSignature
            });
          }
        }

        // Extraer métricas de consumo de tokens
        const usageMetadata = response.usageMetadata;
        const usage = usageMetadata ? {
          promptTokens: usageMetadata.promptTokenCount || 0,
          completionTokens: usageMetadata.candidatesTokenCount || 0,
          totalTokens: usageMetadata.totalTokenCount || 0
        } : undefined;

        return {
          content: response.text || undefined,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          usage
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const errMsg = lastError.message || "";

        // Si es 429 o 503, esperar y reintentar
        if (errMsg.includes("429") || errMsg.includes("503") || errMsg.includes("RESOURCE_EXHAUSTED")) {
          const delayMs = attempt * 1500;
          console.warn(`[GeminiAdapter] Reintento ${attempt}/${maxRetries} por saturación (${errMsg.slice(0, 40)})... esperando ${delayMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        // Para otros errores (400, auth, etc.), fallar de inmediato
        throw lastError;
      }
    }

    throw lastError || new Error("Error desconocido tras agotar reintentos con Gemini");
  }

  /**
   * Mapea el historial agnóstico de mensajes al formato de partes/roles de Gemini
   */
  private formatMessagesForGemini(mensajes: LlmMessage[]): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
    const geminiContents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

    for (const m of mensajes) {
      if (m.role === "system") {
        // En Gemini, las instrucciones del sistema van en config.systemInstruction
        continue;
      }

      if (m.role === "user") {
        geminiContents.push({
          role: "user",
          parts: [{ text: m.content || "" }]
        });
      } else if (m.role === "model") {
        const parts: Array<Record<string, unknown>> = [];
        if (m.content) {
          parts.push({ text: m.content });
        }
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            const fcPart: Record<string, unknown> = {
              functionCall: {
                id: tc.id,
                name: tc.name,
                args: tc.args
              }
            };
            if (tc.thoughtSignature) {
              fcPart.thoughtSignature = tc.thoughtSignature;
            }
            parts.push(fcPart);
          }
        }
        geminiContents.push({
          role: "model",
          parts
        });
      } else if (m.role === "tool") {
        // En Gemini @google/genai, las respuestas de función van con role: 'user'
        geminiContents.push({
          role: "user",
          parts: [{
            functionResponse: {
              name: m.toolName || "herramienta",
              response: (typeof m.toolResult === "object" && m.toolResult !== null)
                ? m.toolResult as Record<string, unknown>
                : { result: m.toolResult }
            }
          }]
        });
      }
    }

    return geminiContents;
  }
}
