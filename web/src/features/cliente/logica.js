// Lógica pura del rol cliente (sin React ni Supabase) para poder probarla con `npm test`.
// web/src/features/cliente/logica.js

const DICCIONARIO_ESTADOS = {
  pendiente: 'Pendiente',
  asistio: 'Asististe',
  no_asistio: 'No asististe',
  cancelo: 'Cancelada'
};

/**
 * Devuelve la etiqueta legible para el estado de una reserva.
 */
export function etiquetaEstadoReserva(estado) {
  if (!estado) return 'Sin datos';
  return DICCIONARIO_ESTADOS[estado.toLowerCase()] || estado;
}

/**
 * Valida que el código del local ingresado por el cliente sea de 6 dígitos numéricos.
 */
export function validarCodigo6Digitos(codigo) {
  return /^\d{6}$/.test(String(codigo || '').trim());
}

/**
 * Formatea cadenas de fecha a un formato amigable para Perú (DD/MM/YYYY HH:mm).
 */
export function formatearFechaPe(fechaStr) {
  if (!fechaStr) return 'En curso';
  const fecha = new Date(fechaStr);
  if (isNaN(fecha.getTime())) return fechaStr;

  return fecha.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Retorna la clase CSS correspondiente según el estado de la reserva.
 */
export function claseBadgeEstado(estado) {
  const e = (estado || '').toLowerCase();
  if (e === 'pendiente') return 'cli-badge-pendiente';
  if (e === 'asistio') return 'cli-badge-asistio';
  if (e === 'cancelo') return 'cli-badge-cancelo';
  return 'cli-badge-neutro';
}