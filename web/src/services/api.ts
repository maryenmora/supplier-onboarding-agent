export interface ToolCallItem {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

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
  createdAt: string;
  expiresAt: string;
  packageHash?: string;
  status: "pending" | "confirmed" | "rejected" | "consumed";
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  toolCalls: ToolExecutionRecord[];
  needsConfirmation: boolean;
  pendingConfirmation: PendingConfirmation | null;
  usage: TokenUsage;
}

export interface HealthResponse {
  ok: boolean;
  provider: string;
  model: string;
  modelAvailable: boolean;
  status: string;
  timestamp: string;
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  messagesCount: number;
  toolCallsCount: number;
  hasPendingConfirmation: boolean;
  usage: TokenUsage;
}

const API_BASE = "";

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem("perxia_visitor_id");
    if (!id) {
      id = "vis_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem("perxia_visitor_id", id);
    }
    return id;
  } catch {
    return "vis_default";
  }
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "x-visitor-id": getVisitorId()
  };
  try {
    const demoKey = localStorage.getItem("perxia_demo_key");
    if (demoKey) {
      headers["x-demo-key"] = demoKey;
    }
  } catch {
    // Entornos sin localStorage
  }
  return headers;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function sendChatMessage(message: string, sessionId?: string, referenceDate?: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ message, sessionId, referenceDate, visitorId: getVisitorId() })
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "Error al procesar el mensaje");
  }
  return json.data;
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error("Error consultando sesiones");
  const json = await res.json();
  return json.data || [];
}

export async function fetchSessionDetail(id: string) {
  const res = await fetch(`${API_BASE}/api/sessions/${id}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error("Error consultando detalle de sesión");
  const json = await res.json();
  return json.data;
}

export async function fetchPendingConfirmation(sessionId: string): Promise<{ hasPending: boolean; confirmation: PendingConfirmation | null }> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/confirmation`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) return { hasPending: false, confirmation: null };
  const json = await res.json();
  return json.data || { hasPending: false, confirmation: null };
}

export async function confirmOperation(sessionId: string, token?: string, caso?: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ token, caso })
  });
  const json = await res.json();
  return json.ok === true;
}

export async function rejectOperation(sessionId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/reject`, {
    method: "POST",
    headers: getAuthHeaders()
  });
  const json = await res.json();
  return json.ok === true;
}

export function getArtifactDownloadUrl(caso: string, file: string, sessionId?: string): string {
  const params = new URLSearchParams();
  if (sessionId) params.set("sessionId", sessionId);
  params.set("visitorId", getVisitorId());
  const query = params.toString() ? `?${params.toString()}` : "";
  return `${API_BASE}/api/artifacts/${encodeURIComponent(caso)}/${encodeURIComponent(file)}${query}`;
}

