import { useCallback, useEffect, useState } from 'react';
import './estilos.css';
import { supabase, mensajeError } from '../../lib/supabase';
import Icono from '../../components/Iconos';
import SedeSelector from './SedeSelector';
import { sedeGuardada, guardarSede, irA } from './sede';
import { enviarAPagos } from './puente';
import { estadoAforo, alertasCompletas } from './logica';

const GRUPOS = [['todas', 'Todas'], ['aforo', 'Aforo'], ['sauna', 'Sauna'], ['membresias', 'Membresías']];
const ETQ = { 1: ['rojo', 'CRÍTICA'], 2: ['amarillo', 'ATENCIÓN'], 3: ['azul', 'SEGUIMIENTO'] };

export default function Alertas({ onAviso }) {
  const [sede, setSede] = useState(sedeGuardada());
  const [alertas, setAlertas] = useState(null);
  const [grupo, setGrupo] = useState('todas');
  const aviso = (m) => onAviso && onAviso(m);

  const cargar = useCallback(async () => {
    const [af, venc, res, aus, op] = await Promise.all([
      supabase.rpc('aforo_actual', { p_sede: sede }),
      supabase.rpc('membresias_por_vencer', { p_dias: 7 }),
      supabase.rpc('resumen_dia', { p_sede: sede }),
      supabase.rpc('afiliados_ausentes', { p_dias: 14 }),
      supabase.rpc('oportunidades_conversion', {})
    ]);
    const falla = [af, venc, res].find((r) => r.error);
    if (falla) { aviso(mensajeError(falla.error)); return; }
    const g = (Array.isArray(af.data) ? af.data : []).find((x) => x.servicio === 'gimnasio') || { ocupados: 0, capacidad: 0 };
    setAlertas(alertasCompletas({
      aforoGim: estadoAforo(g.ocupados, g.capacidad),
      porVencer: Array.isArray(venc.data) ? venc.data : [],
      noShows: res.data ? res.data.no_shows : 0,
      ausentes: Array.isArray(aus.data) ? aus.data : [],
      pases: Array.isArray(op.data) ? op.data : []
    }));
    aviso('');
  }, [sede]);
  useEffect(() => { cargar(); const t = setInterval(cargar, 30000); return () => clearInterval(t); }, [cargar]);

  if (!alertas) return <p className="vacio">Cargando alertas…</p>;
  const lista = alertas.filter((a) => grupo === 'todas' || a.grupo === grupo);
  const n = (s) => alertas.filter((a) => a.sev === s).length;

  return (
    <div className="rec-pagina">
      <header className="rec-cab-pag">
        <div><h1>Centro de alertas</h1><p>Lo que requiere tu atención, ordenado por urgencia. Se actualiza cada 30 segundos.</p></div>
        <SedeSelector sede={sede} onCambiar={(s) => { setSede(s); guardarSede(s); }} />
      </header>

      <section className="rec-franja">
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="alerta" tam={22} /></span><div><small>Críticas</small><strong>{n(1)}</strong> <em>acción inmediata</em></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="reloj" tam={22} /></span><div><small>Atención</small><strong>{n(2)}</strong> <em>vencimientos y citas</em></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="check" tam={22} /></span><div><small>Seguimiento</small><strong>{n(3)}</strong> <em>ausentes y ventas</em></div></div>
      </section>

      <div className="rec-tabs">
        {GRUPOS.map(([v, t]) => <button key={v} type="button" className={grupo === v ? 'rec-tab-act' : ''} onClick={() => setGrupo(v)}>{t}</button>)}
        <button type="button" onClick={cargar}>Actualizar</button>
      </div>

      {lista.length === 0 && <section className="rec-panel"><p className="rec-nota">Todo en orden. No hay alertas en esta categoría.</p></section>}
      <ul className="rec-alertas">
        {lista.map((a) => (
          <li key={a.id} className={`rec-alerta rec-alerta-${ETQ[a.sev][0]}`}>
            <span className="rec-alerta-ico"><Icono n={a.icono} tam={20} /></span>
            <div><span className={`rec-estado rec-${ETQ[a.sev][0] === 'azul' ? 'gris' : ETQ[a.sev][0]}`}>{ETQ[a.sev][1]}</span>
              <strong>{a.titulo}</strong><small>{a.detalle}</small></div>
            <button type="button" className="rec-btn-sec" onClick={() => { if (a.destino === 'pagos' && a.buscar) enviarAPagos(a.buscar); irA(a.destino, onAviso); }}>{a.accion}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}