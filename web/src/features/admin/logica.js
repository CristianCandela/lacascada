// Lógica pura de administración (sin React ni Supabase) para poder probarla con `npm test`.

export const MOTIVOS_VALIDOS = ['horario', 'costo', 'salud', 'viaje', 'otro'];

/**
 * Días sin asistir desde la última visita; null si el cliente nunca asistió. Fechas ISO o 'YYYY-MM-DD'.
 */
export function diasSinAsistir(ultimaVisita, hoy = new Date()) {
  if (!ultimaVisita) return null;
  return Math.floor((hoy - new Date(ultimaVisita)) / 86400000);
}

/**
 * Determina si un cliente es candidato a reactivación según los días de umbral (por defecto 14 según contrato).
 */
export function esCandidatoReactivacion(ultimaVisita, diasUmbral = 14, hoy = new Date()) {
  const dias = diasSinAsistir(ultimaVisita, hoy);
  if (dias === null) return true;
  return dias >= diasUmbral;
}

/**
 * Valida la creación o edición de un plan según la tabla `planes` del contrato (`nombre`, `dias`, `precio`).
 */
export function validarPlan(plan) {
  const errores = [];

  if (!plan || typeof plan !== 'object') {
    return { esValido: false, errores: ['Datos del plan inválidos.'] };
  }

  if (!plan.nombre || plan.nombre.trim().length < 3) {
    errores.push('El nombre del plan debe tener al menos 3 caracteres.');
  }

  const precio = Number(plan.precio);
  if (isNaN(precio) || precio <= 0) {
    errores.push('El precio debe ser un número mayor a 0.');
  }

  const dias = Number(plan.dias ?? plan.duracion_dias);
  if (isNaN(dias) || dias <= 0) {
    errores.push('La duración en días debe ser mayor a 0.');
  }

  return {
    esValido: errores.length === 0,
    errores
  };
}

/**
 * Valida que el motivo de ausencia esté dentro del contrato ('horario'|'costo'|'salud'|'viaje'|'otro').
 */
export function esMotivoValido(motivo) {
  return MOTIVOS_VALIDOS.includes(motivo);
}

/**
 * Genera el mensaje personalizado para reactivación por WhatsApp.
 */
export function generarMensajeReactivacion(cliente) {
  const nombre = cliente?.nombre ? cliente.nombre.split(' ')[0] : 'Estimado cliente';
  return `¡Hola ${nombre}! Te saludamos de Sauna y Gimnasio La Cascada. Vemos que tienes tu membresía vigente y te extrañamos entrenando. ¿Te ayudamos a coordinar tu próxima visita esta semana?`;
}