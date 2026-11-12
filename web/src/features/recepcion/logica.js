// Lógica pura de recepción (sin React ni Supabase) para poder probarla con `npm test`.

// Días que faltan para que venza una membresía (negativo = ya venció). Fechas 'YYYY-MM-DD'.
export function diasParaVencer(fin, hoy = new Date()) {
  const f = new Date(`${fin}T00:00:00`);
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((f - h) / 86400000);
}

// Semáforo de membresía: 'gris' (sin plan), 'rojo' (vencida), 'amarillo' (vence pronto), 'verde' (vigente).
export function semaforoMembresia(fin, hoy = new Date(), diasAlerta = 7) {
  if (!fin) return 'gris';
  const dias = diasParaVencer(fin, hoy);
  if (dias < 0) return 'rojo';
  if (dias <= diasAlerta) return 'amarillo';
  return 'verde';
}

// Estado del aforo: porcentaje y color según umbrales (ajustables).
export function estadoAforo(ocupados, capacidad, umbrales = { amarillo: 60, rojo: 90 }) {
  if (!capacidad || capacidad <= 0) return { porcentaje: 0, color: 'gris', mensaje: 'Sin datos' };
  const porcentaje = Math.round((ocupados / capacidad) * 100);
  if (porcentaje >= umbrales.rojo) return { porcentaje, color: 'rojo', mensaje: 'Lleno' };
  if (porcentaje >= umbrales.amarillo) return { porcentaje, color: 'amarillo', mensaje: 'Se está llenando' };
  return { porcentaje, color: 'verde', mensaje: 'Buen momento para venir' };
}

// Decide qué escribió la recepcionista en el buscador: DNI (8 dígitos), código de cliente o nombre.
export function tipoBusqueda(texto) {
  const t = String(texto || '').trim();
  if (!t) return 'vacio';
  if (/^\d{8}$/.test(t)) return 'dni';
  if (/^[A-Za-z]{0,3}-?\d{3,6}$/.test(t)) return 'codigo';
  return 'nombre';
}

// Construye la lista de alertas de Inicio a partir de datos reales (sin escribirlas a mano).
export function construirAlertas({ aforoGim, porVencer = [], noShows = 0 }, hoy = new Date()) {
  const alertas = [];
  if (aforoGim && aforoGim.color === 'rojo') alertas.push({ id: 'aforo', tono: 'rojo', icono: 'alerta', titulo: 'Gimnasio lleno', detalle: `${aforoGim.porcentaje} % de ocupación. Avisa a quien llegue.`, accion: 'Ver aforo' });
  else if (aforoGim && aforoGim.color === 'amarillo') alertas.push({ id: 'aforo', tono: 'amarillo', icono: 'alerta', titulo: 'Gimnasio llenándose', detalle: `${aforoGim.porcentaje} % de ocupación.`, accion: 'Monitorear' });
  const vencidas = porVencer.filter((m) => diasParaVencer(m.fin, hoy) < 0);
  const proximas = porVencer.filter((m) => diasParaVencer(m.fin, hoy) >= 0);
  if (vencidas.length) alertas.push({ id: 'vencidas', tono: 'rojo', icono: 'x', titulo: `${vencidas.length} membresía(s) vencida(s)`, detalle: `${vencidas[0].nombre}${vencidas.length > 1 ? ' y otras' : ''}: ofrecer renovación en caja.`, accion: 'Renovar' });
  if (proximas.length) alertas.push({ id: 'proximas', tono: 'amarillo', icono: 'agenda', titulo: `${proximas.length} membresía(s) vencen en 7 días`, detalle: 'Avisar al salir o por WhatsApp.', accion: 'Ver lista' });
  if (noShows > 0) alertas.push({ id: 'noshows', tono: 'azul', icono: 'reloj', titulo: `${noShows} cita(s) de sauna sin llegar`, detalle: 'Pagadas y sin check-in al terminar el turno.', accion: 'Ver agenda' });
  return alertas;
}

// ---- Check-in, tarifas y entrada (Recepción) ----
// Tarifas de ejemplo. Más adelante vendrán de la tabla `tarifas` (PROPUESTA).
export const TARIFAS = { sauna_regular: 20, sauna_afiliado: 15, pase_dia: 20 };

export function esAfiliadoVigente(fin, hoy = new Date()) {
  return !!fin && diasParaVencer(fin, hoy) >= 0;
}

