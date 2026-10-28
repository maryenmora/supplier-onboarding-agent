import React from "react";
import { Building2, FileCheck2, AlertTriangle, XCircle, CheckCircle2, Download, FileSpreadsheet, FileText, Globe, FileCode2 } from "lucide-react";
import { ToolExecutionRecord, downloadArtifact } from "../services/api.js";

interface RightSidebarProps {
  toolCalls: ToolExecutionRecord[];
  activeCase: string | null;
  sessionId?: string | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  toolCalls,
  activeCase,
  sessionId,
  isOpenMobile,
  onCloseMobile
}) => {
  const currentCase = activeCase || null;

  // Extraer información consolidada de las últimas herramientas ejecutadas para el caso activo
  const toolLeer = [...toolCalls].reverse().find(
    (t: ToolExecutionRecord) => t.name === "proveedor_leer_solicitud" && (!currentCase || (t.args as { caso?: string })?.caso === currentCase) && t.ok
  );
  const toolMapear = [...toolCalls].reverse().find(
    (t: ToolExecutionRecord) => t.name === "proveedor_mapear_campos" && (!currentCase || (t.args as { caso?: string })?.caso === currentCase) && t.ok
  );
  const toolPaquete = [...toolCalls].reverse().find(
    (t: ToolExecutionRecord) => t.name === "proveedor_armar_paquete" && (!currentCase || (t.args as { caso?: string })?.caso === currentCase) && t.ok
  );
  const toolEnvio = [...toolCalls].reverse().find(
    (t: ToolExecutionRecord) => t.name === "proveedor_simular_envio" && (!currentCase || (t.args as { caso?: string })?.caso === currentCase) && t.ok
  );

  const dataLeer = (toolLeer?.result as { data?: { cliente: string; pais: string; formato: string } })?.data;
  const dataMapear = (toolMapear?.result as { data?: { llenos: unknown[]; faltantes: unknown[]; requiere_confirmacion: unknown[] } })?.data;
  const dataPaquete = (toolPaquete?.result as { data?: { listo_para_firma: boolean; checklist: { soportes_presentes: string[]; soportes_ausentes: string[]; soportes_vencidos: string[]; campos_faltantes: string[] } } })?.data;
  const dataEnvio = (toolEnvio?.result as { data?: { ruta: string } })?.data;

  const handleDownload = async (fileName: string) => {
    if (!currentCase || !sessionId) return;
    try {
      await downloadArtifact(currentCase, fileName, sessionId);
    } catch (err) {
      console.error("Error al descargar archivo:", err);
      alert(`No se pudo descargar ${fileName}: ${(err as Error).message}`);
    }
  };

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
        className={`fixed lg:static top-0 bottom-0 right-0 z-40 w-80 bg-white border-l border-slate-200 flex flex-col transition-transform duration-200 ease-in-out overflow-y-auto ${
          isOpenMobile ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Encabezado del Proveedor */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800 tracking-tight">Periferia IT Group S.A.S.</span>
          </div>
          <div className="text-[11px] text-slate-500 space-y-0.5 font-mono">
            <div>NIT: 900123456-7 · Medellín, CO</div>
            <div>Rep. Legal: Roberto Andrade Salazar</div>
          </div>
        </div>

        {/* Panel del Caso Activo */}
        {currentCase ? (
          <div className="p-4 space-y-4 flex-1">
            {/* Cabecera del Caso */}
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Solicitud Activa
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900 truncate">
                    {dataLeer?.cliente || currentCase}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded font-semibold uppercase">
                    {dataLeer?.pais || "CO"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Formato:</span>
                  <span className="font-semibold text-emerald-700 uppercase bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]">
                    {dataLeer?.formato || "xlsx"}
                  </span>
                </div>
              </div>
            </div>

            {/* Veredicto de Firma */}
            {dataPaquete && (
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Estado para Firma (RN3)
                </div>
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                    dataPaquete.listo_para_firma
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  {dataPaquete.listo_para_firma ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 text-xs">
                    <div className="font-bold">
                      {dataPaquete.listo_para_firma ? "LISTO PARA FIRMA" : "FIRMA BLOQUEADA"}
                    </div>
                    <div className="text-[11px] opacity-90 leading-tight">
                      {dataPaquete.listo_para_firma
                        ? "Todos los soportes exigidos están vigentes y presentes."
                        : "Existen soportes vencidos o ausentes que impiden la firma legal."}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Métricas de Campos */}
            {dataMapear && (
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Mapeo de Campos (HU-2)
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <div className="font-bold text-emerald-700 text-sm">{dataMapear.llenos.length}</div>
                    <div className="text-[10px] text-emerald-600">Llenos</div>
                  </div>
                  <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg">
                    <div className="font-bold text-rose-700 text-sm">{dataMapear.faltantes.length}</div>
                    <div className="text-[10px] text-rose-600">Faltantes</div>
                  </div>
                  <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg">
                    <div className="font-bold text-amber-700 text-sm">{dataMapear.requiere_confirmacion.length}</div>
                    <div className="text-[10px] text-amber-600">Confirmar</div>
                  </div>
                </div>

                {/* Detalle explícito de campos faltantes auditables */}
                {dataMapear.faltantes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] font-medium text-rose-700">Campos faltantes en el maestro:</div>
                    {(dataMapear.faltantes as Array<{ etiqueta: string; motivo?: string }>).map((f) => (
                      <div key={f.etiqueta} className="p-1.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-900 font-mono flex items-center justify-between">
                        <span>{f.etiqueta}</span>
                        <span className="text-[9px] text-rose-600 uppercase font-sans font-semibold">Sin dato</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Detalle explícito de campos que requieren confirmación */}
                {dataMapear.requiere_confirmacion.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] font-medium text-amber-700">Campos con regla especial (RN1):</div>
                    {(dataMapear.requiere_confirmacion as Array<{ etiqueta: string; valor_propuesto?: string }>).map((rc) => (
                      <div key={rc.etiqueta} className="p-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 font-mono flex items-center justify-between">
                        <span>{rc.etiqueta}</span>
                        <span className="text-[10px] font-semibold text-amber-800">Sugerido: {String(rc.valor_propuesto || "NIT")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Checklist de Soportes */}
            {dataPaquete?.checklist && (
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Soportes Exigidos (Checklist)
                </div>
                <div className="space-y-1.5 text-xs">
                  {dataPaquete.checklist.soportes_presentes.map((s) => (
                    <div key={s} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-100 text-emerald-800 text-[11px]">
                      <span className="font-mono">{s}</span>
                      <span className="inline-flex items-center gap-1 font-medium text-[10px] text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> Vigente
                      </span>
                    </div>
                  ))}
                  {dataPaquete.checklist.soportes_vencidos.map((s) => (
                    <div key={s} className="flex items-center justify-between p-2 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px]">
                      <span className="font-mono">{s}</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-amber-700">
                        <AlertTriangle className="w-3 h-3" /> VENCIDO
                      </span>
                    </div>
                  ))}
                  {dataPaquete.checklist.soportes_ausentes.map((s) => (
                    <div key={s} className="flex items-center justify-between p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-[11px]">
                      <span className="font-mono">{s}</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-rose-700">
                        <XCircle className="w-3 h-3" /> AUSENTE
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Artefactos Generados y Descarga */}
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Archivos Generados (out/{currentCase})
              </div>
              <div className="space-y-1.5">
                {dataLeer?.formato === "xlsx" && (
                  <button
                    type="button"
                    onClick={() => handleDownload("formulario.xlsx")}
                    className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs text-slate-700 group cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span className="font-mono text-[11px] group-hover:text-emerald-700 font-medium">formulario.xlsx</span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                  </button>
                )}

                {dataLeer?.formato === "pdf" && (
                  <button
                    type="button"
                    onClick={() => handleDownload("formulario.pdf")}
                    className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs text-slate-700 group cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-rose-600" />
                      <span className="font-mono text-[11px] group-hover:text-rose-700 font-medium">formulario.pdf</span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                  </button>
                )}

                {dataLeer?.formato === "portal" && (
                  <button
                    type="button"
                    onClick={() => handleDownload("valores-portal.md")}
                    className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs text-slate-700 group cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-sky-600" />
                      <span className="font-mono text-[11px] group-hover:text-sky-700 font-medium">valores-portal.md</span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload("checklist.md")}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs text-slate-700 group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-slate-600" />
                    <span className="font-mono text-[11px] group-hover:text-slate-900 font-medium">checklist.md</span>
                  </div>
                  <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload("borrador-correo.md")}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs text-slate-700 group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    <FileCode2 className="w-4 h-4 text-slate-600" />
                    <span className="font-mono text-[11px] group-hover:text-slate-900 font-medium">borrador-correo.md</span>
                  </div>
                  <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                </button>

                {dataEnvio && (
                  <button
                    type="button"
                    onClick={() => handleDownload("ENVIO-SIMULADO.md")}
                    className="w-full flex items-center justify-between p-2 rounded-lg border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors text-xs text-emerald-800 group cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-mono text-[11px] font-bold">ENVIO-SIMULADO.md</span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 space-y-2 flex-1 flex flex-col justify-center items-center">
            <Building2 className="w-8 h-8 text-slate-300" />
            <p className="text-xs">Selecciona o solicita procesar un caso en el chat para inspeccionar sus métricas y descargar los formularios generados.</p>
          </div>
        )}
      </aside>
    </>
  );
};

