// Lógica pura de recepción (sin React ni Supabase) para poder probarla con `npm test`.
// Días que faltan para que venza una membresía (negativo = ya venció). Fechas 'YYYY-MM-DD'.
export function diasParaVencer(fin, hoy = new Date()) {
  const f = new Date(`${fin}T00:00:00`);
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((f - h) / 86400000);
}
