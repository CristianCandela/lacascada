import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Icono, { Logo } from '../../components/Iconos';
import BarraAforo from './BarraAforo';
import { EMPRESA, SEDES } from './contenido';
import { aforoDeSede, estadoLocal } from './landing-logica';
import './landing.css';

const REFRESCO_MS = 15000;

// Pantalla pública de aforo en vivo (HU-P2): pensada para abrirla desde el celular o mostrarla en una pantalla del local.
export default function AforoPublico() {
  const [aforo, setAforo] = useState(null);
  const [falloAforo, setFalloAforo] = useState(false);
  const [horarios, setHorarios] = useState([]);
  const [actualizado, setActualizado] = useState(null);

  useEffect(() => {
    const anterior = document.title;
    document.title = 'Aforo en vivo · Cascada Gym';
    return () => { document.title = anterior; };
  }, []);

  const cargar = useCallback(async () => {
    try {
      const r = await supabase.rpc('aforo_actual', {});
      if (r.error) throw r.error;
      setAforo(r.data || []); setFalloAforo(false); setActualizado(new Date());
    } catch {
      setFalloAforo(true);
      setAforo((previo) => previo || []);
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    (async () => {
      try {
        const s = await supabase.from('sedes').select('sede, abre, cierra').order('sede');
        if (!s.error && s.data) setHorarios(s.data);
      } catch { /* la pantalla funciona sin horarios */ }
    })();
  }, []);

  const hora = actualizado
    ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }).format(actualizado)
    : null;

  return (
    <div className="pub pub-pagina-aforo">
      <header className="pub-barra">
        <div className="pub-barra-in">
          <a className="pub-marca" href="#/inicio" aria-label="Cascada Gym, inicio">
            <Logo tam={44} /><span><b>{EMPRESA.marca}</b><small>Sauna y gimnasio</small></span>
          </a>
          <div className="pub-acciones">
            <a className="pub-btn pub-btn-fantasma" href="#/inicio">Volver al inicio</a>
          </div>
        </div>
      </header>

      <main className="pub-cont pub-aforo-main">
        <h1 id="aforo-h1">Aforo en vivo</h1>
        <p className="pub-aforo-sub">
          Personas dentro ahora y reservas de sauna de la hora actual.
          {hora && <> Actualizado a las <b>{hora}</b>; se renueva cada 15 segundos.</>}
        </p>
        {falloAforo && <p className="pub-nota pub-nota-error" role="status">No pudimos actualizar el aforo. Mostramos el último dato disponible.</p>}
        {aforo === null && <p className="pub-aforo-sub">Cargando aforo…</p>}

        {aforo !== null && (
          <div className="pub-aforo-sedes">
            {Object.entries(SEDES).map(([sede, info]) => {
              const datos = aforoDeSede(aforo, sede);
              const h = horarios.find((x) => x.sede === sede);
              const est = h ? estadoLocal(h.abre, h.cierra) : null;
              return (
                <section key={sede} className="pub-aforo-sede" aria-labelledby={`s-${sede}`}>
                  <div className="pub-aforo-sede-cab">
                    <div>
                      <h2 id={`s-${sede}`}>{info.titulo}</h2>
                      <p>{info.direccion}</p>
                    </div>
                    {est && (
                      <span className={`pub-estado ${est.abierto ? 'abierto' : 'cerrado'}`}>
                        {est.abierto ? `Abierto hasta las ${est.cierra}` : `Cerrado · abre a las ${est.abre}`}
                      </span>
                    )}
                  </div>
                  {datos.gimnasio
                    ? <BarraAforo titulo="Gimnasio" icono={<Icono n="pesa" tam={18} />} ocupados={datos.gimnasio.ocupados} capacidad={datos.gimnasio.capacidad} unidad="personas dentro" />
                    : <p className="pub-nota">Sin datos del gimnasio.</p>}
                  {datos.sauna
                    ? <BarraAforo titulo="Sauna" icono={<Icono n="sauna" tam={18} />} ocupados={datos.sauna.ocupados} capacidad={datos.sauna.capacidad} unidad="cupos reservados este turno" />
                    : <p className="pub-nota">Sin datos del sauna.</p>}
                </section>
              );
            })}
          </div>
        )}

        <p className="pub-aforo-pie">
          ¿Quieres entrenar o usar el sauna? <a href="#/reservar">Solicita una reserva</a> o <a href="#/ingresar">ingresa a tu cuenta</a>.
        </p>
      </main>
    </div>
  );
}
