// web/src/features/cliente/MisReservas.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { etiquetaEstadoReserva, formatearFechaPe, claseBadgeEstado } from './logica';
import './estilos.css';

export default function MisReservas({ perfil, onAviso }) {
  const [reservas, setReservas] = useState([]);
  const [sede, setSede] = useState('Túpac Amaru');
  const [fechaHora, setFechaHora] = useState('');
  const [cupos, setCupos] = useState(null);
  const [cargando, setCargando] = useState(false);

  const cargarReservas = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('mis_reservas');
      if (error) throw error;
      setReservas(Array.isArray(data) ? data : []);
    } catch (err) {
      if (onAviso) onAviso(err.message || 'No se pudieron cargar tus reservas.', 'error');
    }
  }, [onAviso]);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  // Consulta disponibilidad de sauna en tiempo real al elegir sede y fecha/hora (HU-C3)
  useEffect(() => {
    let activo = true;
    if (!fechaHora) {
      setCupos(null);
      return;
    }

    async function consultarDisponibilidad() {
      const fechaObj = new Date(fechaHora);
      if (Number.isNaN(fechaObj.getTime())) {
        setCupos(null);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('disponibilidad', {
          p_servicio: 'sauna',
          p_sede: sede,
          p_fecha_hora: fechaObj.toISOString()
        });
        if (!activo) return;
        if (error) {
          setCupos(null);
          return;
        }
        setCupos(data || null);
      } catch {
        if (activo) setCupos(null);
      }
    }

    consultarDisponibilidad();
    return () => {
      activo = false;
    };
  }, [sede, fechaHora]);

  const tieneAforo = Boolean(cupos && Number(cupos.capacidad) > 0);
  const turnoLleno = Boolean(tieneAforo && Number(cupos.libres) <= 0);

  const handleReservar = async (e) => {
    e.preventDefault();
    if (!fechaHora) {
      if (onAviso) onAviso('Selecciona una fecha y hora para tu reserva.', 'error');
      return;
    }
    if (turnoLleno) {
      if (onAviso) onAviso('El turno seleccionado ya no tiene cupos libres.', 'error');
      return;
    }

    const fechaObj = new Date(fechaHora);
    if (Number.isNaN(fechaObj.getTime())) {
      if (onAviso) onAviso('Fecha u hora inválida.', 'error');
      return;
    }

    setCargando(true);
    try {
      const { data, error } = await supabase.rpc('reservar_sauna', {
        p_sede: sede,
        p_fecha_hora: fechaObj.toISOString()
      });
      if (error) throw error;

      if (data) {
        if (onAviso) onAviso('¡Reserva de sauna agendada con éxito!', 'exito');
        setFechaHora('');
        setCupos(null);
        await cargarReservas();
      } else {
        if (onAviso) onAviso('No se pudo registrar la reserva.', 'error');
      }
    } catch (err) {
      if (onAviso) onAviso(err.message || 'No se pudo registrar la reserva.', 'error');
    } finally {
      setCargando(false);
    }
  };

  const handleCancelar = async (idCita) => {
    setCargando(true);
    try {
      const { data, error } = await supabase.rpc('cancelar_reserva', {
        p_id_cita: idCita
      });
      if (error) throw error;

      if (data?.ok) {
        if (onAviso) onAviso('Reserva cancelada correctamente.', 'exito');
        await cargarReservas();
      } else {
        if (onAviso) onAviso(data?.motivo || 'Error al cancelar reserva.', 'error');
      }
    } catch (err) {
      if (onAviso) onAviso(err.message || 'Error al cancelar reserva.', 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="cli-contenedor">
      <div className="pag-cab">
        <div>
          <h1>Reservas de Sauna</h1>
          <p className="ayuda">Agenda y administra tus turnos de sauna en nuestras sedes.</p>
        </div>
      </div>

      <div className="tarjeta">
        <h2>Nueva Reserva</h2>
        <form onSubmit={handleReservar} className="cli-form-reserva">
          <label className="cli-label">Sede:</label>
          <select value={sede} onChange={(e) => setSede(e.target.value)} className="cli-input">
            <option value="Túpac Amaru">Sede Túpac Amaru (Av. Túpac Amaru 6912)</option>
            <option value="Santa Rosa">Sede Santa Rosa (Av. Túpac Amaru 1857)</option>
          </select>

          <label className="cli-label">Fecha y Hora:</label>
          <input
            type="datetime-local"
            value={fechaHora}
            onChange={(e) => setFechaHora(e.target.value)}
            className="cli-input"
          />

          {tieneAforo && (
            <p className="ayuda" role="status">
              {turnoLleno
                ? 'Turno lleno (0 cupos disponibles).'
                : `Cupos libres para sauna: ${cupos.libres} de ${cupos.capacidad}`}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando || turnoLleno}
            className="cli-btn-primario"
          >
            {cargando ? 'Agendando...' : turnoLleno ? 'Turno lleno' : 'Agendar Turno'}
          </button>
        </form>
      </div>

      <div className="tarjeta">
        <h2>Mis Turnos Agendados</h2>
        {reservas.length > 0 ? (
          <ul className="cli-lista">
            {reservas.map((reserva) => (
              <li key={reserva.id_cita} className="cli-item-reserva">
                <div>
                  <strong>
                    {reserva.servicio
                      ? reserva.servicio.charAt(0).toUpperCase() + reserva.servicio.slice(1)
                      : 'Sauna'}
                  </strong>{' '}
                  — Sede {reserva.sede}
                  <div>{formatearFechaPe(reserva.fecha_hora_cita || reserva.fecha_hora)}</div>
                </div>
                <div className="cli-acciones">
                  <span className={`cli-badge ${claseBadgeEstado(reserva.estado || reserva.estado_asistencia)}`}>
                    {etiquetaEstadoReserva(reserva.estado || reserva.estado_asistencia)}
                  </span>
                  {(reserva.estado === 'pendiente' || reserva.estado_asistencia === 'pendiente') && (
                    <button
                      onClick={() => handleCancelar(reserva.id_cita)}
                      disabled={cargando}
                      className="cli-btn-cancelar"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ayuda">No tienes reservas registradas.</p>
        )}
      </div>
    </div>
  );
}