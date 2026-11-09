import test from 'node:test';
import assert from 'node:assert/strict';
import { diasParaVencer, semaforoMembresia, estadoAforo, tipoBusqueda} from '../src/features/recepcion/logica.js';
import { esDniValido, esTelefonoValido } from '../src/features/recepcion/logica.js';
import { mensajeRenovacion, enlaceWhatsApp } from '../src/features/recepcion/logica.js';


test('recepción: días para que venza una membresía', () => {
  const hoy = new Date(2026, 9, 20, 15, 30);
  assert.equal(diasParaVencer('2026-10-27', hoy), 7);
  assert.equal(diasParaVencer('2026-10-20', hoy), 0);
  assert.equal(diasParaVencer('2026-10-18', hoy), -2);
});

test('recepción: semáforo de membresía', () => {
  const hoy = new Date(2026, 9, 20, 15, 30);
  assert.equal(semaforoMembresia(null, hoy), 'gris');
  assert.equal(semaforoMembresia('2026-10-18', hoy), 'rojo');
  assert.equal(semaforoMembresia('2026-10-23', hoy), 'amarillo');
  assert.equal(semaforoMembresia('2026-11-10', hoy), 'verde');
});

test('recepción: estado del aforo', () => {
  assert.equal(estadoAforo(36, 40).color, 'rojo');      // 90 %
  assert.equal(estadoAforo(28, 40).color, 'amarillo');  // 70 %
  assert.equal(estadoAforo(18, 40).color, 'verde');     // 45 %
  assert.equal(estadoAforo(5, 0).color, 'gris');        // sin capacidad
});

test('recepción: tipo de búsqueda', () => {
  assert.equal(tipoBusqueda('12345678'), 'dni');
  assert.equal(tipoBusqueda('C-1042'), 'codigo');
  assert.equal(tipoBusqueda('Juan Pérez'), 'nombre');
  assert.equal(tipoBusqueda('   '), 'vacio');
});

import { TARIFAS, esAfiliadoVigente, calcularTarifaSauna, textoMembresia, decisionEntrada } from '../src/features/recepcion/logica.js';

test('recepción: tarifa de sauna según afiliación', () => {
  assert.equal(calcularTarifaSauna(true).monto, 15);
  assert.equal(calcularTarifaSauna(false).monto, 20);
  assert.equal(calcularTarifaSauna(true).etiqueta, 'Tarifa afiliado');
});

test('recepción: decisión de entrada al gimnasio', () => {
  const ahora = new Date(2026, 9, 20, 15, 30);
  assert.equal(decisionEntrada({ fin: '2026-10-18' }, ahora).puede, false);          // vencida
  assert.equal(decisionEntrada({ fin: '2026-10-18', tienePase: true }, ahora).puede, true); // pase del día
  assert.deepEqual(decisionEntrada({ fin: '2026-11-10', aforoColor: 'rojo' }, ahora).avisos, ['lleno']);
  const reciente = new Date(2026, 9, 20, 14, 30).toISOString();
  assert.deepEqual(decisionEntrada({ fin: '2026-11-10', ultimaEntrada: reciente }, ahora).avisos, ['duplicado']);
});

test('recepción: cobro y nuevo vencimiento', () => {
  const hoy = new Date(2026, 9, 20, 15, 0);
  assert.equal(montoCobro('pase_dia', null), 20);
  assert.equal(montoCobro('membresia', { precio: 380 }), 380);
  assert.equal(nuevoFin('2026-10-25', 30, hoy), '2026-11-24'); // vigente: suma al fin actual
  assert.equal(nuevoFin('2026-10-10', 30, hoy), '2026-11-19'); // vencida: desde hoy
  assert.equal(nuevoFin(null, 30, hoy), '2026-11-19');         // sin plan: desde hoy
});

test('recepción: validación de DNI y teléfono', () => {
  assert.equal(esDniValido('47829103'), true);
  assert.equal(esDniValido('4782910'), false);
  assert.equal(esDniValido('4782910a'), false);
  assert.equal(esTelefonoValido(''), true);      // opcional
  assert.equal(esTelefonoValido('987654321'), true);
  assert.equal(esTelefonoValido('98765'), false);
});

test('recepción: mensaje de renovación y enlace de WhatsApp', () => {
  const hoy = new Date(2026, 9, 20, 10, 0);
  assert.match(mensajeRenovacion('Mateo Castro', '2026-10-22', hoy), /Hola Mateo.*vence en 2 días/);
  assert.match(mensajeRenovacion('Joaquín Paredes', '2026-10-17', hoy), /venció hace 3 días/);
  assert.equal(enlaceWhatsApp('12345', 'hola'), null);
  assert.ok(enlaceWhatsApp('987654321', 'hola').startsWith('https://wa.me/51987654321'));
});

import { alertasCompletas, clientesConPases } from '../src/features/recepcion/logica.js';

test('recepción: alertas ordenadas por severidad', () => {
  const hoy = new Date(2026, 9, 20);
  const a = alertasCompletas({ aforoGim: { color: 'rojo', porcentaje: 95 }, porVencer: [{ nombre: 'Ana', fin: '2026-10-22' }], noShows: 1, ausentes: [{}] }, hoy);
  assert.equal(a[0].id, 'aforo');
  assert.equal(a[a.length - 1].id, 'ausentes');
  assert.equal(alertasCompletas({}, hoy).length, 0);
});

test('recepción: clientes con 3 pases del día', () => {
  const pagos = [1, 2, 3].map(() => ({ id_cliente: 'k1', concepto: 'pase_dia' }));
  assert.equal(clientesConPases(pagos, [{ id_cliente: 'k1', nombre: 'Ana' }])[0].cuenta, 3);
  assert.equal(clientesConPases(pagos.slice(0, 2), []).length, 0);
});

import { tasaNoShow, entradasPorHora, porcentaje } from '../src/features/recepcion/logica.js';

test('recepción: resumen del día', () => {
  assert.equal(tasaNoShow(11, 1), 8.3);
  assert.equal(tasaNoShow(0, 0), 0);
  assert.equal(porcentaje(460, 1420), 32.4);
  const h = entradasPorHora([{ entrada_en: new Date(2026, 9, 20, 8, 5).toISOString() }, { entrada_en: new Date(2026, 9, 20, 8, 40).toISOString() }]);
  assert.deepEqual(h, [{ hora: 8, cuenta: 2 }]);
});