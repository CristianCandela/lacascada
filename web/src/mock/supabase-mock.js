// Simulación mínima de supabase-js SOLO para pruebas automáticas (vite --mode mock).
// No se usa en desarrollo ni en producción.
// Cada rol aporta su parte en src/features/<rol>/mock.js (usuarios, tablas y funciones rpc).
import { MOCKS } from '../features/mocks';

const USERS = {
  'recepcion@demo.test': { id: 'u1', pass: 'demo123', perfil: { nombre: 'Recepcionista de prueba', rol: 'recepcionista' } },
  'admin@demo.test': { id: 'u2', pass: 'demo123', perfil: { nombre: 'Administrador de prueba', rol: 'administrador' } }
};
const db = { perfiles: [], clientes: [], citas: [], solicitudes: [] };
// Aforos de prueba (en producción están en la tabla public.aforos).
const AFOROS = { 'sauna|Túpac Amaru': 2, 'sauna|Santa Rosa': 4, 'gimnasio|Túpac Amaru': 30, 'gimnasio|Santa Rosa': 20 };
const hora = (iso) => String(iso).slice(0, 13);
const ocupados = (servicio, sede, iso, excepto) => db.citas.filter((x) => x.servicio === servicio && x.sede === sede
  && hora(new Date(x.fecha_hora_cita).toISOString()) === hora(new Date(iso).toISOString())
  && x.estado_asistencia !== 'cancelo' && x.id_cita !== excepto).length;
function validarCita(n, excepto) {
  if (n.estado_asistencia === 'cancelo' || new Date(n.fecha_hora_cita) <= new Date()) return null;
  if (db.citas.some((x) => x.id_cita !== excepto && x.id_cliente === n.id_cliente && x.servicio === n.servicio
    && x.fecha_hora_cita === n.fecha_hora_cita && x.estado_asistencia !== 'cancelo'))
    return new Error('duplicate key value violates unique constraint "citas_sin_duplicado"');
  const cap = AFOROS[`${n.servicio}|${n.sede}`];
  if (cap && ocupados(n.servicio, n.sede, n.fecha_hora_cita, excepto) >= cap)
    return new Error('Aforo máximo completado para esta franja horaria');
  return null;
}
MOCKS.forEach((x) => Object.assign(USERS, x.usuarios || {}));
Object.keys(USERS).forEach((e) => db.perfiles.push({ id: USERS[e].id, ...USERS[e].perfil }));
let sesion = null; let redCaida = false; let seq = 1;

const hoy = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
db.clientes.push({ id_cliente: 'k1', nombre: 'Cliente Demo 01', dni: '70000001', telefono: '900000001' });
db.citas.push(
  { id_cita: 'c1', id_cliente: 'k1', servicio: 'sauna', sede: 'Túpac Amaru', fecha_hora_cita: hoy(1), fecha_hora_registro: hoy(0), estado_asistencia: 'asistio' },
  { id_cita: 'c2', id_cliente: 'k1', servicio: 'gimnasio', sede: 'Santa Rosa', fecha_hora_cita: hoy(2), fecha_hora_registro: hoy(0), estado_asistencia: 'pendiente' }
);
const manana = (h) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d.toISOString(); };
db.solicitudes.push({ id_solicitud: 's1', nombre: 'Cliente Demo 31', dni: '70000031', telefono: '900000031',
  servicio: 'sauna', sede: 'Túpac Amaru', fecha_hora_preferida: manana(18), estado: 'pendiente' });
const ctxMock = { db, usuario: () => sesion && db.perfiles.find((p) => p.id === sesion.user.id), nuevoId: (p) => `${p}${++seq}`, registrar: typeof registrar === 'function' ? registrar : () => {} };
MOCKS.forEach((x) => x.iniciar && x.iniciar(db, ctxMock));
if (typeof window !== 'undefined') window.__mock = { db, caerRed: (v) => { redCaida = v; } };

