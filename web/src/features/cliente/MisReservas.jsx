// web/src/features/cliente/MisReservas.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { etiquetaEstadoReserva, formatearFechaPe, claseBadgeEstado, politicaReembolso, HORAS_REEMBOLSO } from './logica';
import PagoSimulado from './PagoSimulado';
import './estilos.css';

export default function MisReservas({ perfil, onAviso }) {
  const [reservas, setReservas] = useState([]);
  const [sede, setSede] = useState('Túpac Amaru');
  const [fechaHora, setFechaHora] = useState('');
  const [cupos, setCupos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [pagando, setPagando] = useState(null); // reserva que se está pagando (ventana de pago)

  const cargarReservas = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('mis_reservas');
      if (error) throw error;
      const lista = Array.isArray(data) ? data : [];
      setReservas(lista);
      return lista;
    } catch (err) {
      if (onAviso) onAviso(err.message || 'No se pudieron cargar tus reservas.', 'error');
      return [];
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
        const lista = await cargarReservas();
        // El pago se ofrece de inmediato; si el cliente lo cierra, la reserva queda «por pagar».
        const nueva = lista.find((r) => r.id_cita === data);
        if (nueva && nueva.estado_pago === 'pendiente') setPagando(nueva);
      } else {
        if (onAviso) onAviso('No se pudo registrar la reserva.', 'error');
      }
    } catch (err) {
      if (onAviso) onAviso(err.message || 'No se pudo registrar la reserva.', 'error');
    } finally {
      setCargando(false);
    }
  };

  const handleCancelar = async (reserva) => {
    const pol = politicaReembolso(reserva);
    const soles = `S/ ${pol.monto.toFixed(2)}`;
    const pregunta = !pol.pagada
      ? '¿Cancelar esta reserva?'
      : pol.reembolsa
        ? `¿Cancelar esta reserva? Se te reembolsarán ${soles} por el mismo medio de pago.`
        : `Faltan menos de ${HORAS_REEMBOLSO} horas para tu turno: si cancelas, NO habrá reembolso de ${soles}. ¿Cancelar de todos modos?`;
    if (!window.confirm(pregunta)) return;
    setCargando(true);
    try {
      const { data, error } = await supabase.rpc('cancelar_reserva', {
        p_id_cita: reserva.id_cita
      });
      if (error) throw error;

      if (data?.ok) {
        if (onAviso) {
          onAviso(data.reembolso
            ? `Reserva cancelada. Te reembolsaremos S/ ${Number(data.monto).toFixed(2)} por el mismo medio de pago (reembolso simulado).`
            : data.monto != null
              ? `Reserva cancelada. Como faltaban menos de ${HORAS_REEMBOLSO} horas, el pago no se reembolsa.`
              : 'Reserva cancelada correctamente.', 'exito');
        }
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
                  {reserva.estado_pago === 'pendiente' && (reserva.estado_asistencia === 'pendiente') && (
                    <div className="cli-pago-nota" data-pago="pendiente">
                      Por pagar{reserva.tarifa_aplicada != null ? `: S/ ${Number(reserva.tarifa_aplicada).toFixed(2)}` : ''} · paga ahora en línea o en recepción al llegar
                    </div>
                  )}
                  {reserva.estado_pago === 'pagada' && reserva.tarifa_aplicada != null && reserva.estado_asistencia !== 'cancelo' && (
                    <div className="cli-pago-nota ok" data-pago="pagada">
                      Pagado: S/ {Number(reserva.tarifa_aplicada).toFixed(2)}
                      {reserva.estado_asistencia === 'pendiente' && <small> · reembolso si cancelas con {HORAS_REEMBOLSO} h o más de anticipación</small>}
                    </div>
                  )}
                  {reserva.estado_pago === 'reembolsada' && (
                    <div className="cli-pago-nota ok" data-pago="reembolsada">
                      Reembolsado: S/ {Number(reserva.tarifa_aplicada || 0).toFixed(2)} por el mismo medio de pago
                    </div>
                  )}
                  {reserva.estado_pago === 'pagada' && reserva.estado_asistencia === 'cancelo' && (
                    <div className="cli-pago-nota" data-pago="retenido">Cancelada con menos de {HORAS_REEMBOLSO} h de anticipación: el pago no se reembolsa</div>
                  )}
                </div>
                <div className="cli-acciones">
                  <span className={`cli-badge ${claseBadgeEstado(reserva.estado || reserva.estado_asistencia)}`}>
                    {etiquetaEstadoReserva(reserva.estado || reserva.estado_asistencia)}
                  </span>
                  {reserva.estado_pago === 'pendiente' && reserva.estado_asistencia === 'pendiente' && (
                    <button type="button" data-accion="pagar-reserva" className="cli-btn-primario cli-btn-pagar" disabled={cargando} onClick={() => setPagando(reserva)}>
                      Pagar ahora
                    </button>
                  )}
                  {(reserva.estado === 'pendiente' || reserva.estado_asistencia === 'pendiente') && (
                    <button
                      onClick={() => handleCancelar(reserva)}
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

      {pagando && (
        <PagoSimulado
          reserva={pagando}
          onCerrar={() => { setPagando(null); cargarReservas(); }}
          onPagado={() => { if (onAviso) onAviso('Pago registrado. ¡Gracias!', 'exito'); }}
        />
      )}
    </div>
  );
}