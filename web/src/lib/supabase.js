import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configurado = Boolean(url && key && !url.includes('TU-PROYECTO'));
export const supabase = configurado ? createClient(url, key) : null;

export const MSG_RED = 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';

export function esFalloDeRed(err) {
  const m = String((err && err.message) || err || '').toLowerCase();
  return m.includes('fetch') || m.includes('network') || m.includes('failed');
}

export function mensajeError(err) {
  if (esFalloDeRed(err)) return MSG_RED;
  const m = String((err && err.message) || '');
  if (m.includes('Aforo máximo')) return 'Aforo máximo completado para esta franja horaria.';
  if (m.includes('citas_sin_duplicado')) return 'Ese cliente ya tiene una reserva del mismo servicio a esa hora.';
  return `Ocurrió un error: ${m || 'inténtalo otra vez.'}`;
}
