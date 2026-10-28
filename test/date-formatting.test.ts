import test from "node:test";
import assert from "node:assert/strict";

// Función equivalente a la del frontend para probar en Node.js
function formatSafeTime(value?: string | number | Date | null): string {
  if (!value) return "";
  if (value instanceof Date) {
    return isNaN(value.getTime())
      ? ""
      : value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{1,2}:\d{2}(\s*(AM|PM|am|pm))?$/.test(trimmed)) {
      return trimmed;
    }
  }
  const dateObj = new Date(value);
  if (isNaN(dateObj.getTime())) {
    return "";
  }
  return dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

test("Date Formatter: Nunca retorna 'Invalid Date'", () => {
  // 1. Casos inválidos o corruptos
  assert.equal(formatSafeTime("cadena-invalida-xyz"), "");
  assert.equal(formatSafeTime(null), "");
  assert.equal(formatSafeTime(undefined), "");
  assert.equal(formatSafeTime(""), "");
  assert.equal(formatSafeTime(new Date("fecha-invalida")), "");

  // 2. Cadenas ISO 8601 válidas
  const isoTime = formatSafeTime("2026-10-28T16:30:00.000Z");
  assert.ok(!isoTime.includes("Invalid"), "No debe contener Invalid");
  assert.ok(isoTime.length > 0, "Debe contener una hora formateada");

  // 3. Objeto Date válido
  const dateObjTime = formatSafeTime(new Date(2026, 9, 28, 11, 45));
  assert.ok(!dateObjTime.includes("Invalid"));
  assert.ok(dateObjTime.length > 0);

  // 4. Cadena que ya venía como hora preformateada
  assert.equal(formatSafeTime("11:30 AM"), "11:30 AM");
  assert.equal(formatSafeTime("14:25"), "14:25");
});

