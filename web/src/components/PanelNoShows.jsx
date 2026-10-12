import { useEffect, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { aCSV, calcularPorcentajes, pctNoShow } from '../lib/logica';

function Kpi({ valor, texto, clase }) {
  return (
    <div className="kpi">
      <div className={`num ${clase || ''}`}>{valor}%</div>
      <div className="eti">{texto}</div>
    </div>
  );
}

function TablaDesglose({ titulo, columna, filas }) {
  return (
    <>
      <h3>{titulo}</h3>
      <div className="tabla-wrap">
        <table>
          <thead><tr><th>{columna}</th><th>Asistió</th><th>No asistió</th><th>% no-show</th></tr></thead>
          <tbody>
            {(filas || []).map((x) => (
              <tr key={x.clave}><td>{x.clave}</td><td>{x.asistio}</td><td>{x.no_asistio}</td><td>{pctNoShow(x)}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PanelNoShows({ perfil, onAviso }) {
  const [datos, setDatos] = useState(null);
  const esAdmin = perfil.rol === 'administrador';

  useEffect(() => {
    if (!esAdmin) return;
    let vivo = true;
    (async () => {
      try {
        const r = await supabase.rpc('resumen_no_shows');
        if (r.error) throw r.error;
        if (vivo) { onAviso(''); setDatos(r.data); }
      } catch (e) {
        if (vivo) onAviso(mensajeError(e));
      }
    })();
    return () => { vivo = false; };
  }, [esAdmin, onAviso]);

  async function descargar() {
    try {
      const r = await supabase.from('citas')
        .select('id_cita, id_cliente, servicio, sede, fecha_hora_cita, fecha_hora_registro, estado_asistencia')
        .order('fecha_hora_cita');
      if (r.error) throw r.error;
      const blob = new Blob([aCSV(r.data || [])], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'citas_lacascada.csv';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { onAviso(mensajeError(e)); }
  }

  if (!esAdmin) {
    return (
      <div className="tarjeta">
        <h2>Panel de no-shows</h2>
        <p className="error" role="alert">Acceso denegado: este panel es solo para el administrador.</p>
      </div>
    );
  }

  const p = datos ? calcularPorcentajes(datos) : null;
  const metaOk = p && p.pct_registro >= 90;

  return (
    <div className="tarjeta">
      <h2>Panel de no-shows</h2>
      {!datos && <p className="ayuda">Cargando…</p>}
      {datos && (
        <>
          <div className="kpis">
            <Kpi valor={p.pct_no_show} texto={`de no-shows (${datos.no_asistio} de ${p.registradas} citas registradas)`} />
            <Kpi valor={p.pct_asistencia} texto="de asistencia" />
            <Kpi valor={p.pct_registro} clase={metaOk ? 'meta-ok' : 'meta-mal'}
              texto={`de citas vencidas con asistencia registrada (meta ≥ 90%: ${metaOk ? 'cumplida' : 'no cumplida'})`} />
          </div>
          <TablaDesglose titulo="Por servicio" columna="servicio" filas={datos.por_servicio} />
          <TablaDesglose titulo="Por sede" columna="sede" filas={datos.por_sede} />
          <button type="button" id="btn-csv" className="sec" onClick={descargar}>
            Descargar CSV (sin datos personales)
          </button>
        </>
      )}
    </div>
  );
}
