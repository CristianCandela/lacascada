// web/src/features/cliente/IngresarCodigo.jsx
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { validarCodigoCheckin } from './logica.js';
import './estilos.css';

export default function IngresarCodigo({ onAviso }) {
  const [codigo, setCodigo] = useState('');
  const [dentro, setDentro] = useState(false);
  const [cargando, setCargando] = useState(false);

  const handleCheckin = async (e) => {
    e.preventDefault();
    if (!validarCodigoCheckin(codigo)) {
      if (onAviso) onAviso('El código debe tener exactamente 6 dígitos numéricos.', 'error');
      return;
    }

    setCargando(true);
    try {
      const { data, error } = await supabase.rpc('checkin', { p_codigo: codigo });
      if (error) throw error;

      if (data?.ok) {
        setDentro(true);
        setCodigo('');
        if (onAviso) {
          onAviso(`¡Ingreso registrado correctamente! Sede: ${data.sede || 'Principal'}`, 'exito');
        }
      } else {
        if (onAviso) onAviso(data?.motivo || 'Error al validar el código', 'error');
      }
    } catch (err) {
      if (onAviso) onAviso(err.message || 'Error al validar el código', 'error');
    } finally {
      setCargando(false);
    }
  };

  const handleCheckout = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase.rpc('checkout');
      if (error) throw error;

      if (data?.ok) {
        setDentro(false);
        if (onAviso) onAviso('Salida registrada correctamente.', 'exito');
      } else {
        if (onAviso) onAviso(data?.motivo || 'Error al marcar salida', 'error');
      }
    } catch (err) {
      if (onAviso) onAviso(err.message || 'Error al marcar salida', 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="cli-contenedor">
      <div className="pag-cab">
        <div>
          <h1>Ingreso al Gimnasio</h1>
          <p className="ayuda">Ingresa el código de 6 dígitos que se muestra en la recepción del local.</p>
        </div>
      </div>

      <div className="tarjeta">
        {!dentro ? (
          <form onSubmit={handleCheckin} className="cli-form">
            <label className="cli-label">Código del local (6 dígitos):</label>
            <input
              type="text"
              maxLength={6}
              placeholder="123456"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="cli-input-codigo"
            />
            <button type="submit" disabled={cargando} className="cli-btn-primario">
              {cargando ? 'Verificando...' : 'Marcar Entrada'}
            </button>
          </form>
        ) : (
          <div className="cli-box-dentro">
            <p className="cli-texto-exito">Tienes una entrada activa en el gimnasio.</p>
            <button onClick={handleCheckout} disabled={cargando} className="cli-btn-peligro">
              {cargando ? 'Procesando...' : 'Marcar Salida'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}