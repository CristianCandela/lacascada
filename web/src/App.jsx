import { useCallback, useState } from 'react';
import { configurado } from './lib/supabase';
import { useSesion } from './hooks/useSesion';
import Aviso from './components/Aviso';
import Cabecera from './components/Cabecera';
import Login from './components/Login';
import FormularioReserva from './components/FormularioReserva';
import Agenda from './components/Agenda';
import PanelNoShows from './components/PanelNoShows';

const TABS = [
  ['registrar', 'Registrar reserva'],
  ['agenda', 'Agenda'],
  ['panel', 'Panel de no-shows']
];

function Aplicacion() {
  const { cargando, perfil, error, entrar, salir } = useSesion();
  const [tab, setTab] = useState('registrar');
  const [aviso, setAviso] = useState('');
  const avisar = useCallback((m) => setAviso(m), []);

  const cambiar = (t) => { setAviso(''); setTab(t); };

  return (
    <>
      <Cabecera perfil={perfil} onSalir={salir} />
      <Aviso mensaje={aviso} />
      <main>
        {cargando && <p className="ayuda">Cargando…</p>}
        {!cargando && !perfil && <Login onEntrar={entrar} error={error} />}
        {!cargando && perfil && (
          <>
            <nav className="tabs" role="tablist">
              {TABS.map(([id, texto]) => (
                <button key={id} type="button" role="tab" data-tab={id}
                  className={tab === id ? 'activa' : ''} onClick={() => cambiar(id)}>{texto}</button>
              ))}
            </nav>
            {tab === 'registrar' && <FormularioReserva onAviso={avisar} />}
            {tab === 'agenda' && <Agenda perfil={perfil} onAviso={avisar} />}
            {tab === 'panel' && <PanelNoShows perfil={perfil} onAviso={avisar} />}
          </>
        )}
      </main>
      <footer className="pie">
        MVP académico UTP · Innovación y Transformación Digital 
      </footer>
    </>
  );
}

export default function App() {
  if (!configurado) {
    return (
      <main>
        <section className="tarjeta estrecha">
          <h1>Falta configurar Supabase</h1>
          <p className="ayuda">Copia <code>.env.example</code> como <code>.env</code>, completa
            <code> VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> y reinicia <code>npm run dev</code>.</p>
        </section>
      </main>
    );
  }
  return <Aplicacion />;
}
