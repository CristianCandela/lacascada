// Simulación del servidor para recepción (solo `npm run dev:mock` y pruebas). Debe seguir `docs/CONTRATO_DATOS.md`.
import { ok, err, hoyLima, sumarDias, CODIGO_DEMO, iniciarTablas, entrarGimnasio } from '../../mock/comunes.js';

const esPersonal = (ctx) => { const u = ctx.usuario(); return !!u && ['recepcionista', 'administrador'].includes(u.rol); };
const denegado = () => err('Acceso denegado: solo el personal');

export const mock = {
  usuarios: {},
  iniciar(db) { iniciarTablas(db); },
  rpc: {
    codigo_local_actual(a, ctx) {
      if (!esPersonal(ctx)) return denegado();
      const c = ctx.db.codigos_local.find((x) => x.sede === a.p_sede && new Date(x.vigente_hasta) > new Date());
      if (!c) return err('Sede no válida.');
      return ok({ codigo: c.codigo || CODIGO_DEMO, sede: c.sede, vigente_hasta: c.vigente_hasta });
    },

    // Si la membresía sigue vigente, la nueva empieza al día siguiente de su fin.
    registrar_pago(a, ctx) {
      if (!esPersonal(ctx)) return denegado();
      const { db } = ctx;
      const plan = db.planes.find((p) => p.id_plan === a.p_id_plan && p.activo);
      if (!plan) return err('El plan no existe o no está activo.');
      const cli = db.clientes.find((c) => c.id_cliente === a.p_id_cliente);
      if (!cli) return err('El cliente no existe.');
      const medio = a.p_medio || 'efectivo';
      if (!['efectivo', 'yape', 'plin'].includes(medio)) return err('Medio de pago no válido.');
      const monto = a.p_monto == null ? plan.precio : a.p_monto;
      if (!(monto > 0)) return err('El monto debe ser mayor que cero.');
      const fines = db.membresias.filter((m) => m.id_cliente === cli.id_cliente).map((m) => m.fin).sort();
      const ultimo = fines.length ? fines[fines.length - 1] : null;
      const hoy = hoyLima();
      const inicio = ultimo && ultimo >= hoy ? sumarDias(ultimo, 1) : hoy;
      const m = { id_membresia: ctx.nuevoId('m'), id_cliente: cli.id_cliente, id_plan: plan.id_plan, inicio, fin: sumarDias(inicio, plan.dias - 1) };
      db.membresias.push(m);
      db.pagos.push({ id_pago: ctx.nuevoId('pg'), id_membresia: m.id_membresia, monto, medio, pagado_en: new Date().toISOString() });
      if (ctx.registrar) ctx.registrar('membresias', 'pago', m.id_membresia, cli.id_cliente, { plan: plan.nombre, monto, medio });
      return ok(m.id_membresia);
    },

    // Vencen en p_dias días o vencieron en los últimos 30 sin renovar.
    membresias_por_vencer(a, ctx) {
      if (!esPersonal(ctx)) return denegado();
      const { db } = ctx; const hoy = hoyLima(); const lim = sumarDias(hoy, a.p_dias == null ? 7 : a.p_dias);
      const ultimos = {};
      db.membresias.forEach((m) => { if (!ultimos[m.id_cliente] || m.fin > ultimos[m.id_cliente]) ultimos[m.id_cliente] = m.fin; });
      return ok(Object.entries(ultimos).filter(([, fin]) => fin <= lim && fin >= sumarDias(hoy, -30))
        .map(([id, fin]) => ({ id_cliente: id, nombre: db.clientes.find((c) => c.id_cliente === id).nombre, fin,
          dias_restantes: Math.round((new Date(`${fin}T00:00:00Z`) - new Date(`${hoy}T00:00:00Z`)) / 86400000) }))
        .sort((x, y) => (x.fin < y.fin ? -1 : 1)));
    },

    checkin_manual(a, ctx) {
      if (!esPersonal(ctx)) return denegado();
      const cli = ctx.db.clientes.find((c) => c.id_cliente === a.p_id_cliente);
      if (!cli) return ok({ ok: false, motivo: 'Cliente no encontrado' });
      return entrarGimnasio(ctx, cli, a.p_sede, 'manual');
    },

    checkout_manual(a, ctx) {
      if (!esPersonal(ctx)) return denegado();
      const c = ctx.db.checkins.find((x) => x.id_cliente === a.p_id_cliente && !x.salida_en);
      if (!c) return ok({ ok: false, motivo: 'El cliente no tiene una entrada abierta.' });
      c.salida_en = new Date().toISOString();
      if (ctx.registrar) ctx.registrar('checkins', 'checkout', c.id_checkin, a.p_id_cliente, { metodo: 'manual' });
      return ok({ ok: true });
    }
  }
};
