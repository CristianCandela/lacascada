// web/src/features/admin/logica.js
// Lógica pura de administración (sin React ni Supabase) para poder probarla con `npm test`.

/**
 * Días sin asistir desde la última visita; null si el cliente nunca asistió. Fechas ISO o 'YYYY-MM-DD'.
 */
export function diasSinAsistir(ultimaVisita, hoy = new Date()) {
  if (!ultimaVisita) return null;
  return Math.floor((hoy - new Date(ultimaVisita)) / 86400000);
}

/**
 * Determina si un cliente es candidato a reactivación.
 * Por defecto: inactivo si tiene 30 días o más sin registrar visita.
 */
export function esCandidatoReactivacion(ultimaVisita, diasUmbral = 30, hoy = new Date()) {
  const dias = diasSinAsistir(ultimaVisita, hoy);
  if (dias === null) return true; // Nunca asistió o sin registro
  return dias >= diasUmbral;
}

/**
 * Valida la creación o edición de un plan/membresía.
 */
export function validarPlan(plan) {
  const errores = [];

  if (!plan || typeof plan !== 'object') {
    return { esValido: false, errores: ['Datos del plan inválidos'] };
  }

  if (!plan.nombre || plan.nombre.trim().length < 3) {
    errores.push('El nombre del plan debe tener al menos 3 caracteres.');
  }

  const precio = Number(plan.precio);
  if (isNaN(precio) || precio <= 0) {
    errores.push('El precio debe ser un número mayor a 0.');
  }

  const duracion = Number(plan.duracion_dias);
  if (isNaN(duracion) || duracion <= 0) {
    errores.push('La duración en días debe ser mayor a 0.');
  }

  const tiposValidos = ['sauna', 'gimnasio', 'completo', 'paquete_sesiones'];
  if (!plan.tipo_servicio || !tiposValidos.includes(plan.tipo_servicio)) {
    errores.push('El tipo de servicio debe ser sauna, gimnasio, completo o paquete_sesiones.');
  }

  return {
    esValido: errores.length === 0,
    errores
  };
}

/**
 * Genera la plantilla de mensaje personalizado para reactivación por WhatsApp.
 */
export function generarMensajeReactivacion(cliente, promocion = '15% de descuento') {
  const nombre = cliente?.nombre ? cliente.nombre.split(' ')[0] : 'Estimado cliente';
  return `¡Hola ${nombre}! Te extrañamos en Sauna y Gimnasio La Cascada. Vuelve este mes y aprovecha un ${promocion} en tu renovación. ¿Te reservamos un turno para esta semana?`;
}

/**
 * Calcula métricas resumen para el panel de administración.
 */
export function calcularMetricasPanel(planes = [], personal = [], clientes = []) {
  const planesActivos = planes.filter(p => p.activo).length;
  const personalActivo = personal.filter(p => p.activo !== false).length;
  const clientesInactivos = clientes.filter(c => esCandidatoReactivacion(c.ultima_visita)).length;

  return {
    totalPlanes: planes.length,
    planesActivos,
    personalActivo,
    clientesInactivos
  };
}