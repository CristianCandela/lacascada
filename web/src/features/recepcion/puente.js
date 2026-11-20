// Puente local de Recepción: pasa un código/DNI de una pantalla a Pagos.
let pendiente = null;
const oyentes = new Set();

export function enviarAPagos(texto) {
  pendiente = texto;
  oyentes.forEach((fn) => fn());
}

export function tomarPendiente() {
  const t = pendiente;
  pendiente = null;
  return t;
}

export function alLlegar(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
