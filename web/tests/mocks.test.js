// Comprueba que los mock.js de los roles siguen el contrato de datos (flujo completo de la v2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mock as cliente } from '../src/features/cliente/mock.js';
import { mock as recepcion } from '../src/features/recepcion/mock.js';
import { mock as admin } from '../src/features/admin/mock.js';
import { mock as publico } from '../src/features/publico/mock.js';
import { hoyLima, sumarDias } from '../src/mock/comunes.js';

function entorno() {
  const db = { perfiles: [{ id: 'u1', nombre: 'Rec', rol: 'recepcionista' }, { id: 'u2', nombre: 'Adm', rol: 'administrador' }, { id: 'u3', nombre: 'Cli', rol: 'cliente' }],
    clientes: [], citas: [], solicitudes: [], bitacora: [] };
  let seq = 100; let yo = null;
  const ctx = { db, usuario: () => db.perfiles.find((p) => p.id === yo), nuevoId: (p) => `${p}${++seq}`, registrar: () => {} };
  [cliente, recepcion, admin, publico].forEach((m) => m.iniciar(db, ctx));
  // El horario simulado (06:00–22:00) no debe volver las pruebas dependientes de la hora del día.
  db.sedes.forEach((x) => { x.abre = '00:00'; x.cierra = '24:00'; });
  const llamar = (como, fn, args = {}) => {
    yo = como;
    const m = [cliente, recepcion, admin, publico].find((x) => x.rpc[fn]);
    return m.rpc[fn](args, ctx);
  };
  return { db, ctx, llamar, como: (u) => { yo = u; } };
}
const manana = (h) => { const d = new Date(Date.now() + 24 * 3600 * 1000); d.setUTCHours(h + 5, 0, 0, 0); return d.toISOString(); };

test('cliente de prueba: membresía vigente, check-in, salida y aforo', () => {
  const { llamar } = entorno();
  assert.equal(llamar('u3', 'mi_membresia').data.vigente, true);
  assert.equal(llamar('u3', 'checkin', { p_codigo: '000000' }).data.ok, false);
  const r = llamar('u3', 'checkin', { p_codigo: '123456' }).data;
  assert.equal(r.ok, true, r.motivo);
  assert.equal(llamar('u3', 'checkin', { p_codigo: '123456' }).data.ok, false); // doble entrada
  const g = llamar(null, 'aforo_actual', {}).data.find((x) => x.servicio === 'gimnasio' && x.sede === r.sede);
  assert.equal(g.ocupados, 1);
  assert.equal(llamar('u3', 'checkout').data.ok, true);
  assert.equal(llamar('u3', 'mis_visitas', { p_limite: 5 }).data.length, 1);
});

test('seguridad del mock: el cliente no usa funciones de personal y viceversa', () => {
  const { llamar } = entorno();
  assert.ok(llamar('u3', 'codigo_local_actual', { p_sede: 'Santa Rosa' }).error);
  assert.ok(llamar('u3', 'registrar_pago', {}).error);
  assert.ok(llamar('u1', 'clientes_inactivos', {}).error);
  assert.ok(llamar('u1', 'checkin', { p_codigo: '123456' }).error);
});

test('recepción: pago extiende la membresía desde el día siguiente al fin', () => {
  const { llamar, db } = entorno();
  llamar('u1', 'registrar_pago', { p_id_cliente: 'kc1', p_id_plan: 'p1' });
  const ms = db.membresias.filter((m) => m.id_cliente === 'kc1').sort((a, b) => (a.fin < b.fin ? -1 : 1));
  assert.equal(ms.length, 2);
  assert.equal(ms[1].inicio, sumarDias(ms[0].fin, 1));
  assert.equal(ms[1].fin, sumarDias(ms[1].inicio, 29));
  assert.ok(llamar('u1', 'registrar_pago', { p_id_cliente: 'kc1', p_id_plan: 'p1', p_medio: 'bitcoin' }).error);
});

