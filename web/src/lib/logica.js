// Lógica pura (sin React ni red): validaciones, porcentajes y CSV.
export const SERVICIOS = ['sauna', 'gimnasio'];
export const SEDES = ['Túpac Amaru', 'Santa Rosa'];

export function validarReserva(d, ahora = new Date()) {
  const e = {};
  const nombre = String(d.nombre || '').trim();
  const dni = String(d.dni || '').trim();
  const tel = String(d.telefono || '').trim();

  if (nombre.length < 3) e.nombre = 'Ingresa el nombre completo (mínimo 3 letras).';
  else if (/[0-9]/.test(nombre)) e.nombre = 'El nombre no puede contener números.';

  if (!/^[0-9]{8}$/.test(dni)) e.dni = 'El DNI debe tener exactamente 8 dígitos.';
  if (!/^[0-9]{9}$/.test(tel)) e.telefono = 'El teléfono debe tener exactamente 9 dígitos.';

  if (!SERVICIOS.includes(d.servicio)) e.servicio = 'Elige un servicio.';
  if (!SEDES.includes(d.sede)) e.sede = 'Elige una sede.';

  if (!d.fecha_hora) {
    e.fecha_hora = 'Elige la fecha y la hora de la cita.';
  } else {
    const f = new Date(d.fecha_hora);
    if (Number.isNaN(f.getTime())) e.fecha_hora = 'La fecha u hora no es válida.';
    else if (f.getTime() <= ahora.getTime())
      e.fecha_hora = 'La fecha y hora deben ser posteriores al momento actual.';
  }

  if (d.consentimiento !== true)
    e.consentimiento = 'Debes marcar el consentimiento de tratamiento de datos (Ley 29733).';

  return { ok: Object.keys(e).length === 0, errores: e };
}

const redondear = (n) => Math.round(n * 10) / 10;

export function calcularPorcentajes(r = {}) {
  const asistio = Number(r.asistio) || 0;
  const noAsistio = Number(r.no_asistio) || 0;
  const vencidas = Number(r.citas_vencidas) || 0;
  const conRegistro = Number(r.vencidas_con_registro) || 0;
  const registradas = asistio + noAsistio;
  return {
    registradas,
    pct_no_show: registradas ? redondear((noAsistio / registradas) * 100) : 0,
    pct_asistencia: registradas ? redondear((asistio / registradas) * 100) : 0,
    pct_registro: vencidas ? redondear((conRegistro / vencidas) * 100) : 0
  };
}

export function pctNoShow(x) {
  const tot = (x.asistio || 0) + (x.no_asistio || 0);
  return tot ? redondear((x.no_asistio / tot) * 100) : 0;
}

// CSV sin datos personales (contrato de datos para APF3).
// no_show = 1 si «no asistió», 0 en otro caso. Las citas «canceló» o «pendiente» no son
// observaciones válidas para el modelo: se filtran al entrenar (estado_asistencia in asistio/no_asistio).
export function aCSV(filas = []) {
  const cab = ['id_cita', 'id_cliente', 'servicio', 'sede', 'fecha_hora_cita',
    'fecha_hora_registro', 'recordatorio_enviado_en', 'confirmada_en', 'estado_asistencia', 'segundos_registro', 'no_show'];
  const out = [cab.join(',')];
  filas.forEach((f) => out.push([f.id_cita, f.id_cliente, f.servicio, f.sede, f.fecha_hora_cita,
    f.fecha_hora_registro, f.recordatorio_enviado_en || '', f.confirmada_en || '',
    f.estado_asistencia, f.segundos_registro ?? '', f.estado_asistencia === 'no_asistio' ? 1 : 0].join(',')));
  return out.join('\n');
}

// Mensaje de recordatorio para WhatsApp (sin API: enlace "click to chat" de wa.me).
export function mensajeRecordatorio(cita) {
  const f = new Date(cita.fecha_hora_cita);
  const fecha = f.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const hora = f.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const nombre = (cita.clientes && cita.clientes.nombre) || '';
  return `Hola ${nombre}, te recordamos tu cita de ${cita.servicio} en La Cascada (sede ${cita.sede}) ` +
    `el ${fecha} a las ${hora}. Responde SÍ para confirmar o avísanos si no podrás asistir.`;
}

// Teléfono peruano de 9 dígitos -> enlace wa.me con código de país 51.
export function urlWhatsApp(telefono, texto) {
  const tel = String(telefono || '').replace(/\D/g, '');
  if (!/^[0-9]{9}$/.test(tel)) return null;
  return `https://wa.me/51${tel}?text=${encodeURIComponent(texto)}`;
}

export function hoyLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- Riesgo heurístico (misma regla que la función SQL riesgo_clientes) ----------
export const UMBRAL_RIESGO = 30;   // % de inasistencia en los últimos 30 días
export const MIN_CITAS_RIESGO = 2; // citas con estado final necesarias para evaluar

export function esAltoRiesgo({ total = 0, no_asistio = 0 } = {}) {
  return total >= MIN_CITAS_RIESGO && (no_asistio / total) * 100 >= UMBRAL_RIESGO;
}

// ---------- Cola de recordatorios (protocolo «2 horas antes») ----------
export const VENTANA_RECORDATORIO_MIN = 120;

// Minutos que faltan para la cita si recepción debe recordarla; null si no corresponde.
// Corresponde: cita pendiente, aún sin recordatorio ni confirmación, que empieza en 120 min o menos.
export function minutosParaRecordar(cita, ahora = new Date()) {
  if (!cita || cita.estado_asistencia !== 'pendiente') return null;
  if (cita.recordatorio_enviado_en || cita.confirmada_en) return null;
  const falta = Math.round((new Date(cita.fecha_hora_cita) - ahora) / 60000);
  return falta > 0 && falta <= VENTANA_RECORDATORIO_MIN ? falta : null;
}

