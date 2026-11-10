// Simulación del servidor para el rol cliente (solo `npm run dev:mock` y pruebas).
// web/src/features/cliente/mock.js
let estadoSimulado = {
  datos: {
    nombre: 'Cliente de prueba',
    dni: '70000100',
    telefono: '900000100',
    estado: 'activo',
    consentimiento: true,
    fecha_consentimiento: new Date().toISOString()
  },
  membresia: {
    vigente: true,
    plan: 'Plan general',
    inicio: '2026-11-01',
    fin: '2026-12-01',
    dias_restantes: 22
  },
  entradaActiva: null,
  visitas: [
    { entrada_en: '2026-11-08 08:30', salida_en: '2026-11-08 10:15', sede: 'Principal' },
    { entrada_en: '2026-11-06 17:00', salida_en: '2026-11-06 18:45', sede: 'Santa Rosa' }
  ],
  reservas: [
    { id_cita: 'c1', servicio: 'Sauna', sede: 'Principal', fecha_hora: '2026-11-12 10:00', estado: 'pendiente', fecha_hora_cita: '2026-11-12 10:00', estado_asistencia: 'pendiente' }
  ]
};

export const mock = {
  usuarios: {
    'cliente@demo.test': {
      id: 'u3',
      pass: 'demo123',
      perfil: { nombre: 'Cliente de prueba', rol: 'cliente' }
    }
  },
  iniciar(db) {
    if (db && db.clientes && !db.clientes.some(c => c.id_usuario === 'u3')) {
      db.clientes.push({
        id_cliente: 'kc1',
        nombre: 'Cliente de prueba',
        dni: '70000100',
        telefono: '900000100',
        estado: 'activo',
        id_usuario: 'u3',
        consentimiento: true,
        fecha_consentimiento: new Date().toISOString()
      });
    }
  },
  rpc: {
    // HU-C1: Autoregistro de cliente
    registrar_cliente: async (params) => {
      const { p_codigo_local, p_nombre, p_dni, p_telefono, p_consentimiento } = params || {};
      if (String(p_codigo_local || '').trim() !== '123456') {
        return { data: { ok: false, motivo: 'Código del local incorrecto o vencido.' }, error: null };
      }
      if (!p_consentimiento) {
        return { data: { ok: false, motivo: 'Debes aceptar el tratamiento de tus datos personales.' }, error: null };
      }
      if (!/^[0-9]{8}$/.test(p_dni || '') || !/^[0-9]{9}$/.test(p_telefono || '')) {
        return { data: { ok: false, motivo: 'DNI (8 dígitos) o teléfono (9 dígitos) no válido.' }, error: null };
      }
      estadoSimulado.datos = {
        nombre: p_nombre,
        dni: p_dni,
        telefono: p_telefono,
        estado: 'activo',
        consentimiento: true,
        fecha_consentimiento: new Date().toISOString()
      };
      return { data: { ok: true, id_cliente: 'cli_new_' + Date.now() }, error: null };
    },

    // HU-C2: Check-in con código del local (123456)
    checkin: async (params) => {
      const cod = String(params?.p_codigo || '').trim();
      if (cod !== '123456' && cod !== '123987') {
        return { data: { ok: false, motivo: 'Código del local incorrecto o vencido' }, error: null };
      }
      if (!estadoSimulado.membresia.vigente) {
        return { data: { ok: false, motivo: 'No cuentas con una membresía vigente' }, error: null };
      }
      if (estadoSimulado.entradaActiva) {
        return { data: { ok: false, motivo: 'Ya tienes una entrada abierta sin marcar salida' }, error: null };
      }
      const ahora = new Date().toISOString().replace('T', ' ').substring(0, 16);
      estadoSimulado.entradaActiva = { entrada_en: ahora, sede: 'Principal' };
      return { data: { ok: true, sede: 'Principal', membresia_fin: estadoSimulado.membresia.fin }, error: null };
    },

    // HU-C2: Checkout de ingreso
    checkout: async () => {
      if (!estadoSimulado.entradaActiva) {
        return { data: { ok: false, motivo: 'No tienes una entrada abierta.' }, error: null };
      }
      const ahora = new Date().toISOString().replace('T', ' ').substring(0, 16);
      estadoSimulado.visitas.unshift({
        entrada_en: estadoSimulado.entradaActiva.entrada_en,
        salida_en: ahora,
        sede: estadoSimulado.entradaActiva.sede
      });
      estadoSimulado.entradaActiva = null;
      return { data: { ok: true }, error: null };
    },

    // HU-C5: Mi Membresía
    mi_membresia: async () => ({ data: estadoSimulado.membresia, error: null }),

    // HU-C5: Mis Visitas
    mis_visitas: async (params) => {
      const limite = params?.p_limite || 20;
      return { data: estadoSimulado.visitas.slice(0, limite), error: null };
    },

    // HU-C7: Mis Datos
    mis_datos: async () => ({ data: estadoSimulado.datos, error: null }),

    // Listar reservas activas
    mis_reservas: async () => ({ data: estadoSimulado.reservas, error: null }),

    // HU-C3: Reservar turno de sauna
    reservar_sauna: async (params) => {
      const { p_sede, p_fecha_hora } = params || {};
      if (!estadoSimulado.membresia.vigente) {
        return { data: null, error: { message: 'Tu membresía no cubre esta fecha.' } };
      }
      const idCita = 'c_' + Date.now();
      const nuevaReserva = {
        id_cita: idCita,
        servicio: 'Sauna',
        sede: p_sede || 'Principal',
        fecha_hora: p_fecha_hora,
        fecha_hora_cita: p_fecha_hora,
        estado: 'pendiente',
        estado_asistencia: 'pendiente'
      };
      estadoSimulado.reservas.unshift(nuevaReserva);
      return { data: idCita, error: null };
    },

    // HU-C4: Cancelar reserva de sauna
    cancelar_reserva: async (params) => {
      const idCita = params?.p_id_cita;
      estadoSimulado.reservas = estadoSimulado.reservas.map(r =>
        r.id_cita === idCita ? { ...r, estado: 'cancelo', estado_asistencia: 'cancelo' } : r
      );
      return { data: { ok: true }, error: null };
    },

    // HU-C6: Disponibilidad de aforo
    disponibilidad: async () => ({
      data: { capacidad: 10, ocupados: 3, libres: 7 },
      error: null
    })
  }
};