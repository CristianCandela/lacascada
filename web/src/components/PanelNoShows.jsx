import { useEffect, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { aCSV, calcularPorcentajes, pctNoShow } from '../lib/logica';
import Icono from './Iconos';

function Kpi({ valor, texto, titulo, icono, tono, clase, children }) {
  return (
    <div className={`kpi ${tono || ''}`}>
      <div className="kpi-cab"><span className="eti">{titulo}</span><span className="resumen-ico"><Icono n={icono} tam={20} /></span></div>
      <div className={`num ${clase || ''}`}>{valor}%</div>
      <div className="det">{texto}</div>
      {children}
    </div>
  );
}

function Desglose({ titulo, filas }) {
  return (
    <div className="tarjeta desglose">
      <h2>{titulo}</h2>
      <p className="leyenda"><span className="punto verde" />Asistió <span className="punto naranja" />No asistió</p>
      {(filas || []).length === 0 && <p className="vacio">Aún no hay asistencias registradas.</p>}
      {(filas || []).map((x) => {
        const tot = (x.asistio || 0) + (x.no_asistio || 0);
        const pa = tot ? (x.asistio / tot) * 100 : 0;
        return (
          <div className="barra-fila" key={x.clave}>
            <div className="barra-fila-cab">
              <b>{x.clave.charAt(0).toUpperCase() + x.clave.slice(1)}</b>
              <span>{pctNoShow(x)}% no-show · {x.no_asistio} de {tot}</span>
            </div>
            <div className="barra-apilada" role="img" aria-label={`${x.asistio} asistieron y ${x.no_asistio} no asistieron`}>
              <span className="tramo verde" style={{ width: `${pa}%` }} />
              <span className="tramo naranja" style={{ width: tot ? `${100 - pa}%` : '0%' }} />
            </div>
          </div>
        );
      })}
    </div>
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
        .select('id_cita, id_cliente, servicio, sede, fecha_hora_cita, fecha_hora_registro, recordatorio_enviado_en, confirmada_en, estado_asistencia')
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
      <>
        <div className="pag-cab"><div><h1>Panel de no-shows</h1></div></div>
        <div className="tarjeta">
          <p className="error-grande" role="alert"><Icono n="escudo" tam={22} />Acceso denegado: este panel es solo para el administrador.</p>
        </div>
      </>
    );
  }

  const p = datos ? calcularPorcentajes(datos) : null;
  const metaOk = p && p.pct_registro >= 90;

  return (
    <>
      <div className="pag-cab">
        <div>
          <h1>Panel de no-shows</h1>
          <p className="ayuda">Inasistencias sin aviso, por servicio y por sede.</p>
        </div>
        {datos && (
          <button type="button" id="btn-csv" className="sec" onClick={descargar}>
            <Icono n="descargar" tam={16} />Descargar CSV (sin datos personales)
          </button>
        )}
      </div>
      {!datos && <p className="vacio">Cargando…</p>}
      {datos && (
        <>
          <div className="kpis">
            <Kpi titulo="Tasa de no-shows" icono="x" tono="naranja" valor={p.pct_no_show}
              texto={`${datos.no_asistio} de ${p.registradas} citas registradas`} />
            <Kpi titulo="Asistencia" icono="check" tono="verde" valor={p.pct_asistencia}
              texto={`${datos.asistio} de ${p.registradas} citas registradas`} />
            <Kpi titulo="Citas vencidas con asistencia registrada" icono="agenda" tono="azul" valor={p.pct_registro}
              clase={metaOk ? 'meta-ok' : 'meta-mal'}
              texto={`Meta ≥ 90%: ${metaOk ? 'cumplida' : 'no cumplida'}`}>
              <div className="progreso" role="img" aria-label={`${p.pct_registro}% de la meta del 90%`}>
                <span className={metaOk ? 'ok' : 'falta'} style={{ width: `${Math.min(p.pct_registro, 100)}%` }} />
                <i style={{ left: '90%' }} title="Meta 90%" />
              </div>
            </Kpi>
          </div>
          <div className="desgloses">
            <Desglose titulo="Por servicio" filas={datos.por_servicio} />
            <Desglose titulo="Por sede" filas={datos.por_sede} />
          </div>
        </>
      )}
    </>
  );
}
