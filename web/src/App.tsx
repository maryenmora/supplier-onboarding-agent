import React, { useState, useEffect, useCallback } from "react";
import { LeftSidebar } from "./components/LeftSidebar.js";
import { RightSidebar } from "./components/RightSidebar.js";
import { ChatView, MessageItem } from "./components/ChatView.js";
import {
  checkHealth,
  sendChatMessage,
  fetchSessions,
  fetchSessionDetail,
  confirmOperation,
  rejectOperation,
  SessionSummary,
  HealthResponse,
  PendingConfirmation,
  ToolExecutionRecord
} from "./services/api.js";

const INITIAL_WELCOME_MESSAGE: MessageItem = {
  id: "welcome-1",
  role: "model",
  content:
    "¡Hola! Soy el agente de Registro de Proveedores de Periferia IT Group. Puedo procesar solicitudes de registro para Colombia, Ecuador, Honduras y Panamá, mapear campos oficiales, validar soportes con fecha de vigencia y generar los formularios requeridos.\n\nSelecciona uno de los casos del panel lateral o escribe una instrucción para comenzar.",
  timestamp: new Date().toISOString()
};

export const App: React.FC = () => {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([INITIAL_WELCOME_MESSAGE]);
  const [allToolCalls, setAllToolCalls] = useState<ToolExecutionRecord[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leftMobileOpen, setLeftMobileOpen] = useState<boolean>(false);
  const [rightMobileOpen, setRightMobileOpen] = useState<boolean>(false);

  // Cargar estado del backend y sesiones existentes
  const refreshData = useCallback(async () => {
    try {
      const [healthData, sessionsList] = await Promise.all([
        checkHealth().catch(() => null),
        fetchSessions().catch(() => [])
      ]);
      if (healthData) setHealth(healthData);
      setSessions(sessionsList);
    } catch {
      // Ignorar errores de red iniciales
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Iniciar nueva conversación
  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setAllToolCalls([]);
    setPendingConfirmation(null);
    setActiveCase(null);
    setErrorMessage(null);
  };

  // Seleccionar sesión existente
  const handleSelectSession = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const detail = await fetchSessionDetail(sessionId);
      setCurrentSessionId(sessionId);
      setPendingConfirmation(detail.pendingConfirmation || null);

      const historyMessages: MessageItem[] = (detail.messages || []).map((m: { role: string; content: string; timestamp?: string }, idx: number) => ({
        id: `msg-${sessionId}-${idx}`,
        role: m.role as "user" | "model",
        content: m.content,
        timestamp: m.timestamp || new Date().toISOString()
      }));

      setMessages(historyMessages.length > 0 ? historyMessages : [INITIAL_WELCOME_MESSAGE]);
      setAllToolCalls(detail.toolCalls || []);

      // Inferir caso activo a partir de las herramientas ejecutadas
      const lastTool = [...(detail.toolCalls || [])].reverse().find(
        (t: ToolExecutionRecord) => t.args && (t.args as { caso?: string }).caso
      );
      if (lastTool && (lastTool.args as { caso?: string }).caso) {
        setActiveCase((lastTool.args as { caso?: string }).caso as string);
      }

      setErrorMessage(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error al cargar la sesión seleccionada");
    } finally {
      setIsLoading(false);
    }
  };

  // Enviar mensaje al backend
  const handleSendMessage = async (text: string, explicitRefDate?: string) => {
    const userMsg: MessageItem = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const dateMatch = text.match(/\b(202[0-9]-[0-1][0-9]-[0-3][0-9])\b/);
      const refDate = explicitRefDate || (dateMatch ? dateMatch[1] : undefined);

      const res = await sendChatMessage(text, currentSessionId || undefined, refDate);

      if (!currentSessionId) {
        setCurrentSessionId(res.sessionId);
      }

      const agentMsg: MessageItem = {
        id: `msg-model-${Date.now()}`,
        role: "model",
        content: res.reply,
        toolCalls: res.toolCalls,
        timestamp: new Date().toISOString()
      };

      setMessages((prev) => [...prev, agentMsg]);
      setAllToolCalls((prev) => [...prev, ...res.toolCalls]);

      // Detectar caso activo de los tool calls retornados
      for (const t of res.toolCalls) {
        if (t.args && (t.args as { caso?: string }).caso) {
          setActiveCase((t.args as { caso?: string }).caso as string);
        }
      }

      setPendingConfirmation(res.pendingConfirmation);
      refreshData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error inesperado al comunicarse con el agente";
      setErrorMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Seleccionar caso PRD y disparar procesamiento automático
  const handleSelectCase = (casoId: string) => {
    setActiveCase(casoId);
    // Limpiar confirmación pendiente si pertenecía a otro caso
    if (pendingConfirmation && pendingConfirmation.caso !== casoId) {
      setPendingConfirmation(null);
    }
    handleSendMessage(`Por favor procesa la solicitud de registro de proveedor para el caso "${casoId}". Lee la solicitud, mapea los campos, genera el formulario y arma el paquete de registro.`);
  };

  // Confirmar acción humana (RN4)
  const handleConfirmAction = async () => {
    if (!currentSessionId || !pendingConfirmation) return;
    setIsConfirming(true);
    try {
      const ok = await confirmOperation(
        currentSessionId,
        pendingConfirmation.token,
        pendingConfirmation.caso
      );
      if (ok) {
        const tokenVal = pendingConfirmation.token;
        const casoVal = pendingConfirmation.caso;
        setPendingConfirmation(null);
        await handleSendMessage(`Autorizo expresamente la simulación de envío para el caso ${casoVal} con token ${tokenVal}. Procede con el envío.`);
      } else {
        setErrorMessage("La confirmación fue rechazada o expiró.");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error al registrar la confirmación");
    } finally {
      setIsConfirming(false);
    }
  };

  // Rechazar acción humana
  const handleRejectAction = async () => {
    if (!currentSessionId) return;
    setIsConfirming(true);
    try {
      await rejectOperation(currentSessionId);
      setPendingConfirmation(null);
      await handleSendMessage("He cancelado y rechazado expresamente el envío del paquete.");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error al registrar el rechazo");
    } finally {
      setIsConfirming(false);
    }
  };

  // Determinar si el paquete del caso activo tiene la firma bloqueada (RN3 & RN4)
  const latestPaquete = [...allToolCalls].reverse().find(
    (t: ToolExecutionRecord) => t.name === "proveedor_armar_paquete" && (t.args as { caso?: string })?.caso === activeCase && t.ok
  );
  const isCaseBlocked = latestPaquete ? !(latestPaquete.result as { data?: { listo_para_firma?: boolean } })?.data?.listo_para_firma : false;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 font-sans text-slate-100 antialiased">
      {/* Panel Izquierdo */}
      <LeftSidebar
        currentSessionId={currentSessionId}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onSelectCase={handleSelectCase}
        health={health}
        isOpenMobile={leftMobileOpen}
        onCloseMobile={() => setLeftMobileOpen(false)}
      />

      {/* Panel Central Conversacional */}
      <ChatView
        messages={messages}
        pendingConfirmation={pendingConfirmation}
        onSendMessage={handleSendMessage}
        onConfirmAction={handleConfirmAction}
        onRejectAction={handleRejectAction}
        isLoading={isLoading}
        isConfirming={isConfirming}
        errorMessage={errorMessage}
        onToggleLeftMobile={() => setLeftMobileOpen(!leftMobileOpen)}
        onToggleRightMobile={() => setRightMobileOpen(!rightMobileOpen)}
        currentSessionId={currentSessionId}
        activeCase={activeCase}
        health={health}
        isBlocked={isCaseBlocked}
      />

      {/* Panel Derecho de Inspección y Artefactos */}
      <RightSidebar
        toolCalls={allToolCalls}
        activeCase={activeCase}
        sessionId={currentSessionId}
        isOpenMobile={rightMobileOpen}
        onCloseMobile={() => setRightMobileOpen(false)}
      />
    </div>
  );
};

