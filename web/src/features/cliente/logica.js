// Lógica pura del rol cliente (sin React ni Supabase) para poder probarla con `npm test`.
// web/src/features/cliente/logica.js

/**
 * Traduce los estados de reserva de sauna a etiquetas legibles (HU-C4)
 */
export function etiquetaEstadoReserva(estado) {
  if (!estado) return 'Desconocido';
  const normalizado = estado.toLowerCase();
  if (normalizado === 'pendiente') return 'Pendiente';
  if (normalizado === 'cancelo' || normalizado === 'cancelada') return 'Cancelada';
  if (normalizado === 'asistio' || normalizado === 'completada') return 'Asistió';
  return 'Desconocido';
}

/**
 * Devuelve la clase CSS de color según el estado de la reserva o membresía (HU-C4 / HU-C5)
 */
export function claseBadgeEstado(estado) {
  if (!estado) return 'cli-badge-gris';
  const normalizado = String(estado).toLowerCase();
  if (normalizado === 'asistio' || normalizado === 'completada' || normalizado === 'confirmada' || normalizado === 'vigente' || normalizado === 'activa') {
    return 'cli-badge-verde';
  }
  if (normalizado === 'pendiente' || normalizado === 'reservada') {
    return 'cli-badge-amarillo';
  }
  if (normalizado === 'cancelo' || normalizado === 'cancelada' || normalizado === 'no_show' || normalizado === 'vencida') {
    return 'cli-badge-rojo';
  }
  return 'cli-badge-gris';
}

/**
 * Valida las credenciales de cuenta para el registro en Supabase Auth (HU-C1)
 */
export function validarCredencialesRegistro({ email, password }) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return { valido: false, motivo: 'Ingrese un correo electrónico válido' };
  }
  if (!password || String(password).length < 6) {
    return { valido: false, motivo: 'La contraseña debe tener al menos 6 caracteres' };
  }
  return { valido: true };
}

/**
 * Valida el formulario de autoregistro de cliente (HU-C1)
 */
export function validarDatosRegistro({ email, password, nombre, dni, telefono, consentimiento }) {
  if (email !== undefined || password !== undefined) {
    const cred = validarCredencialesRegistro({ email, password });
    if (!cred.valido) return cred;
  }
  if (!nombre || nombre.trim().length === 0) {
    return { valido: false, motivo: 'El nombre es obligatorio' };
  }
  if (!dni || !/^\d{8}$/.test(String(dni).trim())) {
    return { valido: false, motivo: 'El DNI debe tener 8 dígitos' };
  }
  if (!telefono || !/^\d{9}$/.test(String(telefono).trim())) {
    return { valido: false, motivo: 'El teléfono debe tener 9 dígitos' };
  }
  if (!consentimiento) {
    return { valido: false, motivo: 'Debe aceptar los términos y consentimiento' };
  }
  return { valido: true };
}

/**
 * Valida el formato del código de ingreso de 6 dígitos al gimnasio (HU-C2)
 */
export function validarCodigoCheckin(codigo) {
  if (!codigo) return false;
  return /^\d{6}$/.test(String(codigo).trim());
}

/**
 * Calcula los días restantes de la membresía activa (HU-C5)
 */
