import { useCallback, useEffect, useState } from 'react';
import { configurado } from './lib/supabase';
import { useSesion } from './hooks/useSesion';
import Aviso from './components/Aviso';
import Icono, { Logo } from './components/Iconos';
import Cabecera from './components/Cabecera';
import Login from './components/Login';
import { modulosDeRol, RUTAS_PUBLICAS } from './features/modulos';

function Aplicacion() {
  const { cargando, perfil, error, entrar, salir } = useSesion();
  const [tab, setTab] = useState(null);
  const [aviso, setAviso] = useState(null);
  const avisar = useCallback((m, tipo = 'error') => setAviso(m ? { m, tipo } : null), []);

  const cambiar = (t) => { setAviso(null); setTab(t); };

  if (cargando) return <p className="cargando-pagina">Cargando…</p>;
  if (!perfil) return <Login onEntrar={entrar} error={error} />;

  // El menú sale del registro de módulos (features/): cada rol ve solo sus pantallas.
  const visibles = modulosDeRol(perfil.rol);
  const activo = visibles.find((m) => m.id === tab) || visibles[0];

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <Logo tam={98} />
          <span className="marca-texto"><b>Cascada Gym</b><small>Control de reservas</small></span>
        </div>
        <nav className="tabs" role="tablist" aria-label="Secciones">
          {visibles.map((m) => (
            <button key={m.id} type="button" role="tab" data-tab={m.id} aria-selected={activo === m}
              className={activo === m ? 'activa' : ''} onClick={() => cambiar(m.id)}>
              <Icono n={m.icono} tam={20} /><span>{m.texto}</span>
              {m.admin && <em className="insignia">Admin</em>}
            </button>
          ))}
        </nav>
        <p className="lateral-pie">MVP académico UTP · Innovación y Transformación Digital </p>
      </aside>
      <div className="contenido">
        <Cabecera perfil={perfil} onSalir={salir} />
        <Aviso mensaje={aviso && aviso.m} tipo={aviso && aviso.tipo} />
        <main className="pagina">
          {activo
            ? <activo.Componente perfil={perfil} onAviso={avisar} />
            : <p className="vacio">Tu rol aún no tiene pantallas habilitadas.</p>}
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
  const Publica = RUTAS_PUBLICAS[ruta];
  if (Publica) return <Publica />;
  return <Aplicacion />;
}
