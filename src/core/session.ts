import crypto from "node:crypto";
import { LlmMessage, TokenUsage } from "../llm/adapter.js";

export interface ToolExecutionRecord {
  id: string;
  ts: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  ok: boolean;
}

export interface PendingConfirmation {
  token: string;
  caso: string;
  action: "simular_envio";
  createdAt: Date;
  expiresAt: Date;
  packageHash?: string;
  status: "pending" | "confirmed" | "rejected" | "consumed";
}

export class Session {
  public readonly id: string;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public visitorId?: string;
  public messages: LlmMessage[] = [];
  public toolCallsHistory: ToolExecutionRecord[] = [];
  public pendingConfirmation: PendingConfirmation | null = null;
  public totalTokens: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor(id?: string, visitorId?: string) {
    this.id = id || `sess_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    this.visitorId = visitorId;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public addMessage(msg: LlmMessage): void {
    this.messages.push(msg);
    this.updatedAt = new Date();
  }

  public addToolRecord(record: ToolExecutionRecord): void {
    this.toolCallsHistory.push(record);
    this.updatedAt = new Date();
  }

  public addUsage(usage?: TokenUsage): void {
    if (!usage) return;
    this.totalTokens.promptTokens += usage.promptTokens || 0;
    this.totalTokens.completionTokens += usage.completionTokens || 0;
    this.totalTokens.totalTokens += usage.totalTokens || 0;
  }

  /**
   * Crea una solicitud formal de confirmación humana vinculada a un caso específico
   */
  public createPendingConfirmation(caso: string, action: "simular_envio", packageHash?: string): PendingConfirmation {
    const token = `conf_${crypto.randomBytes(8).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de vigencia

    this.pendingConfirmation = {
      token,
      caso,
      action,
      createdAt: new Date(),
      expiresAt,
      packageHash,
      status: "pending"
    };

    return this.pendingConfirmation;
  }

  /**
   * Ratifica la confirmación humana mediante acción explícita del usuario
   */
  public confirmPending(token?: string, caso?: string): boolean {
    if (!this.pendingConfirmation) return false;
    if (this.pendingConfirmation.status !== "pending") return false;
    if (new Date() > this.pendingConfirmation.expiresAt) return false;

    if (caso && this.pendingConfirmation.caso !== caso) return false;
    if (token && this.pendingConfirmation.token !== token) return false;

    this.pendingConfirmation.status = "confirmed";
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Cancela la confirmación pendiente
   */
  public rejectPending(): boolean {
    if (!this.pendingConfirmation) return false;
    this.pendingConfirmation.status = "rejected";
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Verifica y consume la autorización. Garantiza uso único (Single-Use).
   */
  public consumeAuthorization(caso: string): boolean {
    if (!this.pendingConfirmation) return false;
    if (this.pendingConfirmation.status !== "confirmed") return false;
    if (this.pendingConfirmation.caso !== caso) return false;
    if (new Date() > this.pendingConfirmation.expiresAt) return false;

    // Consumir el token inmediatamente
    this.pendingConfirmation.status = "consumed";
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Invalida cualquier confirmación previa si los datos del caso cambian
   */
  public invalidatePending(caso: string): void {
    if (this.pendingConfirmation && this.pendingConfirmation.caso === caso) {
      this.pendingConfirmation = null;
    }
  }
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private readonly maxGlobalSessions: number;
  private readonly maxSessionsPerVisitor: number;

  constructor(options?: { maxGlobalSessions?: number; maxSessionsPerVisitor?: number }) {
    this.maxGlobalSessions = options?.maxGlobalSessions || Number(process.env.MAX_GLOBAL_SESSIONS || 100);
    this.maxSessionsPerVisitor = options?.maxSessionsPerVisitor || Number(process.env.MAX_SESSIONS_PER_VISITOR || 10);
  }

  public getOrCreate(id?: string, visitorId?: string): Session {
    if (id && this.sessions.has(id)) {
      const existing = this.sessions.get(id)!;
      // Si la sesión ya tiene un visitorId asignado y se proporciona uno diferente, impedir usurpación
      if (existing.visitorId && visitorId && existing.visitorId !== visitorId) {
        throw new Error("Acceso denegado: la sesión pertenece a otro visitante");
      }
      if (!existing.visitorId && visitorId) {
        existing.visitorId = visitorId;
      }
      return existing;
    }

    // Control de límite de sesiones por visitante (evict oldest)
    if (visitorId) {
      const visitorSessions = Array.from(this.sessions.values())
        .filter((s) => s.visitorId === visitorId)
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

      while (visitorSessions.length >= this.maxSessionsPerVisitor) {
        const oldest = visitorSessions.shift();
        if (oldest) {
          this.sessions.delete(oldest.id);
        }
      }
    }

    // Control de límite global de sesiones (evict oldest)
    if (this.sessions.size >= this.maxGlobalSessions) {
      const oldestSession = Array.from(this.sessions.values())
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())[0];
      if (oldestSession) {
        this.sessions.delete(oldestSession.id);
      }
    }

    const session = new Session(id, visitorId);
    this.sessions.set(session.id, session);
    return session;
  }

  public get(id: string, visitorId?: string): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    // Si se consulta con un visitorId específico, comprobar propiedad
    if (visitorId && session.visitorId && session.visitorId !== visitorId) {
      return undefined;
    }
    return session;
  }

  public list(visitorId?: string): Session[] {
    const all = Array.from(this.sessions.values());
    if (visitorId) {
      return all.filter((s) => s.visitorId === visitorId);
    }
    return all;
  }

  public delete(id: string, visitorId?: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    if (visitorId && session.visitorId && session.visitorId !== visitorId) {
      return false;
    }
    return this.sessions.delete(id);
  }

  public clear(): void {
    this.sessions.clear();
  }
}

