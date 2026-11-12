// Simulación del servidor para páginas públicas (solo `npm run dev:mock` y pruebas). Debe seguir `docs/CONTRATO_DATOS.md`.
import { ok, CAPACIDAD, iniciarTablas, cerrarVisitasVencidas } from '../../mock/comunes.js';

export const mock = {
  usuarios: {},
  iniciar(db) { iniciarTablas(db); },
  rpc: {
    // Solo totales (sin datos personales). Gimnasio: personas dentro; sauna: reservas de la hora actual.
    aforo_actual(a, ctx) {
      const { db } = ctx; cerrarVisitasVencidas(db);
      const sedes = a.p_sede ? [a.p_sede] : ['Santa Rosa', 'Túpac Amaru'];
      const ahora = new Date().toISOString().slice(0, 13);
      const filas = [];
      sedes.forEach((sede) => ['gimnasio', 'sauna'].forEach((servicio) => filas.push({
        sede, servicio, capacidad: CAPACIDAD[servicio][sede],
        ocupados: servicio === 'gimnasio'
          ? db.checkins.filter((c) => c.sede === sede && !c.salida_en).length
          : db.citas.filter((c) => c.servicio === 'sauna' && c.sede === sede && c.fecha_hora_cita.slice(0, 13) === ahora && c.estado_asistencia !== 'cancelo').length
      })));
      return ok(filas);
    }
  }
};
