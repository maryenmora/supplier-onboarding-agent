import fs from "node:fs";
import path from "node:path";
import {
  Solicitud,
  SolicitudSchema,
  PlantillaCeldaItem,
  PlantillaCeldaItemSchema,
  PlantillaCampoItem,
  PlantillaCampoItemSchema,
  SoporteCatalogoItem,
  SoporteCatalogoItemSchema,
  CampoIdentificado
} from "../types/index.js";

export class FixtureService {
  private baseDir: string;
  private fixtureRoot: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
    // Buscar fixtures en raíz o en carpeta entregada
    const rootFixtures = path.join(this.baseDir, "fixtures", "reto-01");
    const nestedFixtures = path.join(this.baseDir, "PRD-01-agente-registro-proveedor 3", "fixtures", "reto-01");

    if (fs.existsSync(rootFixtures)) {
      this.fixtureRoot = rootFixtures;
    } else if (fs.existsSync(nestedFixtures)) {
      this.fixtureRoot = nestedFixtures;
    } else {
      throw new Error(`Directorio de fixtures no encontrado en ${this.baseDir}`);
    }
  }

  public sanitizeCaso(caso: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(caso)) {
      throw new Error(`Nombre de caso inválido o peligroso: "${caso}"`);
    }
    return caso;
  }

  public getCasoDir(caso: string): string {
    const safeCaso = this.sanitizeCaso(caso);
    const casoDir = path.resolve(this.fixtureRoot, "casos", safeCaso);

    // Evitar Path Traversal verificando que resida dentro de fixtureRoot
    if (!casoDir.startsWith(this.fixtureRoot)) {
      throw new Error(`Acceso no autorizado fuera del árbol de fixtures: ${caso}`);
    }
    if (!fs.existsSync(casoDir)) {
      throw new Error(`Caso no encontrado en fixtures: "${safeCaso}"`);
    }
    return casoDir;
  }

  public getSolicitud(caso: string): Solicitud {
    const casoDir = this.getCasoDir(caso);
    const filePath = path.join(casoDir, "solicitud.json");
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo solicitud.json no encontrado para el caso ${caso}`);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return SolicitudSchema.parse(raw);
  }

  public getCamposSolicitados(caso: string, formato: string): CampoIdentificado[] {
    const casoDir = this.getCasoDir(caso);

    if (formato === "xlsx") {
      const celdasPath = path.join(casoDir, "plantilla-celdas.json");
      if (!fs.existsSync(celdasPath)) {
        throw new Error(`plantilla-celdas.json no encontrada para caso xlsx: ${caso}`);
      }
      const raw = JSON.parse(fs.readFileSync(celdasPath, "utf-8"));
      const items: PlantillaCeldaItem[] = raw.map((item: unknown) => PlantillaCeldaItemSchema.parse(item));
      return items.map((i) => ({
        etiqueta: i.etiqueta,
        hoja: i.hoja,
        celda_etiqueta: i.celda_etiqueta,
        celda_valor: i.celda_valor,
        obligatorio: true
      }));
    } else {
      // pdf o portal
      const camposPath = path.join(casoDir, "plantilla-campos.json");
      if (!fs.existsSync(camposPath)) {
        throw new Error(`plantilla-campos.json no encontrada para caso ${formato}: ${caso}`);
      }
      const raw = JSON.parse(fs.readFileSync(camposPath, "utf-8"));
      const items: PlantillaCampoItem[] = raw.map((item: unknown) => PlantillaCampoItemSchema.parse(item));
      return items.map((i) => ({
        etiqueta: i.etiqueta,
        obligatorio: i.obligatorio
      }));
    }
  }

  public getSoportesExigidos(caso: string): string[] {
    const casoDir = this.getCasoDir(caso);
    const filePath = path.join(casoDir, "soportes-exigidos.json");
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(raw)) {
      throw new Error(`soportes-exigidos.json debe ser un array en caso: ${caso}`);
    }
    return raw as string[];
  }

  public getMaestro(): Record<string, unknown> {
    const maestroPath = path.join(this.fixtureRoot, "repositorio", "maestro.json");
    if (!fs.existsSync(maestroPath)) {
      throw new Error(`Archivo maestro.json no encontrado en ${maestroPath}`);
    }
    return JSON.parse(fs.readFileSync(maestroPath, "utf-8")) as Record<string, unknown>;
  }

  public getGlosario(): Record<string, string> {
    const glosarioPath = path.join(this.fixtureRoot, "glosario-campos.json");
    if (!fs.existsSync(glosarioPath)) {
      throw new Error(`Archivo glosario-campos.json no encontrado en ${glosarioPath}`);
    }
    return JSON.parse(fs.readFileSync(glosarioPath, "utf-8")) as Record<string, string>;
  }

  public getCatalogoSoportes(): SoporteCatalogoItem[] {
    const soporteIndexPath = path.join(this.fixtureRoot, "repositorio", "soportes", "index.json");
    if (!fs.existsSync(soporteIndexPath)) {
      throw new Error(`Catálogo de soportes index.json no encontrado en ${soporteIndexPath}`);
    }
    const raw = JSON.parse(fs.readFileSync(soporteIndexPath, "utf-8"));
    return (raw as unknown[]).map((item) => SoporteCatalogoItemSchema.parse(item));
  }

  public getSoporteFilePath(archivo: string): string | null {
    const safeArchivo = path.basename(archivo);
    const filePath = path.join(this.fixtureRoot, "repositorio", "soportes", safeArchivo);
    return fs.existsSync(filePath) ? filePath : null;
  }
}

