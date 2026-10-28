import React, { useState, useRef, useEffect } from "react";
import { Send, Menu, SlidersHorizontal, Sparkles, User, Bot, AlertCircle } from "lucide-react";
import { ToolCallBadge } from "./ToolCallBadge.js";
import { ConfirmationBanner } from "./ConfirmationBanner.js";
import { ToolExecutionRecord, PendingConfirmation, HealthResponse } from "../services/api.js";
import { formatSafeTime } from "../utils/date.js";

export interface MessageItem {
  id: string;
  role: "user" | "model";
  content: string;
  toolCalls?: ToolExecutionRecord[];
  timestamp: string;
}

interface ChatViewProps {
  messages: MessageItem[];
  pendingConfirmation: PendingConfirmation | null;
  onSendMessage: (msg: string) => void;
  onConfirmAction: () => void;
  onRejectAction: () => void;
  isLoading: boolean;
  isConfirming: boolean;
  errorMessage: string | null;
  onToggleLeftMobile: () => void;
  onToggleRightMobile: () => void;
  currentSessionId: string | null;
  activeCase: string | null;
  health: HealthResponse | null;
  isBlocked?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  pendingConfirmation,
  onSendMessage,
  onConfirmAction,
  onRejectAction,
  isLoading,
  isConfirming,
  errorMessage,
  onToggleLeftMobile,
  onToggleRightMobile,
  currentSessionId,
  activeCase,
  health,
  isBlocked = false
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, pendingConfirmation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const quickPrompts = [
    "Procesa el caso co-industrias-delta",
    "Procesa el caso ec-corp-andina",
    "Procesa el caso hn-agroexport-sula",
    "Procesa el caso pa-logistica-istmo"
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Barra Superior */}
      <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleLeftMobile}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden cursor-pointer"
            title="Menú de casos"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span>Gestión de Registro de Proveedores</span>
              {health?.provider === "mock" ? (
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  ⚡ Mock Determinista (Offline)
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  ✨ Google Gemini Flash-Lite (Live)
                </span>
              )}
            </h1>
            <p className="text-[10px] font-mono text-slate-400">
              Sesión: {currentSessionId || "Nueva Sesión"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleRightMobile}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden cursor-pointer"
            title="Inspector de paquete"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Timeline de Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="max-w-md mx-auto my-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Asistente de Registro como Proveedor
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Automatiza la lectura de solicitudes de clientes, el mapeo de campos al repositorio maestro, la generación de formularios (.xlsx, .pdf, portal) y el armado de paquetes de soporte con verificación estricta de vigencias.
              </p>
            </div>

            <div className="pt-2 text-left">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
                Sugerencias rápidas para comenzar:
              </div>
              <div className="space-y-1.5">
                {quickPrompts.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSendMessage(q)}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 text-xs text-slate-700 transition-all shadow-2xs flex items-center justify-between cursor-pointer group"
                  >
                    <span>{q}</span>
                    <Send className="w-3 h-3 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 max-w-3xl ${
                m.role === "user" ? "ml-auto justify-end" : "mr-auto justify-start"
              }`}
            >
              {m.role === "model" && (
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 text-xs shadow-sm mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className="space-y-1 max-w-[85%]">
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-emerald-700 text-white shadow-sm rounded-br-none"
                      : "bg-white text-slate-800 border border-slate-200 shadow-2xs rounded-bl-none"
                  }`}
                >
                  {m.content}
                </div>

                {/* Llamadas a herramientas en este turno */}
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Herramientas ejecutadas en este turno ({m.toolCalls.length})
                    </div>
                    {m.toolCalls.map((tc) => (
                      <ToolCallBadge key={tc.id} tool={tc} />
                    ))}
                  </div>
                )}

                <div
                  className={`text-[10px] text-slate-400 px-1 ${
                    m.role === "user" ? "text-right" : "text-left"
                  }`}
                >
                  {formatSafeTime(m.timestamp)}
                </div>
              </div>

              {m.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 text-xs shadow-sm mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Indicador de "Pensando..." */}
        {isLoading && (
          <div className="flex gap-3 max-w-xl mr-auto items-center animate-pulse">
            <div className="w-7 h-7 rounded-lg bg-emerald-600/70 text-white flex items-center justify-center text-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-none text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
              <span>Analizando solicitud y ejecutando herramientas...</span>
            </div>
          </div>
        )}

        {/* Banner de Confirmación Humana: Sólo si corresponde al caso activo */}
        {pendingConfirmation && activeCase && pendingConfirmation.caso === activeCase && (
          <div className="max-w-3xl mr-auto">
            <ConfirmationBanner
              confirmation={pendingConfirmation}
              onConfirm={onConfirmAction}
              onReject={onRejectAction}
              isProcessing={isConfirming}
              isBlocked={isBlocked}
            />
          </div>
        )}

        {/* Banner de Error */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 max-w-xl mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Entrada de Mensaje */}
      <footer className="p-3 lg:p-4 bg-white border-t border-slate-200 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-end gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu instrucción (ej. 'Procesa el caso ec-corp-andina') · Enter para enviar..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            title="Enviar mensaje"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
};

