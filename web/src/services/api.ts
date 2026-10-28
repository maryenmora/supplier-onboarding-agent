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

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function sendChatMessage(message: string, sessionId?: string, referenceDate?: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId, referenceDate })
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "Error al procesar el mensaje");
  }
  return json.data;
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${API_BASE}/api/sessions`);
  if (!res.ok) throw new Error("Error consultando sesiones");
  const json = await res.json();
  return json.data || [];
}

export async function fetchSessionDetail(id: string) {
  const res = await fetch(`${API_BASE}/api/sessions/${id}`);
  if (!res.ok) throw new Error("Error consultando detalle de sesión");
  const json = await res.json();
  return json.data;
}

export async function fetchPendingConfirmation(sessionId: string): Promise<{ hasPending: boolean; confirmation: PendingConfirmation | null }> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/confirmation`);
  if (!res.ok) return { hasPending: false, confirmation: null };
  const json = await res.json();
  return json.data || { hasPending: false, confirmation: null };
}

export async function confirmOperation(sessionId: string, token?: string, caso?: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, caso })
  });
  const json = await res.json();
  return json.ok === true;
}

export async function rejectOperation(sessionId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/reject`, {
    method: "POST"
  });
  const json = await res.json();
  return json.ok === true;
}

export function getArtifactDownloadUrl(caso: string, file: string): string {
  return `${API_BASE}/api/artifacts/${encodeURIComponent(caso)}/${encodeURIComponent(file)}`;
}

