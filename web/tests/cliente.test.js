import test from 'node:test';
import assert from 'node:assert/strict';
import { etiquetaEstadoReserva } from '../src/features/cliente/logica.js';

test('cliente: etiqueta de estado de reserva', () => {
  assert.equal(etiquetaEstadoReserva('pendiente'), 'Pendiente');
  assert.equal(etiquetaEstadoReserva('cancelo'), 'Cancelada');
  assert.equal(etiquetaEstadoReserva('otro'), 'Desconocido');
});
