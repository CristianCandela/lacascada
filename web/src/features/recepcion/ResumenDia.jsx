import { useCallback, useEffect, useState } from 'react';
import './estilos.css';
import { supabase, mensajeError } from '../../lib/supabase';
import Icono from '../../components/Iconos';
import SedeSelector from './SedeSelector';
import { sedeGuardada, guardarSede } from './sede';
import { tasaNoShow, porcentaje } from './logica';

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function ResumenDia({ onAviso }) {
  const [sede, setSede] = useState(sedeGuardada());
  const [d, setD] = useState(null);
  const [ok, setOk] = useState('');
  const aviso = (m) => onAviso && onAviso(m);

  const cargar = useCallback(async () => {
    const r = await supabase.rpc('resumen_completo', { p_sede: sede });
    if (r.error) { aviso(mensajeError(r.error)); return; }
    setD(r.data); aviso('');
  }, [sede]);
  useEffect(() => { cargar(); }, [cargar]);

  async function marcar(c, asistio) {
    const r = asistio
      ? await supabase.rpc('checkin_manual', { p_id_cliente: c.id_cliente, p_servicio: 'sauna', p_id_cita: c.id_cita, p_sede: sede })
      : await supabase.from('citas').update({ estado_asistencia: 'no_asistio' }).eq('id_cita', c.id_cita);
    if (r.error) { aviso(mensajeError(r.error)); return; }
    setOk(asistio ? `Asistencia registrada: ${c.nombre}.` : `${c.nombre} marcado como no asistió.`);
    cargar();
  }

  if (!d) return <p className="vacio">Cargando resumen…</p>;
  const c = d.cobros;
  const total = c.efectivo + c.yape + c.plin;
  const tasa = tasaNoShow(d.sauna.asistio, d.sauna.no_asistio);
  const maxH = Math.max(1, ...d.por_hora.map((x) => x.cuenta));
  const pico = d.por_hora.reduce((m, x) => (x.cuenta > (m ? m.cuenta : 0) ? x : m), null);

  return (
    <div className="rec-pagina">
      <header className="rec-cab-pag">
        <div><h1>Resumen del día</h1><p>Cuadre de caja, asistencia y flujo de entradas. Revisa las citas sin check-in antes de cerrar.</p></div>
        <SedeSelector sede={sede} onCambiar={(s) => { setSede(s); guardarSede(s); }} />
      </header>

      {d.sin_checkin.length > 0 && <p className="rec-aviso-amarillo">Hay {d.sin_checkin.length} cita(s) pagada(s) sin check-in. Regularízalas antes de cerrar.</p>}
      {ok && <p className="rec-exito" role="status">{ok}</p>}

      <section className="rec-franja rec-franja4">
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="usuarios" tam={22} /></span><div><small>Entradas al gimnasio</small><strong>{d.entradas}</strong> <em>{porcentaje(d.por_codigo, d.entradas)} % por código</em></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="bandeja" tam={22} /></span><div><small>Total recaudado</small><strong>{soles(total)}</strong></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="sauna" tam={22} /></span><div><small>Sauna: asistieron</small><strong>{d.sauna.asistio}</strong> <em>{d.sauna.pendientes} pendientes</em></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="x" tam={22} /></span><div><small>No-shows de sauna</small><strong>{d.sauna.no_asistio}</strong> <em>tasa {tasa} %</em></div></div>
      </section>

      <div className="rec-trabajo">
        <div className="rec-col">
          <section className="rec-panel">
            <div className="rec-bloque-cab"><h3>Cuadre de caja</h3><span className="rec-etiqueta">{c.anulados} ANULADO(S)</span></div>
            {[['Efectivo', c.efectivo, c.n_efectivo], ['Yape', c.yape, c.n_yape], ['Plin', c.plin, c.n_plin]].map(([n, m, k]) => (
              <div key={n} className="rec-bloque rec-fila-caja">
                <div><strong>{n}</strong><small>{k} operación(es)</small></div>
                <div style={{ textAlign: 'right' }}><strong className="rec-num">{soles(m)}</strong><small>{porcentaje(m, total)} %</small></div>
              </div>
            ))}
            <div className="rec-total"><small>TOTAL RECAUDADO</small><strong className="rec-num">{soles(total)}</strong><span>Efectivo + Yape + Plin, sin pagos anulados</span></div>
            <div className="rec-franja" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="rec-bloque"><small>Membresías</small><strong className="rec-num">{soles(c.membresia)}</strong></div>
              <div className="rec-bloque"><small>Pases del día</small><strong className="rec-num">{soles(c.pase_dia)}</strong></div>
              <div className="rec-bloque"><small>Sauna</small><strong className="rec-num">{soles(c.sauna)}</strong></div>
            </div>
          </section>

          <section className="rec-panel">
            <div className="rec-bloque-cab"><h3>Entradas por hora</h3>{pico && <span className="rec-etiqueta">PICO {String(pico.hora).padStart(2, '0')}:00 · {pico.cuenta}</span>}</div>
            {d.por_hora.length === 0 && <p className="rec-nota">Aún no hay entradas hoy.</p>}
            <div className="rec-barras">
              {d.por_hora.map((x) => (
                <div key={x.hora} className="rec-barra-col">
                  <span className="rec-num">{x.cuenta}</span>
                  <i style={{ height: `${Math.round((x.cuenta / maxH) * 100)}%` }} />
                  <small>{String(x.hora).padStart(2, '0')}:00</small>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="rec-col">
          <section className="rec-panel">
            <div className="rec-bloque-cab"><h3>Citas pagadas sin check-in</h3><span className="rec-etiqueta">{d.sin_checkin.length} PENDIENTE(S)</span></div>
            {d.sin_checkin.length === 0 && <p className="rec-exito">Todo regularizado. Puedes cerrar el turno.</p>}
            <ul className="rec-feed">
              {d.sin_checkin.map((c2) => (
                <li key={c2.id_cita}>
                  <div><strong>{c2.nombre}</strong><small>Turno {hhmm(c2.fecha_hora_cita)}</small></div>
                  <div className="rec-acciones">
                    <button type="button" className="rec-btn-nar" onClick={() => marcar(c2, true)}>Asistió</button>
                    <button type="button" className="rec-btn-sec" onClick={() => marcar(c2, false)}>No asistió</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="rec-nota-pie">
            <strong>Reglas del cierre</strong>
            <ul>
              <li>Cita pagada sin check-in al terminar el turno es no-show.</li>
              <li>Antes de cerrar, confirma si alguien entró sin registrarse.</li>
              <li>Los pagos anulados no suman al cuadre.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}