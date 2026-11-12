import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diasSinAsistir,
  esCandidatoReactivacion,
  validarPlan,
  esMotivoValido,
  generarMensajeReactivacion
} from '../src/features/admin/logica.js';

test('admin: días sin asistir desde la última visita', () => {
  const hoy = new Date('2026-10-20T12:00:00');
  assert.equal(diasSinAsistir('2026-10-06T12:00:00', hoy), 14);
  assert.equal(diasSinAsistir(null, hoy), null);
});

test('admin: validación de planes según tabla planes del contrato', () => {
  const valido = validarPlan({ nombre: 'Plan Mensual', dias: 30, precio: 150 });
  assert.equal(valido.esValido, true);

  const invalido = validarPlan({ nombre: 'AB', dias: 0, precio: -10 });
  assert.equal(invalido.esValido, false);
  assert.equal(invalido.errores.length, 3);
});

test('admin: motivos de ausencia válidos según contrato y mensaje de reactivación', () => {
  assert.equal(esMotivoValido('costo'), true);
  assert.equal(esMotivoValido('invalido'), false);
  assert.equal(esCandidatoReactivacion('2026-10-01T12:00:00', 14, new Date('2026-10-20T12:00:00')), true);
  assert.match(generarMensajeReactivacion({ nombre: 'Carlos Mendoza' }), /Carlos/);
});
