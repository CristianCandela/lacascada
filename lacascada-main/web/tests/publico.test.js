import test from 'node:test';
import assert from 'node:assert/strict';
import { nivelAforo } from '../src/features/publico/logica.js';

test('público: nivel del indicador de aforo', () => {
  assert.deepEqual(nivelAforo(5, 30), { pct: 17, nivel: 'bajo' });
  assert.deepEqual(nivelAforo(20, 30), { pct: 67, nivel: 'medio' });
  assert.deepEqual(nivelAforo(28, 30), { pct: 93, nivel: 'alto' });
  assert.deepEqual(nivelAforo(40, 30), { pct: 100, nivel: 'alto' });
  assert.deepEqual(nivelAforo(3, 0), { pct: 0, nivel: 'bajo' });
});
