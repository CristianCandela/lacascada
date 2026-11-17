// Simulación del servidor para administración (solo `npm run dev:mock` y pruebas). Debe seguir `docs/CONTRATO_DATOS.md`.
import { ok, err, hoyLima, iniciarTablas, membresiaVigente } from '../../mock/comunes.js';

const esAdmin = (ctx) => { const u = ctx.usuario(); return !!u && u.rol === 'administrador'; };
const denegado = () => err('Acceso denegado: solo el administrador');

export const mock = {
  usuarios: {},
  iniciar(db) { iniciarTablas(db); },
  rpc: {
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