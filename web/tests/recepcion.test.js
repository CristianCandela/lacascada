import test from 'node:test';
import assert from 'node:assert/strict';
import { diasParaVencer } from '../src/features/recepcion/logica.js';

test('recepción: días para que venza una membresía', () => {
  const hoy = new Date(2026, 9, 20, 15, 30);
  assert.equal(diasParaVencer('2026-10-27', hoy), 7);
  assert.equal(diasParaVencer('2026-10-20', hoy), 0);
  assert.equal(diasParaVencer('2026-10-18', hoy), -2);
});
