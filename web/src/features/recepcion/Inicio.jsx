import { useCallback, useEffect, useState } from 'react';
import './estilos.css';
import { supabase } from '../../lib/supabase';
import Icono from '../../components/Iconos';
import SedeSelector from './SedeSelector';
import { sedeGuardada, guardarSede, irA } from './sede';
import { estadoAforo, diasParaVencer, construirAlertas } from './logica';

const soles = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });



function Barra({ color, porcentaje }) {
  return (
    <div className="rec-barra" role="progressbar" aria-valuenow={porcentaje} aria-valuemin="0" aria-valuemax="100">
      <div className={`rec-barra-relleno rec-barra-${color}`} style={{ width: `${Math.min(porcentaje, 100)}%` }} />
    </div>
  );
}

function Acceso({ icono, tono, titulo, texto, extra, onClick }) {
  return (
    <button type="button" className={`rec-acceso rec-acceso-${tono}`} onClick={onClick}>
      <span className="rec-acceso-ico"><Icono n={icono} tam={28} /></span>
      <span className="rec-acceso-txt"><strong>{titulo}</strong><small>{texto}</small></span>
      {extra && <span className="rec-acceso-extra">{extra}</span>}
    </button>
  );
}

export default function Inicio({ perfil, onAviso }) {
  const [sede, setSede] = useState(sedeGuardada());
  const [d, setD] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [proyectar, setProyectar] = useState(false);
  const nombre = (perfil && perfil.nombre ? perfil.nombre : 'Recepción').split(' ')[0];

  const cargar = useCallback(async () => {
    try {
      const [aforo, codigo, venc, resumen, recientes] = await Promise.all([
        supabase.rpc('aforo_actual', { p_sede: sede }),
        supabase.rpc('codigo_local_actual', { p_sede: sede }),
        supabase.rpc('membresias_por_vencer', { p_dias: 7 }),
        supabase.rpc('resumen_dia', { p_sede: sede }),
        supabase.rpc('entradas_recientes', { p_limite: 5 })
      ]);
      const falla = [aforo, codigo, venc, resumen, recientes].find((r) => r.error);
      if (falla) throw falla.error;
      const lista = Array.isArray(aforo.data) ? aforo.data : [];
      setD({
        gim: lista.find((x) => x.servicio === 'gimnasio') || { ocupados: 0, capacidad: 0 },
        codigo: codigo.data,
        porVencer: Array.isArray(venc.data) ? venc.data : [],
        resumen: resumen.data,
        recientes: Array.isArray(recientes.data) ? recientes.data : []
      });
      if (onAviso) onAviso('');
    } catch (e) {
      if (onAviso) onAviso(e.message || 'No se pudo cargar el inicio.');
    }
  }, [onAviso, sede]);

  useEffect(() => { cargar(); const t = setInterval(cargar, 30000); return () => clearInterval(t); }, [cargar]);

  function cambiarSede(s) { setSede(s); guardarSede(s); }

  async function copiarCodigo(texto) {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { if (onAviso) onAviso('No se pudo copiar. Selecciona el código y usa Ctrl + C.'); }
  }


  if (!d) return <p className="vacio">Cargando inicio…</p>;

  const gim = estadoAforo(d.gim.ocupados, d.gim.capacidad);
  const alertas = construirAlertas({ aforoGim: gim, porVencer: d.porVencer, noShows: d.resumen.no_shows });
  const c = d.resumen.cobros;
  const total = c.efectivo + c.yape + c.plin;
  const fecha = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

  async function copiarCodigo(texto) {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { if (onAviso) onAviso('No se pudo copiar. Selecciona el código y usa Ctrl + C.'); }
  }

  {
    proyectar && (
      <div className="rec-modal rec-modal-oscuro" role="dialog" aria-modal="true" onClick={() => setProyectar(false)}>
        <div className="rec-proyeccion">
          <small>CASCADA GYM · SEDE {sede.toUpperCase()}</small>
          <span>Ingresa desde tu celular</span>
          <strong className="rec-num">{d.codigo.codigo}</strong>
          <small>Válido hasta las {hhmm(d.codigo.vigente_hasta)} · toca para cerrar</small>
        </div>
      </div>
    )
  }

  return (
    <div className="rec-pagina">
      <section className="rec-hero">
        <div>
          <h1>Hola, {nombre}</h1>
          <p>{fecha} · Sede {sede}. Lo urgente aparece primero.</p>
        </div>
        <div className="rec-hero-chips">
          <span className={`rec-chip rec-chip-${gim.color}`}>Gimnasio: {gim.mensaje}</span>
          <span className={`rec-chip ${alertas.length ? 'rec-chip-rojo' : 'rec-chip-verde'}`}>{alertas.length} alertas</span>
          <SedeSelector sede={sede} onCambiar={cambiarSede} />
        </div>
      </section>

      <section className="rec-accesos">
        <Acceso icono="check" tono="azul" titulo="Check-in" texto="Código, DNI o nombre" onClick={() => irA('checkin', onAviso)} />
        <Acceso icono="pesa" tono="naranja" titulo="Pase del día" texto="Sin membresía: cobra y registra" extra="S/ 20.00" onClick={() => irA('pagos', onAviso, 'Pagos está en construcción.')} />
        <Acceso icono="sauna" tono="celeste" titulo="Reservar sauna" texto="Reserva y cobro en un paso" extra="Cupos limitados" onClick={() => irA('reservar', onAviso)} />
      </section>

      <section className="rec-principal">
        <article className={`rec-panel rec-aforo rec-aforo-${gim.color}`}>
          <div className="rec-bloque-cab"><h3>Aforo del gimnasio</h3><span className="rec-vivo">En vivo</span></div>
          <p className="rec-enorme rec-num">{d.gim.ocupados}<span> / {d.gim.capacidad} personas</span></p>
          <Barra color={gim.color} porcentaje={gim.porcentaje} />
          <p className="rec-barra-pie"><span>0</span><strong>{gim.porcentaje} % ocupado</strong><span>Máx {d.gim.capacidad}</span></p>
          <p className={`rec-estado rec-${gim.color}`}>{gim.mensaje}</p>
          <p className="rec-nota">Sin reserva: membresía o pase del día. Cuenta los check-ins de los últimos 90 min.</p>
        </article>

        <article className="rec-panel">
          <div className="rec-bloque-cab"><h3>Sauna por turnos</h3><span className="rec-etiqueta">RESERVA OBLIGATORIA</span></div>
          {d.resumen.turnos.map((t) => {
            const e = estadoAforo(t.ocupados, t.capacidad);
            return (
              <div key={t.hora} className="rec-turno">
                <div className="rec-turno-cab"><strong>Turno {t.hora}</strong>
                  <span className={`rec-estado rec-${e.color}`}>{t.capacidad - t.ocupados} de {t.capacidad} libres</span></div>
                <Barra color={e.color} porcentaje={e.porcentaje} />
              </div>
            );
          })}
          <p className="rec-nota">El afiliado paga tarifa reducida; el sistema calcula el monto.</p>
        </article>

        <article className="rec-panel rec-codigo">
          <div className="rec-bloque-cab"><h3>Código del local</h3><span className="rec-etiqueta">HOY</span></div>
          <strong className="rec-codigo-grande rec-num">{d.codigo.codigo}</strong>
          <small className="rec-codigo-vig"><Icono n="reloj" tam={14} /> Válido hasta las {hhmm(d.codigo.vigente_hasta)}</small>
          <div className="rec-acciones">
            <button type="button" className="rec-btn-sec" onClick={() => copiarCodigo(d.codigo.codigo)}>{copiado ? '¡Copiado!' : 'Copiar'}</button>
            <button type="button" className="rec-btn-sec" onClick={() => setProyectar(true)}>Pantalla completa</button>
            <button type="button" className="rec-btn-sec" onClick={() => window.print()}>Imprimir</button>
          </div>
          <p className="rec-nota">El cliente con celular lo escribe en la web para hacer su propio check-in. Recepción solo lo muestra.</p>
        </article>
      </section>

      <section className="rec-franja">
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="usuarios" tam={22} /></span>
          <div><small>Entradas de hoy</small><strong>{d.resumen.entradas}</strong> <em>accesos</em></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="bandeja" tam={22} /></span>
          <div><small>Cobros de hoy</small><strong>{soles(total)}</strong>
            <em>Efec {soles(c.efectivo)} · Yape {soles(c.yape)} · Plin {soles(c.plin)}</em></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="x" tam={22} /></span>
          <div><small>No-shows de sauna</small><strong>{d.resumen.no_shows}</strong> <em>citas pagadas sin llegar</em></div></div>
      </section>

      <section className="rec-trabajo">
        <article className="rec-panel">
          <div className="rec-bloque-cab"><h3>Alertas de recepción</h3><span className="rec-contador">{alertas.length} activas</span></div>
          {alertas.length === 0 && <p className="rec-nota">Todo en orden. No hay alertas.</p>}
          <ul className="rec-alertas">
            {alertas.map((a) => (
              <li key={a.id} className={`rec-alerta rec-alerta-${a.tono}`}>
                <span className="rec-alerta-ico"><Icono n={a.icono} tam={18} /></span>
                <div><strong>{a.titulo}</strong><small>{a.detalle}</small></div>
                <button type="button" className="rec-btn-sec" onClick={() => irA(a.id === 'noshows' ? 'agenda' : 'renovaciones', onAviso, 'Pantalla en construcción.')}>{a.accion}</button>
              </li>
            ))}
          </ul>
        </article>

        <article className="rec-panel">
          <div className="rec-bloque-cab"><h3>Entradas recientes</h3></div>
          <div className="rec-tabla-wrap">
            <table className="rec-tabla">
              <thead><tr><th>Cliente</th><th>Hora</th><th>Membresía</th><th>Método</th></tr></thead>
              <tbody>
                {d.recientes.map((r, i) => {
                  const dias = r.fin ? diasParaVencer(r.fin) : null;
                  const color = dias === null ? 'gris' : dias < 0 ? 'rojo' : dias <= 7 ? 'amarillo' : 'verde';
                  const txt = dias === null ? 'Sin plan' : dias < 0 ? `Vencida hace ${-dias} d` : `${dias} d restantes`;
                  return (
                    <tr key={`${r.dni}-${i}`}>
                      <td><strong>{r.nombre}</strong><small>DNI {r.dni}</small></td>
                      <td className="rec-num">{hhmm(r.entrada_en)}</td>
                      <td><span className={`rec-estado rec-${color}`}>{txt}</span></td>
                      <td>{r.metodo === 'codigo' ? 'Código del local' : 'Manual'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}