// El monto lo calcula el sistema; la recepcionista no lo escribe.
export function calcularTarifaSauna(esAfiliado, tarifas = TARIFAS) {
  return esAfiliado
    ? { monto: tarifas.sauna_afiliado, etiqueta: 'Tarifa afiliado' }
    : { monto: tarifas.sauna_regular, etiqueta: 'Tarifa regular' };
}

export function textoMembresia(fin, hoy = new Date()) {
  if (!fin) return 'Sin plan';
  const d = diasParaVencer(fin, hoy);
  if (d < 0) return `Vencida hace ${-d} ${-d === 1 ? 'día' : 'días'}`;
  if (d === 0) return 'Vence hoy';
  if (d <= 7) return `Vence en ${d} ${d === 1 ? 'día' : 'días'}`;
  return `Vigente, le quedan ${d} días`;
}

// ¿Puede entrar al gimnasio? Membresía vigente o pase del día. Avisa si está lleno o si ya entró hace poco.
export function decisionEntrada({ fin, tienePase = false, aforoColor, ultimaEntrada }, ahora = new Date()) {
  const avisos = [];
  if (aforoColor === 'rojo') avisos.push('lleno');
  if (ultimaEntrada && ahora - new Date(ultimaEntrada) < 120 * 60000) avisos.push('duplicado');
  return { puede: esAfiliadoVigente(fin, ahora) || tienePase, avisos };
}

// ---- Reserva de sauna y registro asistido ----
export const esDniValido = (t) => /^\d{8}$/.test(String(t || '').trim());
export const esTelefonoValido = (t) => !String(t || '').trim() || /^\d{9}$/.test(String(t).trim());

// Turnos de una hora entre 'desde' y 'hasta' (horas 0-23) para el día +offset. Hoy omite los que ya pasaron.
export function turnosDelDia(offset = 0, ahora = new Date(), desde = 6, hasta = 21) {
  const lista = [];
  for (let h = desde; h <= hasta; h++) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + offset, h, 0, 0, 0);
    if (offset === 0 && d.getTime() + 3600000 <= ahora.getTime()) continue;
    lista.push(d);
  }
  return lista;
}
// ---- Pagos (membresía y pase del día) ----
// Planes de ejemplo. Más adelante vendrán de la tabla `planes` (CONTRATO).
export const PLANES = [
  { id_plan: 'p1', nombre: 'Mensual', dias: 30, precio: 160 },
  { id_plan: 'p2', nombre: 'Trimestral', dias: 90, precio: 380 },
  { id_plan: 'p3', nombre: 'Semestral', dias: 180, precio: 680 }
];
export const MOTIVOS_ANULACION = [
  'Error al registrar el cobro',
  'Operación duplicada de Yape/Plin',
  'El cliente desistió',
  'Cambio de plan'
];

// Nueva fecha de fin: si aún está vigente se suma al fin actual; si no, desde hoy.
export function nuevoFin(finActual, dias, hoy = new Date()) {
  const base = finActual && diasParaVencer(finActual, hoy) >= 0 ? new Date(`${finActual}T00:00:00`) : new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  base.setDate(base.getDate() + dias);
  const p = (n) => String(n).padStart(2, '0');
  return `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}`;
}

// Monto que calcula el sistema; la recepcionista no lo escribe.
export function montoCobro(concepto, plan) {
  if (concepto === 'pase_dia') return TARIFAS.pase_dia;
  return plan ? plan.precio : 0;
}

// ---- Renovaciones ----
export function mensajeRenovacion(nombre, fin, hoy = new Date()) {
  const primero = String(nombre || '').split(' ')[0];
  const d = diasParaVencer(fin, hoy);
  const cuando = d < 0 ? `venció hace ${-d} ${-d === 1 ? 'día' : 'días'}` : d === 0 ? 'vence hoy' : `vence en ${d} ${d === 1 ? 'día' : 'días'}`;
  return `Hola ${primero}, en Cascada Gym te recordamos que tu membresía ${cuando}. Renueva en recepción y mantén tus beneficios activos.`;
}

export function mensajeAusente(nombre, dias) {
  const primero = String(nombre || '').split(' ')[0];
  return `Hola ${primero}, en Cascada Gym te extrañamos: hace ${dias} días que no vienes. ¿Todo bien? Aquí te esperamos para seguir entrenando.`;
}

// Enlace de WhatsApp (Perú: prefijo 51). Devuelve null si el teléfono no es válido.
export function enlaceWhatsApp(telefono, mensaje) {
  const t = String(telefono || '').replace(/\D/g, '');
  if (t.length !== 9) return null;
  return `https://wa.me/51${t}?text=${encodeURIComponent(mensaje)}`;
}

