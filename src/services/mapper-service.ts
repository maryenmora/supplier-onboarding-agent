import {
  CampoLleno,
  CampoFaltante,
  CampoRequiereConfirmacion,
  ResultadoMapeo
} from "../types/index.js";

/**
 * Resuelve una ruta separada por puntos (dot-notation) dentro de un objeto anidado
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export class MapperService {
  private maestro: Record<string, unknown>;
  private glosario: Record<string, string>;

  constructor(maestro: Record<string, unknown>, glosario: Record<string, string>) {
    this.maestro = maestro;
    this.glosario = glosario;
  }

  /**
   * Mapea un listado de etiquetas al maestro usando el glosario y reglas de país (RN1).
   * Clasifica cada campo en exactamente uno de: llenos, faltantes o requiere_confirmacion.
   */
  public mapear(etiquetas: string[], paisSolicitud: string): ResultadoMapeo {
    const llenos: CampoLleno[] = [];
    const faltantes: CampoFaltante[] = [];
    const requiereConfirmacion: CampoRequiereConfirmacion[] = [];

    const pais = (paisSolicitud || "CO").toUpperCase();

    for (const etiqueta of etiquetas) {
      const trimmed = etiqueta.trim();

      // 1. Buscar en el glosario (coincidencia directa o normalizada sin mayúsculas/acentos si hiciera falta)
      let rutaMaestro = this.glosario[trimmed];

      if (!rutaMaestro) {
        // Intento de búsqueda insensible a mayúsculas en el glosario
        const keyLower = trimmed.toLowerCase();
        for (const [gKey, gVal] of Object.entries(this.glosario)) {
          if (gKey.toLowerCase() === keyLower) {
            rutaMaestro = gVal;
            break;
          }
        }
      }

      // Si no está en glosario, verificar si coincide directamente con una propiedad del maestro
      if (!rutaMaestro && trimmed in this.maestro) {
        rutaMaestro = trimmed;
      }

      // 2. Si no tiene ruta asociada ni existe en maestro -> FALTANTE
      if (!rutaMaestro) {
        faltantes.push({
          etiqueta: trimmed,
          motivo: "El campo no existe en el glosario ni en el repositorio maestro"
        });
        continue;
      }

      // 3. Obtener el valor desde el repositorio maestro
      const valor = getNestedValue(this.maestro, rutaMaestro);

      // Si el valor no existe o es indefinido en el maestro -> FALTANTE
      if (valor === undefined || valor === null || valor === "") {
        faltantes.push({
          etiqueta: trimmed,
          motivo: `No se encontró valor en la ruta "${rutaMaestro}" del repositorio maestro`
        });
        continue;
      }

      // Asegurar que el valor sea un primitivo aceptable
      const primitiveValue = (typeof valor === "string" || typeof valor === "number" || typeof valor === "boolean")
        ? valor
        : String(valor);

      // 4. Regla RN1: Identificadores tributarios por país
      // CO -> NIT, EC -> RUC, PE -> RUC, PA -> RUC, HN -> RTN
      const esIdentificadorTributario =
        rutaMaestro === "nit" ||
        trimmed.toUpperCase() === "NIT" ||
        trimmed.toUpperCase() === "RUC" ||
        trimmed.toUpperCase() === "RTN" ||
        trimmed.toLowerCase().includes("identificación tributaria") ||
        trimmed.toLowerCase().includes("identificación fiscal");

      if (esIdentificadorTributario) {
        if (pais === "CO") {
          // Caso Colombia: Periferia tiene NIT local
          llenos.push({
            etiqueta: trimmed,
            valor: primitiveValue,
            ruta_maestro: rutaMaestro
          });
        } else {
          // País extranjero: Periferia solo tiene NIT colombiano (RN1)
          // Se llena con el NIT y se marca en requiere_confirmacion con nota de identificador extranjero
          requiereConfirmacion.push({
            etiqueta: trimmed,
            valor_propuesto: primitiveValue,
            motivo: `identificador extranjero (${pais}): Periferia solo cuenta con NIT colombiano`,
            sugerencia: `Utilizar NIT colombiano (${primitiveValue}) con aclaración de proveedor del exterior`
          });
        }
        continue;
      }

      // 5. Caso estándar: Campo encontrado con fuente trazable en maestro
      llenos.push({
        etiqueta: trimmed,
        valor: primitiveValue,
        ruta_maestro: rutaMaestro
      });
    }

    return {
      llenos,
      faltantes,
      requiere_confirmacion: requiereConfirmacion
    };
  }
}

