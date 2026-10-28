import React from "react";
import { ShieldAlert, Check, X, Info, Lock } from "lucide-react";
import { PendingConfirmation } from "../services/api.js";

interface ConfirmationBannerProps {
  confirmation: PendingConfirmation;
  onConfirm: () => void;
  onReject: () => void;
  isProcessing?: boolean;
  isBlocked?: boolean;
}

export const ConfirmationBanner: React.FC<ConfirmationBannerProps> = ({
  confirmation,
  onConfirm,
  onReject,
  isProcessing = false,
  isBlocked = false
}) => {
  return (
    <div
      className={`my-4 p-4 border-2 rounded-xl shadow-sm text-slate-800 animate-fadeIn transition-colors ${
        isBlocked
          ? "border-rose-300 bg-gradient-to-br from-rose-50 to-orange-50/40"
          : "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg shrink-0 mt-0.5 ${
            isBlocked ? "bg-rose-200/80 text-rose-800" : "bg-amber-200/60 text-amber-800"
          }`}
        >
          {isBlocked ? <Lock className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <span>
                {isBlocked
                  ? "Autorización Bloqueada: Soportes No Conformes"
                  : "Autorización Requerida: Simulación de Envío"}
              </span>
              {isBlocked && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full border border-rose-300">
                  Firma Bloqueada
                </span>
              )}
            </h4>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded font-medium ${
                isBlocked ? "bg-rose-200/80 text-rose-900" : "bg-amber-200/80 text-amber-900"
              }`}
            >
              Caso: {confirmation.caso}
            </span>
          </div>

          {isBlocked ? (
            <p className="text-xs text-rose-800 leading-relaxed font-medium">
              ⚠️ El paquete para el caso <strong className="text-rose-950">{confirmation.caso}</strong> presenta soportes vencidos o ausentes en el checklist. <strong>Por política estricta de cumplimiento (RN4), la simulación de envío se encuentra inhabilitada hasta subsanar la documentación.</strong>
            </p>
          ) : (
            <p className="text-xs text-slate-600 leading-relaxed">
              El paquete para el caso <strong className="text-slate-900">{confirmation.caso}</strong> ha sido preparado y cumple los requisitos. Para continuar con la generación de <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px]">ENVIO-SIMULADO.md</code>, se requiere tu confirmación explícita como analista responsable.
            </p>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-1">
            <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span>Nota de seguridad: Esta operación es una simulación controlada y <strong>no realiza ningún envío real de correo</strong>.</span>
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              onClick={onConfirm}
              disabled={isProcessing || isBlocked}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all ${
                isBlocked
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300"
                  : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer"
              }`}
              title={isBlocked ? "Simulación inhabilitada por firma bloqueada" : "Confirmar operación"}
            >
              {isBlocked ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isProcessing ? "Confirmando..." : isBlocked ? "Envío Inhabilitado (Firma Bloqueada)" : "Confirmar y Simular Envío"}</span>
            </button>
            <button
              onClick={onReject}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 rounded-lg text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{isBlocked ? "Cerrar Notificación" : "Cancelar / Posponer"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
