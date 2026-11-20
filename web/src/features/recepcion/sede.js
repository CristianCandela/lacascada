// Sedes del gimnasio y ayudas compartidas de Recepción.
export const SEDES = ['Santa Rosa', 'Túpac Amaru'];
export const CAPACIDAD_GIM = { 'Santa Rosa': 40, 'Túpac Amaru': 30 };
const CLAVE = 'rec_sede';

export function sedeGuardada() {
  try { const s = sessionStorage.getItem(CLAVE); return SEDES.includes(s) ? s : SEDES[0]; } catch { return SEDES[0]; }
}
export function guardarSede(s) { try { sessionStorage.setItem(CLAVE, s); } catch { /* sin almacenamiento */ } }

// Cambia de pantalla pulsando la pestaña de la barra lateral (App.jsx la dibuja con data-tab).
export function irA(id, onAviso, texto) {
  const b = document.querySelector(`[data-tab="${id}"]`);
  if (b) b.click(); else if (onAviso) onAviso(texto || 'Esta pantalla está en construcción.');
}