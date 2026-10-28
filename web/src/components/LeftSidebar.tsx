import React from "react";
import { Plus, MessageSquare, Briefcase, FileSpreadsheet, FileText, Globe, Server, CheckCircle2, AlertCircle } from "lucide-react";
import { SessionSummary, HealthResponse } from "../services/api.js";
import { formatSafeTime } from "../utils/date.js";

interface LeftSidebarProps {
  currentSessionId: string | null;
  sessions: SessionSummary[];
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onSelectCase: (caso: string) => void;
  health: HealthResponse | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const PRD_CASES = [
  {
    id: "co-industrias-delta",
    name: "Industrias Delta S.A.S.",
    pais: "CO",
    formato: "xlsx",
    icon: FileSpreadsheet,
    desc: "Colombia · Formato Excel (2 hojas)"
  },
  {
    id: "ec-corp-andina",
    name: "Corp. Andina de Servicios",
    pais: "EC",
    formato: "pdf",
    icon: FileText,
    desc: "Ecuador · Formato PDF"
  },
  {
    id: "hn-agroexport-sula",
    name: "Agroexport Sula S. de R.L.",
    pais: "HN",
    formato: "xlsx",
    icon: FileSpreadsheet,
    desc: "Honduras · Formato Excel"
  },
  {
    id: "pa-logistica-istmo",
    name: "Logística del Istmo S.A.",
    pais: "PA",
    formato: "portal",
    icon: Globe,
    desc: "Panamá · Portal Web VendorHub"
  }
];

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  currentSessionId,
  sessions,
  onSelectSession,
  onNewChat,
  onSelectCase,
  health,
  isOpenMobile,
  onCloseMobile
}) => {
  return (
    <>
      {/* Overlay para móvil */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-72 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Identidad del Agente */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-950">
              P
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Periferia IT Group</h2>
              <p className="text-[11px] text-emerald-400 font-medium">Agente Proveedores · PRD-01</p>
            </div>
          </div>

          <button
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Conversación</span>
          </button>
        </div>

        {/* Selección Rápida de Casos del PRD */}
        <div className="p-3 border-b border-slate-800">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
            <Briefcase className="w-3 h-3 text-slate-400" />
            <span>Casos de Prueba (PRD)</span>
          </div>
          <div className="space-y-1">
            {PRD_CASES.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelectCase(c.id);
                    onCloseMobile();
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-800 transition-all text-xs group flex items-start gap-2.5 cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 truncate">
                    <div className="text-slate-200 font-medium group-hover:text-emerald-300 transition-colors truncate">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-slate-400">{c.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Historial de Sesiones */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3 text-slate-400" />
            <span>Historial de Sesiones</span>
          </div>

          {sessions.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-slate-500">
              No hay sesiones previas
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelectSession(s.id);
                    onCloseMobile();
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    currentSessionId === s.id
                      ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
                      : "text-slate-300 hover:bg-slate-800/80"
                  }`}
                >
                  <div className="truncate flex-1">
                    <div className="font-mono text-[11px] truncate">{s.id}</div>
                    <div className="text-[10px] text-slate-400">
                      {s.messagesCount} mensajes · {formatSafeTime(s.updatedAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Estado del Backend y Modelo */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-300 font-medium">Motor LLM:</span>
            </div>
            {health?.ok ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[10px]">
                <CheckCircle2 className="w-3 h-3" /> Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[10px]">
                <AlertCircle className="w-3 h-3" /> Offline
              </span>
            )}
          </div>

          {health?.provider === "mock" ? (
            <div className="p-2 bg-amber-950/40 border border-amber-800/60 rounded-lg text-[10px] space-y-0.5">
              <div className="font-semibold text-amber-300 flex items-center gap-1">
                <span>⚡ MOCK DETERMINISTA</span>
              </div>
              <div className="text-amber-400/80 text-[9px] leading-tight">
                Pruebas offline sin costo de tokens ni llamadas de red externas.
              </div>
            </div>
          ) : (
            <div className="p-2 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-[10px] space-y-0.5">
              <div className="font-semibold text-emerald-300 flex items-center gap-1">
                <span>✨ GOOGLE GEMINI REAL</span>
              </div>
              <div className="text-emerald-400/80 text-[9px] leading-tight font-mono truncate">
                {health?.model || "gemini-3.5-flash-lite"}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

