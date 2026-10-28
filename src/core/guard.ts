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
  // 1b. Registro de solicitudes por IP (ventana deslizante de 60s)
  private ipRequestTimestamps = new Map<string, number[]>();
  // 1c. Registro de identidades declaradas por IP
  private ipVisitorMap = new Map<string, { visitorId: string; ts: number }[]>();
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
   * Valida la tasa de solicitudes (Rate Limiting) por visitante y por IP del cliente,
   * impidiendo eludir la protección cambiando arbitrariamente el visitorId.
   */
  public checkRateLimit(visitorId: string, clientIp?: string): RateLimitResult {
    const now = Date.now();
    const windowMs = 60 * 1000;

    // 1. Control de red por IP del cliente (si está disponible)
    if (clientIp) {
      const ipTimestamps = (this.ipRequestTimestamps.get(clientIp) || []).filter((ts) => now - ts < windowMs);
      if (ipTimestamps.length >= this.maxRequestsPerMinute) {
        const oldest = ipTimestamps[0];
        const retryAfterSeconds = Math.ceil((windowMs - (now - oldest)) / 1000);
        return {
          allowed: false,
          retryAfterSeconds,
          message: `Límite de solicitudes por minuto excedido para la conexión (${this.maxRequestsPerMinute}/min). Por favor espere ${retryAfterSeconds} segundos.`
        };
      }

      // Control contra elusión por cambio arbitrario y acelerado de visitorId desde la misma IP
      const recentVisitors = (this.ipVisitorMap.get(clientIp) || []).filter((v) => now - v.ts < windowMs);
      const uniqueVisitors = new Set(recentVisitors.map((v) => v.visitorId));
      uniqueVisitors.add(visitorId);
      if (uniqueVisitors.size > 5) {
        return {
          allowed: false,
          retryAfterSeconds: 60,
          message: "Actividad sospechosa detectada: cambio excesivo de identidad de visitante desde la misma conexión. Acceso temporalmente restringido."
        };
      }

      ipTimestamps.push(now);
      this.ipRequestTimestamps.set(clientIp, ipTimestamps);

      recentVisitors.push({ visitorId, ts: now });
      this.ipVisitorMap.set(clientIp, recentVisitors);
    }

    // 2. Control por identificador de visitante
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

