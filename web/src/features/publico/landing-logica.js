// Lógica pura de la página pública (sin React ni Supabase), probada con `npm test`.
import { nivelAforo } from './logica.js';

export const formatoHora = (t) => String(t || '').slice(0, 5);

export function formatoPrecio(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return `S/ ${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

export const textoNivelAforo = (nivel) => ({ bajo: 'Disponible', medio: 'Concurrido', alto: 'Casi lleno' }[nivel] || '');

export const formatoTelefono = (t) => String(t || '').replace(/\D/g, '').slice(-9).replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

export const enlaceWhatsApp = (telefono, texto = '') => {
  const n = String(telefono || '').replace(/\D/g, '').slice(-9);
  return `https://wa.me/51${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
};

export const urlMapa = (direccion) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${direccion}, Lima, Perú`)}`;

// Filas de aforo_actual -> { gimnasio, sauna } de una sede, con porcentaje y nivel.
export function aforoDeSede(filas, sede) {
  const salida = { gimnasio: null, sauna: null };
  (filas || []).filter((f) => f.sede === sede).forEach((f) => {
    if (f.servicio in salida) salida[f.servicio] = { ocupados: f.ocupados, capacidad: f.capacidad, ...nivelAforo(f.ocupados, f.capacidad) };
  });
  return salida;
}

// ¿El local está abierto ahora (hora de Lima)? abre/cierra: 'HH:MM' o 'HH:MM:SS'.
export function estadoLocal(abre, cierra, ahora = new Date()) {
  if (!abre || !cierra) return null;
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(ahora);
  const hora = hm.replace('24:', '00:');
  const a = formatoHora(abre); const c = formatoHora(cierra);
  return { abierto: hora >= a && hora < c, abre: a, cierra: c };
}
