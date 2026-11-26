import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { formatearFechaPe, etiquetaEstadoMembresia } from './logica';
import './estilos.css';

const METODOS_PAGO = [
  { id: 'visa', etiqueta: 'Visa' },
  { id: 'yape', etiqueta: 'Yape' },
  { id: 'plin', etiqueta: 'Plin' }
];

export default function MiMembresia({ onAviso }) {
  const [membresia, setMembresia] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [planSeleccionado, setPlanSeleccionado] = useState('');
  const [metodoPago, setMetodoPago] = useState('visa');
  const [visitas, setVisitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pagando, setPagando] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [resMembresia, resVisitas, resPlanes] = await Promise.all([
        supabase.rpc('mi_membresia'),
        supabase.rpc('mis_visitas', { p_limite: 20 }),
        supabase.from('planes').select('*')
      ]);

      const falla = [resMembresia, resVisitas, resPlanes].find((r) => r.error);
      if (falla) throw falla.error;

      if (resMembresia.data) setMembresia(resMembresia.data);
      setVisitas(Array.isArray(resVisitas.data) ? resVisitas.data : []);
      const activos = (resPlanes.data || []).filter((p) => p.activo !== false);
      setPlanes(activos);
      if (activos.length) {
        setPlanSeleccionado((prev) => prev || activos[0].id_plan);
      }
    } catch (err) {
      if (onAviso) onAviso(err.message || 'No se pudo cargar tu membresía.', 'error');
    } finally {
      setCargando(false);
    }
  }, [onAviso]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const ejecutarPagoDirecto = async (idPlan, medio) => {
    if (pagando) return;
    if (membresia?.vigente) {
      if (onAviso) onAviso('Ya tienes una membresía vigente. Solo se permite 1 membresía activa.', 'error');
      return;
    }

    const planAUsar = idPlan || planSeleccionado || planes[0]?.id_plan;
    const medioAUsar = medio || metodoPago || 'visa';
    if (!planAUsar) return;

    setPagando(true);
    try {
      const { data, error } = await supabase.rpc('pagar_membresia', {
        p_id_plan: planAUsar,
        p_medio: medioAUsar
      });
      if (error) throw error;
      if (!data?.ok) {
        if (onAviso) onAviso(data?.motivo || 'No se pudo procesar el pago.', 'error');
        return;
      }
      const etiquetaMedio = METODOS_PAGO.find((m) => m.id === medioAUsar)?.etiqueta || medioAUsar.toUpperCase();
      if (onAviso) {
        onAviso(`Membresía "${data.plan}" activada con ${etiquetaMedio} (${data.inicio} al ${data.fin}).`, 'exito');
      }
      await cargarDatos();
    } catch (err) {
      if (onAviso) onAviso(err.message || 'No se pudo procesar el pago.', 'error');
    } finally {
      setPagando(false);
    }
  };

  const diasRestantes = membresia?.dias_restantes ?? 0;
  const porVencer = Boolean(membresia?.vigente && diasRestantes <= 7);
  const etiquetaMedioActual = METODOS_PAGO.find((m) => m.id === metodoPago)?.etiqueta || 'Visa';

  return (
    <div className="cli-contenedor">
      <div className="pag-cab cli-pag-cab">
        <div>
          <h1>Membresía de Gimnasio y Visitas</h1>
          <p className="ayuda">La membresía aplica al ingreso al gimnasio; el sauna funciona por reserva de turno.</p>
        </div>
      </div>

      <div className="cli-grid-2">
        <div className="tarjeta">
          <div className="cli-membresia-cab">
            <h2 className="cli-membresia-titulo">Plan Actual</h2>
            {membresia && !cargando && (
              <span className="cli-dias-pill">
                {diasRestantes} {diasRestantes === 1 ? 'día restante' : 'días restantes'}
              </span>
            )}
          </div>

          {cargando ? (
            <p className="ayuda">Cargando información de tu membresía...</p>
          ) : membresia ? (
            <>
              <div className="cli-detalles-plan">
                <div className="cli-dato-card">
                  <span className="cli-dato-etiqueta">Plan</span>
                  <strong className="cli-dato-valor">{membresia.plan || 'Sin plan asignado'}</strong>
                </div>

                <div className="cli-dato-card">
                  <span className="cli-dato-etiqueta">Estado</span>
                  <div className="cli-dato-valor">
                    <span
                      className={`cli-badge ${
                        !membresia.vigente
                          ? 'cli-badge-cancelo'
                          : porVencer
                          ? 'cli-badge-pendiente'
                          : 'cli-badge-asistio'
                      }`}
                    >
                      {etiquetaEstadoMembresia(membresia.vigente, diasRestantes)}
                    </span>
                  </div>
                </div>

                <div className="cli-dato-card">
                  <span className="cli-dato-etiqueta">Vigencia</span>
                  <strong className="cli-dato-valor">
                    {formatearFechaPe(membresia.inicio)} al {formatearFechaPe(membresia.fin)}
                  </strong>
                </div>

                <div className="cli-dato-card">
                  <span className="cli-dato-etiqueta">Días restantes</span>
                  <strong className="cli-dato-valor">{diasRestantes} días</strong>
                </div>
              </div>

              {porVencer && (
                <p className="cli-alerta-aviso" role="alert">
                  Aviso: Tu membresía vence en {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}.
                </p>
              )}
            </>
          ) : (
            <p className="ayuda">No se encontró información de membresía.</p>
          )}
        </div>

        <div className="tarjeta cli-pago-box">
          <div className="cli-membresia-cab">
            <h2 className="cli-membresia-titulo">Pagar Membresía</h2>
            <span className="cli-badge cli-badge-neutro">Máx. 1 vigente</span>
          </div>

          {membresia?.vigente ? (
            <p className="ayuda">
              Ya cuentas con una membresía vigente. No puedes pagar otra membresía hasta que venza la actual.
            </p>
          ) : (
            <div className="cli-form-reserva cli-modal-form">
              <div>
                <label className="cli-label" htmlFor="cli-plan-select">Plan a pagar:</label>
                <select
                  id="cli-plan-select"
                  value={planSeleccionado}
                  onChange={(e) => setPlanSeleccionado(e.target.value)}
                  className="cli-input"
                  style={{ width: '100%' }}
                >
                  {planes.map((p) => (
                    <option key={p.id_plan} value={p.id_plan}>
                      {p.nombre} ({p.dias} días — S/ {Number(p.precio).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="cli-label" htmlFor="cli-medio-select">Opción de pago:</label>
                <select
                  id="cli-medio-select"
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="cli-input"
                  style={{ width: '100%' }}
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.etiqueta}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={pagando || (!planSeleccionado && !planes.length)}
                onClick={() => ejecutarPagoDirecto(planSeleccionado, metodoPago)}
                className="cli-btn-primario"
              >
                {pagando ? 'Pagando...' : `Pagar Membresía (${etiquetaMedioActual})`}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <div className="cli-membresia-cab">
          <h2 className="cli-membresia-titulo">Historial de Visitas Recientes</h2>
          <span className="cli-badge cli-badge-neutro">{visitas.length} registros</span>
        </div>

        {cargando ? (
          <p className="ayuda">Cargando historial...</p>
        ) : visitas.length > 0 ? (
          <ul className="cli-lista">
            {visitas.map((visita, idx) => (
              <li key={idx} className="cli-item-visita">
                <div className="cli-reserva-meta">
                  <span className="cli-reserva-titulo">Sede {visita.sede}</span>
                  <span className="cli-reserva-sub">Entrada: {formatearFechaPe(visita.entrada_en)}</span>
                  <span className="cli-reserva-sub">Salida: {formatearFechaPe(visita.salida_en)}</span>
                </div>
                <span className={`cli-badge ${visita.salida_en ? 'cli-badge-neutro' : 'cli-badge-asistio'}`}>
                  {visita.salida_en ? 'Completada' : 'En local'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ayuda">Aún no registras visitas en el gimnasio.</p>
        )}
      </div>
    </div>
  );
}