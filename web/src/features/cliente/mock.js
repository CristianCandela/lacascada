// Simulación del servidor para el rol cliente (solo `npm run dev:mock` y pruebas).
// Debe seguir `docs/CONTRATO_DATOS.md`. El código del local en el mock es 123456.
import {
  ok,
  err,
  hoyLima,
  sumarDias,
  horaLima,
  CAPACIDAD,
  CODIGO_DEMO,
  iniciarTablas,
  membresiaVigente,
  cerrarVisitasVencidas,
  entrarGimnasio,
  intentosExcedidos,
  anotarIntento,
  MSG_BLOQUEO
} from '../../mock/comunes.js';

const clienteActual = (ctx) => {
  const u = ctx.usuario();
  return u && u.rol === 'cliente' ? ctx.db.clientes.find((c) => c.id_usuario === u.id) : null;
};
const soloClientes = () => err('Acceso denegado: solo los clientes');

export const mock = {
  usuarios: {
    'cliente@demo.test': { id: 'u3', pass: 'demo123', perfil: { nombre: 'Cliente de prueba', rol: 'cliente' } }
  },
  iniciar(db) {
    iniciarTablas(db);
    if (!db.clientes.some((c) => c.id_usuario === 'u3')) {
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
      db.membresias.push({
        id_membresia: 'm1',
        id_cliente: 'kc1',
        id_plan: 'p1',
        inicio: sumarDias(hoyLima(), -10),
        fin: sumarDias(hoyLima(), 19)
      });
    }
  },
  rpc: {
    // La cuenta ya existe en Auth (supabase.auth.signUp); aquí se crea o vincula el cliente.
    registrar_cliente(a, ctx) {
      const { db } = ctx;
      const uid = (ctx.usuario() && ctx.usuario().id) || db.cuenta_nueva;
      if (!uid) return err('Acceso denegado: inicia sesión primero');
      if (db.perfiles.some((p) => p.id === uid)) return ok({ ok: false, motivo: 'Esta cuenta ya tiene un perfil.' });
      if (intentosExcedidos(db, uid)) return ok({ ok: false, motivo: MSG_BLOQUEO });
      if (String(a.p_codigo_local).trim() !== CODIGO_DEMO) {
        anotarIntento(db, uid, false);
        return ok({ ok: false, motivo: 'Código del local incorrecto o vencido.' });
      }
      if (a.p_consentimiento !== true) {
        return ok({ ok: false, motivo: 'Debes aceptar el tratamiento de tus datos personales.' });
      }
      if (String(a.p_nombre || '').trim().length < 3) {
        return ok({ ok: false, motivo: 'Escribe tu nombre completo.' });
      }
      if (!/^[0-9]{8}$/.test(a.p_dni || '') || !/^[0-9]{9}$/.test(a.p_telefono || '')) {
        return ok({ ok: false, motivo: 'DNI (8 dígitos) o teléfono (9 dígitos) con formato inválido.' });
      }
      let cli = db.clientes.find((c) => c.dni === a.p_dni);
      if (cli) {
        if (cli.id_usuario) return ok({ ok: false, motivo: 'Ese DNI ya está registrado con otra cuenta.' });
        if (cli.telefono !== a.p_telefono) {
          return ok({ ok: false, motivo: 'Los datos no coinciden con un registro existente. Acude a recepción.' });
        }
        cli.id_usuario = uid;
      } else {
        cli = {
          id_cliente: ctx.nuevoId('k'),
          nombre: a.p_nombre.trim(),
          dni: a.p_dni,
          telefono: a.p_telefono,
          estado: 'activo',
          id_usuario: uid,
          consentimiento: true,
          fecha_consentimiento: new Date().toISOString()
        };
        db.clientes.push(cli);
      }
      db.perfiles.push({ id: uid, nombre: cli.nombre, rol: 'cliente' });
      anotarIntento(db, uid, true);
      if (ctx.registrar) ctx.registrar('clientes', 'autoregistro', cli.id_cliente, cli.id_cliente, {});
      return ok({ ok: true, id_cliente: cli.id_cliente });
    },

    checkin(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return err('Acceso denegado: solo los clientes registran su entrada con código');
      const uid = ctx.usuario().id;
      if (intentosExcedidos(ctx.db, uid)) return ok({ ok: false, motivo: MSG_BLOQUEO });
      const cod = ctx.db.codigos_local.find(
        (c) => c.codigo === String(a.p_codigo).trim() && new Date(c.vigente_hasta) > new Date()
      );
      if (!cod) {
        anotarIntento(ctx.db, uid, false);
        return ok({ ok: false, motivo: 'Código incorrecto o vencido.' });
      }
      anotarIntento(ctx.db, uid, true);
      return entrarGimnasio(ctx, cli, cod.sede, 'codigo');
    },

    checkout(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return soloClientes();
      const c = ctx.db.checkins.find((x) => x.id_cliente === cli.id_cliente && !x.salida_en);
      if (!c) return ok({ ok: false, motivo: 'No tienes una entrada abierta.' });
      c.salida_en = new Date().toISOString();
      if (ctx.registrar) ctx.registrar('checkins', 'checkout', c.id_checkin, cli.id_cliente, {});
      return ok({ ok: true });
    },

    mi_membresia(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return soloClientes();
      const ms = ctx.db.membresias
        .filter((m) => m.id_cliente === cli.id_cliente)
        .sort((x, y) => (x.fin < y.fin ? 1 : -1));
      if (!ms.length) return ok({ vigente: false, plan: null, inicio: null, fin: null, dias_restantes: 0 });
      const hoy = hoyLima();
      const activas = ms.filter((m) => m.fin >= hoy).sort((x, y) => (x.inicio < y.inicio ? -1 : 1));
      const dias = Math.max(Math.round((new Date(`${ms[0].fin}T00:00:00Z`) - new Date(`${hoy}T00:00:00Z`)) / 86400000), 0);
      return ok({
        vigente: membresiaVigente(ctx.db, cli.id_cliente) !== null,
        plan: ctx.db.planes.find((p) => p.id_plan === ms[0].id_plan).nombre,
        inicio: activas.length ? activas[0].inicio : ms[0].inicio,
        fin: ms[0].fin,
        dias_restantes: dias
      });
    },

    mis_visitas(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return soloClientes();
      cerrarVisitasVencidas(ctx.db);
      const n = Math.min(Math.max(a.p_limite || 20, 1), 100);
      return ok(
        ctx.db.checkins
          .filter((c) => c.id_cliente === cli.id_cliente)
          .sort((x, y) => (x.entrada_en < y.entrada_en ? 1 : -1))
          .slice(0, n)
          .map((c) => ({ entrada_en: c.entrada_en, salida_en: c.salida_en, sede: c.sede }))
      );
    },

    mis_datos(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return soloClientes();
      const { nombre, dni, telefono, estado, consentimiento, fecha_consentimiento } = cli;
      return ok({ nombre, dni, telefono, estado, consentimiento, fecha_consentimiento });
    },

    // Lista las reservas de sauna del cliente autenticado (HU-C4)
    mis_reservas(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return soloClientes();
      return ok(
        ctx.db.citas
          .filter((c) => c.id_cliente === cli.id_cliente)
          .sort((x, y) => (x.fecha_hora_cita < y.fecha_hora_cita ? 1 : -1))
          .map((c) => ({
            id_cita: c.id_cita,
            servicio: c.servicio,
            sede: c.sede,
            fecha_hora_cita: c.fecha_hora_cita,
            estado_asistencia: c.estado_asistencia
          }))
      );
    },

    // Reserva de sauna en franja de una hora. Devuelve id_cita o un error legible.
    reservar_sauna(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return err('Acceso denegado: solo los clientes reservan por esta vía');
      const { db } = ctx;
      if (cli.estado !== 'activo') return err('Tu cuenta no está activa. Acude a recepción.');
      const slot = new Date(a.p_fecha_hora);
      slot.setMinutes(0, 0, 0);
      if (slot <= new Date()) return err('Elige un horario futuro.');
      if (slot > new Date(Date.now() + 30 * 24 * 3600 * 1000)) {
        return err('Solo se puede reservar con hasta 30 días de anticipación.');
      }
      const s = db.sedes.find((x) => x.sede === a.p_sede);
      if (!s) return err('Sede no válida.');
      const hl = horaLima(slot);
      if (hl < s.abre || hl >= s.cierra) return err('Ese horario está fuera del horario de atención.');
      const dia = new Date(slot.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
      if (!membresiaVigente(db, cli.id_cliente, dia)) return err('Tu membresía no cubre esa fecha.');
      const iso = slot.toISOString();
      const misma = (c) =>
        c.servicio === 'sauna' && c.fecha_hora_cita.slice(0, 13) === iso.slice(0, 13) && c.estado_asistencia !== 'cancelo';
      if (db.citas.some((c) => misma(c) && c.id_cliente === cli.id_cliente && c.sede === a.p_sede)) {
        return err('duplicate key value violates unique constraint "citas_sin_duplicado"');
      }
      if (db.citas.filter((c) => misma(c) && c.sede === a.p_sede).length >= CAPACIDAD.sauna[a.p_sede]) {
        return err('Aforo máximo completado para esta franja horaria');
      }
      const cita = {
        id_cita: ctx.nuevoId('c'),
        id_cliente: cli.id_cliente,
        servicio: 'sauna',
        sede: a.p_sede,
        fecha_hora_cita: iso,
        fecha_hora_registro: new Date().toISOString(),
        estado_asistencia: 'pendiente',
        origen: 'cliente'
      };
      db.citas.push(cita);
      if (ctx.registrar) {
        ctx.registrar('citas', 'crear', cita.id_cita, cli.id_cliente, {
          servicio: 'sauna',
          sede: a.p_sede,
          fecha_hora_cita: iso,
          estado: 'pendiente'
        });
      }
      return ok(cita.id_cita);
    },

    cancelar_reserva(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return soloClientes();
      const c = ctx.db.citas.find((x) => x.id_cita === a.p_id_cita && x.id_cliente === cli.id_cliente);
      if (!c) return ok({ ok: false, motivo: 'La reserva no existe.' });
      if (c.estado_asistencia !== 'pendiente' || new Date(c.fecha_hora_cita) <= new Date()) {
        return ok({ ok: false, motivo: 'Solo se pueden cancelar reservas pendientes y futuras.' });
      }
      c.estado_asistencia = 'cancelo';
      if (ctx.registrar) {
        ctx.registrar('citas', 'marcar', c.id_cita, cli.id_cliente, { antes: 'pendiente', despues: 'cancelo' });
      }
      return ok({ ok: true });
    }
  }
};