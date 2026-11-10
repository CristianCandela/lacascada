// web/src/features/cliente/MisReservas.jsx
import React, { useState, useEffect } from 'react';
import { mock } from './mock';
import { etiquetaEstadoReserva, formatearFechaPe, claseBadgeEstado } from './logica';
import './estilos.css';

export default function MisReservas({ perfil, onAviso }) {
  const [reservas, setReservas] = useState([]);
  const [sede, setSede] = useState('Principal');
  const [fechaHora, setFechaHora] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargarReservas = async () => {
    const res = await mock.rpc.mis_reservas();
    if (res?.data) {
      setReservas(res.data);
    }
  };

  useEffect(() => {
    cargarReservas();
  }, []);

  const handleReservar = async (e) => {
    e.preventDefault();
    if (!fechaHora) {
      if (onAviso) onAviso('Selecciona una fecha y hora para tu reserva.', 'error');
      return;
    }

    setCargando(true);
    const res = await mock.rpc.reservar_sauna({ p_sede: sede, p_fecha_hora: fechaHora });
    setCargando(false);

    if (res?.data) {
      if (onAviso) onAviso('¡Reserva de sauna agendada con éxito!', 'exito');
      setFechaHora('');
      cargarReservas();
    } else {
      if (onAviso) onAviso(res?.error?.message || 'No se pudo registrar la reserva.', 'error');
    }
  };

  const handleCancelar = async (idCita) => {
    setCargando(true);
    const res = await mock.rpc.cancelar_reserva({ p_id_cita: idCita });
    setCargando(false);

    if (res?.data?.ok) {
      if (onAviso) onAviso('Reserva cancelada correctamente.', 'exito');
      cargarReservas();
    } else {
      if (onAviso) onAviso(res?.data?.motivo || 'Error al cancelar reserva.', 'error');
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
            <option value="Principal">Sede Principal (Av. Túpac Amaru 6912)</option>
            <option value="Santa Rosa">Sede Santa Rosa (Av. Túpac Amaru 1857)</option>
          </select>

          <label className="cli-label">Fecha y Hora:</label>
          <input
            type="datetime-local"
            value={fechaHora}
            onChange={(e) => setFechaHora(e.target.value)}
            className="cli-input"
          />

          <button type="submit" disabled={cargando} className="cli-btn-primario">
            {cargando ? 'Agendando...' : 'Agendar Turno'}
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
                  <strong>{reserva.servicio || 'Sauna'}</strong> — Sede {reserva.sede}
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