import {
  LlmAdapter,
  LlmMessage,
  LlmToolDeclaration,
  LlmResponse,
  TokenUsage
} from "./adapter.js";

export type MockHandler = (
  mensajes: LlmMessage[],
  herramientas: LlmToolDeclaration[]
) => Promise<LlmResponse> | LlmResponse;

export class MockAdapter implements LlmAdapter {
  private queue: LlmResponse[] = [];
  private customHandler?: MockHandler;
  private callCount = 0;
  private modelName: string;

  constructor(modelName = "mock-deterministic-model") {
    this.modelName = modelName;
  }

  public getModelName(): string {
    return this.modelName;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public getCallCount(): number {
    return this.callCount;
  }

  public reset(): void {
    this.queue = [];
    this.customHandler = undefined;
    this.callCount = 0;
  }

  public enqueueResponse(res: LlmResponse): void {
    this.queue.push(res);
  }

  public setHandler(handler: MockHandler): void {
    this.customHandler = handler;
  }

  public async enviar(
    mensajes: LlmMessage[],
    herramientas: LlmToolDeclaration[],
    _systemInstruction?: string
  ): Promise<LlmResponse> {
    this.callCount++;

    if (this.customHandler) {
      return this.customHandler(mensajes, herramientas);
    }

    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }

    // Comportamiento inteligente por defecto del Mock si no hay cola
    const lastMsg = mensajes[mensajes.length - 1];

    // Si el último mensaje es un resultado de herramienta
    if (lastMsg?.role === "tool") {
      const toolName = lastMsg.toolName;

      // Extraer el caso y la intención a partir del mensaje más reciente del usuario
      const lastUserMsg = ([...mensajes].reverse().find((m) => m.role === "user")?.content || "").toLowerCase();
      const isFullFlowRequested =
        lastUserMsg.includes("paquete") ||
        lastUserMsg.includes("formulario") ||
        lastUserMsg.includes("completo") ||
        lastUserMsg.includes("procesa");

      const matchCaso = lastUserMsg.match(/co-industrias-delta|ec-corp-andina|hn-agroexport-sula|pa-logistica-istmo/i);
      let caso = matchCaso ? matchCaso[0].toLowerCase() : "co-industrias-delta";

      // Si no viene en el mensaje de usuario, buscar en el tool call más reciente
      if (!matchCaso) {
        for (let i = mensajes.length - 1; i >= 0; i--) {
          const m = mensajes[i];
          if (m.toolCalls) {
            const tc = m.toolCalls.find((t) => t.args && (t.args as { caso?: string }).caso);
            if (tc && (tc.args as { caso?: string }).caso) {
              caso = (tc.args as { caso?: string }).caso as string;
              break;
            }
          }
        }
      }

      if (isFullFlowRequested) {
        if (toolName === "proveedor_leer_solicitud") {
          const leerData = (lastMsg.toolResult as { ok?: boolean; data?: { campos?: Array<string | { etiqueta: string }> } })?.data;
          const rawCampos = leerData?.campos || [];
          const campos = rawCampos.map((c) => (typeof c === "string" ? c : c.etiqueta));
          return {
            toolCalls: [
              {
                id: `mock_call_${this.callCount}`,
                name: "proveedor_mapear_campos",
                args: { caso, campos }
              }
            ],
            usage: { promptTokens: 60, completionTokens: 25, totalTokens: 85 }
          };
        }
        if (toolName === "proveedor_mapear_campos") {
          const mapeoData = (lastMsg.toolResult as { ok?: boolean; data?: unknown })?.data || { llenos: [] };
          return {
            toolCalls: [
              {
                id: `mock_call_${this.callCount}`,
                name: "proveedor_generar_formulario",
                args: { caso, mapeo: mapeoData }
              }
            ],
            usage: { promptTokens: 75, completionTokens: 30, totalTokens: 105 }
          };
        }
        if (toolName === "proveedor_generar_formulario") {
          return {
            toolCalls: [
              {
                id: `mock_call_${this.callCount}`,
                name: "proveedor_armar_paquete",
                args: { caso }
              }
            ],
            usage: { promptTokens: 90, completionTokens: 35, totalTokens: 125 }
          };
        }
        if (toolName === "proveedor_armar_paquete") {
          return {
            content: `He procesado exitosamente la solicitud para el caso '${caso}'. Se leyó la solicitud del cliente, se mapearon los campos según el maestro y glosario, se generó el formulario correspondiente y se armó el paquete de registro en 'out/${caso}/paquete/'. El paquete no está listo para firma debido a soportes vencidos o ausentes según la fecha actual de ejecución.`,
            usage: { promptTokens: 110, completionTokens: 50, totalTokens: 160 }
          };
        }
      }

      return {
        content: `Herramienta ${toolName} procesada exitosamente. Resultado recibido.`,
        usage: { promptTokens: 40, completionTokens: 15, totalTokens: 55 }
      };
    }

    const text = (lastMsg?.content || "").toLowerCase();

    // Si el usuario pide procesar un caso, simular llamado a leer_solicitud
    if (text.includes("procesa") || text.includes("caso")) {
      const match = text.match(/co-industrias-delta|ec-corp-andina|hn-agroexport-sula|pa-logistica-istmo/i);
      const caso = match ? match[0].toLowerCase() : "co-industrias-delta";

      return {
        toolCalls: [
          {
            id: `mock_call_${this.callCount}`,
            name: "proveedor_leer_solicitud",
            args: { caso }
          }
        ],
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 }
      };
    }

    // Respuesta conversacional estándar
    return {
      content: "Entendido. ¿En qué más puedo orientarte respecto al registro de proveedor?",
      usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 }
    };
  }
}

