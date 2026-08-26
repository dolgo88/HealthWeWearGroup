/** Utilidades de fecha. Todas las fechas viajan como texto AAAA-MM-DD. */

const MS_DIA = 86400000;

/** Interpreta AAAA-MM-DD en la zona horaria local, no en UTC. */
export function aFecha(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function aIso(fecha) {
  const p = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

export function hoyIso() {
  return aIso(new Date());
}

export function sumarDias(iso, dias) {
  const f = aFecha(iso);
  f.setDate(f.getDate() + dias);
  return aIso(f);
}

/** Días enteros entre dos fechas ISO (b - a). */
export function diasEntre(a, b) {
  return Math.round((aFecha(b) - aFecha(a)) / MS_DIA);
}

export function formatoCorto(iso) {
  const f = aFecha(iso);
  return f.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** "dom, 12 jul" — cabe en una línea del tooltip. */
export function formatoTooltip(iso) {
  const f = aFecha(iso);
  const texto = f.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatoLargo(iso) {
  const f = aFecha(iso);
  return f.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "hoy", "ayer" o la fecha corta — para etiquetar la última medición. */
export function formatoRelativo(iso, referencia = hoyIso()) {
  const d = diasEntre(iso, referencia);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} días`;
  return formatoCorto(iso);
}

export function edadEnAnios(fechaNacimiento, referencia = hoyIso()) {
  if (!fechaNacimiento) return null;
  const nac = aFecha(fechaNacimiento);
  const ref = aFecha(referencia);
  let edad = ref.getFullYear() - nac.getFullYear();
  const cumpleYaPasado =
    ref.getMonth() > nac.getMonth() ||
    (ref.getMonth() === nac.getMonth() && ref.getDate() >= nac.getDate());
  if (!cumpleYaPasado) edad -= 1;
  return edad >= 0 && edad < 130 ? edad : null;
}
