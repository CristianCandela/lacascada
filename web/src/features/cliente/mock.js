// Simulación del servidor para el rol cliente (solo `npm run dev:mock` y pruebas).
// Debe seguir `docs/CONTRATO_DATOS.md`.
import {
  ok,
  err,
  hoyLima,
  sumarDias,
  horaLima,
  CAPACIDAD,
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
    'cliente@demo.test': { id: 'u3', pass: 'demo123', perfil: { nombre: 'Cliente de prueba', rol: 'cliente' } },
    'dennis.cliente@demo.test': { id: 'u4', pass: 'demo123', perfil: { nombre: 'Dennis Mendoza', rol: 'cliente' } }
  },
  iniciar(db) {
    iniciarTablas(db);
    if (!db.planes) db.planes = [];
    if (!db.planes.some((p) => p.id_plan === 'p1')) {
      db.planes.push({
        id_plan: 'p1',
        nombre: 'Plan general',
        dias: 30,
        precio: 150,
        activo: true
      });
    }
    if (!db.planes.some((p) => p.id_plan === 'p2')) {
      db.planes.push({
        id_plan: 'p2',
        nombre: 'Plan bimestral',
        dias: 60,
        precio: 270,
        activo: true
      });
    }
    if (!db.clientes.some((c) => c.id_usuario === 'u3')) {
      db.clientes.push({
        id_cliente: 'kc1',
        nombre: 'Cliente de prueba',
        dni: '70000100',
        telefono: '900000100',
        fecha_nacimiento: '1998-05-14',
        foto_url: '',
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
    if (!db.clientes.some((c) => c.id_usuario === 'u4')) {
      db.clientes.push({
        id_cliente: 'kc2',
        nombre: 'Dennis Mendoza',
        dni: '70000104',
        telefono: '900000104',
        fecha_nacimiento: '2002-08-20',
        foto_url: '',
        estado: 'activo',
        id_usuario: 'u4',
        consentimiento: true,
        fecha_consentimiento: new Date().toISOString()
      });
    }
  },
  rpc: {
    registrar_cliente(a, ctx) {
      const { db } = ctx;
      const uid = (ctx.usuario() && ctx.usuario().id) || db.cuenta_nueva;
      if (!uid) return err('Acceso denegado: inicia sesión primero');
      if (db.perfiles.some((p) => p.id === uid)) return ok({ ok: false, motivo: 'Esta cuenta ya tiene un perfil.' });
      if (a.p_consentimiento !== true) {
        return ok({ ok: false, motivo: 'Debes aceptar el tratamiento de tus datos personales.' });
      }
      if (String(a.p_nombre || '').trim().length < 3) {
        return ok({ ok: false, motivo: 'Escribe tu nombre completo.' });
      }
      if (!/^[0-9]{8}$/.test(a.p_dni || '') || !/^[0-9]{9}$/.test(a.p_telefono || '')) {
        return ok({ ok: false, motivo: 'DNI (8 dígitos) o teléfono (9 dígitos) con formato inválido.' });
      }

      const fn = a.p_fecha_nacimiento !== undefined ? String(a.p_fecha_nacimiento || '').trim() : '';
      if (a.p_fecha_nacimiento !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fn)) {
          return ok({ ok: false, motivo: 'Ingresa tu fecha de nacimiento.' });
        }
        const anioNac = Number(fn.slice(0, 4));
        const anioActual = Number(hoyLima().slice(0, 4));
        if (anioNac > anioActual || anioActual - anioNac < 18) {
          return ok({ ok: false, motivo: 'Debes ser mayor de edad' });
        }
      }

      let cli = db.clientes.find((c) => c.dni === a.p_dni);
      if (cli) {
        if (cli.id_usuario) return ok({ ok: false, motivo: 'Ese DNI ya está registrado con otra cuenta.' });
        if (cli.telefono !== a.p_telefono) {
          return ok({ ok: false, motivo: 'Los datos no coinciden con un registro existente. Acude a recepción.' });
        }
        cli.id_usuario = uid;
        if (fn) cli.fecha_nacimiento = fn;
      } else {
        cli = {
          id_cliente: ctx.nuevoId('k'),
          nombre: a.p_nombre.trim(),
          dni: a.p_dni,
          telefono: a.p_telefono,
          fecha_nacimiento: fn,
          foto_url: '',
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
      const planObj = ctx.db.planes.find((p) => p.id_plan === ms[0].id_plan);
      return ok({
        vigente: membresiaVigente(ctx.db, cli.id_cliente) !== null,
        plan: planObj ? planObj.nombre : ms[0].id_plan,
        inicio: activas.length ? activas[0].inicio : ms[0].inicio,
        fin: ms[0].fin,
        dias_restantes: dias
      });
    },

    // Registra pago de membresía (Visa, Yape o Plin) solo si el cliente no tiene una membresía vigente (máximo 1 membresía).
    pagar_membresia(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return soloClientes();
      if (cli.estado !== 'activo') return ok({ ok: false, motivo: 'Tu cuenta no está activa.' });
      if (membresiaVigente(ctx.db, cli.id_cliente)) {
        return ok({ ok: false, motivo: 'Solo puedes tener 1 membresía vigente a la vez.' });
      }
      const plan = ctx.db.planes.find((p) => p.id_plan === a.p_id_plan && p.activo !== false);
      if (!plan) return ok({ ok: false, motivo: 'El plan seleccionado no está disponible.' });

      const medio = String(a.p_medio || 'visa').toLowerCase().trim();
      if (!['visa', 'yape', 'plin'].includes(medio)) {
        return ok({ ok: false, motivo: 'Selecciona una opción de pago válida (Visa, Yape o Plin).' });
      }

      const inicio = hoyLima();
      const fin = sumarDias(inicio, Number(plan.dias) - 1);
      const idMembresia = ctx.nuevoId('m');
      const idPago = ctx.nuevoId('pg');

      ctx.db.membresias.push({
        id_membresia: idMembresia,
        id_cliente: cli.id_cliente,
        id_plan: plan.id_plan,
        inicio,
        fin
      });
      ctx.db.pagos.push({
        id_pago: idPago,
        id_cliente: cli.id_cliente,
        id_plan: plan.id_plan,
        monto: plan.precio,
        medio,
        pagado_en: new Date().toISOString()
      });
      if (ctx.registrar) {
        ctx.registrar('membresias', 'pagar', idMembresia, cli.id_cliente, {
          id_plan: plan.id_plan,
          monto: plan.precio,
          medio
        });
      }
      return ok({ ok: true, id_membresia: idMembresia, plan: plan.nombre, medio, inicio, fin });
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
      const {
        nombre,
        dni,
        telefono,
        fecha_nacimiento = '',
        foto_url = '',
        estado,
        consentimiento,
        fecha_consentimiento
      } = cli;
      return ok({
        nombre,
        dni,
        telefono,
        fecha_nacimiento,
        foto_url,
        estado,
        consentimiento,
        fecha_consentimiento
      });
    },

    actualizar_mi_perfil(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return soloClientes();
      if (a.p_fecha_nacimiento !== undefined) {
        const fn = String(a.p_fecha_nacimiento || '').trim();
        if (fn) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(fn)) {
            return ok({ ok: false, motivo: 'Formato de fecha de nacimiento no válido.' });
          }
          const anioNac = Number(fn.slice(0, 4));
          const anioActual = Number(hoyLima().slice(0, 4));
          if (anioNac > anioActual || anioActual - anioNac < 18) {
            return ok({ ok: false, motivo: 'Debes ser mayor de edad' });
          }
        }
        cli.fecha_nacimiento = fn;
      }
      if (a.p_foto_url !== undefined) {
        cli.foto_url = String(a.p_foto_url || '');
      }
      if (ctx.registrar) {
        ctx.registrar('clientes', 'actualizar_perfil', cli.id_cliente, cli.id_cliente, {
          fecha_nacimiento: cli.fecha_nacimiento,
          tiene_foto: Boolean(cli.foto_url)
        });
      }
      return ok({
        ok: true,
        fecha_nacimiento: cli.fecha_nacimiento || '',
        foto_url: cli.foto_url || ''
      });
    },

    // pagar_reserva_sauna(p_id_cita, p_medio): el cliente paga su propia reserva (simulado, sin pasarela).
    pagar_reserva_sauna(a, ctx) {
      const cli = clienteActual(ctx);
      if (!cli) return soloClientes();
      const medio = String(a.p_medio || 'visa').toLowerCase().trim();
      if (!['visa', 'yape', 'plin'].includes(medio)) return err('Medio de pago no válido');
      const cita = ctx.db.citas.find((c) => c.id_cita === a.p_id_cita && c.id_cliente === cli.id_cliente && c.servicio === 'sauna');
      if (!cita) return err('La reserva no existe.');
      if (cita.estado_asistencia !== 'pendiente') return err('La reserva ya no está vigente.');
      if ((cita.estado_pago || 'pagada') === 'pagada') return err('Esta reserva ya está pagada.');
      const monto = cita.tarifa_aplicada || 15;
      const pago = { id_pago: ctx.nuevoId('pg'), id_cliente: cli.id_cliente, id_cita: cita.id_cita, monto, medio,
        concepto: 'sauna', estado: 'registrado', pagado_en: new Date().toISOString() };
      ctx.db.pagos.push(pago);
      cita.estado_pago = 'pagada'; cita.tarifa_aplicada = monto;
      if (ctx.registrar) ctx.registrar('pagos', 'pago', pago.id_pago, cli.id_cliente, { concepto: 'sauna', monto, medio, id_cita: cita.id_cita, origen: 'cliente_en_linea' });
      return ok({ ok: true, monto, medio, pagado_en: pago.pagado_en, operacion: `OP-${String(pago.id_pago).replace(/[^0-9a-z]/gi, '').slice(-8).toUpperCase().padStart(8, '0')}` });
    },

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
            estado_asistencia: c.estado_asistencia,
            estado_pago: c.estado_pago || 'pagada',
            tarifa_aplicada: c.tarifa_aplicada === undefined ? null : c.tarifa_aplicada
          }))
      );
    },

    // Reserva de sauna en franja de una hora (solo reserva por cupo y horario, sin exigir membresía de gimnasio).
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
        origen: 'cliente',
        estado_pago: 'pendiente',      // se cobra en recepción
        tarifa_aplicada: 15            // tarifa de afiliado (reservar exige membresía vigente)
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