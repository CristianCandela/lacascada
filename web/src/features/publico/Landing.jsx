import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Icono, { Logo } from '../../components/Iconos';
import BarraAforo from './BarraAforo';
import { EMPRESA, SEDES, MISION, VISION, SERVICIOS, PASOS } from './contenido';
import { aforoDeSede, enlaceWhatsApp, estadoLocal, formatoHora, formatoPrecio, formatoTelefono, urlMapa } from './landing-logica';
import './landing.css';

const REFRESCO_MS = 30000;

function IconoPunto(props) {
  return (
    <svg className="ico" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1113 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}
function IconoTelefono(props) {
  return (
    <svg className="ico" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 4h3.5l1.7 4.2-2 1.4a11 11 0 005.2 5.2l1.4-2L19 14.5V18a2 2 0 01-2 2A13 13 0 013 6a2 2 0 012-2z" />
    </svg>
  );
}

function irA(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
}

// Página pública: aforo en vivo, servicios, plan y sedes. No requiere sesión.
export default function Landing({ tieneRegistro = false }) {
  const [aforo, setAforo] = useState(null);       // null = cargando
  const [falloAforo, setFalloAforo] = useState(false);
  const [planes, setPlanes] = useState(null);
  const [horarios, setHorarios] = useState([]);
  const [sedeSel, setSedeSel] = useState('Túpac Amaru');
  const [actualizado, setActualizado] = useState(null);

  useEffect(() => {
    const anterior = document.title;
    document.title = 'Cascada Gym · Sauna y gimnasio en Comas';
    return () => { document.title = anterior; };
  }, []);

  const cargarAforo = useCallback(async () => {
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
    cargarAforo();
    const t = setInterval(cargarAforo, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargarAforo]);

  useEffect(() => {
    (async () => {
      try {
        const p = await supabase.from('planes').select('nombre, dias, precio').eq('activo', true).order('precio');
        setPlanes(p.error ? [] : (p.data || []));
      } catch { setPlanes([]); }
      try {
        const s = await supabase.from('sedes').select('sede, abre, cierra').order('sede');
        if (!s.error && s.data) setHorarios(s.data);
      } catch { /* la página funciona sin horarios */ }
    })();
  }, []);

  const horarioDe = useCallback((sede) => horarios.find((h) => h.sede === sede), [horarios]);
  const hSel = horarioDe(sedeSel);
  const estado = hSel ? estadoLocal(hSel.abre, hSel.cierra) : null;
  const datos = useMemo(() => aforoDeSede(aforo, sedeSel), [aforo, sedeSel]);
  const plan = planes && planes[0];
  const sedesLista = Object.keys(SEDES);
  const wa = enlaceWhatsApp(EMPRESA.telefono, 'Hola, quiero información sobre el Plan general de Cascada Gym.');

  return (
    <div className="pub">
      <header className="pub-barra">
        <div className="pub-barra-in">
          <a className="pub-marca" href="#/inicio" aria-label="Cascada Gym, inicio">
            <Logo tam={44} /><span><b>{EMPRESA.marca}</b><small>Sauna y gimnasio</small></span>
          </a>
          <nav className="pub-nav" aria-label="Secciones de la página">
            <button type="button" onClick={() => irA('aforo')}>Aforo</button>
            <button type="button" onClick={() => irA('servicios')}>Servicios</button>
            <button type="button" onClick={() => irA('plan')}>Plan</button>
            <button type="button" onClick={() => irA('sedes')}>Sedes</button>
            <button type="button" onClick={() => irA('nosotros')}>Nosotros</button>
          </nav>
          <div className="pub-acciones">
            {tieneRegistro && <a className="pub-btn pub-btn-fantasma pub-solo-ancho" href="#/registro">Crear cuenta</a>}
            <a id="btn-ingresar" className="pub-btn pub-btn-borde" href="#/ingresar">Ingresar</a>
          </div>
        </div>
      </header>

      <main>
        <section className="pub-hero" aria-labelledby="pub-h1">
          <div className="pub-hero-in">
            <div className="pub-hero-texto">
              <h1 id="pub-h1">Entrena y relájate en Comas, con el aforo a la vista</h1>
              <p>Gimnasio y sauna con cámara de vapor, cámara seca y piscina pequeña. Mira cuánta gente hay en tu sede antes de salir de casa y reserva tu turno de sauna desde el celular.</p>
              <div className="pub-hero-cta">
                <a className="pub-btn pub-btn-primario" href="#/reservar">Solicitar reserva de sauna</a>
                {tieneRegistro
                  ? <a className="pub-btn pub-btn-claro" href="#/registro">Crear mi cuenta</a>
                  : <button type="button" className="pub-btn pub-btn-claro" onClick={() => irA('plan')}>Ver el plan</button>}
              </div>
            </div>

            <div className="pub-foto" aria-hidden="true"><img src="/img/portada.jpg" alt="" width="900" height="1602" /></div>

            <div className="pub-tarjeta-aforo" id="aforo" aria-labelledby="pub-aforo-t">
              <div className="pub-aforo-encabezado">
                <h2 id="pub-aforo-t">Aforo en este momento</h2>
                {estado && (
                  <span className={`pub-estado ${estado.abierto ? 'abierto' : 'cerrado'}`}>
                    {estado.abierto ? `Abierto hasta las ${estado.cierra}` : `Cerrado · abre a las ${estado.abre}`}
                  </span>
                )}
              </div>
              <div className="pub-sedes-sel" role="group" aria-label="Elige una sede">
                {sedesLista.map((s) => (
                  <button key={s} type="button" aria-pressed={sedeSel === s} data-sede={s} onClick={() => setSedeSel(s)}>{SEDES[s].titulo}</button>
                ))}
              </div>
              {aforo === null && <p className="pub-nota">Cargando aforo…</p>}
              {aforo !== null && !falloAforo && (
                <div className="pub-aforos">
                  {datos.gimnasio
                    ? <BarraAforo titulo="Gimnasio" icono={<Icono n="pesa" tam={18} />} ocupados={datos.gimnasio.ocupados} capacidad={datos.gimnasio.capacidad} unidad="personas dentro" />
                    : <p className="pub-nota">Sin datos del gimnasio.</p>}
                  {datos.sauna
                    ? <BarraAforo titulo="Sauna" icono={<Icono n="sauna" tam={18} />} ocupados={datos.sauna.ocupados} capacidad={datos.sauna.capacidad} unidad="cupos reservados este turno" />
                    : <p className="pub-nota">Sin datos del sauna.</p>}
                </div>
              )}
              {falloAforo && <p className="pub-nota pub-nota-error" role="status">No pudimos cargar el aforo. Se reintentará en unos segundos.</p>}
              {actualizado && !falloAforo && <p className="pub-nota">Se actualiza cada 30 segundos.</p>}
            </div>
          </div>
        </section>

        <section className="pub-seccion" id="como" aria-labelledby="pub-h-como">
          <div className="pub-cont">
            <h2 id="pub-h-como">Así empiezas</h2>
            <p className="pub-lead">Registras tus datos una sola vez y después entras con tu código.</p>
            <ol className="pub-pasos">
              {PASOS.map(([t, d]) => (<li key={t}><h3>{t}</h3><p>{d}</p></li>))}
            </ol>
          </div>
        </section>

        <section className="pub-seccion pub-seccion-suave" id="servicios" aria-labelledby="pub-h-serv">
          <div className="pub-cont">
            <h2 id="pub-h-serv">Dos servicios, una membresía</h2>
            <p className="pub-lead">Tu Plan general incluye el gimnasio y el sauna.</p>
            <div className="pub-servicios">
              {Object.entries(SERVICIOS).map(([k, s]) => (
                <article key={k} className={`pub-servicio pub-servicio-${k}`}>
                  <div className="pub-servicio-ico"><Icono n={k === 'gimnasio' ? 'pesa' : 'sauna'} tam={30} /></div>
                  <h3>{s.titulo}</h3>
                  <p>{s.descripcion}</p>
                  <dl>
                    {s.datos.map(([a, b]) => (<div key={a}><dt>{a}</dt><dd>{b}</dd></div>))}
                  </dl>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="pub-seccion" id="plan" aria-labelledby="pub-h-plan">
          <div className="pub-cont pub-plan">
            <div>
              <h2 id="pub-h-plan">Un solo plan, sin horarios restringidos</h2>
              <p className="pub-lead">Entra cuando quieras dentro del horario de atención y quédate el tiempo que necesites.</p>
              <ul className="pub-lista">
                <li><Icono n="check" tam={18} />Acceso al gimnasio todos los días de atención</li>
                <li><Icono n="check" tam={18} />Reserva de turnos de sauna según cupos libres</li>
                <li><Icono n="check" tam={18} />Entrada con código desde tu celular, sin papeles</li>
                <li><Icono n="check" tam={18} />Consulta cuándo vence tu membresía en tu cuenta</li>
              </ul>
            </div>
            <div className="pub-precio" aria-live="polite">
              <p className="pub-precio-nombre">{plan ? plan.nombre : 'Plan general'}</p>
              {plan
                ? (<p className="pub-precio-monto"><b>{formatoPrecio(plan.precio)}</b><span>por {plan.dias} días</span></p>)
                : (<p className="pub-precio-monto"><span>{planes === null ? 'Cargando tarifa…' : 'Consulta la tarifa en recepción'}</span></p>)}
              <a className="pub-btn pub-btn-primario" href={tieneRegistro ? '#/registro' : '#/reservar'}>{tieneRegistro ? 'Crear mi cuenta' : 'Solicitar información'}</a>
              <p className="pub-pie-precio">Tarifa referencial del prototipo; la tarifa vigente se confirma en recepción.</p>
            </div>
          </div>
        </section>

        <section className="pub-seccion pub-seccion-suave" id="sedes" aria-labelledby="pub-h-sedes">
          <div className="pub-cont">
            <h2 id="pub-h-sedes">Dos sedes en Comas</h2>
            <div className="pub-sedes">
              {sedesLista.map((s) => {
                const h = horarioDe(s);
                return (
                  <article key={s} className="pub-sede" data-sede-card={s}>
                    <h3>{SEDES[s].titulo}</h3>
                    <p className="pub-dato"><IconoPunto />{SEDES[s].direccion}</p>
                    <p className="pub-dato"><Icono n="reloj" tam={18} />{h ? `Atención de ${formatoHora(h.abre)} a ${formatoHora(h.cierra)}` : 'Horario por confirmar'}</p>
                    <a className="pub-enlace" href={urlMapa(SEDES[s].direccion)} target="_blank" rel="noopener noreferrer">Cómo llegar<span className="sr"> a {SEDES[s].titulo} (se abre en otra pestaña)</span></a>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="pub-seccion" id="nosotros" aria-labelledby="pub-h-nos">
          <div className="pub-cont pub-nosotros">
            <div>
              <h2 id="pub-h-nos">Más de diez años cuidando tu bienestar</h2>
              <p className="pub-lead">Somos un gimnasio de barrio con sauna, dedicado a que cada visita termine en satisfacción. Ahora sumamos tecnología para que entrar, reservar y consultar tu plan sea simple.</p>
            </div>
            <div className="pub-mv">
              <div><h3>Misión</h3><p>{MISION}</p></div>
              <div><h3>Visión</h3><p>{VISION}</p></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="pub-pie" id="contacto">
        <div className="pub-cont pub-pie-in">
          <div>
            <p className="pub-pie-marca">{EMPRESA.marca}</p>
            <p>{EMPRESA.razonSocial}</p>
            <p>RUC {EMPRESA.ruc}</p>
          </div>
          <div>
            <p className="pub-pie-titulo">Contacto</p>
            <p><a href={`tel:+51${EMPRESA.telefono}`}><IconoTelefono />{formatoTelefono(EMPRESA.telefono)}</a></p>
            <p><a href={wa} target="_blank" rel="noopener noreferrer"><Icono n="whatsapp" tam={18} />Escríbenos por WhatsApp</a></p>
            <p><a href={`mailto:${EMPRESA.correo}`}><Icono n="correo" tam={18} />{EMPRESA.correo}</a></p>
          </div>
          <div>
            <p className="pub-pie-titulo">Tus datos</p>
            <p>Tratamos tus datos personales conforme a la Ley N.° 29733. Esta página es un prototipo académico de la UTP y no procesa pagos.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
