// Lógica pura (sin React ni red): validaciones, porcentajes y CSV.
export const SERVICIOS = ['sauna', 'gimnasio'];
export const SEDES = ['Año Nuevo', 'Santa Rosa'];

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
export function aCSV(filas = []) {
  const cab = ['id_cita', 'id_cliente', 'servicio', 'sede', 'fecha_hora_cita',
    'fecha_hora_registro', 'estado_asistencia', 'no_show'];
  const out = [cab.join(',')];
  filas.forEach((f) => out.push([f.id_cita, f.id_cliente, f.servicio, f.sede, f.fecha_hora_cita,
    f.fecha_hora_registro, f.estado_asistencia, f.estado_asistencia === 'no_asistio' ? 1 : 0].join(',')));
  return out.join('\n');
}

export function hoyLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
