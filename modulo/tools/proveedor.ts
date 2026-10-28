/**
 * Módulo Reutilizable - Herramientas de Registro como Proveedor
 * Periferia IT Group
 *
 * Exporta las mismas 5 herramientas que utiliza el motor conversacional
 * para permitir su consumo standalone sin depender del servidor HTTP.
 */

export {
  leer_solicitud,
  mapear_campos,
  generar_formulario,
  armar_paquete,
  simular_envio
} from "../../src/tools/proveedor.js";

export type {
  ToolContext,
  SolicitudLectura,
  MapeoCamposResultado,
  GenerarFormularioResultado,
  ArmarPaqueteResultado,
  SimularEnvioResultado
} from "../../src/types/index.js";

