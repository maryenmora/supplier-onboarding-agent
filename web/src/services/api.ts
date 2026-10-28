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
  keyRequired?: boolean;
  timestamp: string;
}

export interface SessionSummary {
  id: string;
  sessionToken?: string;
  createdAt: string;
  updatedAt: string;
  messagesCount: number;
  toolCallsCount: number;
  hasPendingConfirmation: boolean;
  usage: TokenUsage;
}

const API_BASE = "";

// 1. Manejo de Visitor ID y Token Criptográfico de Visitante
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

export function getVisitorToken(): string | null {
  try {
    return sessionStorage.getItem("perxia_visitor_token") || localStorage.getItem("perxia_visitor_token");
  } catch {
    return null;
  }
}

export function storeVisitorToken(token: string): void {
  try {
    sessionStorage.setItem("perxia_visitor_token", token);
    localStorage.setItem("perxia_visitor_token", token);
  } catch {
    // Entornos sin storage
  }
}

// 2. Manejo de Tokens de Sesión (Credenciales de Propietario)
const sessionTokensMap = new Map<string, string>();

export function storeSessionToken(sessionId: string, token: string): void {
  sessionTokensMap.set(sessionId, token);
  try {
    sessionStorage.setItem(`perxia_stk_${sessionId}`, token);
  } catch {
    // Entornos sin sessionStorage
  }
}

export function getSessionToken(sessionId: string): string | null {
  if (sessionTokensMap.has(sessionId)) {
    return sessionTokensMap.get(sessionId)!;
  }
  try {
    const val = sessionStorage.getItem(`perxia_stk_${sessionId}`);
    if (val) {
      sessionTokensMap.set(sessionId, val);
      return val;
    }
  } catch {
    // Entornos sin sessionStorage
  }
  return null;
}

// 3. Manejo de Clave de Demostración Privada (DEMO_ACCESS_KEY - Sólo durante la sesión de navegador)
let memoryDemoKey: string | null = null;

export function getDemoKey(): string | null {
  if (memoryDemoKey) return memoryDemoKey;
  try {
    return sessionStorage.getItem("perxia_demo_key");
  } catch {
    return null;
  }
}

export function setDemoKey(key: string): void {
  memoryDemoKey = key;
  try {
    sessionStorage.setItem("perxia_demo_key", key);
  } catch {
    // Entornos sin sessionStorage
  }
}

export function clearDemoKey(): void {
  memoryDemoKey = null;
  try {
    sessionStorage.removeItem("perxia_demo_key");
  } catch {
    // Entornos sin sessionStorage
  }
}

export function getAuthHeaders(sessionId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "x-visitor-id": getVisitorId()
  };
  const vToken = getVisitorToken();
  if (vToken) {
    headers["x-visitor-token"] = vToken;
  }
  const demoKey = getDemoKey();
  if (demoKey) {
    headers["x-demo-key"] = demoKey;
    headers["authorization"] = `Bearer ${demoKey}`;
  }
  if (sessionId) {
    const token = getSessionToken(sessionId);
    if (token) {
      headers["x-session-token"] = token;
    }
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
      ...getAuthHeaders(sessionId)
    },
    body: JSON.stringify({ message, sessionId, referenceDate, visitorId: getVisitorId() })
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "Error al procesar el mensaje");
  }
  if (json.data?.visitorToken) {
    storeVisitorToken(json.data.visitorToken);
  }
  if (json.data?.sessionId && json.data?.sessionToken) {
    storeSessionToken(json.data.sessionId, json.data.sessionToken);
  }
  return json.data;
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    headers: getAuthHeaders()
  });
  if (res.status === 401) {
    throw new Error("401 Unauthorized: Clave de acceso requerida");
  }
  if (!res.ok) throw new Error("Error consultando sesiones");
  const json = await res.json();
  return json.data || [];
}

export async function fetchSessionDetail(id: string) {
  const res = await fetch(`${API_BASE}/api/sessions/${id}`, {
    headers: getAuthHeaders(id)
  });
  if (res.status === 401) {
    throw new Error("401 Unauthorized: Clave de acceso requerida o credencial de sesión inválida");
  }
  if (!res.ok) throw new Error("Error consultando detalle de sesión");
  const json = await res.json();
  return json.data;
}

export async function fetchPendingConfirmation(sessionId: string): Promise<{ hasPending: boolean; confirmation: PendingConfirmation | null }> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/confirmation`, {
    headers: getAuthHeaders(sessionId)
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
      ...getAuthHeaders(sessionId)
    },
    body: JSON.stringify({ token, caso })
  });
  const json = await res.json();
  return json.ok === true;
}

export async function rejectOperation(sessionId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/reject`, {
    method: "POST",
    headers: getAuthHeaders(sessionId)
  });
  const json = await res.json();
  return json.ok === true;
}

/**
 * Descarga segura de un artefacto mediante fetch con cabecera x-session-token y Blob en memoria.
 * NUNCA expone el token de sesión en la URL del navegador ni en query parameters.
 */
export async function downloadArtifact(caso: string, file: string, sessionId: string): Promise<void> {
  const token = getSessionToken(sessionId);
  const headers: Record<string, string> = {
    ...getAuthHeaders(sessionId)
  };
  if (token) {
    headers["x-session-token"] = token;
  }

  const res = await fetch(`${API_BASE}/api/artifacts/${encodeURIComponent(caso)}/${encodeURIComponent(file)}?sessionId=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    throw new Error(errJson?.error || `Error ${res.status} al descargar el archivo ${file}`);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const tempLink = document.createElement("a");
  tempLink.href = blobUrl;
  tempLink.download = file;
  tempLink.style.display = "none";
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
  URL.revokeObjectURL(blobUrl);
}

/**
 * URL sanitizada para inspección sin tokens expuestos en parámetros de consulta
 */
export function getArtifactDownloadUrl(caso: string, file: string, sessionId?: string): string {
  if (!sessionId) return "#";
  const params = new URLSearchParams();
  params.set("sessionId", sessionId);
  params.set("visitorId", getVisitorId());
  return `${API_BASE}/api/artifacts/${encodeURIComponent(caso)}/${encodeURIComponent(file)}?${params.toString()}`;
}

