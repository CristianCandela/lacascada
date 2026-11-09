import { useCallback, useEffect, useState } from 'react';
import './estilos.css';
import { supabase, mensajeError } from '../../lib/supabase';
import Icono from '../../components/Iconos';
import SedeSelector from './SedeSelector';
import { sedeGuardada, guardarSede, irA } from './sede';
import { estadoAforo, semaforoMembresia, textoMembresia, tipoBusqueda, decisionEntrada } from './logica';

const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
const etiquetaPago = { pagada: 'Pagada', pendiente: 'Pendiente de pago' };
const etiquetaAsist = { pendiente: 'Por llegar', asistio: 'Asistió', no_asistio: 'No asistió' };
const iniciales = (n) => String(n || '?').split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const TXT_BALIZA = { verde: 'MEMBRESÍA VIGENTE', amarillo: 'POR VENCER', rojo: 'MEMBRESÍA VENCIDA', gris: 'SIN PLAN' };

export default function Checkin({ onAviso }) {
  const [sede, setSede] = useState(sedeGuardada());
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState(null);
  const [f, setF] = useState(null);
  const [gim, setGim] = useState(null);
  const [sauna, setSauna] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const aviso = (m) => onAviso && onAviso(m);

  const cargarEstado = useCallback(async () => {
    const [a, e] = await Promise.all([
      supabase.rpc('aforo_actual', { p_sede: sede }),
      supabase.rpc('entradas_recientes', { p_limite: 50 })
    ]);
    if (!a.error && Array.isArray(a.data)) {
      const g = a.data.find((x) => x.servicio === 'gimnasio');
      const s = a.data.find((x) => x.servicio === 'sauna');
      if (g) setGim({ ...estadoAforo(g.ocupados, g.capacidad), ocupados: g.ocupados, capacidad: g.capacidad });
      if (s) setSauna({ ocupados: s.ocupados, capacidad: s.capacidad });
    }
    if (!e.error && Array.isArray(e.data)) setRecientes(e.data);
  }, [sede]);
  useEffect(() => { cargarEstado(); }, [cargarEstado]);

  function cambiarSede(s) { setSede(s); guardarSede(s); }

  async function buscar(e) {
    e.preventDefault();
    setOk(''); aviso(''); setF(null);
    if (tipoBusqueda(texto) === 'vacio') return;
    const r = await supabase.rpc('buscar_cliente', { p_texto: texto });
    if (r.error) { aviso(mensajeError(r.error)); return; }
    const datos = Array.isArray(r.data) ? r.data : [];
    setResultados(datos);
    if (datos.length === 1) setF(datos[0]);
  }

  async function recargarFicha() {
    const r = await supabase.rpc('buscar_cliente', { p_texto: f.dni });
    if (!r.error && Array.isArray(r.data) && r.data[0]) setF(r.data[0]);
    cargarEstado();
  }

  const dec = f ? decisionEntrada({ fin: f.membresia_fin, tienePase: f.pase_hoy, aforoColor: gim && gim.color, ultimaEntrada: f.ultima_entrada }) : null;
  const sem = f ? semaforoMembresia(f.membresia_fin) : null;

  async function registrarEntrada() {
    if (dec.avisos.includes('lleno') && !window.confirm('El gimnasio está lleno. ¿Confirmar la entrada de todos modos?')) return;
    if (dec.avisos.includes('duplicado') && !window.confirm('Este cliente ya registró entrada hace menos de 2 horas. ¿Registrar otra?')) return;
    setOcupado(true);
    const r = await supabase.rpc('checkin_manual', { p_id_cliente: f.id_cliente, p_servicio: 'gimnasio', p_id_cita: null, p_sede: sede });
    setOcupado(false);
    if (r.error) { aviso(mensajeError(r.error)); return; }
    aviso(''); setOk(`Entrada registrada: ${f.nombre}. El aforo se actualizó.`);
    recargarFicha();
  }

  async function marcarAsistio(cita) {
    const r = await supabase.rpc('checkin_manual', { p_id_cliente: f.id_cliente, p_servicio: 'sauna', p_id_cita: cita.id_cita, p_sede: sede });
    if (r.error) { aviso(mensajeError(r.error)); return; }
    aviso(''); setOk('Asistencia al sauna registrada.');
    recargarFicha();
  }

  const haceUnaHora = Date.now() - 3600000;
  const ultimaHora = recientes.filter((r) => new Date(r.entrada_en).getTime() >= haceUnaHora).length;

  return (
    <div className="rec-pagina">
      <header className="rec-cab-pag">
        <div>
          <h1>Check-in</h1>
          <p>Busca por código, DNI o nombre. Cada entrada y cada asistencia queda registrada y mueve el aforo.</p>
        </div>
        <SedeSelector sede={sede} onCambiar={cambiarSede} />
      </header>

      <section className="rec-franja">
        <div className="rec-mini">
          <span className="rec-mini-ico"><Icono n="pesa" tam={24} /></span>
          <div><small>Aforo gimnasio · {sede}</small>
            <strong>{gim ? gim.ocupados : '–'}</strong> <em>/ {gim ? gim.capacidad : '–'} · {gim ? `${gim.porcentaje} %` : ''}</em></div>
        </div>
        <div className="rec-mini">
          <span className="rec-mini-ico"><Icono n="reloj" tam={24} /></span>
          <div><small>Entradas última hora</small><strong>{ultimaHora}</strong> <em>ingresos</em></div>
        </div>
        <div className="rec-mini">
          <span className="rec-mini-ico"><Icono n="sauna" tam={24} /></span>
          <div><small>Sauna, turno actual</small>
            <strong>{sauna ? sauna.ocupados : '–'}</strong> <em>/ {sauna ? sauna.capacidad : '–'} cupos</em></div>
        </div>
      </section>

      <form className="rec-buscador" onSubmit={buscar}>
        <Icono n="buscar" tam={22} />
        <label htmlFor="rec-q" className="sr">Código de cliente, DNI o nombre</label>
        <input id="rec-q" autoFocus placeholder="Código (C-1001), DNI de 8 dígitos o nombre" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button type="submit" className="rec-btn-principal">Buscar cliente</button>
      </form>

      {gim && gim.color !== 'verde' && gim.color !== 'gris' && (
        <p className={`rec-banda rec-${gim.color}`}>Gimnasio: {gim.mensaje} ({gim.porcentaje} %). Solo se advierte, la entrada no se bloquea.</p>
      )}
      {ok && <p className="rec-exito" role="status">{ok}</p>}

      <div className="rec-trabajo">
        <div className="rec-col">
          {resultados && resultados.length === 0 && (
            <div className="rec-panel">
              <strong>No se encontró al cliente.</strong>
              <p className="rec-nota">Lo normal es que se registre solo desde la web. Si no puede, usa Registro asistido.</p>
              <button type="button" className="rec-btn-sec" onClick={() => irA('registro', onAviso, 'Registro asistido está en construcción.')}>Ir a Registro asistido</button>
            </div>
          )}

          {resultados && resultados.length > 1 && !f && (
            <div className="rec-panel">
              <h2 className="rec-h2">Coincidencias</h2>
              <ul className="rec-lista">
                {resultados.map((c) => (
                  <li key={c.id_cliente}><button type="button" className="rec-fila-btn" onClick={() => setF(c)}>
                    <strong>{c.nombre}</strong><small>DNI {c.dni}{c.codigo_cliente ? ` · ${c.codigo_cliente}` : ''}</small></button></li>
                ))}
              </ul>
            </div>
          )}

          {!f && !resultados && <div className="rec-panel"><p className="rec-nota">Escribe un código, DNI o nombre para empezar.</p></div>}

          {f && (
            <section className="rec-panel">
              <div className="rec-ident">
                <div className="rec-ident-izq">
                  <div className="rec-avatar">{iniciales(f.nombre)}</div>
                  <div>
                    <small className="rec-num">{f.codigo_cliente || 'Sin código'} · DNI {f.dni}</small>
                    <h2>{f.nombre}</h2>
                    <small>Tel. {f.telefono || '—'} · {f.ultima_entrada ? `Última entrada ${hhmm(f.ultima_entrada)}` : 'Sin entradas registradas'}</small>
                  </div>
                </div>
                <div className="rec-lado">
                  <span className={`rec-baliza rec-${sem}`}>{TXT_BALIZA[sem]}</span>
                  <small>{textoMembresia(f.membresia_fin)}{f.pase_hoy ? ' · Pase del día pagado' : ''}</small>
                </div>
              </div>

              <div className="rec-bloque">
                <div className="rec-bloque-cab">
                  <div><h3>1. Gimnasio (máquinas)</h3><small>Sin reserva. Se entra con membresía vigente o pase del día.</small></div>
                  <span className="rec-etiqueta">{f.ultima_entrada ? 'YA REGISTRÓ ENTRADA' : 'SIN ENTRADA HOY'}</span>
                </div>
                {dec.puede ? (
                  <>
                    {dec.avisos.includes('lleno') && <p className="rec-aviso-amarillo">El gimnasio está lleno. Avísale y que decida; si entra, confirma.</p>}
                    {dec.avisos.includes('duplicado') && <p className="rec-aviso-amarillo">Ya registró entrada hace menos de 2 horas.</p>}
                    <button type="button" className="rec-btn-gran" disabled={ocupado} onClick={registrarEntrada}>
                      <Icono n="check" tam={22} /> Registrar entrada al gimnasio
                    </button>
                  </>
                ) : (
                  <div className="rec-opciones">
                    <div className="rec-opcion">
                      <small>OPCIÓN 1 · RECOMENDADA</small>
                      <strong>{sem === 'gris' ? 'Vender membresía' : 'Renovar membresía'}</strong>
                      <small>Mantiene la tarifa de afiliado en el sauna.</small>
                      <button type="button" className="rec-btn-sec" onClick={() => irA('pagos', onAviso, 'Pagos está en construcción.')}>Ir a cobrar membresía</button>
                    </div>
                    <div className="rec-opcion">
                      <small>OPCIÓN 2 · INGRESO INMEDIATO</small>
                      <strong>Pase del día (S/ 20)</strong>
                      <small>Entrada solo por hoy, sin membresía.</small>
                      <button type="button" className="rec-btn-nar" onClick={() => irA('pagos', onAviso, 'El pase del día se cobra en Pagos, que está en construcción.')}>Cobrar pase del día</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rec-bloque">
                <div className="rec-bloque-cab">
                  <div><h3>2. Sauna</h3><small>Siempre con reserva pagada. No exige membresía.</small></div>
                  <span className="rec-etiqueta">{f.citas_hoy.length} TURNO(S) HOY</span>
                </div>
                {f.citas_hoy.length === 0 && <p className="rec-nota">Sin citas de sauna hoy.</p>}
                <ul className="rec-lista">
                  {f.citas_hoy.map((c) => (
                    <li key={c.id_cita} className="rec-cita">
                      <div><strong className="rec-num">{hhmm(c.fecha_hora_cita)}</strong><small>{etiquetaPago[c.estado_pago]} · {etiquetaAsist[c.estado_asistencia]}</small></div>
                      {c.estado_asistencia === 'pendiente' && c.estado_pago === 'pagada' && (
                        <button type="button" className="rec-btn-nar" onClick={() => marcarAsistio(c)}>Registrar asistió</button>
                      )}
                    </li>
                  ))}
                </ul>
                <button type="button" className="rec-btn-sec" onClick={() => irA('reservar', onAviso)}>Reservar nuevo turno de sauna</button>
              </div>
            </section>
          )}
        </div>

        <aside className="rec-col">
          <section className="rec-panel">
            <h2 className="rec-h2">Ingresos recientes</h2>
            {recientes.length === 0 && <p className="rec-nota">Aún no hay entradas.</p>}
            <ul className="rec-feed">
              {recientes.slice(0, 6).map((r, i) => (
                <li key={`${r.dni}-${i}`}>
                  <div><strong>{r.nombre}</strong><small>{r.servicio === 'sauna' ? 'Sauna' : 'Gimnasio'} · {r.metodo === 'codigo' ? 'Código del local' : 'Manual'}</small></div>
                  <span className="rec-hora">{hhmm(r.entrada_en)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rec-nota-pie">
            <strong>Reglas del mostrador</strong>
            <ul>
              <li>El gimnasio no se reserva: membresía vigente o pase del día.</li>
              <li>El aforo cuenta los check-ins de los últimos 90 minutos.</li>
              <li>Si está lleno, se advierte pero no se bloquea.</li>
              <li>El sauna requiere reserva pagada; la asistencia se marca aquí.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}