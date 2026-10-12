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
  return esFalloDeRed(err) ? MSG_RED : `Ocurrió un error: ${(err && err.message) || 'inténtalo otra vez.'}`;
}
