// web/src/features/admin/mock.js

export const mock = {
  usuarios: {},
  iniciar(db) {
    // 1. Tabla de Planes y Membresías
    if (!db.planes_membresias) {
      db.planes_membresias = [
        {
          id: 'plan-1',
          nombre: 'Membresía Completa Mensual (Sauna + Gym)',
          tipo_servicio: 'completo',
          precio: 160.00,
          duracion_dias: 30,
          sesiones_totales: null,
          activo: true
        },
        {
          id: 'plan-2',
          nombre: 'Boletera 10 Sesiones Sauna',
          tipo_servicio: 'sauna',
          precio: 120.00,
          duracion_dias: 60,
          sesiones_totales: 10,
          activo: true
        },
        {
          id: 'plan-3',
          nombre: 'Pase Libre Gimnasio Mensual',
          tipo_servicio: 'gimnasio',
          precio: 90.00,
          duracion_dias: 30,
          sesiones_totales: null,
          activo: true
        }
      ];
    }

    // 2. Tabla de Campañas de Reactivación
    if (!db.campanas_reactivacion) {
      db.campanas_reactivacion = [];
    }

    // 3. Garantizar clientes de prueba con última visita para evaluar inactividad
    if (db.clientes && db.clientes.length > 0) {
      db.clientes[0].ultima_visita = '2026-09-10'; // Inactivo
      if (db.clientes[1]) db.clientes[1].ultima_visita = '2026-10-01'; // Inactivo
    }
  },
  rpc: {
    // Obtener catálogo de planes
    async admin_obtener_planes(args, ctx) {
      return { data: ctx.db.planes_membresias || [], error: null };
    },

    // Crear nuevo plan
    async admin_crear_plan(args, ctx) {
      const { plan } = args;
      const nuevo = {
        ...plan,
        id: `plan-${Date.now()}`,
        activo: true
      };
      ctx.db.planes_membresias.push(nuevo);
      return { data: nuevo, error: null };
    },

    // Cambiar estado activo/inactivo de un plan
    async admin_toggle_plan(args, ctx) {
      const { id } = args;
      ctx.db.planes_membresias = ctx.db.planes_membresias.map(p => 
        p.id === id ? { ...p, activo: !p.activo } : p
      );
      return { data: true, error: null };
    },

    // Listar personal
    async admin_listar_personal(args, ctx) {
      const personal = (ctx.db.usuarios || []).map(u => ({
        id: u.id,
        nombre: u.nombre || u.email,
        email: u.email,
        rol: u.rol,
        activo: true
      }));
      return { data: personal, error: null };
    },

    // Registrar campaña de reactivación enviada
    async admin_registrar_reactivacion(args, ctx) {
      const { cliente_id, mensaje } = args;
      const registro = {
        id: `rec-${Date.now()}`,
        cliente_id,
        mensaje_enviado: mensaje,
        estado_envio: 'enviado',
        enviado_en: new Date().toISOString()
      };
      ctx.db.campanas_reactivacion.push(registro);
      return { data: registro, error: null };
    }
  }
};