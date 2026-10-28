import React, { useState } from "react";
import { Terminal, ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { ToolExecutionRecord } from "../services/api.js";

interface ToolCallBadgeProps {
  tool: ToolExecutionRecord;
}

export const ToolCallBadge: React.FC<ToolCallBadgeProps> = ({ tool }) => {
  const [expanded, setExpanded] = useState(false);

  const cleanName = tool.name.replace(/^proveedor_/, "");

  return (
    <div className="my-2 border border-slate-200 rounded-lg bg-slate-50 overflow-hidden text-xs transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200/80 transition-colors text-slate-700"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-mono font-semibold text-slate-800">{tool.name}</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500 capitalize">{cleanName.replace(/_/g, " ")}</span>
        </div>
        <div className="flex items-center gap-2">
          {tool.ok ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle2 className="w-3 h-3" /> OK
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full font-medium">
              <XCircle className="w-3 h-3" /> Error
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-3 border-t border-slate-200 space-y-2 bg-white">
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">Argumentos (Zod Validated)</div>
            <pre className="p-2 bg-slate-900 text-slate-100 rounded text-[11px] overflow-x-auto font-mono">
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">Resultado de Ejecución</div>
            <pre className="p-2 bg-slate-900 text-emerald-400 rounded text-[11px] overflow-x-auto font-mono">
              {JSON.stringify(tool.result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

