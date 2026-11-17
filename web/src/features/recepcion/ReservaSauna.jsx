import { useCallback, useEffect, useState } from 'react';
import './estilos.css';
import { supabase, mensajeError } from '../../lib/supabase';
import Icono from '../../components/Iconos';
import SedeSelector from './SedeSelector';
import { sedeGuardada, guardarSede } from './sede';
import { tipoBusqueda, semaforoMembresia, textoMembresia, esAfiliadoVigente, calcularTarifaSauna, esDniValido, esTelefonoValido, turnosDelDia, TARIFAS } from './logica';

const MEDIOS = [['efectivo', 'Efectivo', 'pesa'], ['yape', 'Yape', 'check'], ['plin', 'Plin', 'check']];
const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
const iniciales = (n) => String(n || '?').split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase();
const VACIO = { nombre: '', dni: '', telefono: '', consent: false };

export default function ReservaSauna({ onAviso }) {
  const [sede, setSede] = useState(sedeGuardada());
  const [texto, setTexto] = useState('');
  const [cliente, setCliente] = useState(null);
  const [lista, setLista] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [dia, setDia] = useState(0);
  const [turnos, setTurnos] = useState([]);
  const [turno, setTurno] = useState(null);
  const [medio, setMedio] = useState('efectivo');
  const [ocupado, setOcupado] = useState(false);
  const [ok, setOk] = useState('');
  const [recientes, setRecientes] = useState([]);

  const aviso = (m) => onAviso && onAviso(m);

  const cargarRecientes = useCallback(async () => {
    const r = await supabase.rpc('reservas_recepcion_hoy', { p_limite: 5 });
    if (!r.error && Array.isArray(r.data)) setRecientes(r.data);
  }, []);

  const cargarTurnos = useCallback(async () => {
    const horas = turnosDelDia(dia);
    const filas = await Promise.all(horas.map(async (d) => {
      const r = await supabase.rpc('disponibilidad', { p_servicio: 'sauna', p_sede: sede, p_fecha_hora: d.toISOString() });
      const dat = r.data && typeof r.data.libres === 'number' ? r.data : { capacidad: 0, ocupados: 0, libres: 0 };
      return { iso: d.toISOString(), ...dat };
    }));
    setTurnos(filas); setTurno(null);
  }, [dia, sede]);

  useEffect(() => { cargarRecientes(); }, [cargarRecientes]);
  useEffect(() => { if (cliente) cargarTurnos(); }, [cliente, cargarTurnos]);

  function cambiarSede(s) { setSede(s); guardarSede(s); setTurno(null); }

  async function buscar(e) {
    e.preventDefault();
    setOk(''); aviso(''); setCliente(null); setNuevo(false);
    if (tipoBusqueda(texto) === 'vacio') return;
    const r = await supabase.rpc('buscar_cliente', { p_texto: texto });
    if (r.error) { aviso(mensajeError(r.error)); return; }
    const datos = Array.isArray(r.data) ? r.data : [];
    setLista(datos);
    if (datos.length === 1) setCliente(datos[0]);
    if (datos.length === 0) { setNuevo(true); setForm({ ...VACIO, dni: tipoBusqueda(texto) === 'dni' ? texto.trim() : '' }); }
  }

  async function registrar(e) {
    e.preventDefault();
    if (!esDniValido(form.dni)) { aviso('El DNI debe tener 8 dígitos.'); return; }
    if (!esTelefonoValido(form.telefono)) { aviso('El teléfono debe tener 9 dígitos (o déjalo vacío).'); return; }
    if (!form.consent) { aviso('Falta marcar el consentimiento informado.'); return; }
    setOcupado(true);
    const r = await supabase.rpc('registrar_cliente_asistido', { p_nombre: form.nombre, p_dni: form.dni, p_telefono: form.telefono, p_consentimiento: form.consent });
    if (r.error) { setOcupado(false); aviso(mensajeError(r.error)); return; }
    const b = await supabase.rpc('buscar_cliente', { p_texto: form.dni });
    setOcupado(false); aviso('');
    setNuevo(false); setOk(`Cliente registrado. Su código es ${r.data.codigo_cliente}.`);
    if (Array.isArray(b.data) && b.data[0]) setCliente(b.data[0]);
  }

  async function reservar() {
    setOcupado(true);
    const r = await supabase.rpc('reservar_sauna_recepcion', { p_id_cliente: cliente.id_cliente, p_sede: sede, p_fecha_hora: turno.iso, p_medio: medio });
    setOcupado(false);
    if (r.error) { aviso(mensajeError(r.error)); cargarTurnos(); return; }
    aviso(''); setOk(`Reserva cobrada: ${cliente.nombre}, ${hhmm(turno.iso)} (${dia === 0 ? 'hoy' : 'mañana'}) en ${sede}.`);
    setCliente(null); setLista(null); setTexto(''); setTurno(null); cargarRecientes();
  }

  function limpiar() { setCliente(null); setLista(null); setNuevo(false); setTexto(''); setTurno(null); setOk(''); aviso(''); }

  const afiliado = cliente ? esAfiliadoVigente(cliente.membresia_fin) : false;
  const tarifa = calcularTarifaSauna(afiliado);
  const paso = !cliente ? 1 : !turno ? 2 : 3;
  const libresTotal = turnos.reduce((a, t) => a + t.libres, 0);
  const proximo = turnos.find((t) => t.libres > 0);

  return (
    <div className="rec-pagina">
      <header className="rec-cab-pag">
        <div>
          <h1>Reservar cita de sauna</h1>
          <p>Reserva y cobro en un solo paso. La cita nace pagada y ocupa un cupo del turno.</p>
        </div>
        <SedeSelector sede={sede} onCambiar={cambiarSede} />
      </header>

      <section className="rec-franja rec-franja4">
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="agenda" tam={22} /></span>
          <div><small>Cupos libres ({dia === 0 ? 'hoy' : 'mañana'})</small><strong>{cliente ? libresTotal : '–'}</strong></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="reloj" tam={22} /></span>
          <div><small>Próximo turno libre</small><strong>{proximo ? hhmm(proximo.iso) : '–'}</strong></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="check" tam={22} /></span>
          <div><small>Tarifa afiliado</small><strong>S/ {TARIFAS.sauna_afiliado.toFixed(2)}</strong></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="usuarios" tam={22} /></span>
          <div><small>Tarifa regular</small><strong>S/ {TARIFAS.sauna_regular.toFixed(2)}</strong></div></div>
      </section>

      <ol className="rec-pasos">
        {['Cliente', 'Turno', 'Cobro'].map((t, i) => (
          <li key={t} className={paso === i + 1 ? 'rec-paso-act' : paso > i + 1 ? 'rec-paso-ok' : ''}>
            <span>{paso > i + 1 ? '✓' : i + 1}</span>{t}
          </li>
        ))}
      </ol>

      {ok && <p className="rec-exito" role="status">{ok}</p>}

      <div className="rec-trabajo">
        <div className="rec-col">
          <section className="rec-panel">
            <div className="rec-bloque-cab">
              <h3>1. Cliente</h3>
              {cliente && <button type="button" className="rec-btn-sec" onClick={limpiar}>Cambiar cliente</button>}
            </div>

            {!cliente && !nuevo && (
              <form className="rec-buscador" onSubmit={buscar}>
                <Icono n="buscar" tam={20} />
                <label htmlFor="rs-q" className="sr">Código, DNI o nombre</label>
                <input id="rs-q" autoFocus placeholder="Código (C-1001), DNI o nombre" value={texto} onChange={(e) => setTexto(e.target.value)} />
                <button type="submit" className="rec-btn-principal">Buscar</button>
              </form>
            )}

            {!cliente && lista && lista.length > 1 && (
              <ul className="rec-lista">
                {lista.map((c) => (
                  <li key={c.id_cliente}><button type="button" className="rec-fila-btn" onClick={() => setCliente(c)}>
                    <strong>{c.nombre}</strong><small>DNI {c.dni}{c.codigo_cliente ? ` · ${c.codigo_cliente}` : ''}</small></button></li>
                ))}
              </ul>
            )}

            {nuevo && (
              <form className="rec-form" onSubmit={registrar}>
                <p className="rec-aviso-amarillo">No existe. Lo normal es que el cliente se registre solo desde la web; usa esto solo si no puede.</p>
                <label>Nombre completo<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
                <div className="rec-form-fila">
                  <label>DNI (8 dígitos)<input inputMode="numeric" maxLength={8} value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} required /></label>
                  <label>Teléfono (opcional)<input inputMode="numeric" maxLength={9} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></label>
                </div>
                <label className="rec-consent"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                  Consentimiento informado: el cliente autoriza el tratamiento de sus datos (Ley 29733).</label>
                <div className="rec-acciones">
                  <button type="submit" className="rec-btn-principal" disabled={ocupado}>Registrar y continuar</button>
                  <button type="button" className="rec-btn-sec" onClick={limpiar}>Cancelar</button>
                </div>
              </form>
            )}

            {cliente && (
              <div className="rec-cliente-card">
                <div className="rec-avatar rec-avatar-sm">{iniciales(cliente.nombre)}</div>
                <div className="rec-cliente-dat">
                  <strong>{cliente.nombre}</strong>
                  <small className="rec-num">{cliente.codigo_cliente || 'Sin código'} · DNI {cliente.dni}</small>
                  <span className={`rec-estado rec-${semaforoMembresia(cliente.membresia_fin)}`}>{textoMembresia(cliente.membresia_fin)}</span>
                </div>
                <div className={`rec-benef ${afiliado ? 'rec-benef-si' : ''}`}>
                  {afiliado ? `Aplica tarifa de afiliado (S/ ${TARIFAS.sauna_afiliado.toFixed(2)})` : `Tarifa regular (S/ ${TARIFAS.sauna_regular.toFixed(2)})`}
                </div>
              </div>
            )}
          </section>

          {cliente && (
            <section className="rec-panel">
              <div className="rec-bloque-cab">
                <div><h3>2. Turno</h3><small>Sede {sede} · turnos de 60 min</small></div>
                <div className="rec-tabs">
                  <button type="button" className={dia === 0 ? 'rec-tab-act' : ''} onClick={() => setDia(0)}>Hoy</button>
                  <button type="button" className={dia === 1 ? 'rec-tab-act' : ''} onClick={() => setDia(1)}>Mañana</button>
                </div>
              </div>

              <div className="rec-leyenda">
                <span><i className="rec-pto rec-pto-ok" />Disponible</span>
                <span><i className="rec-pto rec-pto-casi" />Casi lleno</span>
                <span><i className="rec-pto rec-pto-lleno" />Lleno</span>
              </div>

              {turnos.length === 0 && <p className="rec-nota">No quedan turnos para este día.</p>}
              <div className="rec-turnos-grid">
                {turnos.map((t) => {
                  const pct = t.capacidad ? Math.round((t.ocupados / t.capacidad) * 100) : 100;
                  const clase = t.libres === 0 ? 'rec-lleno' : t.libres <= 1 ? 'rec-casi' : 'rec-libre';
                  const fin = new Date(new Date(t.iso).getTime() + 3600000).toISOString();
                  return (
                    <button key={t.iso} type="button" disabled={t.libres === 0}
                      className={`rec-turno-card ${clase} ${turno && turno.iso === t.iso ? 'rec-sel' : ''}`} onClick={() => setTurno(t)}>
                      <strong className="rec-num">{hhmm(t.iso)} – {hhmm(fin)}</strong>
                      <span className="rec-turno-estado">{t.libres === 0 ? 'Lleno' : t.libres === 1 ? '1 libre' : `${t.libres} libres`}</span>
                      <span className="rec-turno-barra"><i style={{ width: `${Math.min(pct, 100)}%` }} /></span>
                      <small>{t.ocupados} de {t.capacidad} ocupados</small>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="rec-col">
          <section className="rec-panel rec-resumen">
            <div className="rec-bloque-cab"><h3>3. Cobro</h3><span className="rec-etiqueta">CAJA MOSTRADOR</span></div>
            {!cliente || !turno ? <p className="rec-nota">Elige cliente y turno para ver el monto.</p> : (
              <>
                <dl className="rec-dl">
                  <dt>Cliente</dt><dd>{cliente.nombre}</dd>
                  <dt>Sede</dt><dd>{sede}</dd>
                  <dt>Turno</dt><dd>{dia === 0 ? 'Hoy' : 'Mañana'} · {hhmm(turno.iso)}</dd>
                </dl>
                <div className="rec-total">
                  <small>TOTAL A COBRAR</small>
                  <strong className="rec-num">S/ {tarifa.monto.toFixed(2)}</strong>
                  <span>{tarifa.etiqueta} · lo calcula el sistema, no se edita</span>
                </div>
                {!afiliado && <p className="rec-nota">Con membresía vigente pagaría S/ {TARIFAS.sauna_afiliado.toFixed(2)}.</p>}
                <div className="rec-medios">
                  {MEDIOS.map(([v, t]) => (
                    <button key={v} type="button" className={medio === v ? 'rec-medio-act' : ''} onClick={() => setMedio(v)}>{t}</button>
                  ))}
                </div>
                <button type="button" className="rec-btn-gran" disabled={ocupado} onClick={reservar}>
                  Cobrar S/ {tarifa.monto.toFixed(2)} y reservar
                </button>
              </>
            )}
          </section>

          <section className="rec-panel">
            <h3 className="rec-h2">Últimas reservas en recepción</h3>
            {recientes.length === 0 && <p className="rec-nota">Aún no hay reservas hoy.</p>}
            <ul className="rec-feed">
              {recientes.map((r, i) => (
                <li key={i}>
                  <div><strong>{r.nombre}</strong><small>{hhmm(r.fecha_hora_cita)} · S/ {Number(r.tarifa).toFixed(2)}</small></div>
                  <span className="rec-estado rec-verde">Pagada</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rec-nota-pie">
            <strong>Reglas de recepción</strong>
            <ul>
              <li>El sauna no exige membresía; el afiliado paga menos.</li>
              <li>Reserva y pago se guardan juntos o no se guarda nada.</li>
              <li>Si el turno se llena mientras cobras, no se cobra.</li>
              <li>Los pagos no se borran: se anulan con motivo.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}