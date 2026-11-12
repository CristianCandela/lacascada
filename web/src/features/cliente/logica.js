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
export function validarDatosRegistro({ email, password, nombre, dni, telefono, consentimiento, codigoLocal }) {
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
  if (!codigoLocal || String(codigoLocal).trim().length !== 6) {
    return { valido: false, motivo: 'Código de local inválido (debe tener 6 dígitos)' };
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
 * Valida las reglas de negocio antes de agendar un turno de sauna (HU-C3)
 */
export function validarReservaSauna({ fechaHora, membresiaVigente }) {
  if (!membresiaVigente) {
    return { valido: false, motivo: 'Requiere membresía vigente' };
  }
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