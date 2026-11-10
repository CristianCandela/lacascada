// web/src/features/cliente/MiMembresia.jsx
import React, { useState, useEffect } from 'react';
import { mock } from './mock';
import { formatearFechaPe } from './logica';
import './estilos.css';

export default function MiMembresia() {
  const [membresia, setMembresia] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      setCargando(true);
      const resMembresia = await mock.rpc.mi_membresia();
      const resVisitas = await mock.rpc.mis_visitas({ p_limite: 10 });

      if (resMembresia?.data) setMembresia(resMembresia.data);
      if (resVisitas?.data) setVisitas(resVisitas.data);
      setCargando(false);
    }
    cargarDatos();
  }, []);

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
              <span className={`cli-badge ${membresia.vigente ? 'cli-badge-asistio' : 'cli-badge-cancelo'}`}>
                {membresia.vigente ? 'Vigente' : 'Vencida'}
              </span>
            </p>
            <p><strong>Vigencia:</strong> {membresia.inicio || '-'} al {membresia.fin || '-'}</p>
            <p><strong>Días restantes:</strong> {membresia.dias_restantes ?? 0} días</p>
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