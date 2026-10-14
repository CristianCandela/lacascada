import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarReserva, calcularPorcentajes, aCSV, urlWhatsApp, mensajeRecordatorio } from '../src/lib/logica.js';

const ahora = new Date('2026-10-11T10:00:00');
const ok = { nombre: 'Ana Pérez', dni: '70000001', telefono: '900000001', servicio: 'sauna',
  sede: 'Año Nuevo', fecha_hora: '2026-10-12T18:00', consentimiento: true };
const con = (o) => ({ ...ok, ...o });

test('reserva válida', () => assert.equal(validarReserva(ok, ahora).ok, true));
test('formulario vacío marca todos los campos', () => {
  const r = validarReserva({}, ahora);
  assert.equal(r.ok, false);
  for (const k of ['nombre', 'dni', 'telefono', 'servicio', 'sede', 'fecha_hora', 'consentimiento']) assert.ok(r.errores[k], k);
});
test('teléfono inválido', () => assert.ok(validarReserva(con({ telefono: '12345' }), ahora).errores.telefono));
test('DNI de 7 y de 9 dígitos', () => {
  assert.ok(validarReserva(con({ dni: '1234567' }), ahora).errores.dni);
  assert.ok(validarReserva(con({ dni: '123456789' }), ahora).errores.dni);
});
test('fecha pasada', () => assert.ok(validarReserva(con({ fecha_hora: '2026-10-10T10:00' }), ahora).errores.fecha_hora));
test('sin consentimiento', () => assert.ok(validarReserva(con({ consentimiento: false }), ahora).errores.consentimiento));
test('nombre con números', () => assert.ok(validarReserva(con({ nombre: 'Ana 123' }), ahora).errores.nombre));
test('porcentajes', () => {
  const p = calcularPorcentajes({ asistio: 82, no_asistio: 18, citas_vencidas: 100, vencidas_con_registro: 100 });
  assert.deepEqual([p.pct_no_show, p.pct_asistencia, p.pct_registro], [18, 82, 100]);
});
test('porcentajes sin datos (sin dividir por cero)', () => {
  const p = calcularPorcentajes({});
  assert.deepEqual([p.pct_no_show, p.pct_asistencia, p.pct_registro], [0, 0, 0]);
});
test('CSV sin datos personales', () => {
  const csv = aCSV([{ id_cita: 'c1', id_cliente: 'k1', servicio: 'sauna', sede: 'Año Nuevo',
    fecha_hora_cita: 'f1', fecha_hora_registro: 'f0', estado_asistencia: 'no_asistio' }]);
  assert.ok(csv.split('\n')[1].endsWith(',1'));
  assert.ok(!/dni|telefono|nombre/.test(csv));
  assert.match(csv.split('\n')[0], /recordatorio_enviado_en,confirmada_en/);
});
test('urlWhatsApp: agrega 51 y codifica el mensaje', () => {
  const u = urlWhatsApp('900000001', 'Hola, ¿vienes?');
  assert.ok(u.startsWith('https://wa.me/51900000001?text='));
  assert.ok(u.includes(encodeURIComponent('¿vienes?')));
});
test('urlWhatsApp: teléfono inválido devuelve null', () => {
  assert.equal(urlWhatsApp('123', 'x'), null);
  assert.equal(urlWhatsApp('', 'x'), null);
});
test('mensajeRecordatorio incluye cliente, servicio y sede', () => {
  const m = mensajeRecordatorio({ servicio: 'sauna', sede: 'Año Nuevo', fecha_hora_cita: '2026-10-14T18:00:00',
    clientes: { nombre: 'Ana' } });
  assert.match(m, /Ana/); assert.match(m, /sauna/); assert.match(m, /Año Nuevo/);
});
