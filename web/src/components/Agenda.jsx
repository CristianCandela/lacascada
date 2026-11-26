import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import {
  agruparPorDia, citasVigentes, claveDia, contarPorDia, diasDesde, hoyLocal,
  mensajeRecordatorio, minutosParaRecordar, textoFalta, urlWhatsApp
} from '../lib/logica';
import Icono, { iniciales, tonoAvatar } from './Iconos';
import './agenda.css';

const ETIQUETAS = { asistio: 'Asistió', no_asistio: 'No asistió', cancelo: 'Canceló', pendiente: 'Pendiente' };
const NOMBRE_SERVICIO = { sauna: 'Sauna', gimnasio: 'Gimnasio' };
const COLUMNAS = 'id_cita, id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia, origen, estado_pago, tarifa_aplicada, recordatorio_enviado_en, confirmada_en, clientes(nombre, telefono)';
const DIAS_TIRA = 14;     // días que muestra la tira de arriba
const DIAS_PROXIMAS = 31; // reservar_sauna permite hasta 30 días de anticipación

function moverDia(dia, n) {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return claveDia(d);
}

const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
const fechaLarga = (dia) => new Date(`${dia}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

function etiquetaDia(dia) {
  const hoy = hoyLocal();
  if (dia === hoy) return 'Hoy';
  if (dia === moverDia(hoy, 1)) return 'Mañana';
  return new Date(`${dia}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'long' });
}

// Cita de sauna con el pago pendiente (se cobra en recepción).
const porCobrar = (f) => f.servicio === 'sauna' && f.estado_pago === 'pendiente' && f.estado_asistencia !== 'cancelo';
const pagadaEnLinea = (f) => f.servicio === 'sauna' && f.origen === 'cliente' && f.estado_pago === 'pagada' && f.tarifa_aplicada != null && f.estado_asistencia !== 'cancelo';
const reembolsada = (f) => f.servicio === 'sauna' && f.estado_pago === 'reembolsada';
const textoCobro = (f) => `Por cobrar${f.tarifa_aplicada != null ? ` · S/ ${Number(f.tarifa_aplicada).toFixed(2)}` : ''}`;

function Resumen({ icono, tono, valor, texto }) {
  return (
    <div className={`resumen ${tono}`}>
      <span className="resumen-ico"><Icono n={icono} tam={20} /></span>
      <div><div className="resumen-num">{valor}</div><div className="resumen-eti">{texto}</div></div>
    </div>
  );
}

