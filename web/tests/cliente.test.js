import test from 'node:test';
import assert from 'node:assert/strict';
import {
  etiquetaEstadoReserva,
  validarDatosRegistro,
  validarCodigoCheckin,
  calcularDiasRestantes,
  validarReservaSauna
} from '../src/features/cliente/logica.js';

test('CLI-LOGICA-1: Validaciones de autoregistro de cliente (HU-C1)', () => {
  // Caso exitoso (sin código de local)
  const ok = validarDatosRegistro({
    nombre: 'Juan Pérez',
    dni: '78901234',
    telefono: '987654321',
    consentimiento: true
  });
  assert.equal(ok.valido, true);

  // Error DNI inválido
  const errDni = validarDatosRegistro({
    nombre: 'Juan Pérez',
    dni: '123',
    telefono: '987654321',
    consentimiento: true
  });
  assert.equal(errDni.valido, false);
  assert.equal(errDni.motivo, 'El DNI debe tener 8 dígitos');

  // Error sin consentimiento
  const errConsent = validarDatosRegistro({
    nombre: 'Juan Pérez',
    dni: '78901234',
    telefono: '987654321',
    consentimiento: false
  });
  assert.equal(errConsent.valido, false);
});

test('CLI-LOGICA-2: Validación del formato de código de Check-in (HU-C2)', () => {
  assert.equal(validarCodigoCheckin('123456'), true);
  assert.equal(validarCodigoCheckin('12345'), false);
  assert.equal(validarCodigoCheckin('abcdef'), false);
});

test('CLI-LOGICA-3: Formato y etiquetas de estado de reservas de sauna (HU-C4)', () => {
  assert.equal(etiquetaEstadoReserva('pendiente'), 'Pendiente');
  assert.equal(etiquetaEstadoReserva('cancelo'), 'Cancelada');
  assert.equal(etiquetaEstadoReserva('asistio'), 'Asistió');
  assert.equal(etiquetaEstadoReserva('otro'), 'Desconocido');
});

test('CLI-LOGICA-4: Cálculo de días restantes de membresía (HU-C5)', () => {
  const hoy = new Date();
  
  const enCincoDiasObj = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 5);
  const yyyy = enCincoDiasObj.getFullYear();
  const mm = String(enCincoDiasObj.getMonth() + 1).padStart(2, '0');
  const dd = String(enCincoDiasObj.getDate()).padStart(2, '0');
  const enCincoDias = `${yyyy}-${mm}-${dd}`;
  
  assert.equal(calcularDiasRestantes(enCincoDias), 5);

  const pasadaObj = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 2);
  const yyyyP = pasadaObj.getFullYear();
  const mmP = String(pasadaObj.getMonth() + 1).padStart(2, '0');
  const ddP = String(pasadaObj.getDate()).padStart(2, '0');
  const pasada = `${yyyyP}-${mmP}-${ddP}`;
  
  assert.equal(calcularDiasRestantes(pasada), 0);
});

const FECHA_FUTURA = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + 'T10:00:00';
const FECHA_PASADA = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10) + 'T10:00:00';

test('CLI-LOGICA-5: Validación de reglas de negocio al reservar sauna (HU-C3)', () => {
  // Permite reservar sauna sin requerir membresía activa de gimnasio
  const sinMembresia = validarReservaSauna({
    fechaHora: FECHA_FUTURA,
    membresiaVigente: false
  });
  assert.equal(sinMembresia.valido, true);

  // Rechaza reserva sin fecha u hora
  const sinFecha = validarReservaSauna({
    fechaHora: ''
  });
  assert.equal(sinFecha.valido, false);
  assert.equal(sinFecha.motivo, 'Debe seleccionar una fecha y hora');

  // Rechaza reserva en fecha pasada
  const pasada = validarReservaSauna({
    fechaHora: FECHA_PASADA
  });
  assert.equal(pasada.valido, false);
  assert.equal(pasada.motivo, 'No puede reservar en una fecha u hora pasada');
});