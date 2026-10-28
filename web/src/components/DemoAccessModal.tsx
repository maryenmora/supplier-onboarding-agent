import React, { useState } from "react";
import { Lock, ShieldAlert, ArrowRight, Loader2 } from "lucide-react";

interface DemoAccessModalProps {
  isOpen: boolean;
  onSubmit: (key: string) => Promise<void>;
  error: string | null;
  isSubmitting: boolean;
}

export const DemoAccessModal: React.FC<DemoAccessModalProps> = ({
  isOpen,
  onSubmit,
  error,
  isSubmitting
}) => {
  const [keyValue, setKeyValue] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyValue.trim() || isSubmitting) return;
    await onSubmit(keyValue.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-access-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 space-y-6 text-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 id="demo-access-title" className="text-base font-semibold text-white">
              Acceso a la Demostración Privada
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Instancia de evaluación protegida
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Esta versión de demostración requiere una clave de acceso autorizada (
          <code className="text-blue-300 font-mono bg-blue-950/60 px-1 py-0.5 rounded border border-blue-900/50">
            DEMO_ACCESS_KEY
          </code>
          ) para interactuar con el agente y ejecutar herramientas.
        </p>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs animate-shake"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block">Acceso denegado</span>
              <span className="text-[11px] text-rose-300 opacity-90">{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="demo-access-key-input"
              className="block text-xs font-medium text-slate-300"
            >
              Clave de Evaluación
            </label>
            <input
              id="demo-access-key-input"
              type="password"
              autoComplete="off"
              autoFocus
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="Ingresa la clave de acceso..."
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={!keyValue.trim() || isSubmitting}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando credencial...</span>
              </>
            ) : (
              <>
                <span>Ingresar a la Demostración</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-1 border-t border-slate-800">
          <span className="text-[10px] text-slate-500">
            Periferia IT Group · Reto Técnico Perxia 2.0 · Seguridad Multi-Visitante
          </span>
        </div>
      </div>
    </div>
  );
};
