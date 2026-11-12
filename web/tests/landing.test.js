import test from 'node:test';
import assert from 'node:assert/strict';
import { formatoPrecio, formatoTelefono, enlaceWhatsApp, urlMapa, aforoDeSede, estadoLocal, textoNivelAforo, formatoHora } from '../src/features/publico/landing-logica.js';

test('landing: formato de precio y hora', () => {
  assert.equal(formatoPrecio(150), 'S/ 150');
  assert.equal(formatoPrecio('150.5'), 'S/ 150.50');
  assert.equal(formatoPrecio(null), 'S/ 0');
  assert.equal(formatoPrecio('abc'), '');
  assert.equal(formatoHora('06:00:00'), '06:00');
});

test('landing: teléfono y WhatsApp', () => {
  assert.equal(formatoTelefono('913023155'), '913 023 155');
  assert.equal(formatoTelefono('+51 913 023 155'), '913 023 155');
  assert.equal(enlaceWhatsApp('913023155'), 'https://wa.me/51913023155');
  assert.equal(enlaceWhatsApp('913023155', 'Hola, quiero info'), 'https://wa.me/51913023155?text=Hola%2C%20quiero%20info');
});

test('landing: enlace de mapa', () => {
  const u = urlMapa('Av. Túpac Amaru N.° 6912, Comas');
  assert.ok(u.startsWith('https://www.google.com/maps/search/?api=1&query='));
  assert.ok(decodeURIComponent(u).includes('Túpac Amaru'));
});

test('landing: aforo por sede y nivel', () => {
  const filas = [
    { sede: 'A', servicio: 'gimnasio', ocupados: 3, capacidad: 30 },
    { sede: 'A', servicio: 'sauna', ocupados: 5, capacidad: 6 },
    { sede: 'B', servicio: 'gimnasio', ocupados: 20, capacidad: 30 },
  ];
  const a = aforoDeSede(filas, 'A');
  assert.equal(a.gimnasio.pct, 10);
  assert.equal(a.sauna.nivel, 'alto');
  assert.equal(aforoDeSede(filas, 'B').sauna, null);
  assert.deepEqual(aforoDeSede(null, 'A'), { gimnasio: null, sauna: null });
  assert.equal(textoNivelAforo('medio'), 'Concurrido');
  assert.equal(textoNivelAforo('x'), '');
});

test('landing: estado del local en hora de Lima', () => {
  const mediodia = new Date('2026-10-29T17:00:00Z'); // 12:00 Lima
  const noche = new Date('2026-10-30T04:00:00Z'); // 23:00 Lima
  assert.equal(estadoLocal('06:00:00', '22:00:00', mediodia).abierto, true);
  assert.equal(estadoLocal('06:00', '22:00', noche).abierto, false);
  assert.equal(estadoLocal(null, '22:00'), null);
});