// ---- Alertas centralizadas ----
// Severidad: 1 = crítica, 2 = atención, 3 = oportunidad/seguimiento.
export function alertasCompletas({ aforoGim, porVencer = [], noShows = 0, ausentes = [], pases = [] }, hoy = new Date()) {
  const a = [];
  if (aforoGim && aforoGim.color === 'rojo') a.push({ id: 'aforo', sev: 1, grupo: 'aforo', icono: 'alerta', titulo: `Gimnasio lleno (${aforoGim.porcentaje} %)`, detalle: 'Avisa a quien llegue; la entrada no se bloquea.', accion: 'Ver Inicio', destino: 'inicio' });
  else if (aforoGim && aforoGim.color === 'amarillo') a.push({ id: 'aforo', sev: 2, grupo: 'aforo', icono: 'alerta', titulo: `Gimnasio llenándose (${aforoGim.porcentaje} %)`, detalle: 'Monitorea el aforo en Inicio.', accion: 'Ver Inicio', destino: 'inicio' });

  const vencidas = porVencer.filter((m) => diasParaVencer(m.fin, hoy) < 0);
  const proximas = porVencer.filter((m) => diasParaVencer(m.fin, hoy) >= 0);
  if (vencidas.length) a.push({ id: 'vencidas', sev: 1, grupo: 'membresias', icono: 'x', titulo: `${vencidas.length} membresía(s) vencida(s)`, detalle: `${vencidas.map((v) => v.nombre).slice(0, 3).join(', ')}: ofrece renovar en caja.`, accion: 'Renovaciones', destino: 'renovaciones' });
  if (proximas.length) a.push({ id: 'proximas', sev: 2, grupo: 'membresias', icono: 'agenda', titulo: `${proximas.length} membresía(s) por vencer`, detalle: 'Avisa al salir o por WhatsApp.', accion: 'Renovaciones', destino: 'renovaciones' });
  if (noShows > 0) a.push({ id: 'noshows', sev: 2, grupo: 'sauna', icono: 'reloj', titulo: `${noShows} cita(s) de sauna sin llegar`, detalle: 'Pagadas y sin check-in al terminar el turno.', accion: 'Ver Agenda', destino: 'agenda' });
  if (ausentes.length) a.push({ id: 'ausentes', sev: 3, grupo: 'membresias', icono: 'usuarios', titulo: `${ausentes.length} afiliado(s) ausente(s) (14+ días)`, detalle: 'Escríbeles para reactivarlos.', accion: 'Renovaciones', destino: 'renovaciones' });
  if (pases.length) a.push({ id: 'conversion', sev: 3, grupo: 'membresias', icono: 'check', titulo: `Oportunidad: ${pases[0].nombre} pagó ${pases[0].cuenta} pases`, detalle: 'Ofrécele un plan: le sale más barato.', accion: 'Ir a Pagos', destino: 'pagos', buscar: pases[0].nombre });
  return a.sort((x, y) => x.sev - y.sev);
}

// Clientes con 3 o más pases del día (oportunidad de venta de plan).
export function clientesConPases(pagos, clientes, minimo = 3) {
  const cuenta = {};
  pagos.filter((p) => p.concepto === 'pase_dia' && p.estado !== 'anulado').forEach((p) => { cuenta[p.id_cliente] = (cuenta[p.id_cliente] || 0) + 1; });
  return Object.keys(cuenta).filter((id) => cuenta[id] >= minimo).map((id) => {
    const c = clientes.find((x) => x.id_cliente === id);
    return { id_cliente: id, nombre: c ? c.nombre : 'Cliente', cuenta: cuenta[id] };
  });
}

// ---- Resumen del día ----
export function tasaNoShow(asistieron, noShows) {
  const total = asistieron + noShows;
  return total ? Math.round((noShows / total) * 1000) / 10 : 0;
}

// Entradas por hora (0-23) a partir de check-ins del día.
export function entradasPorHora(checkins) {
  const h = {};
  checkins.forEach((c) => { const k = new Date(c.entrada_en).getHours(); h[k] = (h[k] || 0) + 1; });
  return Object.keys(h).map((k) => ({ hora: Number(k), cuenta: h[k] })).sort((a, b) => a.hora - b.hora);
}

// Porcentaje de un monto sobre el total (0 si no hay total).
export const porcentaje = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : 0);