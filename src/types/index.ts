import { z } from "zod";

// --- Country and Format Types ---
export type Pais = "CO" | "EC" | "HN" | "PA" | string;
export type FormatoSalida = "xlsx" | "pdf" | "portal";

// --- Tool Context ---
export interface ToolContext {
  directory: string;
  sessionId?: string;
  referenceDate?: Date;
  sessionConfirmed?: boolean;
}

// --- Tool Standard Response ---
export type ToolResult<T> = 
  | { ok: true; data: T }
  | { ok: false; error: string };

// --- Request (solicitud.json) Schema ---
export const SolicitudSchema = z.object({
  id: z.string(),
  de: z.string(),
  para: z.string().optional(),
  asunto: z.string(),
  fecha: z.string(),
  pais: z.string(),
  cliente: z.string(),
  formato: z.enum(["xlsx", "pdf", "portal"]),
  cuerpo: z.string(),
  adjuntos: z.array(z.string()).default([])
});
export type Solicitud = z.infer<typeof SolicitudSchema>;

// --- Template Item Schemas ---
export const PlantillaCeldaItemSchema = z.object({
  hoja: z.string(),
  celda_etiqueta: z.string(),
  etiqueta: z.string(),
  celda_valor: z.string()
});
export type PlantillaCeldaItem = z.infer<typeof PlantillaCeldaItemSchema>;

export const PlantillaCampoItemSchema = z.object({
  etiqueta: z.string(),
  obligatorio: z.boolean().default(true)
});
export type PlantillaCampoItem = z.infer<typeof PlantillaCampoItemSchema>;

// Unified representation of a requested field
export interface CampoIdentificado {
  etiqueta: string;
  hoja?: string;
  celda_etiqueta?: string;
  celda_valor?: string;
  obligatorio?: boolean;
}

// --- Support / Document Schemas ---
export const SoporteCatalogoItemSchema = z.object({
  tipo: z.string(),
  archivo: z.string(),
  vigencia_hasta: z.string().nullable(),
  pais_emisor: z.string(),
  descripcion: z.string()
});
export type SoporteCatalogoItem = z.infer<typeof SoporteCatalogoItemSchema>;

export interface SoporteEvaluado {
  tipo: string;
  archivo?: string;
  descripcion?: string;
  vigencia_hasta?: string | null;
  estado: "presente_vigente" | "presente_vencido" | "ausente";
  motivo?: string;
}

// --- Field Mapping Types ---
export interface CampoLleno {
  etiqueta: string;
  valor: string | number | boolean;
  ruta_maestro: string;
}

export interface CampoFaltante {
  etiqueta: string;
  motivo: string;
}

export interface CampoRequiereConfirmacion {
  etiqueta: string;
  valor_propuesto: string | number | boolean;
  motivo: string;
  sugerencia?: string;
}

export interface ResultadoMapeo {
  llenos: CampoLleno[];
  faltantes: CampoFaltante[];
  requiere_confirmacion: CampoRequiereConfirmacion[];
}

// --- Tool 1: leer_solicitud ---
export const LeerSolicitudArgsSchema = z.object({
  caso: z.string().regex(/^[a-zA-Z0-9_-]+$/, "Identificador de caso inválido").describe("Nombre de la carpeta del caso en fixtures/reto-01/casos/")
});
export type LeerSolicitudArgs = z.infer<typeof LeerSolicitudArgsSchema>;

export interface LeerSolicitudData {
  pais: string;
  cliente: string;
  formato: FormatoSalida;
  campos: CampoIdentificado[];
  soportes: string[];
}

// --- Tool 2: mapear_campos ---
export const MapearCamposArgsSchema = z.object({
  caso: z.string().regex(/^[a-zA-Z0-9_-]+$/, "Identificador de caso inválido").describe("Identificador del caso para contexto de reglas"),
  campos: z.array(z.string()).describe("Lista de etiquetas solicitadas en la plantilla")
});
export type MapearCamposArgs = z.infer<typeof MapearCamposArgsSchema>;

// --- Tool 3: generar_formulario ---
export const GenerarFormularioArgsSchema = z.object({
  caso: z.string().regex(/^[a-zA-Z0-9_-]+$/, "Identificador de caso inválido").describe("Identificador del caso"),
  mapeo: z.object({
    llenos: z.array(z.object({
      etiqueta: z.string(),
      valor: z.union([z.string(), z.number(), z.boolean()])
    })),
    requiere_confirmacion: z.array(z.object({
      etiqueta: z.string(),
      valor_propuesto: z.union([z.string(), z.number(), z.boolean()])
    })).optional()
  }).describe("Mapeo validado de campos con sus valores a escribir")
});
export type GenerarFormularioArgs = z.infer<typeof GenerarFormularioArgsSchema>;

export interface GenerarFormularioData {
  ruta: string;
  formato: FormatoSalida;
  advertencia?: string;
}

// --- Tool 4: armar_paquete ---
export const ArmarPaqueteArgsSchema = z.object({
  caso: z.string().regex(/^[a-zA-Z0-9_-]+$/, "Identificador de caso inválido").describe("Identificador del caso a empaquetar")
});
export type ArmarPaqueteArgs = z.infer<typeof ArmarPaqueteArgsSchema>;

export interface ArmarPaqueteData {
  ruta: string;
  listo_para_firma: boolean;
  checklist: {
    soportes_presentes: string[];
    soportes_ausentes: string[];
    soportes_vencidos: string[];
    campos_faltantes: string[];
  };
  ruta_borrador_correo: string;
}

// --- Tool 5: simular_envio ---
export const SimularEnvioArgsSchema = z.object({
  caso: z.string().regex(/^[a-zA-Z0-9_-]+$/, "Identificador de caso inválido").describe("Identificador del caso"),
  confirmado: z.boolean().describe("Debe ser true, ratificando la confirmación explícita del usuario")
});
export type SimularEnvioArgs = z.infer<typeof SimularEnvioArgsSchema>;

export interface SimularEnvioData {
  ruta: string;
  enviado_a: string;
  timestamp: string;
}

