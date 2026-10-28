/**
 * Interfaz unificada de adaptación para proveedores de modelos de lenguaje (LLM).
 * Permite cambiar de proveedor sin tocar el ciclo del agente.
 */

export interface ToolCallItem {
  id: string;
  name: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
}

export interface LlmMessage {
  role: "user" | "model" | "system" | "tool";
  content?: string;
  toolCalls?: ToolCallItem[];
  toolCallId?: string;
  toolName?: string;
  toolResult?: unknown;
}

export interface LlmToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmResponse {
  content?: string;
  toolCalls?: ToolCallItem[];
  usage?: TokenUsage;
}

export interface LlmAdapter {
  enviar(
    mensajes: LlmMessage[],
    herramientas: LlmToolDeclaration[],
    systemInstruction?: string
  ): Promise<LlmResponse>;
  getModelName(): string;
  isAvailable(): Promise<boolean>;
}
