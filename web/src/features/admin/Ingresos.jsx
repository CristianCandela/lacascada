// Ingresos (solo administrador): total recaudado, por medio de pago, por concepto y por día.
// Se actualiza solo: un pago hecho por el cliente en línea aparece aquí sin recargar.
import { useCallback, useEffect, useState } from 'react';
import { supabase, mensajeError } from '../../lib/supabase';
import Icono from '../../components/Iconos';
import './ingresos.css';

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const PERIODOS = [[1, 'Hoy'], [7, '7 días'], [30, '30 días'], [90, '90 días']];
const MEDIOS = [['visa', 'Visa', '#1A4FA0'], ['yape', 'Yape', '#7B2D8E'], ['plin', 'Plin', '#0FB5C8'], ['efectivo', 'Efectivo', '#16A34A']];
const CONCEPTOS = [['membresia', 'Membresías'], ['sauna', 'Sauna'], ['pase_dia', 'Pases del día']];
const etiquetaDia = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });

export default function Ingresos({ perfil, onAviso }) {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState(null);
  const [hora, setHora] = useState(null);
  const admin = perfil && perfil.rol === 'administrador';

  const cargar = useCallback(async () => {
    if (!admin) return;
    const r = await supabase.rpc('ingresos_resumen', { p_dias: dias });
    if (r.error) { onAviso && onAviso(mensajeError(r.error)); return; }
    onAviso && onAviso('');
    setD(r.data); setHora(new Date());
  }, [dias, admin, onAviso]);

  useEffect(() => { setD(null); cargar(); }, [cargar]);
  useEffect(() => {
    if (!admin) return undefined;
    const t = setInterval(() => { if (!document.hidden) cargar(); }, 20000);
    return () => clearInterval(t);
  }, [cargar, admin]);

  if (!admin) return <div className="pag-cab"><div><h1>Ingresos</h1><p className="ayuda">Acceso denegado: esta pantalla es solo para el administrador.</p></div></div>;

  const total = d ? Number(d.total) : 0;
  const maxDia = d ? Math.max(1, ...d.por_dia.map((x) => Number(x.total))) : 1;
  const paso = d && d.por_dia.length > 31 ? 7 : d && d.por_dia.length > 14 ? 3 : 1;
  const pct = (v) => (total ? Math.round((Number(v) / total) * 100) : 0);

  return (
    <div className="ing">
      <div className="pag-cab">
        <div>
          <h1>Ingresos</h1>
          <p className="ayuda">Todo lo recaudado, sin pagos anulados. Los pagos en línea de los clientes aparecen solos{hora ? ` · actualizado ${hora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}` : ''}.</p>
        </div>
        <div className="ing-seg" role="group" aria-label="Periodo">
          {PERIODOS.map(([n, t]) => (
            <button key={n} type="button" data-dias={n} aria-pressed={dias === n} onClick={() => setDias(n)}>{t}</button>
          ))}
        </div>
      </div>

      {!d && <p className="vacio">Cargando ingresos…</p>}
      {d && (
        <>
          <div className="kpis">
            <div className="kpi verde" data-kpi="total">
              <div className="kpi-cab"><span className="eti">Total recaudado</span><span className="resumen-ico"><Icono n="grafico" tam={20} /></span></div>
              <div className="num">{soles(d.total)}</div>
              <div className="det">{d.dias === 1 ? 'Hoy' : `Últimos ${d.dias} días`}</div>
            </div>
            <div className="kpi azul">
              <div className="kpi-cab"><span className="eti">Pagos registrados</span><span className="resumen-ico"><Icono n="check" tam={20} /></span></div>
              <div className="num">{d.n_pagos}</div>
              <div className="det">Ticket promedio {soles(d.n_pagos ? total / d.n_pagos : 0)}</div>
            </div>
            <div className="kpi naranja" data-kpi="por-cobrar">
              <div className="kpi-cab"><span className="eti">Por cobrar (sauna)</span><span className="resumen-ico"><Icono n="reloj" tam={20} /></span></div>
              <div className="num">{soles(d.por_cobrar.monto)}</div>
              <div className="det">{d.por_cobrar.n} {d.por_cobrar.n === 1 ? 'reserva sin pagar' : 'reservas sin pagar'}</div>
            </div>
          </div>

          <div className="ing-dos">
            <section className="tarjeta">
              <h2>Por medio de pago</h2>
              {MEDIOS.map(([k, t, c]) => (
                <div className="ing-fila" key={k} data-medio={k}>
                  <div className="ing-fila-cab"><b><i style={{ background: c }} />{t}</b><span>{soles(d.por_medio[k])} · {pct(d.por_medio[k])} %</span></div>
                  <div className="ing-pista"><span style={{ width: `${pct(d.por_medio[k])}%`, background: c }} /></div>
                </div>
              ))}
            </section>
            <section className="tarjeta">
              <h2>Por concepto</h2>
              {CONCEPTOS.map(([k, t]) => (
                <div className="ing-fila" key={k} data-concepto={k}>
                  <div className="ing-fila-cab"><b>{t}</b><span>{soles(d.por_concepto[k])} · {pct(d.por_concepto[k])} %</span></div>
                  <div className="ing-pista"><span style={{ width: `${pct(d.por_concepto[k])}%` }} /></div>
                </div>
              ))}
            </section>
          </div>

          <section className="tarjeta">
            <h2>Ingresos por día</h2>
            {total === 0 && <p className="vacio">Aún no hay pagos en este periodo.</p>}
            <div className="ing-barras" role="img" aria-label={`Ingresos por día, total ${soles(d.total)}`}>
              {d.por_dia.map((x, i) => (
                <div className="ing-col" key={x.dia} title={`${etiquetaDia(x.dia)}: ${soles(x.total)}`}>
                  <span className="ing-valor">{Number(x.total) > 0 && d.por_dia.length <= 14 ? Math.round(x.total) : ''}</span>
                  <i style={{ height: `${Math.max(Number(x.total) > 0 ? 4 : 0, (Number(x.total) / maxDia) * 100)}%` }} />
                  <small>{(d.por_dia.length - 1 - i) % paso === 0 ? etiquetaDia(x.dia) : ''}</small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
