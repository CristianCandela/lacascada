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

  return (
    <div className="cli-contenedor">
      <div className="pag-cab">
        <div>
          <h1>Membresía de Gimnasio y Visitas</h1>
          <p className="ayuda">La membresía aplica al ingreso al gimnasio; el sauna funciona por reserva de turno.</p>
        </div>
      </div>

      <div className="tarjeta">
        <h2>Plan Actual</h2>
        {cargando ? (
          <p className="ayuda">Cargando información de tu membresía...</p>
        ) : membresia ? (
          <div className="cli-detalles-plan">
            <p><strong>Plan:</strong> {membresia.plan || 'Sin plan asignado'}</p>
            <p>
              <strong>Estado: </strong>
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
            </p>
            <p>
              <strong>Vigencia:</strong> {formatearFechaPe(membresia.inicio)} al {formatearFechaPe(membresia.fin)}
            </p>
            <p><strong>Días restantes:</strong> {diasRestantes} días</p>

            {porVencer && (
              <p className="cli-alerta-aviso" role="alert">
                Aviso: Tu membresía vence en {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}.
              </p>
            )}
          </div>
        ) : (
          <p className="ayuda">No se encontró información de membresía.</p>
        )}

        <div className="cli-pago-box">
          <h3>Pagar Membresía (máximo 1 vigente)</h3>
          {membresia?.vigente ? (
            <p className="ayuda">Ya cuentas con una membresía vigente. No puedes pagar otra membresía hasta que venza la actual.</p>
          ) : (
            <div className="cli-form-reserva">
              <label className="cli-label" htmlFor="cli-plan-select">Plan a pagar:</label>
              <select
                id="cli-plan-select"
                value={planSeleccionado}
                onChange={(e) => setPlanSeleccionado(e.target.value)}
                className="cli-input"
              >
                {planes.map((p) => (
                  <option key={p.id_plan} value={p.id_plan}>
                    {p.nombre} ({p.dias} días — S/ {Number(p.precio).toFixed(2)})
                  </option>
                ))}
              </select>

              <label className="cli-label" htmlFor="cli-medio-select">Opción de pago:</label>
              <select
                id="cli-medio-select"
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="cli-input"
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.etiqueta}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={pagando || (!planSeleccionado && !planes.length)}
                onClick={() => ejecutarPagoDirecto(planSeleccionado, metodoPago)}
                className="cli-btn-primario"
              >
                {pagando ? 'Pagando...' : `Pagar Membresía (${METODOS_PAGO.find((m) => m.id === metodoPago)?.etiqueta || 'Visa'})`}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <h2>Historial de Visitas Recientes</h2>
        {cargando ? (
          <p className="ayuda">Cargando historial...</p>
        ) : visitas.length > 0 ? (
          <ul className="cli-lista">
            {visitas.map((visita, idx) => (
              <li key={idx} className="cli-item-visita">
                <div>
                  <strong>Sede {visita.sede}</strong>
                  <div>Entrada: {formatearFechaPe(visita.entrada_en)}</div>
                  <div>Salida: {formatearFechaPe(visita.salida_en)}</div>
                </div>
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