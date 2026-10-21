// Lógica pura de páginas públicas (sin React ni Supabase) para poder probarla con `npm test`.
// Nivel del indicador de aforo en barras: porcentaje y nivel 'bajo' (<50 %), 'medio' (<80 %) o 'alto'.
export function nivelAforo(ocupados, capacidad) {
  if (!capacidad || capacidad <= 0) return { pct: 0, nivel: 'bajo' };
  const pct = Math.min(100, Math.round((ocupados / capacidad) * 100));
  return { pct, nivel: pct < 50 ? 'bajo' : pct < 80 ? 'medio' : 'alto' };
}
