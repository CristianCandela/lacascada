import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  diasSinAsistir, 
  esCandidatoReactivacion, 
  validarPlan, 
  generarMensajeReactivacion 
} from '../src/features/admin/logica.js';

test('admin: días sin asistir desde la última visita', () => {
  const hoy = new Date('2026-10-20T12:00:00');
  assert.equal(diasSinAsistir('2026-10-06T12:00:00', hoy), 14);
  assert.equal(diasSinAsistir(null, hoy), null);
});

test('admin: determinar si un cliente es candidato a reactivación', () => {
  const hoy = new Date('2026-10-20T12:00:00');
  assert.equal(esCandidatoReactivacion('2026-09-15T12:00:00', 30, hoy), true);
  assert.equal(esCandidatoReactivacion('2026-10-10T12:00:00', 30, hoy), false);
  assert.equal(esCandidatoReactivacion(null, 30, hoy), true);
});

test('admin: validar planes y membresías', () => {
  const planValido = { nombre: 'Pase Libre', precio: 100, duracion_dias: 30, tipo_servicio: 'sauna' };
  assert.equal(validarPlan(planValido).esValido, true);

  const planInvalido = { nombre: 'Li', precio: -5, duracion_dias: 0, tipo_servicio: 'invalido' };
  const resultado = validarPlan(planInvalido);
  assert.equal(resultado.esValido, false);
  assert.ok(resultado.errores.length >= 3);
});

test('admin: generar mensaje de reactivación personalizado', () => {
  const cliente = { nombre: 'Carlos Mendoza' };
  const mensaje = generarMensajeReactivacion(cliente, '20% de descuento');
  assert.ok(mensaje.includes('Carlos'));
  assert.ok(mensaje.includes('20% de descuento'));
  assert.ok(mensaje.includes('La Cascada'));
});