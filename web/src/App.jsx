import { useCallback, useEffect, useState } from 'react';
import { configurado } from './lib/supabase';
import { useSesion } from './hooks/useSesion';
import Aviso from './components/Aviso';
import Icono, { Logo } from './components/Iconos';
import Cabecera from './components/Cabecera';
import Login from './components/Login';
import FormularioReserva from './components/FormularioReserva';
import Agenda from './components/Agenda';
import PanelNoShows from './components/PanelNoShows';
import Solicitudes from './components/Solicitudes';
import SolicitudPublica from './components/SolicitudPublica';

const TABS = [
  ['registrar', 'Registrar reserva', 'mas'],
  ['agenda', 'Agenda', 'agenda'],
  ['solicitudes', 'Solicitudes', 'bandeja'],
  ['panel', 'Panel de no-shows', 'grafico']
];

function Aplicacion() {
  const { cargando, perfil, error, entrar, salir } = useSesion();
  const [tab, setTab] = useState('registrar');
  const [aviso, setAviso] = useState(null);
  const avisar = useCallback((m, tipo = 'error') => setAviso(m ? { m, tipo } : null), []);
  const cambiar = (t) => { setAviso(null); setTab(t); };

  if (cargando) return <p className="cargando-pagina">Cargando…</p>;
  if (!perfil) return <Login onEntrar={entrar} error={error} />;  

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <Logo tam={98} />
          <span className="marca-texto"><b>Cascada Gym</b><small>Control de reservas</small></span>
        </div>
        <nav className="tabs" role="tablist" aria-label="Secciones">
          {TABS.map(([id, texto, icono]) => (
            <button key={id} type="button" role="tab" data-tab={id} aria-selected={tab === id}
              className={tab === id ? 'activa' : ''} onClick={() => cambiar(id)}>
              <Icono n={icono} tam={20} /><span>{texto}</span>
              {id === 'panel' && <em className="insignia">Admin</em>}
            </button>
          ))}
        </nav>
        <p className="lateral-pie">MVP académico UTP · Innovación y Transformación Digital </p>
      </aside>
      <div className="contenido">
        <Cabecera perfil={perfil} onSalir={salir} />
        <Aviso mensaje={aviso && aviso.m} tipo={aviso && aviso.tipo} />
        <main className="pagina">
          {tab === 'registrar' && <FormularioReserva onAviso={avisar} />}
          {tab === 'agenda' && <Agenda perfil={perfil} onAviso={avisar} />}
          {tab === 'solicitudes' && <Solicitudes onAviso={avisar} />}
          {tab === 'panel' && <PanelNoShows perfil={perfil} onAviso={avisar} />}
        </main>
      </div>
    </div>
  );
}

function useHash() {
  const [h, setH] = useState(window.location.hash);
  useEffect(() => {
    const f = () => setH(window.location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

export default function App() {
  const ruta = useHash();
  if (!configurado) {
    return (
      <main className="pagina">
        <section className="tarjeta estrecha">
          <h1>Falta configurar Supabase</h1>
          <p className="ayuda">Copia <code>.env.example</code> como <code>.env</code>, completa
            <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> y reinicia <code>npm run dev</code>.</p>
        </section>
      </main>
    );
  }
  if (ruta === '#/reservar') return <SolicitudPublica />;
  return <Aplicacion />;
}
