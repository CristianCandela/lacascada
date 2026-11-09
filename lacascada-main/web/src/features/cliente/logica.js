// Lógica pura del rol cliente (sin React ni Supabase) para poder probarla con `npm test`.
const ESTADOS = { pendiente: 'Pendiente', asistio: 'Asististe', no_asistio: 'No asististe', cancelo: 'Cancelada' };

export function etiquetaEstadoReserva(estado) {
  return ESTADOS[estado] || 'Desconocido';
}
