import { useCallback, useEffect, useState } from 'react';
import './estilos.css';
import { supabase, mensajeError } from '../../lib/supabase';
import Icono from '../../components/Iconos';
import SedeSelector from './SedeSelector';
import { sedeGuardada, guardarSede, irA } from './sede';
import { diasParaVencer, semaforoMembresia, mensajeRenovacion, mensajeAusente, enlaceWhatsApp } from './logica';

const VENTANAS = [[3, 'Próx. 3 días'], [7, 'Próx. 7 días'], [15, 'Próx. 15 días']];
const fechaCorta = (f) => new Date(`${f}T00:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
const diasDesde = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const iniciales = (n) => String(n || '?').split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase();

// Registro de avisos del día (se borra solo al cambiar de fecha).
const CLAVE_AV = 'rec_avisados';
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
function leerAvisados() {
  try {
    const o = JSON.parse(localStorage.getItem(CLAVE_AV) || '{}');
    return o.dia === hoyLocal() ? (o.ids || {}) : {};
  } catch { return {}; }
}

export default function Renovaciones({ onAviso }) {
  const [sede, setSede] = useState(sedeGuardada());
  const [pestana, setPestana] = useState('vencer');
  const [ventana, setVentana] = useState(7);
  const [vencer, setVencer] = useState([]);
  const [ausentes, setAusentes] = useState([]);
  const [q, setQ] = useState('');
  const [avisados, setAvisados] = useState(leerAvisados);
  const aviso = (m) => onAviso && onAviso(m);
  const clave = (x) => `${pestana}:${x.id_cliente}`;

  const cargar = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        supabase.rpc('renovaciones_lista', { p_dias: ventana }),
        supabase.rpc('afiliados_ausentes', { p_dias: 14 })
      ]);
      if (a.error) { aviso(mensajeError(a.error)); return; }
      setVencer(Array.isArray(a.data) ? a.data : []);
      setAusentes(Array.isArray(b.data) ? b.data : []);
      aviso('');
    } catch (e) {
      aviso('No se pudo cargar la lista. Intenta de nuevo.');
    }
  }, [ventana]);
  useEffect(() => { cargar(); }, [cargar]);

  const vencidas = vencer.filter((x) => diasParaVencer(x.fin) < 0).length;
  const lista = (pestana === 'vencer' ? vencer : ausentes)
    .filter((x) => !q.trim() || `${x.nombre} ${x.dni} ${x.codigo_cliente}`.toLowerCase().includes(q.trim().toLowerCase()));

  function whatsapp(x) {
    const msg = pestana === 'vencer' ? mensajeRenovacion(x.nombre, x.fin) : mensajeAusente(x.nombre, diasDesde(x.ultima_visita) ?? 14);
    const url = enlaceWhatsApp(x.telefono, msg);
    if (!url) { aviso('El cliente no tiene un teléfono válido para WhatsApp.'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
    const nuevo = { ...avisados, [clave(x)]: true };
    setAvisados(nuevo);
    try { localStorage.setItem(CLAVE_AV, JSON.stringify({ dia: hoyLocal(), ids: nuevo })); } catch { /* sin almacenamiento */ }
  }
  const pendientes = lista.filter((x) => !avisados[clave(x)] && enlaceWhatsApp(x.telefono, 'x'));

  return (
    <div className="rec-pagina">
      <header className="rec-cab-pag">
        <div><h1>Renovaciones y seguimiento</h1><p>Avisa a tiempo a quien está por vencer y reactiva a los afiliados que dejaron de venir.</p></div>
        <SedeSelector sede={sede} onCambiar={(s) => { setSede(s); guardarSede(s); }} />
      </header>

      <section className="rec-franja">
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="reloj" tam={22} /></span><div><small>Por vencer (ventana)</small><strong>{vencer.length - vencidas}</strong> <em>afiliados</em></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="alerta" tam={22} /></span><div><small>Ya vencidas</small><strong>{vencidas}</strong> <em>requieren renovar</em></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="usuarios" tam={22} /></span><div><small>Ausentes (14+ días)</small><strong>{ausentes.length}</strong> <em>afiliados</em></div></div>
      </section>

      <section className="rec-panel">
        <div className="rec-bloque-cab">
          <div className="rec-tabs">
            <button type="button" className={pestana === 'vencer' ? 'rec-tab-act' : ''} onClick={() => setPestana('vencer')}>Membresías por vencer ({vencer.length})</button>
            <button type="button" className={pestana === 'ausentes' ? 'rec-tab-act' : ''} onClick={() => setPestana('ausentes')}>Afiliados ausentes ({ausentes.length})</button>
          </div>
          {pestana === 'vencer' && (
            <div className="rec-tabs">
              {VENTANAS.map(([d, t]) => <button key={d} type="button" className={ventana === d ? 'rec-tab-act' : ''} onClick={() => setVentana(d)}>{t}</button>)}
            </div>
          )}
        </div>

        <div className="rec-acciones" style={{ margin: '8px 0' }}>
          <button type="button" className="rec-btn-wa" disabled={pendientes.length === 0} onClick={() => whatsapp(pendientes[0])}>
            Avisar al siguiente ({pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'})
          </button>
        </div>

        <div className="rec-buscador">
          <Icono n="buscar" tam={20} />
          <label htmlFor="rn-q" className="sr">Buscar</label>
          <input id="rn-q" placeholder="Buscar por nombre, DNI o código" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {lista.length === 0 && <p className="rec-nota">{pestana === 'vencer' ? 'Nadie vence en esta ventana.' : 'No hay afiliados ausentes. ¡Buena asistencia!'}</p>}
        <div className="rec-tabla-wrap">
          {lista.length > 0 && (
            <table className="rec-tabla">
              <thead><tr><th>Cliente</th><th>Vencimiento</th><th>Estado</th><th>Última visita</th><th>Acciones</th></tr></thead>
              <tbody>
                {lista.map((x) => {
                  const d = diasParaVencer(x.fin);
                  const sem = semaforoMembresia(x.fin);
                  const v = diasDesde(x.ultima_visita);
                  return (
                    <tr key={x.id_cliente}>
                      <td><span className="rec-persona"><span className="rec-avatar rec-avatar-sm">{iniciales(x.nombre)}</span><span><strong>{x.nombre}</strong><small>{x.codigo_cliente} · DNI {x.dni}</small></span></span></td>
                      <td className="rec-num">{fechaCorta(x.fin)}</td>
                      <td><span className={`rec-estado rec-${sem}`}>{d < 0 ? `Vencida hace ${-d} d` : d === 0 ? 'Vence hoy' : `Vence en ${d} d`}</span></td>
                      <td>{v === null ? 'Sin visitas' : v === 0 ? 'Hoy' : `Hace ${v} d`}</td>
                      <td>
                        <div className="rec-acciones">
                          <button type="button" className="rec-btn-nar" onClick={() => irA('pagos', onAviso)}>Cobrar renovación</button>
                          <button type="button" className="rec-btn-wa" onClick={() => whatsapp(x)}>{avisados[clave(x)] ? 'Avisado ✓' : 'WhatsApp'}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rec-nota-pie">
        <strong>Cómo se usa</strong>
        <ul>
          <li>WhatsApp abre el chat con el mensaje ya redactado; tú solo lo envías.</li>
          <li>«Avisar al siguiente» abre un chat por clic y salta a quienes ya fueron avisados hoy.</li>
          <li>Cobrar renovación te lleva a Pagos: el vencimiento nuevo se suma al actual si aún está vigente.</li>
          <li>Ausente: afiliado vigente sin check-in en 14 días o más.</li>
        </ul>
      </section>
    </div>
  );
}
