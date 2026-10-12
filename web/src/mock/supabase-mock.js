// Simulación mínima de supabase-js SOLO para pruebas automáticas (vite --mode mock).
// No se usa en desarrollo ni en producción.
const USERS = {
  'recepcion@demo.test': { id: 'u1', pass: 'demo123', perfil: { nombre: 'Recepcionista de prueba', rol: 'recepcionista' } },
  'admin@demo.test': { id: 'u2', pass: 'demo123', perfil: { nombre: 'Administrador de prueba', rol: 'administrador' } }
};
const db = { perfiles: [], clientes: [], citas: [] };
Object.keys(USERS).forEach((e) => db.perfiles.push({ id: USERS[e].id, ...USERS[e].perfil }));
let sesion = null; let redCaida = false; let seq = 1;

const hoy = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
db.clientes.push({ id_cliente: 'k1', nombre: 'Cliente Demo 01', dni: '70000001', telefono: '900000001' });
db.citas.push(
  { id_cita: 'c1', id_cliente: 'k1', servicio: 'sauna', sede: 'Año Nuevo', fecha_hora_cita: hoy(1), fecha_hora_registro: hoy(0), estado_asistencia: 'asistio' },
  { id_cita: 'c2', id_cliente: 'k1', servicio: 'gimnasio', sede: 'Santa Rosa', fecha_hora_cita: hoy(2), fecha_hora_registro: hoy(0), estado_asistencia: 'pendiente' }
);
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
        if (tabla === 'citas') { nuevo.id_cita = `c${++seq}`; nuevo.fecha_hora_registro = new Date().toISOString(); }
        db[tabla].push(nuevo);
        return resolve(q.single ? { data: nuevo, error: null } : { data: null, error: null });
      }
      if (q.op === 'update') { filas.forEach((r) => Object.assign(r, q.payload)); return resolve({ data: null, error: null }); }
      if (q.op === 'delete') { db[tabla] = db[tabla].filter((r) => !filas.includes(r)); return resolve({ data: null, error: null }); }
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
      signOut: () => { sesion = null; return Promise.resolve({ error: null }); }
    },
    from: builder,
    rpc: () => {
      if (redCaida) return Promise.resolve({ data: null, error: new Error('Failed to fetch') });
      const c = db.citas; const ahora = new Date().toISOString();
      const venc = c.filter((x) => x.fecha_hora_cita <= ahora);
      const agr = (campo) => {
        const m = {};
        c.forEach((x) => {
          const k = (m[x[campo]] = m[x[campo]] || { clave: x[campo], asistio: 0, no_asistio: 0 });
          if (x.estado_asistencia === 'asistio') k.asistio++;
          if (x.estado_asistencia === 'no_asistio') k.no_asistio++;
        });
        return Object.values(m);
      };
      return Promise.resolve({ data: {
        total_citas: c.length, citas_vencidas: venc.length,
        vencidas_con_registro: venc.filter((x) => x.estado_asistencia !== 'pendiente').length,
        asistio: c.filter((x) => x.estado_asistencia === 'asistio').length,
        no_asistio: c.filter((x) => x.estado_asistencia === 'no_asistio').length,
        por_servicio: agr('servicio'), por_sede: agr('sede') }, error: null });
    }
  };
}
