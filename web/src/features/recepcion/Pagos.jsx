import { useCallback, useEffect, useState } from 'react';
import './estilos.css';
import { supabase, mensajeError } from '../../lib/supabase';
import Icono from '../../components/Iconos';
import SedeSelector from './SedeSelector';
import { sedeGuardada, guardarSede } from './sede';
import { tipoBusqueda, semaforoMembresia, textoMembresia, PLANES, MOTIVOS_ANULACION, montoCobro, nuevoFin } from './logica';

const MEDIOS = [['efectivo', 'Efectivo'], ['yape', 'Yape'], ['plin', 'Plin']];
const CONCEPTOS = [['membresia', 'Membresía'], ['pase_dia', 'Pase del día (S/ 20)']];
const NOM_CONCEPTO = { membresia: 'Membresía', pase_dia: 'Pase del día', sauna: 'Sauna' };
const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function Pagos({ onAviso, textoInicial, onUsado }) {
  const [sede, setSede] = useState(sedeGuardada());
  const [concepto, setConcepto] = useState('membresia');
  const [texto, setTexto] = useState('');
  const [cliente, setCliente] = useState(null);
  const [lista, setLista] = useState(null);
  const [plan, setPlan] = useState(PLANES[1]);
  const [medio, setMedio] = useState('efectivo');
  const [pagos, setPagos] = useState([]);
  const [anular, setAnular] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [ok, setOk] = useState('');

  const aviso = (m) => onAviso && onAviso(m);

  const cargar = useCallback(async () => {
    const r = await supabase.rpc('pagos_hoy', { p_limite: 30 });
    if (!r.error && Array.isArray(r.data)) setPagos(r.data);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // Si otra pantalla manda un cliente (código o DNI), lo busca solo.
  useEffect(() => {
    if (!textoInicial) return;
    (async () => {
      const r = await supabase.rpc('buscar_cliente', { p_texto: textoInicial });
      if (r.error) { aviso(mensajeError(r.error)); return; }
      const datos = Array.isArray(r.data) ? r.data : [];
      setOk(''); setTexto(textoInicial); setLista(datos);
      setCliente(datos.length === 1 ? datos[0] : null);
      if (onUsado) onUsado();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoInicial]);

  async function buscar(e) {
    e.preventDefault();
    setOk(''); aviso(''); setCliente(null);
    if (tipoBusqueda(texto) === 'vacio') return;
    const r = await supabase.rpc('buscar_cliente', { p_texto: texto });
    if (r.error) { aviso(mensajeError(r.error)); return; }
    const datos = Array.isArray(r.data) ? r.data : [];
    setLista(datos);
    if (datos.length === 1) setCliente(datos[0]);
  }

  const monto = montoCobro(concepto, plan);
  const finNuevo = cliente && concepto === 'membresia' ? nuevoFin(cliente.membresia_fin, plan.dias) : null;

  async function cobrar() {
    setOcupado(true);
    const r = await supabase.rpc('registrar_pago', { p_id_cliente: cliente.id_cliente, p_id_plan: concepto === 'membresia' ? plan.id_plan : null, p_medio: medio, p_concepto: concepto });
    setOcupado(false);
    if (r.error) { aviso(mensajeError(r.error)); return; }
    aviso('');
    if (concepto === 'pase_dia') {
      const c = await supabase.rpc('checkin_manual', { p_id_cliente: cliente.id_cliente, p_servicio: 'gimnasio', p_id_cita: null, p_sede: sede });
      setOk(c.error ? `Pase cobrado a ${cliente.nombre}, pero la entrada falló: ${mensajeError(c.error)}` : `Pase del día cobrado y entrada registrada: ${cliente.nombre}.`);
    } else {
      setOk(`Membresía ${plan.nombre} cobrada a ${cliente.nombre}. Nuevo vencimiento: ${finNuevo}.`);
    }
    setCliente(null); setLista(null); setTexto(''); cargar();
  }

  async function confirmarAnulacion() {
    if (!motivo) { aviso('Elige el motivo de la anulación.'); return; }
    const r = await supabase.rpc('anular_pago', { p_id_pago: anular.id_pago, p_motivo: motivo });
    if (r.error) { aviso(mensajeError(r.error)); return; }
    aviso(''); setOk(`Pago de ${anular.nombre} anulado.`); setAnular(null); setMotivo(''); cargar();
  }

  const vigentes = pagos.filter((p) => p.estado !== 'anulado');
  const total = vigentes.reduce((a, p) => a + p.monto, 0);
  const porMedio = (m) => vigentes.filter((p) => p.medio === m).reduce((a, p) => a + p.monto, 0);
  const porConcepto = (c) => vigentes.filter((p) => p.concepto === c).reduce((a, p) => a + p.monto, 0);

  return (
    <div className="rec-pagina">
      <header className="rec-cab-pag">
        <div><h1>Caja y cobros</h1><p>Membresías y pases del día. El monto lo calcula el sistema y los pagos nacen confirmados.</p></div>
        <SedeSelector sede={sede} onCambiar={(s) => { setSede(s); guardarSede(s); }} />
      </header>

      <section className="rec-franja rec-franja4">
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="bandeja" tam={22} /></span><div><small>Total de hoy</small><strong>{soles(total)}</strong></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="pesa" tam={22} /></span><div><small>Efectivo</small><strong>{soles(porMedio('efectivo'))}</strong></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="check" tam={22} /></span><div><small>Yape</small><strong>{soles(porMedio('yape'))}</strong></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="check" tam={22} /></span><div><small>Plin</small><strong>{soles(porMedio('plin'))}</strong></div></div>
      </section>

      {ok && <p className="rec-exito" role="status">{ok}</p>}

      <div className="rec-trabajo">
        <section className="rec-panel">
          <div className="rec-bloque-cab"><h3>Nueva operación de cobro</h3><span className="rec-etiqueta">CAJA MOSTRADOR</span></div>

          <div className="rec-medios" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {CONCEPTOS.map(([v, t]) => (
              <button key={v} type="button" className={concepto === v ? 'rec-medio-act' : ''} onClick={() => setConcepto(v)}>{t}</button>
            ))}
          </div>

          {!cliente && (
            <form className="rec-buscador" onSubmit={buscar}>
              <Icono n="buscar" tam={20} />
              <label htmlFor="pg-q" className="sr">Código, DNI o nombre</label>
              <input id="pg-q" placeholder="Cliente: código (C-1001), DNI o nombre" value={texto} onChange={(e) => setTexto(e.target.value)} />
              <button type="submit" className="rec-btn-principal">Buscar</button>
            </form>
          )}
          {!cliente && lista && lista.length === 0 && <p className="rec-aviso-amarillo">No existe. Regístralo en Registro asistido si no puede hacerlo en la web.</p>}
          {!cliente && lista && lista.length > 1 && (
            <ul className="rec-lista">{lista.map((c) => (
              <li key={c.id_cliente}><button type="button" className="rec-fila-btn" onClick={() => setCliente(c)}><strong>{c.nombre}</strong><small>DNI {c.dni} · {c.codigo_cliente}</small></button></li>
            ))}</ul>
          )}

          {cliente && (
            <>
              <div className="rec-cliente-card">
                <div className="rec-avatar rec-avatar-sm">{cliente.nombre.slice(0, 2).toUpperCase()}</div>
                <div className="rec-cliente-dat">
                  <strong>{cliente.nombre}</strong>
                  <small className="rec-num">{cliente.codigo_cliente} · DNI {cliente.dni}</small>
                  <span className={`rec-estado rec-${semaforoMembresia(cliente.membresia_fin)}`}>{textoMembresia(cliente.membresia_fin)}</span>
                </div>
                <button type="button" className="rec-btn-sec" onClick={() => { setCliente(null); setLista(null); }}>Cambiar</button>
              </div>

              {concepto === 'membresia' && (
                <div className="rec-planes">
                  {PLANES.map((p) => (
                    <button key={p.id_plan} type="button" className={`rec-plan ${plan.id_plan === p.id_plan ? 'rec-plan-act' : ''}`} onClick={() => setPlan(p)}>
                      <small>{p.dias} días</small><strong>{p.nombre}</strong><span className="rec-num">S/ {p.precio}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="rec-total">
                <small>TOTAL A COBRAR</small>
                <strong className="rec-num">{soles(monto)}</strong>
                <span>Tarifa calculada por el sistema. No editable.{finNuevo ? ` Nuevo vencimiento: ${finNuevo}.` : ' Incluye la entrada de hoy al gimnasio.'}</span>
              </div>

              <div className="rec-medios">
                {MEDIOS.map(([v, t]) => (<button key={v} type="button" className={medio === v ? 'rec-medio-act' : ''} onClick={() => setMedio(v)}>{t}</button>))}
              </div>
              <button type="button" className="rec-btn-gran" disabled={ocupado} onClick={cobrar}>
                {concepto === 'membresia' ? `Confirmar cobro y activar plan (${soles(monto)})` : `Cobrar pase y registrar entrada (${soles(monto)})`}
              </button>
            </>
          )}
        </section>

        <aside className="rec-col">
          <section className="rec-panel">
            <div className="rec-bloque-cab"><h3>Transacciones de hoy</h3><span className="rec-etiqueta">{pagos.length} REGISTROS</span></div>
            {pagos.length === 0 && <p className="rec-nota">Aún no hay cobros hoy.</p>}
            <ul className="rec-feed">
              {pagos.map((p) => (
                <li key={p.id_pago} style={p.estado === 'anulado' ? { opacity: .5, textDecoration: 'line-through' } : null}>
                  <div><strong>{p.nombre}</strong><small>{hhmm(p.pagado_en)} · {NOM_CONCEPTO[p.concepto]} · {p.medio}</small></div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="rec-num">{soles(p.monto)}</span>
                    {p.estado !== 'anulado' && <button type="button" className="rec-link-rojo" onClick={() => setAnular(p)}>Anular</button>}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rec-panel">
            <h3 className="rec-h2">Desglose por concepto</h3>
            <div className="rec-franja" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="rec-bloque"><small>Membresías</small><strong className="rec-num">{soles(porConcepto('membresia'))}</strong></div>
              <div className="rec-bloque"><small>Pases</small><strong className="rec-num">{soles(porConcepto('pase_dia'))}</strong></div>
              <div className="rec-bloque"><small>Sauna</small><strong className="rec-num">{soles(porConcepto('sauna'))}</strong></div>
            </div>
          </section>

          <section className="rec-nota-pie">
            <strong>Reglas de caja</strong>
            <ul>
              <li>Medios: solo efectivo, Yape y Plin.</li>
              <li>Los pagos no se borran: se anulan con motivo.</li>
              <li>Sin montos editables ni vuelto.</li>
              <li>El pase del día registra la entrada y suma al aforo.</li>
            </ul>
          </section>
        </aside>
      </div>

      {anular && (
        <div className="rec-modal" role="dialog" aria-modal="true">
          <div className="rec-modal-caja">
            <h3>¿Anular este pago?</h3>
            <p>{anular.nombre} · {soles(anular.monto)} · {anular.medio}</p>
            <label className="rec-form">Motivo (obligatorio)
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option value="">Selecciona…</option>
                {MOTIVOS_ANULACION.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <div className="rec-acciones">
              <button type="button" className="rec-btn-sec" onClick={() => { setAnular(null); setMotivo(''); }}>Cancelar</button>
              <button type="button" className="rec-btn-principal" onClick={confirmarAnulacion}>Confirmar anulación</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
