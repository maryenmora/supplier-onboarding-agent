import { TokenUsage } from "../llm/adapter.js";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  message?: string;
}

export interface ConcurrencySlot {
  release: () => void;
}

export class ResourceGuard {
  // 1. Registro de solicitudes por visitante (ventana deslizante de 60s)
  private requestTimestamps = new Map<string, number[]>();
  private readonly maxRequestsPerMinute: number;

  // 2. Control de concurrencia para Gemini
  private activeGeminiCalls = 0;
  private readonly maxConcurrentGemini: number;

  // 3. Presupuesto global de tokens durante la demostración
  private globalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  };
  private readonly maxGlobalTokens: number;

  // 4. Clave de acceso para demostración privada (opcional)
  private readonly demoAccessKey?: string;

  constructor(options?: {
    maxRequestsPerMinute?: number;
    maxConcurrentGemini?: number;
    maxGlobalTokens?: number;
    demoAccessKey?: string;
  }) {
    this.maxRequestsPerMinute = options?.maxRequestsPerMinute || Number(process.env.MAX_REQUESTS_PER_MINUTE || 30);
    this.maxConcurrentGemini = options?.maxConcurrentGemini || Number(process.env.MAX_CONCURRENT_GEMINI_CALLS || 2);
    this.maxGlobalTokens = options?.maxGlobalTokens || Number(process.env.MAX_GLOBAL_TOKENS || 200000);
    this.demoAccessKey = options?.demoAccessKey || process.env.DEMO_ACCESS_KEY;
  }

  /**
   * Valida la tasa de solicitudes (Rate Limiting) por visitante/IP
   */
  public checkRateLimit(visitorId: string): RateLimitResult {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const timestamps = (this.requestTimestamps.get(visitorId) || []).filter((ts) => now - ts < windowMs);

    if (timestamps.length >= this.maxRequestsPerMinute) {
      const oldest = timestamps[0];
      const retryAfterSeconds = Math.ceil((windowMs - (now - oldest)) / 1000);
      return {
        allowed: false,
        retryAfterSeconds,
        message: `Límite de solicitudes por minuto excedido (${this.maxRequestsPerMinute}/min). Por favor espere ${retryAfterSeconds} segundos.`
      };
    }

    timestamps.push(now);
    this.requestTimestamps.set(visitorId, timestamps);
    return { allowed: true };
  }

  /**
   * Adquiere un slot de concurrencia para llamar al LLM (Semáforo)
   */
  public async acquireGeminiSlot(timeoutMs = 5000): Promise<ConcurrencySlot | null> {
    const startTime = Date.now();
    while (this.activeGeminiCalls >= this.maxConcurrentGemini) {
      if (Date.now() - startTime > timeoutMs) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.activeGeminiCalls++;
    let released = false;

    return {
      release: () => {
        if (!released) {
          released = true;
          this.activeGeminiCalls = Math.max(0, this.activeGeminiCalls - 1);
        }
      }
    };
  }

  /**
   * Verifica el presupuesto global de tokens acumulados
   */
  public checkGlobalTokenBudget(): { allowed: boolean; totalTokens: number; maxTokens: number } {
    const allowed = this.globalUsage.totalTokens < this.maxGlobalTokens;
    return {
      allowed,
      totalTokens: this.globalUsage.totalTokens,
      maxTokens: this.maxGlobalTokens
    };
  }

  /**
   * Registra consumo de tokens a nivel global
   */
  public recordTokenUsage(usage?: TokenUsage): void {
    if (!usage) return;
    this.globalUsage.promptTokens += usage.promptTokens || 0;
    this.globalUsage.completionTokens += usage.completionTokens || 0;
    this.globalUsage.totalTokens += usage.totalTokens || 0;
  }

  /**
   * Obtiene las métricas globales acumuladas
   */
  public getGlobalUsage(): TokenUsage {
    return { ...this.globalUsage };
  }

  /**
   * Valida la clave de acceso para demo privada (si está configurada)
   */
  public validateAccessKey(providedKey?: string): boolean {
    if (!this.demoAccessKey) {
      return true; // Acceso abierto si no se configuró clave en el entorno
    }
    return providedKey === this.demoAccessKey;
  }

  public isKeyRequired(): boolean {
    return !!this.demoAccessKey;
  }
}
