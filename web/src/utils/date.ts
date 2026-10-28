/**
 * Formateador seguro de fechas y marcas de tiempo ISO 8601
 * Evita el error 'Invalid Date' ante valores no inicializados, mal formados o preformateados.
 */

export function formatSafeTime(value?: string | number | Date | null): string {
  if (!value) return "";

  // Si ya es un objeto Date
  if (value instanceof Date) {
    return isNaN(value.getTime())
      ? ""
      : value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Si ya viene pre-formateado como hora ("11:10 AM", "14:30")
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{1,2}:\d{2}(\s*(AM|PM|am|pm))?$/.test(trimmed)) {
      return trimmed;
    }
  }

  // Intentar parsear como ISO 8601 o timestamp numérico
  const dateObj = new Date(value);
  if (isNaN(dateObj.getTime())) {
    return "";
  }

  return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatSafeDate(value?: string | number | Date | null): string {
  if (!value) return "";

  const dateObj = value instanceof Date ? value : new Date(value);
  if (isNaN(dateObj.getTime())) {
    return "";
  }

  return dateObj.toLocaleDateString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

