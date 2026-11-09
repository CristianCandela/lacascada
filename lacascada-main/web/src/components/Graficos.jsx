// Gráficos en SVG/CSS puro (sin librerías): ligeros, accesibles y sin dependencias nuevas.
import { DIAS_SEMANA, FRANJAS } from '../lib/logica';

// ---------- Barras apiladas por día ----------
export function BarrasDiarias({ serie }) {
  const W = 520, H = 250, M = { t: 14, r: 8, b: 34, l: 28 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const max = Math.max(4, ...serie.map((d) => d.asistio + d.no_asistio + d.cancelo));
  const tope = Math.ceil(max / 4) * 4;
  const paso = iw / serie.length;
  const ancho = Math.min(24, paso * 0.64);
  const y = (v) => M.t + ih - (v / tope) * ih;
  const hay = serie.some((d) => d.asistio + d.no_asistio + d.cancelo > 0);
  const resumen = serie.map((d) => `${d.etiqueta}: ${d.asistio} asistieron, ${d.no_asistio} no asistieron, ${d.cancelo} cancelaron`).join('. ');

  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Asistencia por día. ${resumen}`} preserveAspectRatio="xMidYMid meet">
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (tope / 4) * i;
          return (
            <g key={i}>
              <line className="g-rejilla" x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
              <text className="g-eje" x={M.l - 6} y={y(v) + 4} textAnchor="end">{v}</text>
            </g>
          );
        })}
        {serie.map((d, i) => {
          const x = M.l + paso * i + (paso - ancho) / 2;
          let acum = 0;
          const tramos = [['g-verde', d.asistio, 'asistieron'], ['g-naranja', d.no_asistio, 'no asistieron'], ['g-gris', d.cancelo, 'cancelaron']];
          return (
            <g key={d.dia}>
              {tramos.map(([c, v, t]) => {
                if (!v) return null;
                const y0 = y(acum + v), h = y(acum) - y0;
                acum += v;
                return <rect key={c} className={c} x={x} y={y0} width={ancho} height={Math.max(h - 1, 1)} rx="2"><title>{`${d.etiqueta}: ${v} ${t}`}</title></rect>;
              })}
              {(serie.length - 1 - i) % 2 === 0 && (
                <text className="g-eje" x={x + ancho / 2} y={H - 12} textAnchor="middle">{d.etiqueta}</text>
              )}
            </g>
          );
        })}
        {!hay && <text className="g-eje" x={W / 2} y={H / 2} textAnchor="middle">Aún no hay citas en los últimos 14 días.</text>}
      </svg>
      <p className="leyenda"><span className="punto verde" />Asistió <span className="punto naranja" />No asistió <span className="punto gris" />Canceló</p>
    </div>
  );
}

// ---------- Dona de estados ----------
export function Dona({ partes }) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acum = 0;
  return (
    <div className="dona-wrap">
      <svg viewBox="0 0 140 140" className="dona" role="img"
        aria-label={`Estados de las citas: ${partes.map((p) => `${p.valor} ${p.texto}`).join(', ')}`}>
        <circle cx="70" cy="70" r={R} className="g-pista" fill="none" strokeWidth="18" />
        {total > 0 && partes.map((p) => {
          if (!p.valor) return null;
          const largo = (p.valor / total) * C;
          const el = (
            <circle key={p.id} cx="70" cy="70" r={R} fill="none" strokeWidth="18" className={p.clase}
              strokeDasharray={`${Math.max(largo - 2, 0.5)} ${C}`} strokeDashoffset={-acum} transform="rotate(-90 70 70)">
              <title>{`${p.texto}: ${p.valor}`}</title>
            </circle>
          );
          acum += largo;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" className="dona-num">{total}</text>
        <text x="70" y="86" textAnchor="middle" className="g-eje">citas</text>
      </svg>
      <ul className="dona-lista">
        {partes.map((p) => (
          <li key={p.id}><span className={`punto ${p.punto}`} />{p.texto}<b>{p.valor}</b>
            <small>{total ? Math.round((p.valor / total) * 100) : 0}%</small></li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Mapa de calor día x franja ----------
export function MapaCalor({ matriz }) {
  const hay = matriz.some((f) => f.some((c) => c.total > 0));
  const color = (pct) => (pct === null ? undefined : `rgba(242, 140, 40, ${Math.min(0.18 + (pct / 50) * 0.82, 1).toFixed(2)})`);
  if (!hay) return <p className="vacio">Aún no hay asistencias registradas.</p>;
  return (
    <div className="calor-wrap">
      <table className="calor" aria-label="Porcentaje de no-shows por día de la semana y franja horaria">
        <thead>
          <tr><th scope="col"><span className="sr">Día</span></th>{FRANJAS.map((f) => <th scope="col" key={f.id}>{f.texto}</th>)}</tr>
        </thead>
        <tbody>
          {matriz.map((fila, i) => (
            <tr key={DIAS_SEMANA[i]}>
              <th scope="row">{DIAS_SEMANA[i]}</th>
              {fila.map((c, j) => (
                <td key={FRANJAS[j].id} style={{ background: color(c.pct) }}
                  title={c.total ? `${c.no_asistio} de ${c.total} citas (${c.pct}%)` : 'Sin citas'}>
                  {c.total ? <><b>{c.pct}%</b><small>{c.no_asistio}/{c.total}</small></> : <span className="tenue">–</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="leyenda">Más oscuro = más no-shows. Cada celda muestra el % y las citas (no-shows/total).</p>
    </div>
  );
}

// ---------- Comparación con y sin recordatorio ----------
export function BarraTasa({ titulo, tasa, no, total, clase }) {
  return (
    <div className="barra-fila">
      <div className="barra-fila-cab"><b>{titulo}</b><span>{tasa === null ? 'Sin datos' : `${tasa}% no-show · ${no} de ${total}`}</span></div>
      <div className="barra-apilada" role="img" aria-label={`${titulo}: ${tasa === null ? 'sin datos' : tasa + '%'}`}>
        <span className={`tramo ${clase}`} style={{ width: `${Math.min(tasa || 0, 100)}%` }} />
      </div>
    </div>
  );
}
