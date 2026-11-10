// Ayudas compartidas por los mock.js de cada rol (solo para pruebas con `npm run dev:mock`).
// Reflejan las reglas de la base real (supabase/migrations/…fase1…). Dueño: Cristian.
export const ok = (data) => ({ data, error: null });
export const err = (m) => ({ data: null, error: new Error(m) });

const UTC_LIMA = -5 * 3600 * 1000; // Perú no usa horario de verano
export const hoyLima = () => new Date(Date.now() + UTC_LIMA).toISOString().slice(0, 10);
export const horaLima = (d = new Date()) => new Date(d.getTime() + UTC_LIMA).toISOString().slice(11, 16);
export function sumarDias(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Capacidad del sauna por sede (en la base real sale de la tabla aforos).
export const CAPACIDAD = { sauna: { 'Túpac Amaru': 6, 'Santa Rosa': 4 }, gimnasio: { 'Túpac Amaru': 30, 'Santa Rosa': 20 } };
export const CODIGO_DEMO = '123456'; // código del local en el mock

export function iniciarTablas(db) {
  if (db.planes) return;
  db.sedes = [{ sede: 'Túpac Amaru', abre: '06:00', cierra: '22:00' }, { sede: 'Santa Rosa', abre: '06:00', cierra: '22:00' }];
  db.planes = [{ id_plan: 'p1', nombre: 'Plan general', dias: 30, precio: 150, activo: true }];
  db.membresias = []; db.pagos = []; db.checkins = []; db.motivos_ausencia = []; db.intentos = [];
  const manana = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  db.codigos_local = db.sedes.map((s, i) => ({ id_codigo: `cl${i}`, sede: s.sede, codigo: CODIGO_DEMO, vigente_hasta: manana }));
}

export function membresiaVigente(db, idCliente, dia = hoyLima()) {
  const fines = db.membresias.filter((m) => m.id_cliente === idCliente && m.inicio <= dia && m.fin >= dia).map((m) => m.fin);
  return fines.length ? fines.sort().pop() : null;
}

// Cierra las visitas que siguen abiertas cuando el local ya cerró.
export function cerrarVisitasVencidas(db) {
  db.checkins.forEach((c) => {
    if (c.salida_en) return;
    const s = db.sedes.find((x) => x.sede === c.sede);
    const dia = new Date(new Date(c.entrada_en).getTime() + UTC_LIMA).toISOString().slice(0, 10);
    const cierre = new Date(`${dia}T${s.cierra}:00Z`).getTime() - UTC_LIMA;
    if (Date.now() > cierre) { c.salida_en = new Date(cierre).toISOString(); c.cierre_automatico = true; }
  });
}

// Valida y registra una entrada al gimnasio (misma lógica que entrar_gimnasio en SQL).
export function entrarGimnasio(ctx, cliente, sede, metodo) {
  const { db } = ctx;
  cerrarVisitasVencidas(db);
  if (cliente.estado !== 'activo') return ok({ ok: false, motivo: 'La cuenta no está activa. Acude a recepción.' });
  const fin = membresiaVigente(db, cliente.id_cliente);
  if (!fin) return ok({ ok: false, motivo: 'No hay una membresía vigente.' });
  const s = db.sedes.find((x) => x.sede === sede);
  const h = horaLima();
  if (!s || h < s.abre || h >= s.cierra) return ok({ ok: false, motivo: 'El local está cerrado en este momento.' });
  if (db.checkins.some((c) => c.id_cliente === cliente.id_cliente && !c.salida_en))
    return ok({ ok: false, motivo: 'Ya hay una entrada abierta. Registra la salida antes de volver a entrar.' });
  const c = { id_checkin: ctx.nuevoId('ck'), id_cliente: cliente.id_cliente, sede, entrada_en: new Date().toISOString(), salida_en: null, metodo, cierre_automatico: false };
  db.checkins.push(c);
  if (ctx.registrar) ctx.registrar('checkins', 'checkin', c.id_checkin, cliente.id_cliente, { sede, metodo });
  return ok({ ok: true, sede, membresia_fin: fin });
}

// Intentos fallidos de código: 5 en 10 minutos bloquean.
export const intentosExcedidos = (db, uid) =>
  db.intentos.filter((i) => i.id_usuario === uid && !i.ok && Date.now() - i.en < 10 * 60 * 1000).length >= 5;
export const anotarIntento = (db, uid, okk) => db.intentos.push({ id_usuario: uid, en: Date.now(), ok: okk });
export const MSG_BLOQUEO = 'Demasiados intentos fallidos. Espera 10 minutos o acude a recepción.';