test('registro de cliente nuevo y vinculación por DNI', () => {
  const { llamar, db } = entorno();
  db.perfiles = db.perfiles.filter((p) => p.id !== 'u3');
  db.cuenta_nueva = 'u9';
  assert.equal(llamar(null, 'registrar_cliente', { p_codigo_local: '999', p_nombre: 'Ana Prueba', p_dni: '50000001', p_telefono: '955555551', p_consentimiento: true }).data.ok, false);
  const r = llamar(null, 'registrar_cliente', { p_codigo_local: '123456', p_nombre: 'Ana Prueba', p_dni: '50000001', p_telefono: '955555551', p_consentimiento: true }).data;
  assert.equal(r.ok, true);
  assert.ok(db.perfiles.some((p) => p.id === 'u9' && p.rol === 'cliente'));
  db.clientes.push({ id_cliente: 'kx', nombre: 'Existente', dni: '40000001', telefono: '944444444', estado: 'activo', id_usuario: null });
  db.cuenta_nueva = 'u10';
  assert.match(llamar(null, 'registrar_cliente', { p_codigo_local: '123456', p_nombre: 'Otro', p_dni: '40000001', p_telefono: '900000000', p_consentimiento: true }).data.motivo, /no coinciden/);
  assert.equal(llamar(null, 'registrar_cliente', { p_codigo_local: '123456', p_nombre: 'Otro', p_dni: '40000001', p_telefono: '944444444', p_consentimiento: true }).data.ok, true);
});

test('bloqueo tras 5 códigos incorrectos', () => {
  const { llamar } = entorno();
  for (let i = 0; i < 5; i++) llamar('u3', 'checkin', { p_codigo: '111111' });
  assert.match(llamar('u3', 'checkin', { p_codigo: '123456' }).data.motivo, /Demasiados intentos/);
});

test('reserva de sauna: aforo, duplicado, cancelación y cupo liberado', () => {
  const { llamar, db } = entorno();
  const f = manana(10);
  const id = llamar('u3', 'reservar_sauna', { p_sede: 'Túpac Amaru', p_fecha_hora: f });
  assert.ok(id.data, id.error && id.error.message);
  assert.ok(llamar('u3', 'reservar_sauna', { p_sede: 'Túpac Amaru', p_fecha_hora: f }).error);
  assert.equal(llamar('u3', 'cancelar_reserva', { p_id_cita: id.data }).data.ok, true);
  assert.equal(llamar('u3', 'cancelar_reserva', { p_id_cita: id.data }).data.ok, false);
  for (let i = 0; i < 6; i++) db.citas.push({ id_cita: `x${i}`, id_cliente: `z${i}`, servicio: 'sauna', sede: 'Túpac Amaru', fecha_hora_cita: f, estado_asistencia: 'pendiente' });
  assert.match(llamar('u3', 'reservar_sauna', { p_sede: 'Túpac Amaru', p_fecha_hora: f }).error.message, /Aforo máximo/);
  assert.ok(llamar('u3', 'reservar_sauna', { p_sede: 'Túpac Amaru', p_fecha_hora: new Date(Date.now() - 3600000).toISOString() }).error);
});

test('admin: inactivos con membresía vigente y motivo de ausencia', () => {
  const { llamar } = entorno();
  const l = llamar('u2', 'clientes_inactivos', { p_dias: 14 }).data;
  assert.equal(l.length, 1);
  assert.equal(l[0].id_cliente, 'kc1');
  assert.equal(llamar('u2', 'registrar_motivo_ausencia', { p_id_cliente: 'kc1', p_motivo: 'costo' }).data.ok, true);
  assert.equal(llamar('u2', 'clientes_inactivos', { p_dias: 14 }).data[0].ultimo_motivo, 'costo');
  assert.ok(llamar('u2', 'registrar_motivo_ausencia', { p_id_cliente: 'kc1', p_motivo: 'x' }).error);
});
