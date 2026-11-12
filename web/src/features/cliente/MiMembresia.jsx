// web/src/features/cliente/MiMembresia.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatearFechaPe, etiquetaEstadoMembresia } from './logica';
import './estilos.css';

export default function MiMembresia({ onAviso }) {
  const [membresia, setMembresia] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);
      try {
        const [resMembresia, resVisitas] = await Promise.all([
          supabase.rpc('mi_membresia'),
          supabase.rpc('mis_visitas', { p_limite: 20 })
        ]);

        const falla = [resMembresia, resVisitas].find((r) => r.error);
        if (falla) throw falla.error;

        if (resMembresia.data) setMembresia(resMembresia.data);
        setVisitas(Array.isArray(resVisitas.data) ? resVisitas.data : []);
      } catch (err) {
        if (onAviso) onAviso(err.message || 'No se pudo cargar tu membresía.', 'error');
      } finally {
        setCargando(false);
      }
    }
    cargarDatos();
  }, [onAviso]);

  const diasRestantes = membresia?.dias_restantes ?? 0;
  const porVencer = Boolean(membresia?.vigente && diasRestantes <= 7);

  return (
    <div className="cli-contenedor">
      <div className="pag-cab">
        <div>
          <h1>Mi Membresía y Visitas</h1>
          <p className="ayuda">Consulta el estado actual de tu plan e historial de asistencias.</p>
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
                Aviso: Tu membresía vence en {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}. Acércate a recepción para renovarla.
              </p>
            )}
          </div>
        ) : (
          <p className="ayuda">No se encontró información de membresía.</p>
        )}
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