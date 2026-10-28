import fs from "node:fs";
import path from "node:path";
import {
  LlmAdapter,
  LlmMessage,
  LlmToolDeclaration,
  ToolCallItem,
  TokenUsage
} from "../llm/adapter.js";
import {
  SessionManager,
  Session,
  ToolExecutionRecord,
  PendingConfirmation
} from "./session.js";
import {
  leer_solicitud,
  mapear_campos,
  generar_formulario,
  armar_paquete,
  simular_envio
} from "../tools/proveedor.js";
import { ToolContext } from "../types/index.js";

export interface AgentConfig {
  baseDir: string;
  maxIterations?: number;
  systemPromptPath?: string;
}

export interface AgentProcessResult {
  sessionId: string;
  reply: string;
  toolCalls: ToolExecutionRecord[];
  needsConfirmation: boolean;
  pendingConfirmation: PendingConfirmation | null;
  usage: TokenUsage;
}

export class AgentEngine {
  private llmAdapter: LlmAdapter;
  private sessionManager: SessionManager;
  private baseDir: string;
  private maxIterations: number;
  private systemPrompt: string;

  // Declaración formal de herramientas para el modelo de lenguaje
  private toolDeclarations: LlmToolDeclaration[] = [
    {
      name: "proveedor_leer_solicitud",
      description: "Lee la solicitud por correo del cliente y su plantilla asociada para extraer país, formato, campos pedidos y soportes exigidos.",
      parameters: {
        type: "object",
        properties: {
          caso: {
            type: "string",
            description: "Nombre de la carpeta del caso en fixtures/reto-01/casos/ (ej. co-industrias-delta)"
          }
        },
        required: ["caso"]
      }
    },
    {
      name: "proveedor_mapear_campos",
      description: "Cruza cada campo solicitado con el repositorio maestro usando el glosario de sinónimos y reglas de país (RN1).",
      parameters: {
        type: "object",
        properties: {
          caso: {
            type: "string",
            description: "Identificador del caso para contexto de reglas"
          },
          campos: {
            type: "array",
            items: { type: "string" },
            description: "Lista de etiquetas solicitadas en la plantilla"
          }
        },
        required: ["caso", "campos"]
      }
    },
    {
      name: "proveedor_generar_formulario",
      description: "Genera el archivo del formulario diligenciado según el formato del cliente (xlsx o pdf). Si es portal, genera archivo markdown copiable.",
      parameters: {
        type: "object",
        properties: {
          caso: {
            type: "string",
            description: "Identificador del caso"
          },
          mapeo: {
            type: "object",
            properties: {
              llenos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    etiqueta: { type: "string" },
                    valor: { type: "string" }
                  },
                  required: ["etiqueta", "valor"]
                }
              },
              requiere_confirmacion: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    etiqueta: { type: "string" },
                    valor_propuesto: { type: "string" }
                  },
                  required: ["etiqueta", "valor_propuesto"]
                }
              }
            },
            required: ["llenos"]
          }
        },
        required: ["caso", "mapeo"]
      }
    },
    {
      name: "proveedor_armar_paquete",
      description: "Crea el paquete para firma con copias de soportes, checklist de vigencias y borrador de correo.",
      parameters: {
        type: "object",
        properties: {
          caso: {
            type: "string",
            description: "Identificador del caso a empaquetar"
          }
        },
        required: ["caso"]
      }
    },
    {
      name: "proveedor_simular_envio",
      description: "Simula el despacho del paquete hacia el cliente escribiendo ENVIO-SIMULADO.md. Exige confirmación humana previa y no permite envíos con paquetes bloqueados.",
      parameters: {
        type: "object",
        properties: {
          caso: {
            type: "string",
            description: "Identificador del caso"
          },
          confirmado: {
            type: "boolean",
            description: "Debe ser true, ratificando la aprobación explícita del analista en el turno anterior"
          }
        },
        required: ["caso", "confirmado"]
      }
    }
  ];

  constructor(llmAdapter: LlmAdapter, sessionManager: SessionManager, config: AgentConfig) {
    this.llmAdapter = llmAdapter;
    this.sessionManager = sessionManager;
    this.baseDir = path.resolve(config.baseDir);
    this.maxIterations = config.maxIterations || 10; // Inicio conservador para mitigar costos de API

    const promptPath = config.systemPromptPath || path.join(this.baseDir, "agent", "prompt.md");
    if (fs.existsSync(promptPath)) {
      this.systemPrompt = fs.readFileSync(promptPath, "utf-8");
    } else {
      this.systemPrompt = "Eres un agente conversacional para registro de proveedores de Periferia IT Group.";
    }
  }

  public getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  public getAdapter(): LlmAdapter {
    return this.llmAdapter;
  }

  /**
   * Procesa un turno conversacional completo del agente con bucle de herramientas
   */
  public async processMessage(
    sessionId: string | undefined,
    userMessage: string,
    options?: { referenceDate?: Date; visitorId?: string }
  ): Promise<AgentProcessResult> {
    const session = this.sessionManager.getOrCreate(sessionId, options?.visitorId);
    const referenceDate = options?.referenceDate || new Date();

    // Detección automática en lenguaje natural de confirmación humana explícita
    const lowerText = userMessage.toLowerCase().trim();
    const esConfirmacionTexto = /^(s[ií]|confirmo|confirmar|procede|adelante|autorizo|enviar|env[ií]a|enviar paquete)\b/i.test(lowerText);

    if (esConfirmacionTexto && session.pendingConfirmation?.status === "pending") {
      const caso = session.pendingConfirmation.caso;
      const sessionChecklistPath = path.resolve(this.baseDir, "out", "sessions", session.id, caso, "paquete", "checklist.md");
      const globalChecklistPath = path.resolve(this.baseDir, "out", caso, "paquete", "checklist.md");
      const checklistPath = fs.existsSync(sessionChecklistPath) ? sessionChecklistPath : globalChecklistPath;
      let isBlocked = false;
      if (fs.existsSync(checklistPath)) {
        const content = fs.readFileSync(checklistPath, "utf-8");
        if (content.includes("¿Listo para firma?: NO") || content.includes("BLOQUEADO")) {
          isBlocked = true;
        }
      }
      if (!isBlocked) {
        session.confirmPending(undefined, session.pendingConfirmation.caso);
      }
    }

    // Agregar mensaje del usuario a la sesión
    session.addMessage({ role: "user", content: userMessage });

    let iterations = 0;
    const initialToolCallsCount = session.toolCallsHistory.length;
    let finalReply = "";

    while (iterations < this.maxIterations) {
      iterations++;

      // Invocar modelo de lenguaje
      const response = await this.llmAdapter.enviar(
        session.messages,
        this.toolDeclarations,
        this.systemPrompt
      );

      // Registrar métricas de consumo de tokens
      session.addUsage(response.usage);

      // CASO 1: El modelo finalizó su razonamiento y emitió respuesta de texto
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalReply = response.content || "He procesado tu solicitud.";
        session.addMessage({ role: "model", content: finalReply });
        break;
      }

      // CASO 2: El modelo solicita ejecutar una o varias herramientas
      session.addMessage({
        role: "model",
        content: response.content,
        toolCalls: response.toolCalls
      });

      for (const tc of response.toolCalls) {
        const toolRecord = await this.executeToolCall(tc, session, referenceDate);
        session.addToolRecord(toolRecord);

        // Añadir el resultado de la herramienta al contexto conversacional
        session.addMessage({
          role: "tool",
          toolCallId: tc.id,
          toolName: tc.name,
          toolResult: toolRecord.result
        });
      }
    }

    if (iterations >= this.maxIterations && !finalReply) {
      finalReply = "⚠️ Se ha alcanzado el límite de iteraciones configurado por turno. El proceso se detuvo para proteger costos.";
      session.addMessage({ role: "model", content: finalReply });
    }

    const toolCallsThisTurn = session.toolCallsHistory.slice(initialToolCallsCount);
    const needsConfirmation = session.pendingConfirmation?.status === "pending";

    return {
      sessionId: session.id,
      reply: finalReply,
      toolCalls: toolCallsThisTurn,
      needsConfirmation,
      pendingConfirmation: session.pendingConfirmation,
      usage: session.totalTokens
    };
  }

  /**
   * Ejecución controlada y tipada de una herramienta individual
   */
  private async executeToolCall(
    tc: ToolCallItem,
    session: Session,
    referenceDate: Date
  ): Promise<ToolExecutionRecord> {
    const rawArgs = tc.args;
    let rawResultStr = "";
    let ok = false;
    let parsedResult: unknown = null;

    try {
      if (tc.name === "proveedor_leer_solicitud") {
        rawResultStr = await leer_solicitud.execute(rawArgs, {
          directory: this.baseDir,
          sessionId: session.id,
          referenceDate
        });
      } else if (tc.name === "proveedor_mapear_campos") {
        rawResultStr = await mapear_campos.execute(rawArgs, {
          directory: this.baseDir,
          sessionId: session.id,
          referenceDate
        });
      } else if (tc.name === "proveedor_generar_formulario") {
        rawResultStr = await generar_formulario.execute(rawArgs, {
          directory: this.baseDir,
          sessionId: session.id,
          referenceDate
        });
      } else if (tc.name === "proveedor_armar_paquete") {
        rawResultStr = await armar_paquete.execute(rawArgs, {
          directory: this.baseDir,
          sessionId: session.id,
          referenceDate
        });

        // Si el paquete fue armado y está listo para firma, generar token de confirmación pendiente
        const parsed = JSON.parse(rawResultStr);
        if (parsed.ok && parsed.data?.listo_para_firma === true) {
          const caso = String((rawArgs as { caso?: string }).caso || "");
          session.createPendingConfirmation(caso, "simular_envio");
        }
      } else if (tc.name === "proveedor_simular_envio") {
        const caso = String((rawArgs as { caso?: string }).caso || "");

        // VALIDACIÓN DE SEGURIDAD EN DOS FASES (RN4)
        // Verificar si la sesión tiene una confirmación ratificada por el analista
        const sessionConfirmed = session.consumeAuthorization(caso);

        const ctx: ToolContext = {
          directory: this.baseDir,
          sessionId: session.id,
          referenceDate,
          sessionConfirmed
        };

        rawResultStr = await simular_envio.execute(rawArgs, ctx);
      } else {
        rawResultStr = JSON.stringify({ ok: false, error: `Herramienta desconocida: ${tc.name}` });
      }

      parsedResult = JSON.parse(rawResultStr);
      ok = (parsedResult as { ok?: boolean }).ok === true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      parsedResult = { ok: false, error: errorMsg };
      ok = false;
    }

    return {
      id: tc.id,
      ts: new Date().toISOString(),
      name: tc.name,
      args: tc.args,
      result: parsedResult,
      ok
    };
  }
}