export function calcularDiasRestantes(fechaFinStr) {
  if (!fechaFinStr) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const partes = String(fechaFinStr).split('T')[0].split('-');
  if (partes.length !== 3) return 0;

  const fin = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  fin.setHours(0, 0, 0, 0);

  const diffTime = fin.getTime() - hoy.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Valida las reglas de negocio antes de agendar un turno de sauna (solo reservas, sin requerir membresía de gimnasio).
 */
export function validarReservaSauna({ fechaHora }) {
  if (!fechaHora) {
    return { valido: false, motivo: 'Debe seleccionar una fecha y hora' };
  }
  const fechaCita = new Date(fechaHora);
  const ahora = new Date();
  if (fechaCita < ahora) {
    return { valido: false, motivo: 'No puede reservar en una fecha u hora pasada' };
  }
  return { valido: true };
}

/**
 * Retorna el estado formateado de la membresía (HU-C5)
 */
export function etiquetaEstadoMembresia(vigente, diasRestantes) {
  if (!vigente || diasRestantes <= 0) return 'Vencida';
  if (diasRestantes <= 7) return `Por vencer (${diasRestantes} días)`;
  return 'Vigente';
}

/**
 * Formatea fechas ISO a formato legible es-PE (DD/MM/YYYY HH:mm)
 */
export function formatearFecha(fechaIso) {
  if (!fechaIso) return '—';
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) return fechaIso;
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formatea fechas (YYYY-MM-DD o ISO) al estándar peruano sin desfase horario
 */
export function formatearFechaPe(fechaIso) {
  if (!fechaIso) return '—';
  const texto = String(fechaIso);
  if (!texto.includes('T')) {
    const partes = texto.split('-');
    if (partes.length === 3) {
      const local = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
      if (!isNaN(local.getTime())) {
        return local.toLocaleDateString('es-PE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    }
  }
  return formatearFecha(fechaIso);
}
// ---------- Pago simulado de la reserva (Visa / Yape / Plin) ----------
// Nada de esto es una pasarela real: valida el formulario como lo haría una y deja que el servidor registre el pago.
export const METODOS_PAGO_RESERVA = [
  { id: 'visa', etiqueta: 'Visa' },
  { id: 'yape', etiqueta: 'Yape' },
  { id: 'plin', etiqueta: 'Plin' }
];
export const TARJETA_DE_PRUEBA = '4111 1111 1111 1111';
const TARJETA_RECHAZADA = '4000000000000002'; // simula «fondos insuficientes»
const CODIGO_YAPE_RECHAZADO = '000000';       // simula «código incorrecto o vencido»

export const soloDigitos = (s, max = 99) => String(s || '').replace(/\D/g, '').slice(0, max);

export function formatearTarjeta(valor) {
  return soloDigitos(valor, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatearVencimiento(valor) {
  const d = soloDigitos(valor, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

// Algoritmo de Luhn: el dígito de control que usan todas las tarjetas.
export function luhnValido(numero) {
  const d = soloDigitos(numero);
  if (d.length < 13) return false;
  let suma = 0;
  for (let i = 0; i < d.length; i += 1) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    suma += n;
  }
  return suma % 10 === 0;
}

export function vencimientoValido(mmaa, ahora = new Date()) {
  const m = /^(\d{2})\/(\d{2})$/.exec(mmaa || '');
  if (!m) return false;
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return false;
  return anio > ahora.getFullYear() || (anio === ahora.getFullYear() && mes >= ahora.getMonth() + 1);
}

// Devuelve { ok, errores: { campo: mensaje }, rechazo?: motivo }. «rechazo» simula la respuesta del banco.
export function evaluarPago(medio, datos = {}, ahora = new Date()) {
  const errores = {};
  if (medio === 'visa') {
    const num = soloDigitos(datos.numero);
    if (num.length !== 16 || !luhnValido(num)) errores.numero = 'Revisa el número de tu tarjeta.';
    else if (!num.startsWith('4')) errores.numero = 'Solo aceptamos tarjetas Visa.';
    if (String(datos.titular || '').trim().length < 3) errores.titular = 'Escribe el nombre como figura en la tarjeta.';
    if (!vencimientoValido(datos.vence, ahora)) errores.vence = 'Fecha de vencimiento no válida.';
    if (soloDigitos(datos.cvv).length !== 3) errores.cvv = 'El código de seguridad tiene 3 dígitos.';
    if (!Object.keys(errores).length && num === TARJETA_RECHAZADA) {
      return { ok: false, errores, rechazo: 'Tu banco rechazó el pago (fondos insuficientes). Prueba con otra tarjeta o con Yape/Plin.' };
    }
  } else if (medio === 'yape' || medio === 'plin') {
    const cel = soloDigitos(datos.celular);
    if (cel.length !== 9 || !cel.startsWith('9')) errores.celular = 'Ingresa un celular peruano de 9 dígitos (empieza con 9).';
    if (medio === 'yape') {
      if (soloDigitos(datos.codigo).length !== 6) errores.codigo = 'El código de aprobación tiene 6 dígitos.';
      else if (!Object.keys(errores).length && soloDigitos(datos.codigo) === CODIGO_YAPE_RECHAZADO) {
        return { ok: false, errores, rechazo: 'El código de aprobación es incorrecto o venció. Genera uno nuevo en tu app.' };
      }
    }
  } else {
    errores.medio = 'Elige un medio de pago.';
  }
  return { ok: Object.keys(errores).length === 0, errores };
}

export const etiquetaMedioPago = (id) => (METODOS_PAGO_RESERVA.find((m) => m.id === id) || {}).etiqueta || String(id || '').toUpperCase();

// ---------- Reembolso al cancelar una reserva pagada (política simulada) ----------
export const HORAS_REEMBOLSO = 2; // debe coincidir con el intervalo de cancelar_reserva en la base

// { pagada, reembolsa, monto }: si la reserva está pagada y todavía faltan HORAS_REEMBOLSO horas o más.
export function politicaReembolso(reserva, ahora = new Date()) {
  const pagada = Boolean(reserva) && reserva.estado_pago === 'pagada' && reserva.tarifa_aplicada != null;
  const faltan = new Date(reserva && (reserva.fecha_hora_cita || reserva.fecha_hora)).getTime() - ahora.getTime();
  return { pagada, reembolsa: pagada && faltan >= HORAS_REEMBOLSO * 3600000, monto: pagada ? Number(reserva.tarifa_aplicada) : 0 };
}
