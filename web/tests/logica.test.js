import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarReserva, calcularPorcentajes, aCSV, urlWhatsApp, mensajeRecordatorio,
  esAltoRiesgo, hayCupo, textoCupos, reduccionRecordatorio, matrizCalor, serieDiaria } from '../src/lib/logica.js';

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

// ---------- Riesgo, aforo y métricas (migración 3) ----------
test('riesgo: 30 % o más con al menos 2 citas es alto riesgo', () => {
  assert.equal(esAltoRiesgo({ total: 10, no_asistio: 3 }), true);   // 30 % exacto
  assert.equal(esAltoRiesgo({ total: 10, no_asistio: 2 }), false);  // 20 %
});
test('riesgo: una sola cita no alcanza para marcar a un cliente', () => {
  assert.equal(esAltoRiesgo({ total: 1, no_asistio: 1 }), false);
  assert.equal(esAltoRiesgo({ total: 2, no_asistio: 1 }), true);
});
test('riesgo: sin historial (null / vacío) no es alto riesgo ni falla', () => {
  assert.equal(esAltoRiesgo(), false);
  assert.equal(esAltoRiesgo({}), false);
});
test('aforo: hay cupo solo si quedan libres', () => {
  assert.equal(hayCupo({ capacidad: 6, ocupados: 5, libres: 1 }), true);
  assert.equal(hayCupo({ capacidad: 6, ocupados: 6, libres: 0 }), false);
  assert.equal(hayCupo(null), false);
});
test('aforo: texto de cupos', () => {
  assert.match(textoCupos({ capacidad: 6, ocupados: 2, libres: 4 }), /4 de 6/);
  assert.equal(textoCupos({ capacidad: 0 }), '');
});
test('reducción con recordatorio: 30 % sin vs 15 % con = 50 % relativo', () => {
  const r = reduccionRecordatorio({ con_total: 20, con_no: 3, sin_total: 20, sin_no: 6 });
  assert.deepEqual([r.tasa_con, r.tasa_sin, r.reduccion], [15, 30, 50]);
});
test('reducción con recordatorio: sin datos en un grupo devuelve null (sin dividir por cero)', () => {
  assert.equal(reduccionRecordatorio({ con_total: 0, con_no: 0, sin_total: 10, sin_no: 2 }).reduccion, null);
  assert.equal(reduccionRecordatorio({ con_total: 5, con_no: 1, sin_total: 5, sin_no: 0 }).reduccion, null);
  assert.equal(reduccionRecordatorio().reduccion, null);
});
test('mapa de calor: agrupa por día y franja y calcula %', () => {
  const m = matrizCalor([
    { dow: 5, hora: 19, asistio: 3, no_asistio: 1 },
    { dow: 5, hora: 21, asistio: 1, no_asistio: 1 },
    { dow: 1, hora: 8, asistio: 4, no_asistio: 0 },
    { dow: 3, hora: 3, asistio: 9, no_asistio: 9 }   // fuera de las franjas: se ignora
  ]);
  assert.equal(m[4][2].total, 6);                // viernes noche
  assert.equal(m[4][2].pct, 33.3);
  assert.equal(m[0][0].pct, 0);                  // lunes mañana, 0 no-shows
  assert.equal(m[2][0].pct, null);               // miércoles sin datos
});
test('serie diaria: completa los 14 días aunque no haya citas', () => {
  const hoy = new Date(2026, 9, 14);
  const s = serieDiaria([{ dia: '2026-10-13', asistio: 3, no_asistio: 1 }], 14, hoy);
  assert.equal(s.length, 14);
  assert.equal(s[13].dia, '2026-10-14');
  assert.equal(s[12].asistio, 3);
  assert.equal(s[0].asistio + s[0].no_asistio, 0);
});
test('CSV incluye segundos_registro y marca no_show solo para «no asistió»', () => {
  const base = { id_cita: 'c', id_cliente: 'k', servicio: 'sauna', sede: 'Año Nuevo', fecha_hora_cita: 'f', fecha_hora_registro: 'f0' };
  const csv = aCSV([{ ...base, estado_asistencia: 'cancelo', segundos_registro: 1.4 }, { ...base, estado_asistencia: 'no_asistio' }]).split('\n');
  assert.match(csv[0], /segundos_registro,no_show$/);
  assert.ok(csv[1].endsWith(',cancelo,1.4,0'));
  assert.ok(csv[2].endsWith(',no_asistio,,1'));
});