export function textoFalta(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// ---------- Aforo ----------
export function hayCupo(d) {
  return Boolean(d) && Number(d.libres) > 0;
}

export function textoCupos(d) {
  if (!d || !Number(d.capacidad)) return '';
  return `Cupos libres en esa franja: ${d.libres} de ${d.capacidad}`;
}

// ---------- Métricas del dashboard ----------
// Reducción relativa de no-shows entre citas sin recordatorio y con recordatorio.
export function reduccionRecordatorio(r = {}) {
  const tasa = (no, tot) => (tot > 0 ? (no / tot) * 100 : null);
  const con = tasa(r.con_no, r.con_total);
  const sin = tasa(r.sin_no, r.sin_total);
  const reduccion = con !== null && sin !== null && sin > 0 ? redondear(((sin - con) / sin) * 100) : null;
  return {
    tasa_con: con === null ? null : redondear(con),
    tasa_sin: sin === null ? null : redondear(sin),
    reduccion
  };
}

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Franjas para el mapa de calor (hora de Lima). Devuelve una matriz 7 x franjas con % de no-show.
export const FRANJAS = [
  { id: 'manana', texto: 'Mañana (6–12)', desde: 6, hasta: 12 },
  { id: 'tarde', texto: 'Tarde (12–18)', desde: 12, hasta: 18 },
  { id: 'noche', texto: 'Noche (18–23)', desde: 18, hasta: 23 }
];

export function matrizCalor(filas = []) {
  const m = DIAS_SEMANA.map(() => FRANJAS.map(() => ({ asistio: 0, no_asistio: 0 })));
  filas.forEach((f) => {
    const i = Number(f.dow) - 1;
    const j = FRANJAS.findIndex((x) => f.hora >= x.desde && f.hora < x.hasta);
    if (i < 0 || i > 6 || j < 0) return;
    m[i][j].asistio += Number(f.asistio) || 0;
    m[i][j].no_asistio += Number(f.no_asistio) || 0;
  });
  return m.map((fila) => fila.map((c) => {
    const tot = c.asistio + c.no_asistio;
    return { ...c, total: tot, pct: tot ? redondear((c.no_asistio / tot) * 100) : null };
  }));
}

// Completa los últimos n días (aunque no haya citas) para que el gráfico no tenga huecos.
export function serieDiaria(filas = [], n = 14, hoy = new Date()) {
  const mapa = {};
  filas.forEach((f) => { mapa[String(f.dia).slice(0, 10)] = f; });
  const p = (x) => String(x).padStart(2, '0');
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - k);
    const clave = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const f = mapa[clave] || {};
    out.push({ dia: clave, etiqueta: `${d.getDate()}/${d.getMonth() + 1}`,
      asistio: Number(f.asistio) || 0, no_asistio: Number(f.no_asistio) || 0, cancelo: Number(f.cancelo) || 0 });
  }
  return out;
}

// ---------- Trazabilidad (bitácora) ----------
export const ACCIONES_BITACORA = {
  crear: 'Creó cita',
  marcar: 'Marcó asistencia',
  reabrir: 'Corrigió a pendiente',
  recordar: 'Envió recordatorio',
  confirmar: 'Registró confirmación',
  editar: 'Editó cita',
  eliminar: 'Eliminó cita',
  solicitar: 'Envió solicitud',
  aprobar: 'Aprobó solicitud',
  rechazar: 'Rechazó solicitud',
  autoregistro: 'Se registró (cliente)',
  checkin: 'Registró entrada',
  checkout: 'Registró salida',
  pago: 'Registró pago',
  motivo_ausencia: 'Anotó motivo de ausencia'
};

const NOMBRES_ESTADO = { pendiente: 'Pendiente', asistio: 'Asistió', no_asistio: 'No asistió', cancelo: 'Canceló' };
const NOMBRES_SERVICIO = { sauna: 'Sauna', gimnasio: 'Gimnasio' };

export function textoAccionBitacora(accion) {
  return ACCIONES_BITACORA[accion] || accion;
}

function cuando(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

// Texto corto y sin datos personales para la columna «Detalle».
export function detalleBitacora(ev = {}) {
  const d = ev.detalle || {};
  switch (ev.accion) {
    case 'marcar':
    case 'reabrir':
      return `${NOMBRES_ESTADO[d.antes] || d.antes} → ${NOMBRES_ESTADO[d.despues] || d.despues}`;
    case 'recordar':
      return 'Recordatorio por WhatsApp';
    case 'confirmar':
      return 'El cliente confirmó su asistencia';
    case 'crear':
    case 'eliminar':
      return [NOMBRES_SERVICIO[d.servicio] || d.servicio, d.sede, cuando(d.fecha_hora_cita)].filter(Boolean).join(' · ');
    case 'solicitar':
    case 'aprobar':
    case 'rechazar':
      return [NOMBRES_SERVICIO[d.servicio] || d.servicio, d.sede, cuando(d.fecha_hora_preferida)].filter(Boolean).join(' · ');
    case 'autoregistro':
      return d.vinculado ? 'Vinculó su cuenta a un cliente existente' : 'Creó su cuenta de cliente';
    case 'checkin':
      return `${d.sede || ''} · ${d.metodo === 'manual' ? 'manual (recepción)' : 'con código'}`;
    case 'checkout':
      return d.metodo === 'manual' ? 'Salida manual (recepción)' : 'Salida registrada';
    case 'pago':
      return `${d.plan || 'Plan'} · S/ ${d.monto} · ${d.medio}`;
    case 'motivo_ausencia':
      return `Motivo: ${d.motivo}`;
    case 'editar':
      return 'Cambió servicio, sede u hora';
    default:
      return '';
  }
}