export default function Agenda({ perfil, onAviso }) {
  const [vista, setVista] = useState('dia');            // 'dia' | 'proximas'
  const [dia, setDia] = useState(hoyLocal());
  const [filas, setFilas] = useState(null);
  const [proximas, setProximas] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [fServicio, setFServicio] = useState('');
  const [fSede, setFSede] = useState('');
  const [soloRiesgo, setSoloRiesgo] = useState(false);
  const [riesgo, setRiesgo] = useState({});
  const [riesgoProx, setRiesgoProx] = useState({});
  const [soloRecordar, setSoloRecordar] = useState(false);
  const [fEstado, setFEstado] = useState('');
  const [ahora, setAhora] = useState(() => new Date());
  const admin = perfil.rol === 'administrador';

  // Riesgo heurístico del historial de 30 días (función SQL riesgo_clientes).
  async function riesgoDe(datos) {
    const ids = [...new Set(datos.filter((x) => x.estado_asistencia === 'pendiente').map((x) => x.id_cliente))];
    const mapa = {};
    if (ids.length) {
      const rr = await supabase.rpc('riesgo_clientes', { p_ids: ids });
      if (!rr.error) (rr.data || []).forEach((x) => { mapa[x.id_cliente] = x; });
    }
    return mapa;
  }

  // Reservas de hoy en adelante (alimenta la tira de días y la vista «Próximas reservas»).
  const cargarProximas = useCallback(async () => {
    const ini = new Date(`${hoyLocal()}T00:00:00`);
    const fin = new Date(ini.getTime() + DIAS_PROXIMAS * 24 * 3600 * 1000);
    try {
      const r = await supabase.from('citas').select(COLUMNAS)
        .gte('fecha_hora_cita', ini.toISOString())
        .lt('fecha_hora_cita', fin.toISOString())
        .order('fecha_hora_cita');
      if (r.error) throw r.error;
      const datos = r.data || [];
      setProximas(datos);
      setRiesgoProx(await riesgoDe(datos));
    } catch (e) {
      setProximas([]);
      onAviso(mensajeError(e));
    }
  }, [onAviso]);

  const cargar = useCallback(async () => {
    const ini = new Date(`${dia}T00:00:00`);
    const fin = new Date(ini.getTime() + 24 * 3600 * 1000);
    try {
      const r = await supabase.from('citas').select(COLUMNAS)
        .gte('fecha_hora_cita', ini.toISOString())
        .lt('fecha_hora_cita', fin.toISOString())
        .order('fecha_hora_cita');
      if (r.error) throw r.error;
      onAviso('');
      const datos = r.data || [];
      setFilas(datos);
      setRiesgo(await riesgoDe(datos));
    } catch (e) {
      setFilas([]);
      onAviso(mensajeError(e));
    }
    cargarProximas();
  }, [dia, onAviso, cargarProximas]);

  useEffect(() => { cargar(); }, [cargar]);

  // Refresco automático: las reservas y pagos que entran en línea aparecen solos, sin pulsar «Actualizar».
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) cargarRef.current(); }, 30000);
    return () => clearInterval(t);
  }, []);

  // Reloj para la cola de recordatorios: se actualiza cada minuto.
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  async function ejecutar(btn, operacion) {
    btn.disabled = true;
    try {
      const r = await operacion();
      if (r.error) throw r.error;
      await cargar();
    } catch (e) {
      onAviso(mensajeError(e));
      btn.disabled = false;
    }
  }

  // Actualiza una cita y comprueba que la base realmente cambió una fila (RLS puede devolver 0 filas sin error).
  async function actualizar(f, cambios, btn) {
    btn.disabled = true;
    try {
      const r = await supabase.from('citas').update(cambios).eq('id_cita', f.id_cita).select('id_cita');
      if (r.error) throw r.error;
      if (!r.data || r.data.length === 0) throw new Error('No se pudo guardar el cambio. Revisa tu sesión o tus permisos.');
      await cargar();
    } catch (e) {
      onAviso(mensajeError(e));
      btn.disabled = false;
    }
  }

  // Registra el estado y guarda el tiempo (clic → guardado) como log de usabilidad (H1 / US09).
  function marcar(f, estado, ev) {
    const inicio = performance.now();
    return actualizar(f, {
      estado_asistencia: estado,
      marcada_en: new Date().toISOString(),
      segundos_registro: Number(((performance.now() - inicio) / 1000).toFixed(2))
    }, ev.currentTarget);
  }

  // Corrige un registro equivocado: vuelve la cita a «pendiente».
  function reabrir(f, ev) {
    return actualizar(f, { estado_asistencia: 'pendiente', marcada_en: null, segundos_registro: null }, ev.currentTarget);
  }

  // Anula una reserva futura: queda como «Canceló» y el cupo de esa franja se libera.
  function anular(f, ev) {
    const nombre = f.clientes ? f.clientes.nombre : 'este cliente';
    const cuando = `${fechaLarga(claveDia(f.fecha_hora_cita))}, ${hhmm(f.fecha_hora_cita)}`;
    if (!window.confirm(`¿Anular la reserva de ${nombre} (${cuando})? El cupo quedará libre para otras personas.`)) return;
    return actualizar(f, { estado_asistencia: 'cancelo', marcada_en: new Date().toISOString(), segundos_registro: null }, ev.currentTarget);
  }

  function eliminar(f, ev) {
    if (!window.confirm('¿Eliminar esta cita? Esta acción no se puede deshacer.')) return;
    return ejecutar(ev.currentTarget, () => supabase.from('citas').delete().eq('id_cita', f.id_cita));
  }

  function recordar(f, ev) {
    const url = f.clientes && urlWhatsApp(f.clientes.telefono, mensajeRecordatorio(f));
    if (!url) { onAviso('El cliente no tiene un teléfono válido para WhatsApp.'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');   // se abre en el mismo gesto del clic
    return ejecutar(ev.currentTarget, () =>
      supabase.from('citas').update({ recordatorio_enviado_en: new Date().toISOString() }).eq('id_cita', f.id_cita));
  }

  function confirmar(f, ev) {
    return ejecutar(ev.currentTarget, () =>
      supabase.from('citas').update({ confirmada_en: new Date().toISOString() }).eq('id_cita', f.id_cita));
  }

  const q = buscar.trim().toLowerCase();
  const altoRiesgo = (f, mapa) => f.estado_asistencia === 'pendiente' && mapa[f.id_cliente] && mapa[f.id_cliente].alto_riesgo;
  const pasaFiltros = (f, mapa) =>
    (!fServicio || f.servicio === fServicio) &&
    (!fSede || f.sede === fSede) &&
    (!fEstado || (fEstado === 'pendiente' ? f.estado_asistencia === 'pendiente' : f.estado_asistencia !== 'pendiente')) &&
    (!soloRiesgo || altoRiesgo(f, mapa)) &&
    (!soloRecordar || minutosParaRecordar(f, ahora) !== null) &&
    (!q || (f.clientes && f.clientes.nombre.toLowerCase().includes(q)));

  // ----- Vista por día -----
  const todas = filas || [];
  const visibles = todas.filter((f) => pasaFiltros(f, riesgo));
  const cuenta = (e) => todas.filter((f) => f.estado_asistencia === e).length;
  const nRiesgo = todas.filter((f) => altoRiesgo(f, riesgo)).length;
  const porRecordar = todas.filter((f) => minutosParaRecordar(f, ahora) !== null);
  const esHoy = dia === hoyLocal();
  const titulo = fechaLarga(dia);

  // ----- Tira de días y vista «Próximas reservas» -----
  const porDia = contarPorDia(proximas || []);
  const tira = diasDesde(hoyLocal(), DIAS_TIRA);
  const vigentesProx = citasVigentes(proximas || []).filter((f) => new Date(f.fecha_hora_cita) > ahora);
  const proxFiltradas = vigentesProx.filter((f) => pasaFiltros(f, riesgoProx));
  const grupos = agruparPorDia(proxFiltradas);
  const limite7 = moverDia(hoyLocal(), 7);
  const nSemana = vigentesProx.filter((f) => claveDia(f.fecha_hora_cita) < limite7).length;
  const nOnline = vigentesProx.filter((f) => f.origen === 'cliente').length;
  const nSinConfirmar = vigentesProx.filter((f) => f.estado_asistencia === 'pendiente' && !f.confirmada_en).length;

  function abrirDia(d) { setDia(d); setVista('dia'); }

  const filtros = (
    <>
      <div className="entrada buscador">
        <Icono n="buscar" tam={18} />
        <label htmlFor="a-buscar" className="sr">Buscar cliente</label>
        <input id="a-buscar" type="search" placeholder="Buscar por cliente" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      </div>
      <label htmlFor="a-servicio" className="sr">Servicio</label>
      <select id="a-servicio" className="filtro" value={fServicio} onChange={(e) => setFServicio(e.target.value)}>
        <option value="">Todos los servicios</option>
        <option value="sauna">Sauna</option>
        <option value="gimnasio">Gimnasio</option>
      </select>
      <label htmlFor="a-sede" className="sr">Sede</label>
      <select id="a-sede" className="filtro" value={fSede} onChange={(e) => setFSede(e.target.value)}>
        <option value="">Todas las sedes</option>
        <option value="Túpac Amaru">Túpac Amaru</option>
        <option value="Santa Rosa">Santa Rosa</option>
      </select>
      <label htmlFor="a-estado" className="sr">Estado</label>
      <select id="a-estado" className="filtro" value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
        <option value="">Todos los estados</option>
        <option value="pendiente">Solo pendientes</option>
        <option value="atendida">Ya atendidas</option>
      </select>
      <label htmlFor="a-riesgo" className="chip-filtro">
        <input id="a-riesgo" type="checkbox" checked={soloRiesgo} onChange={(e) => setSoloRiesgo(e.target.checked)} />
        Solo alto riesgo
      </label>
      <button type="button" id="btn-agenda" className="sec" onClick={cargar}><Icono n="refrescar" tam={16} />Actualizar</button>
    </>
  );

  return (
    <div className="agenda">
      <div className="pag-cab">
        <div>
          <h1>Agenda</h1>
          <p className="ayuda">
            {vista === 'dia'
              ? `Control de asistencia de sauna y gimnasio. ${esHoy ? 'Hoy' : titulo}.`
              : 'Todas las reservas que vienen, sin tener que buscar día por día.'}
          </p>
        </div>
        <div className="segmento" role="tablist" aria-label="Vista de la agenda">
          <button type="button" role="tab" data-vista="dia" aria-selected={vista === 'dia'} onClick={() => setVista('dia')}>Por día</button>
          <button type="button" role="tab" data-vista="proximas" aria-selected={vista === 'proximas'} onClick={() => setVista('proximas')}>
            Próximas reservas
            {vigentesProx.length > 0 && <span className="seg-n">{vigentesProx.length}</span>}
          </button>
        </div>
      </div>

      {vista === 'dia' && (
        <>
          <div className="tira" role="group" aria-label="Próximos días">
            {tira.map((d) => {
              const n = porDia[d] || 0;
              const f = new Date(`${d}T12:00:00`);
              return (
                <button key={d} type="button" data-dia={d} className={`dia-chip${d === dia ? ' activo' : ''}`}
                  aria-pressed={d === dia} aria-label={`${fechaLarga(d)}: ${n} ${n === 1 ? 'reserva' : 'reservas'}`} onClick={() => setDia(d)}>
                  <small>{f.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '')}</small>
                  <b>{f.getDate()}</b>
                  <span className={`cupo ${n ? 'hay' : 'vacio-dia'}`}>{n || '–'}</span>
                </button>
              );
            })}
          </div>

          <div className="resumenes">
            <Resumen icono="usuarios" tono="azul" valor={todas.length} texto="Total de reservas" />
            <Resumen icono="check" tono="verde" valor={cuenta('asistio')} texto="Asistieron" />
            <Resumen icono="x" tono="naranja" valor={cuenta('no_asistio')} texto="No asistieron" />
            <Resumen icono="reloj" tono="gris" valor={cuenta('pendiente')} texto="Pendientes" />
            <Resumen icono="alerta" tono="ambar" valor={nRiesgo} texto="Pendientes de alto riesgo" />
          </div>

          <div className="tarjeta">
            <div className="herramientas">
              <div className="dia-nav">
                <button type="button" className="icono-btn" aria-label="Día anterior" onClick={() => setDia(moverDia(dia, -1))}><Icono n="izquierda" /></button>
                <label htmlFor="a-fecha" className="sr">Día</label>
                <input id="a-fecha" type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
                <button type="button" className="icono-btn" aria-label="Día siguiente" onClick={() => setDia(moverDia(dia, 1))}><Icono n="derecha" /></button>
                {!esHoy && <button type="button" className="sec chico" onClick={() => setDia(hoyLocal())}>Hoy</button>}
              </div>
              {filtros}
            </div>

            {todas.length > 0 && (
              <div className="avance" aria-label="Avance del día">
                <div className="avance-barra" role="img"
                  aria-label={`${cuenta('asistio')} asistieron, ${cuenta('no_asistio')} no asistieron, ${cuenta('cancelo')} cancelaron, ${cuenta('pendiente')} pendientes`}>
                  <span className="a-asistio" style={{ width: `${(cuenta('asistio') / todas.length) * 100}%` }} />
                  <span className="a-no" style={{ width: `${(cuenta('no_asistio') / todas.length) * 100}%` }} />
                  <span className="a-cancelo" style={{ width: `${(cuenta('cancelo') / todas.length) * 100}%` }} />
                  <span className="a-pend" style={{ width: `${(cuenta('pendiente') / todas.length) * 100}%` }} />
                </div>
                <div className="avance-leyenda">
                  <span><i style={{ background: 'var(--verde)' }} /><b>{cuenta('asistio')}</b> asistieron</span>
                  <span><i style={{ background: 'var(--naranja)' }} /><b>{cuenta('no_asistio')}</b> no asistieron</span>
                  <span><i style={{ background: '#8995A1' }} /><b>{cuenta('cancelo')}</b> cancelaron</span>
                  <span><i style={{ background: '#CBD5DD' }} /><b>{cuenta('pendiente')}</b> pendientes</span>
                </div>
              </div>
            )}

            {porRecordar.length > 0 && (
              <div className="cola-recordar" role="status" data-cola>
                <span>
                  <strong>{porRecordar.length} {porRecordar.length === 1 ? 'cita por recordar' : 'citas por recordar'}</strong>
                  {' '}(empiezan en 2 horas o menos y aún no tienen recordatorio ni confirmación).
                </span>
                <button type="button" className="sec chico" data-accion="ver-cola" onClick={() => setSoloRecordar(!soloRecordar)}>
                  {soloRecordar ? 'Ver todas' : 'Ver solo estas'}
                </button>
              </div>
            )}

            <div className="tabla-wrap">
              {filas === null && <p className="vacio">Cargando…</p>}
              {filas && todas.length === 0 && (
                <div className="vacio"><Icono n="agenda" tam={32} /><p>No hay citas para este día.</p><small>Las reservas de los clientes entran solas; revisa la vista «Próximas reservas» para ver otros días.</small></div>
              )}
              {filas && todas.length > 0 && visibles.length === 0 && (
                <div className="vacio"><Icono n="buscar" tam={32} /><p>Ninguna cita coincide con los filtros.</p></div>
              )}
              {visibles.length > 0 && (
                <table>
                  <thead>
                    <tr><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Contacto</th><th>Estado</th><th>Acción</th></tr>
                  </thead>
                  <tbody>
                    {visibles.map((f) => {
                      const nombre = f.clientes ? f.clientes.nombre : '—';
                      const falta = minutosParaRecordar(f, ahora);
                      const ini = new Date(f.fecha_hora_cita);
                      const enCurso = esHoy && f.estado_asistencia === 'pendiente' && ini <= ahora && ahora < new Date(ini.getTime() + 3600 * 1000);
                      return (
                        <tr key={f.id_cita} data-id={f.id_cita} className={f.estado_asistencia}>
                          <td data-label="Hora" className="hora">
                            <div className="hora-col"><span>{hhmm(f.fecha_hora_cita)}</span>{enCurso && <span className="en-curso">En curso</span>}</div>
                          </td>
                          <td data-label="Cliente">
                            <span className="persona">
                              <span className={`avatar ${tonoAvatar(nombre)}`} aria-hidden="true">{iniciales(nombre)}</span>
                              <span className="persona-txt">
                                <span>{nombre}
                                  {altoRiesgo(f, riesgo) && (
                                    <span className="etq riesgo" data-riesgo="alto"
                                      title={`${riesgo[f.id_cliente].no_asistio} inasistencias en ${riesgo[f.id_cliente].total} citas de los últimos 30 días (${riesgo[f.id_cliente].tasa}%)`}>
                                      <Icono n="alerta" tam={12} />Alto riesgo
                                    </span>
                                  )}
                                </span>
                                <small>Sede {f.sede}</small>
                              </span>
                            </span>
                          </td>
                          <td data-label="Servicio"><span className={`servicio ${f.servicio}`}><Icono n={f.servicio === 'sauna' ? 'sauna' : 'pesa'} tam={14} />{NOMBRE_SERVICIO[f.servicio] || f.servicio}</span></td>
                          <td data-label="Contacto">
                            <div className="contacto">
                              <span data-contacto>
                                {f.confirmada_en ? <span className="etq asistio">Confirmó</span>
                                  : f.recordatorio_enviado_en ? <span className="etq">Recordado</span>
                                  : falta !== null ? <span className="etq recordar" data-recordar>Recordar · faltan {textoFalta(falta)}</span>
                                  : <span className="tenue">Sin contacto</span>}
                              </span>
                              {f.estado_asistencia === 'pendiente' && (
                                <span className="contacto-acc">
                                  <button type="button" data-accion="whatsapp" className={`chico ${falta !== null || altoRiesgo(f, riesgo) ? 'wa-destacado' : 'sec'}`} title="Enviar recordatorio por WhatsApp" aria-label="Enviar recordatorio por WhatsApp" onClick={(e) => recordar(f, e)}><Icono n="whatsapp" tam={16} /><span className="txt-wa">WhatsApp</span></button>
                                  {!f.confirmada_en && (
                                    <button type="button" data-accion="confirmar" className="sec chico" onClick={(e) => confirmar(f, e)}>Confirmó</button>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                          <td data-label="Estado"><span className={`etq ${f.estado_asistencia}`}>{ETIQUETAS[f.estado_asistencia]}</span>{porCobrar(f) && <span className="etq recordar por-cobrar" data-pago="pendiente">{textoCobro(f)}</span>}{pagadaEnLinea(f) && <span className="etq asistio por-cobrar" data-pago="pagada">Pagado · S/ {Number(f.tarifa_aplicada).toFixed(2)}</span>}{reembolsada(f) && <span className="etq por-cobrar" data-pago="reembolsada">Reembolsado</span>}</td>
                          <td data-label="Acción" className="acciones">
                            {f.estado_asistencia === 'pendiente' ? (
                              <>
                                <button type="button" data-accion="asistio" className="ok-btn chico" onClick={(e) => marcar(f, 'asistio', e)}><Icono n="check" tam={15} />Asistió</button>
                                <button type="button" data-accion="no_asistio" className="peligro chico" onClick={(e) => marcar(f, 'no_asistio', e)}><Icono n="x" tam={15} />No asistió</button>
                                <button type="button" data-accion="cancelo" className="sec chico" onClick={(e) => marcar(f, 'cancelo', e)}><Icono n="x" tam={15} />Canceló</button>
                              </>
                            ) : (
                              <button type="button" data-accion="reabrir" className="sec chico" title="Volver a pendiente si te equivocaste" onClick={(e) => reabrir(f, e)}><Icono n="refrescar" tam={14} />Corregir</button>
                            )}
                            {admin && <button type="button" data-accion="eliminar" className="icono-btn borrar" aria-label="Eliminar cita" onClick={(e) => eliminar(f, e)}><Icono n="papelera" tam={16} /></button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {visibles.length > 0 && <p className="tabla-pie">Mostrando {visibles.length} de {todas.length} citas</p>}
          </div>
        </>
      )}

      {vista === 'proximas' && (
        <>
          <div className="resumenes">
            <Resumen icono="agenda" tono="azul" valor={vigentesProx.length} texto="Reservas próximas (30 días)" />
            <Resumen icono="reloj" tono="naranja" valor={nSemana} texto="En los próximos 7 días" />
            <Resumen icono="usuarios" tono="verde" valor={nOnline} texto="Reservadas por el cliente" />
            <Resumen icono="alerta" tono="gris" valor={nSinConfirmar} texto="Sin confirmar con el cliente" />
          </div>

          <div className="tarjeta">
            <div className="herramientas">{filtros}</div>
            <p className="nota-prox">Las reservas se asignan solas: si una franja está llena, nadie más puede reservarla. Aquí solo supervisas y, si hace falta, anulas.</p>

            {proximas === null && <p className="vacio">Cargando…</p>}
            {proximas && vigentesProx.length === 0 && (
              <div className="vacio"><Icono n="agenda" tam={32} /><p>No hay reservas próximas.</p><small>Cuando un cliente reserve, aparecerá aquí automáticamente.</small></div>
            )}
            {proximas && vigentesProx.length > 0 && grupos.length === 0 && (
              <div className="vacio"><Icono n="buscar" tam={32} /><p>Ninguna reserva coincide con los filtros.</p></div>
            )}

            {grupos.map((g) => (
              <section key={g.dia} className="prox-dia" data-dia-grupo={g.dia}>
                <div className="prox-cab">
                  <div className="prox-fecha"><b>{etiquetaDia(g.dia)}</b><span>{fechaLarga(g.dia)}</span></div>
                  <span className="prox-cuenta">{g.citas.length} {g.citas.length === 1 ? 'reserva' : 'reservas'}</span>
                  <button type="button" className="sec chico" data-accion="abrir-dia" onClick={() => abrirDia(g.dia)}>Abrir día</button>
                </div>
                <ul className="prox-lista">
                  {g.citas.map((f) => {
                    const nombre = f.clientes ? f.clientes.nombre : '—';
                    const r = riesgoProx[f.id_cliente];
                    return (
                      <li key={f.id_cita} data-id={f.id_cita} className={`prox-item ${f.estado_asistencia}`}>
                        <span className="prox-hora">{hhmm(f.fecha_hora_cita)}</span>
                        <div className="prox-quien">
                          <span className={`avatar ${tonoAvatar(nombre)}`} aria-hidden="true">{iniciales(nombre)}</span>
                          <div className="persona-txt">
                            <span>{nombre}</span>
                            <div className="prox-meta">
                              <span className={`servicio ${f.servicio}`}><Icono n={f.servicio === 'sauna' ? 'sauna' : 'pesa'} tam={14} />{NOMBRE_SERVICIO[f.servicio] || f.servicio}</span>
                              <small>Sede {f.sede}</small>
                              {f.origen === 'cliente' && <span className="etq online">Reservó en línea</span>}
                              {porCobrar(f) && <span className="etq recordar por-cobrar" data-pago="pendiente">{textoCobro(f)}</span>}
                              {pagadaEnLinea(f) && <span className="etq asistio" data-pago="pagada">Pagado · S/ {Number(f.tarifa_aplicada).toFixed(2)}</span>}
                              {f.confirmada_en && <span className="etq asistio">Confirmó</span>}
                              {!f.confirmada_en && f.recordatorio_enviado_en && <span className="etq">Recordado</span>}
                              {altoRiesgo(f, riesgoProx) && (
                                <span className="etq riesgo" data-riesgo="alto" title={`${r.no_asistio} inasistencias en ${r.total} citas de los últimos 30 días (${r.tasa}%)`}>
                                  <Icono n="alerta" tam={12} />Alto riesgo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="prox-acc">
                          {f.estado_asistencia === 'pendiente' && (
                            <button type="button" data-accion="whatsapp" className="sec chico" title="Enviar recordatorio por WhatsApp" aria-label="Enviar recordatorio por WhatsApp" onClick={(e) => recordar(f, e)}><Icono n="whatsapp" tam={16} /><span className="txt-wa">WhatsApp</span></button>
                          )}
                          <button type="button" data-accion="anular" className="chico anular" onClick={(e) => anular(f, e)}><Icono n="x" tam={14} />Anular</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
