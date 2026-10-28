import {
  SoporteCatalogoItem,
  SoporteEvaluado
} from "../types/index.js";
import { FixtureService } from "./fixture-service.js";

export class SupportService {
  private fixtureService: FixtureService;

  constructor(fixtureService: FixtureService) {
    this.fixtureService = fixtureService;
  }

  /**
   * Evalúa la lista de soportes exigidos contra el catálogo y las vigencias reales.
   * Acepta un reloj inyectable (referenceDate) para determinismo y tests.
   */
  public evaluarSoportes(
    soportesExigidos: string[],
    referenceDate: Date = new Date()
  ): {
    evaluados: SoporteEvaluado[];
    soportesPresentes: string[];
    soportesAusentes: string[];
    soportesVencidos: string[];
    listoParaFirma: boolean;
  } {
    const catalogo = this.fixtureService.getCatalogoSoportes();
    const evaluados: SoporteEvaluado[] = [];

    // Normalizar la fecha de referencia a medianoche para comparación limpia de fechas (YYYY-MM-DD)
    const refYear = referenceDate.getFullYear();
    const refMonth = referenceDate.getMonth();
    const refDay = referenceDate.getDate();
    const refTime = new Date(refYear, refMonth, refDay).getTime();

    for (const tipo of soportesExigidos) {
      const match = catalogo.find((item: SoporteCatalogoItem) => item.tipo === tipo);

      if (!match) {
        evaluados.push({
          tipo,
          estado: "ausente",
          motivo: "El soporte exigido no existe en el catálogo interno"
        });
        continue;
      }

      // Verificar existencia física del archivo
      const diskPath = this.fixtureService.getSoporteFilePath(match.archivo);
      if (!diskPath) {
        evaluados.push({
          tipo,
          archivo: match.archivo,
          descripcion: match.descripcion,
          vigencia_hasta: match.vigencia_hasta,
          estado: "ausente",
          motivo: `El archivo físico "${match.archivo}" no fue encontrado en repositorio/soportes`
        });
        continue;
      }

      // Evaluar vigencia
      if (!match.vigencia_hasta) {
        // Soporte permanente (ej. RUT)
        evaluados.push({
          tipo,
          archivo: match.archivo,
          descripcion: match.descripcion,
          vigencia_hasta: null,
          estado: "presente_vigente"
        });
        continue;
      }

      // Parsear fecha YYYY-MM-DD
      const [year, month, day] = match.vigencia_hasta.split("-").map(Number);
      const vigenciaTime = new Date(year, month - 1, day).getTime();

      if (vigenciaTime < refTime) {
        // Expirado
        evaluados.push({
          tipo,
          archivo: match.archivo,
          descripcion: match.descripcion,
          vigencia_hasta: match.vigencia_hasta,
          estado: "presente_vencido",
          motivo: `Vencido el ${match.vigencia_hasta}`
        });
      } else {
        // Vigente
        evaluados.push({
          tipo,
          archivo: match.archivo,
          descripcion: match.descripcion,
          vigencia_hasta: match.vigencia_hasta,
          estado: "presente_vigente"
        });
      }
    }

    const soportesPresentes = evaluados
      .filter((s) => s.estado === "presente_vigente")
      .map((s) => s.tipo);

    const soportesAusentes = evaluados
      .filter((s) => s.estado === "ausente")
      .map((s) => s.tipo);

    const soportesVencidos = evaluados
      .filter((s) => s.estado === "presente_vencido")
      .map((s) => s.tipo);

    // Regla RN3: Soporte ausente o vencido BLOQUEA listo_para_firma
    const listoParaFirma = soportesAusentes.length === 0 && soportesVencidos.length === 0;

    return {
      evaluados,
      soportesPresentes,
      soportesAusentes,
      soportesVencidos,
      listoParaFirma
    };
  }
}