function builder(tabla) {
  const q = { op: 'select', filtros: [], payload: null, single: null, orden: null, sel: '' };
  const b = {
    select(s) { q.sel = s; return b; },
    insert(p) { q.op = 'insert'; q.payload = p; return b; },
    update(p) { q.op = 'update'; q.payload = p; return b; },
    delete() { q.op = 'delete'; return b; },
    eq(c, v) { q.filtros.push((r) => r[c] === v); return b; },
    gte(c, v) { q.filtros.push((r) => r[c] >= v); return b; },
    lt(c, v) { q.filtros.push((r) => r[c] < v); return b; },
    order(c) { q.orden = c; return b; },
    single() { q.single = 'single'; return b; },
    maybeSingle() { q.single = 'maybe'; return b; },
    then(res, rej) { return run().then(res, rej); }
  };
  function run() {
    return new Promise((resolve) => {
      if (redCaida) return resolve({ data: null, error: new Error('Failed to fetch') });
      let filas = db[tabla].filter((r) => q.filtros.every((f) => f(r)));
      
      if (q.op === 'insert') {
        const nuevo = { ...q.payload };
        if (tabla === 'clientes') nuevo.id_cliente = `k${++seq}`;
        if (tabla === 'solicitudes') { nuevo.id_solicitud = `s${++seq}`; nuevo.estado = 'pendiente'; }
        if (tabla === 'citas') {
          nuevo.id_cita = `c${++seq}`; nuevo.fecha_hora_registro = new Date().toISOString();
          const err = validarCita(nuevo, null);
          if (err) return resolve({ data: null, error: err });
        }
        db[tabla].push(nuevo);
        return resolve(q.single ? { data: nuevo, error: null } : { data: null, error: null });
      }

      if (q.op === 'update') {
        filas.forEach((r) => Object.assign(r, q.payload));
        const resultado = q.sel ? filas : null;
        return resolve({ data: resultado, error: null });
      }

      if (q.op === 'delete') {
        db[tabla] = db[tabla].filter((r) => !filas.includes(r));
        return resolve({ data: null, error: null });
      }

      if (q.orden) filas.sort((a, c) => (a[q.orden] < c[q.orden] ? -1 : 1));
      if (tabla === 'citas' && q.sel.includes('clientes('))
        filas = filas.map((r) => ({ ...r, clientes: db.clientes.find((c) => c.id_cliente === r.id_cliente) }));
      if (q.single) return resolve({ data: filas[0] || null, error: null });
      resolve({ data: filas, error: null });
    });
  }
  return b;
}

