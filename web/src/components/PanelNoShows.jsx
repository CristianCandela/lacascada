import { useEffect, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { aCSV, calcularPorcentajes, matrizCalor, pctNoShow, reduccionRecordatorio, serieDiaria } from '../lib/logica';
import Icono from './Iconos';
import { BarraTasa, BarrasDiarias, Dona, MapaCalor } from './Graficos';

function Kpi({ valor, unidad = '%', texto, titulo, icono, tono, clase, children }) {
  return (
    <div className={`kpi ${tono || ''}`}>
      <div className="kpi-cab"><span className="eti">{titulo}</span><span className="resumen-ico"><Icono n={icono} tam={20} /></span></div>
      <div className={`num ${clase || ''}`}>{valor}{valor === '—' ? '' : unidad}</div>
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
        .select('id_cita, id_cliente, servicio, sede, fecha_hora_cita, fecha_hora_registro, recordatorio_enviado_en, confirmada_en, estado_asistencia, segundos_registro')
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
  const rec = datos ? reduccionRecordatorio(datos.recordatorio) : null;
  const tiempo = datos && datos.tiempo_promedio_seg !== null && datos.tiempo_promedio_seg !== undefined
    ? Number(datos.tiempo_promedio_seg) : null;
  const completos = datos ? Number(datos.registros_completos) || 0 : 0;

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
            <Kpi titulo="Tiempo promedio de marcado" icono="reloj" tono="azul" unidad=" s"
              valor={tiempo === null ? '—' : tiempo}
              clase={tiempo !== null && tiempo <= 15 ? 'meta-ok' : ''}
              texto={tiempo === null ? 'Aún sin marcas con tiempo registrado' : `Meta ≤ 15 s (clic → guardado)`} />
            <Kpi titulo="Registros completos para APF3" icono="agenda" tono="verde" unidad=""
              valor={completos}
              clase={completos >= 100 ? 'meta-ok' : 'meta-mal'}
              texto={`Meta ≥ 100 (asistió / no asistió)`}>
              <div className="progreso" role="img" aria-label={`${completos} de 100 registros`}>
                <span className={completos >= 100 ? 'ok' : 'falta'} style={{ width: `${Math.min(completos, 100)}%` }} />
              </div>
            </Kpi>
            <Kpi titulo="Reducción con recordatorio" icono="whatsapp" tono="naranja"
              valor={rec.reduccion === null ? '—' : rec.reduccion}
              clase={rec.reduccion !== null && rec.reduccion >= 25 ? 'meta-ok' : ''}
              texto={rec.reduccion === null ? 'Faltan citas con y sin recordatorio' : 'Meta ≥ 25 % (relativa)'} />
          </div>

          <div className="desgloses fila-grafico">
            <section className="tarjeta">
              <h2>Asistencia por día</h2>
              <p className="ayuda graf-ayuda">Últimos 14 días. Muestra si el registro de recepción es constante.</p>
              <BarrasDiarias serie={serieDiaria(datos.por_dia, 14)} />
            </section>
            <section className="tarjeta">
              <h2>Estado de las citas</h2>
              <p className="ayuda graf-ayuda">Todas las citas del sistema.</p>
              <Dona partes={[
                { id: 'a', texto: 'Asistió', valor: datos.asistio, clase: 'g-verde-t', punto: 'verde' },
                { id: 'n', texto: 'No asistió', valor: datos.no_asistio, clase: 'g-naranja-t', punto: 'naranja' },
                { id: 'c', texto: 'Canceló', valor: datos.cancelo || 0, clase: 'g-gris-t', punto: 'gris' },
                { id: 'p', texto: 'Pendiente', valor: datos.pendiente || 0, clase: 'g-azul-t', punto: 'azul' }
              ]} />
            </section>
          </div>

          <section className="tarjeta">
            <h2>¿Cuándo faltan más los clientes?</h2>
            <p className="ayuda graf-ayuda">Hipótesis H2: ¿existe un patrón por día y hora? Es la base de las variables del modelo de APF3.</p>
            <MapaCalor matriz={matrizCalor(datos.por_dia_hora)} />
          </section>

          <div className="desgloses">
            <section className="tarjeta">
              <h2>Recordatorio por WhatsApp</h2>
              <p className="ayuda graf-ayuda">Hipótesis H4: citas con y sin recordatorio enviado.</p>
              <BarraTasa titulo="Con recordatorio" tasa={rec.tasa_con} no={datos.recordatorio.con_no} total={datos.recordatorio.con_total} clase="verde" />
              <BarraTasa titulo="Sin recordatorio" tasa={rec.tasa_sin} no={datos.recordatorio.sin_no} total={datos.recordatorio.sin_total} clase="naranja" />
              <p className="nota-panel">
                {rec.reduccion === null
                  ? 'Aún no hay suficientes citas en ambos grupos para comparar.'
                  : `Reducción relativa: ${rec.reduccion}%.`}
                {' '}Es una comparación observacional: el personal decide a quién recordar, así que no prueba causalidad por sí sola.
                {datos.recordatorio.con_total < 20 ? ' Con menos de 20 citas con recordatorio, tómala como indicio.' : ''}
              </p>
            </section>
            <section className="tarjeta">
              <h2>Clientes de alto riesgo</h2>
              <p className="ayuda graf-ayuda">Inasistencia ≥ 30 % en los últimos 30 días (mínimo 2 citas).</p>
              {(datos.clientes_riesgo || []).length === 0 && <p className="vacio">Ningún cliente cumple la regla por ahora.</p>}
              <ul className="lista-riesgo">
                {(datos.clientes_riesgo || []).map((c) => (
                  <li key={c.nombre}><span><b>{c.nombre}</b><small>{c.no_asistio} inasistencias de {c.total} citas</small></span><em className="etq riesgo">{c.tasa}%</em></li>
                ))}
              </ul>
            </section>
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
