import test from 'node:test';
import assert from 'node:assert/strict';
import { diasSinAsistir } from '../src/features/admin/logica.js';

test('admin: días sin asistir desde la última visita', () => {
  const hoy = new Date('2026-10-20T12:00:00');
  assert.equal(diasSinAsistir('2026-10-06T12:00:00', hoy), 14);
  assert.equal(diasSinAsistir(null, hoy), null);
});
