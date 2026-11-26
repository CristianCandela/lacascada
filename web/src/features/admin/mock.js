// Simulación del servidor para administración (solo `npm run dev:mock` y pruebas). Debe seguir `docs/CONTRATO_DATOS.md`.
import { ok, err, hoyLima, iniciarTablas, membresiaVigente } from '../../mock/comunes.js';

const esAdmin = (ctx) => { const u = ctx.usuario(); return !!u && u.rol === 'administrador'; };
const denegado = () => err('Acceso denegado: solo el administrador');

export const mock = {
  usuarios: {},
  iniciar(db) { iniciarTablas(db); },
  rpc: {
    // ingresos_resumen(p_dias): total recaudado, por medio, por concepto, serie diaria y lo por cobrar (solo administrador).
    ingresos_resumen(a, ctx) {
      if (!esAdmin(ctx)) return denegado();
      const dias = Math.min(Math.max(a.p_dias == null ? 30 : a.p_dias, 1), 365);
      const hoy = hoyLima();
      const clave = (iso) => new Date(new Date(iso).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
      const dia0 = new Date(`${hoy}T00:00:00Z`); dia0.setUTCDate(dia0.getUTCDate() - (dias - 1));
      const desde = dia0.toISOString().slice(0, 10);
      const pagos = ctx.db.pagos.filter((p) => p.estado !== 'anulado' && clave(p.pagado_en) >= desde);
      const suma = (f) => pagos.filter(f).reduce((s, p) => s + p.monto, 0);
      const serie = [];
      for (let i = 0; i < dias; i += 1) {
        const d = new Date(dia0); d.setUTCDate(d.getUTCDate() + i);
        const k = d.toISOString().slice(0, 10);
        serie.push({ dia: k, total: pagos.filter((p) => clave(p.pagado_en) === k).reduce((s, p) => s + p.monto, 0) });
      }
      const pend = ctx.db.citas.filter((c) => c.servicio === 'sauna' && c.estado_pago === 'pendiente' && c.estado_asistencia === 'pendiente');
      return ok({
        dias, total: suma(() => true), n_pagos: pagos.length,
        por_medio: { efectivo: suma((p) => p.medio === 'efectivo'), yape: suma((p) => p.medio === 'yape'), plin: suma((p) => p.medio === 'plin'), visa: suma((p) => p.medio === 'visa') },
        por_concepto: { membresia: suma((p) => p.concepto === 'membresia'), pase_dia: suma((p) => p.concepto === 'pase_dia'), sauna: suma((p) => p.concepto === 'sauna') },
        por_dia: serie,
        por_cobrar: { n: pend.length, monto: pend.reduce((s, c) => s + (c.tarifa_aplicada || 0), 0) }
      });
    },

    // Clientes con membresía vigente que no asisten hace p_dias días (o nunca asistieron).
    clientes_inactivos(a, ctx) {
      if (!esAdmin(ctx)) return denegado();
      const { db } = ctx; const hoy = hoyLima(); const dias = a.p_dias == null ? 14 : a.p_dias;
      const corte = Date.now() - dias * 24 * 3600 * 1000;
      return ok(db.clientes.filter((c) => c.estado === 'activo' && membresiaVigente(db, c.id_cliente)).map((c) => {
        const vs = db.checkins.filter((k) => k.id_cliente === c.id_cliente).map((k) => k.entrada_en).sort();
        const ultima = vs.length ? vs[vs.length - 1] : null;
        const ms = db.motivos_ausencia.filter((m) => m.id_cliente === c.id_cliente).sort((x, y) => (x.registrado_en < y.registrado_en ? -1 : 1));
        return {
          id_cliente: c.id_cliente,
          nombre: c.nombre,
          telefono: c.telefono,
          ultima_visita: ultima,
          dias_sin_asistir: ultima ? Math.floor((new Date(`${hoy}T00:00:00Z`) - new Date(`${new Date(new Date(ultima).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10)}T00:00:00Z`)) / 86400000) : null,
          membresia_fin: membresiaVigente(db, c.id_cliente),
          ultimo_motivo: ms.length ? ms[ms.length - 1].motivo : null,
          _t: ultima ? new Date(ultima).getTime() : -1
        };
      }).filter((r) => r._t < corte).sort((x, y) => x._t - y._t).map(({ _t, ...r }) => r));
    },

    registrar_motivo_ausencia(a, ctx) {
      if (!esAdmin(ctx)) return denegado();
      if (!['horario', 'costo', 'salud', 'viaje', 'otro'].includes(a.p_motivo)) return err('Motivo no válido.');
      const cli = ctx.db.clientes.find((c) => c.id_cliente === a.p_id_cliente);
      if (!cli) return err('El cliente no existe.');
      const m = { id: ctx.nuevoId('ma'), id_cliente: cli.id_cliente, motivo: a.p_motivo, registrado_en: new Date().toISOString() };
      ctx.db.motivos_ausencia.push(m);
      if (ctx.registrar) ctx.registrar('clientes', 'motivo_ausencia', m.id, cli.id_cliente, { motivo: a.p_motivo });
      return ok({ ok: true });
    }
  }
};