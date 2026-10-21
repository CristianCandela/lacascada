// Lógica pura de administración (sin React ni Supabase) para poder probarla con `npm test`.
// Días sin asistir desde la última visita; null si el cliente nunca asistió. Fechas ISO o 'YYYY-MM-DD'.
export function diasSinAsistir(ultimaVisita, hoy = new Date()) {
  if (!ultimaVisita) return null;
  return Math.floor((hoy - new Date(ultimaVisita)) / 86400000);
}