export function createClient() {
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: sesion } }),
      signInWithPassword: ({ email, password }) => {
        if (redCaida) return Promise.resolve({ data: null, error: new Error('Failed to fetch') });
        const u = USERS[email];
        if (!u || u.pass !== password) return Promise.resolve({ data: null, error: new Error('Invalid login credentials') });
        sesion = { user: { id: u.id } };
        return Promise.resolve({ data: { user: sesion.user }, error: null });
      },
      signUp: ({ email, password }) => {
        if (redCaida) return Promise.resolve({ data: null, error: new Error('Failed to fetch') });
        if (USERS[email]) return Promise.resolve({ data: null, error: new Error('User already registered') });
        const id = `u${++seq}`;
        USERS[email] = { id, pass: password, perfil: null };
        sesion = { user: { id } }; db.cuenta_nueva = id;
        return Promise.resolve({ data: { user: sesion.user, session: sesion }, error: null });
      },
      signOut: () => { sesion = null; db.cuenta_nueva = null; return Promise.resolve({ error: null }); }
    },
    from: builder,
    rpc: (nombre, args) => {
      if (redCaida) return Promise.resolve({ data: null, error: new Error('Failed to fetch') });
      const ext = MOCKS.find((x) => x.rpc && x.rpc[nombre]);
      if (ext) return Promise.resolve(ext.rpc[nombre](args || {}, ctxMock));
      if (nombre === 'aprobar_solicitud') {
        const sol = db.solicitudes.find((x) => x.id_solicitud === args.p_id && x.estado === 'pendiente');
        if (!sol) return Promise.resolve({ data: null, error: new Error('La solicitud no existe o ya fue atendida') });
        let cli = db.clientes.find((c) => c.dni === sol.dni);
        if (!cli) { cli = { id_cliente: `k${++seq}`, nombre: sol.nombre, dni: sol.dni, telefono: sol.telefono }; db.clientes.push(cli); }
        const cita = { id_cita: `c${++seq}`, id_cliente: cli.id_cliente, servicio: sol.servicio, sede: sol.sede,
          fecha_hora_cita: sol.fecha_hora_preferida, fecha_hora_registro: new Date().toISOString(), estado_asistencia: 'pendiente' };
        db.citas.push(cita); sol.estado = 'aprobada';
        return Promise.resolve({ data: cita.id_cita, error: null });
      }
      if (nombre === 'disponibilidad') {
        const cap = AFOROS[`${args.p_servicio}|${args.p_sede}`] || 0;
        const oc = ocupados(args.p_servicio, args.p_sede, args.p_fecha_hora, null);
        return Promise.resolve({ data: { capacidad: cap, ocupados: oc, libres: Math.max(cap - oc, 0) }, error: null });
      }
      if (nombre === 'riesgo_clientes') {
        const hace30 = Date.now() - 30 * 24 * 3600 * 1000;
        const data = args.p_ids.map((id) => {
          const h = db.citas.filter((x) => x.id_cliente === id && ['asistio', 'no_asistio'].includes(x.estado_asistencia)
            && new Date(x.fecha_hora_cita).getTime() >= hace30 && new Date(x.fecha_hora_cita).getTime() <= Date.now());
          const no = h.filter((x) => x.estado_asistencia === 'no_asistio').length;
          return { id_cliente: id, total: h.length, no_asistio: no, tasa: h.length ? Math.round((no / h.length) * 1000) / 10 : 0,
            alto_riesgo: h.length >= 2 && (no / h.length) * 100 >= 30 };
        }).filter((x) => x.total > 0);
        return Promise.resolve({ data, error: null });
      }
      const c = db.citas; const ahora = new Date().toISOString();
      const venc = c.filter((x) => x.fecha_hora_cita <= ahora);
      const cuenta = (e) => c.filter((x) => x.estado_asistencia === e).length;
      const agr = (campo) => {
        const m = {};
        c.forEach((x) => {
          const k = (m[x[campo]] = m[x[campo]] || { clave: x[campo], asistio: 0, no_asistio: 0 });
          if (x.estado_asistencia === 'asistio') k.asistio++;
          if (x.estado_asistencia === 'no_asistio') k.no_asistio++;
        });
        return Object.values(m);
      };
      const fin = c.filter((x) => ['asistio', 'no_asistio'].includes(x.estado_asistencia));
      const con = fin.filter((x) => x.recordatorio_enviado_en); const sin = fin.filter((x) => !x.recordatorio_enviado_en);
      const tiempos = c.filter((x) => typeof x.segundos_registro === 'number').map((x) => x.segundos_registro);
      const dh = {};
      fin.forEach((x) => {
        const f = new Date(x.fecha_hora_cita); const dow = f.getDay() === 0 ? 7 : f.getDay();
        const k = (dh[`${dow}-${f.getHours()}`] = dh[`${dow}-${f.getHours()}`] || { dow, hora: f.getHours(), asistio: 0, no_asistio: 0 });
        k[x.estado_asistencia]++;
      });
      const dia = {};
      venc.forEach((x) => {
        const f = new Date(x.fecha_hora_cita); const p2 = (n) => String(n).padStart(2, '0');
        const d = `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())}`;
        const k = (dia[d] = dia[d] || { dia: d, asistio: 0, no_asistio: 0, cancelo: 0 });
        if (k[x.estado_asistencia] !== undefined) k[x.estado_asistencia]++;
      });
      return Promise.resolve({ data: {
        total_citas: c.length, citas_vencidas: venc.length,
        vencidas_con_registro: venc.filter((x) => x.estado_asistencia !== 'pendiente').length,
        asistio: cuenta('asistio'), no_asistio: cuenta('no_asistio'), cancelo: cuenta('cancelo'), pendiente: cuenta('pendiente'),
        confirmadas: c.filter((x) => x.confirmada_en).length,
        tiempo_promedio_seg: tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : null,
        registros_completos: fin.length,
        por_servicio: agr('servicio'), por_sede: agr('sede'),
        por_dia: Object.values(dia), por_dia_hora: Object.values(dh),
        recordatorio: { con_total: con.length, con_no: con.filter((x) => x.estado_asistencia === 'no_asistio').length,
          sin_total: sin.length, sin_no: sin.filter((x) => x.estado_asistencia === 'no_asistio').length },
        clientes_riesgo: [] }, error: null });
    }
  };
}