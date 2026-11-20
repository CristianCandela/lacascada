import { useCallback, useEffect, useState } from 'react';
import './estilos.css';
import { supabase, mensajeError } from '../../lib/supabase';
import Icono from '../../components/Iconos';
import SedeSelector from './SedeSelector';
import { sedeGuardada, guardarSede, irA } from './sede';
import { esDniValido, esTelefonoValido } from './logica';

const VACIO = { nombre: '', telefono: '', consent: false };
const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function RegistroAsistido({ onAviso }) {
  const [sede, setSede] = useState(sedeGuardada());
  const [dni, setDni] = useState('');
  const [verif, setVerif] = useState(null); // null | { existe, nombre?, codigo_cliente? }
  const [form, setForm] = useState(VACIO);
  const [creado, setCreado] = useState(null);
  const [recientes, setRecientes] = useState([]);
  const [ocupado, setOcupado] = useState(false);

  const aviso = (m) => onAviso && onAviso(m);

  const cargar = useCallback(async () => {
    const r = await supabase.rpc('registros_asistidos_hoy', { p_limite: 5 });
    if (!r.error && Array.isArray(r.data)) setRecientes(r.data);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function verificar(e) {
    e.preventDefault();
    setCreado(null); aviso('');
    if (!esDniValido(dni)) { aviso('El DNI debe tener exactamente 8 dígitos.'); return; }
    const r = await supabase.rpc('verificar_dni', { p_dni: dni.trim() });
    if (r.error) { aviso(mensajeError(r.error)); return; }
    setVerif(r.data);
  }

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) { aviso('Falta el nombre completo.'); return; }
    if (!esTelefonoValido(form.telefono)) { aviso('El teléfono debe tener 9 dígitos (o déjalo vacío).'); return; }
    if (!form.consent) { aviso('El consentimiento informado es obligatorio.'); return; }
    setOcupado(true);
    const r = await supabase.rpc('registrar_cliente_asistido', { p_nombre: form.nombre, p_dni: dni.trim(), p_telefono: form.telefono, p_consentimiento: form.consent });
    setOcupado(false);
    if (r.error) { aviso(mensajeError(r.error)); return; }
    aviso('');
    setCreado({ nombre: form.nombre.trim(), dni: dni.trim(), telefono: form.telefono, codigo: r.data.codigo_cliente });
    setDni(''); setVerif(null); setForm(VACIO); cargar();
  }

  function limpiar() { setDni(''); setVerif(null); setForm(VACIO); setCreado(null); aviso(''); }

  return (
    <div className="rec-pagina">
      <header className="rec-cab-pag">
        <div><h1>Registro asistido</h1><p>Solo para clientes que no pueden registrarse desde la web. Nombre, DNI y consentimiento; el teléfono es opcional.</p></div>
        <SedeSelector sede={sede} onCambiar={(s) => { setSede(s); guardarSede(s); }} />
      </header>

      <p className="rec-aviso-amarillo">Lo normal es que el cliente se registre solo desde la web. Usa este formulario únicamente si no tiene celular o no puede hacerlo.</p>

      <section className="rec-franja">
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="usuarios" tam={22} /></span><div><small>Registros asistidos hoy</small><strong>{recientes.length}</strong></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="check" tam={22} /></span><div><small>Sede de trabajo</small><strong>{sede}</strong></div></div>
        <div className="rec-mini"><span className="rec-mini-ico"><Icono n="alerta" tam={22} /></span><div><small>Documento aceptado</small><strong>DNI</strong> <em>8 dígitos</em></div></div>
      </section>

      <div className="rec-trabajo">
        <div className="rec-col">
          <section className="rec-panel">
            <div className="rec-bloque-cab"><h3>1. Verificar DNI</h3><span className="rec-etiqueta">PASO 1 DE 2</span></div>
            <form className="rec-buscador" onSubmit={verificar}>
              <Icono n="buscar" tam={20} />
              <label htmlFor="ra-dni" className="sr">DNI</label>
              <input id="ra-dni" inputMode="numeric" maxLength={8} placeholder="DNI de 8 dígitos" value={dni} onChange={(e) => { setDni(e.target.value); setVerif(null); }} />
              <button type="submit" className="rec-btn-principal">Verificar DNI</button>
            </form>
            {verif && verif.existe && (
              <div className="rec-aviso-rojo">
                Ya existe un cliente con ese DNI: <strong>{verif.nombre}</strong> ({verif.codigo_cliente}). No se puede registrar dos veces.
                <div className="rec-acciones" style={{ marginTop: '.5rem' }}>
                  <button type="button" className="rec-btn-sec" onClick={() => irA('checkin', onAviso)}>Ir a Check-in</button>
                </div>
              </div>
            )}
            {verif && !verif.existe && <p className="rec-exito">DNI {dni} verificado: no existe registro previo. Puedes continuar.</p>}
          </section>

          {verif && !verif.existe && (
            <section className="rec-panel">
              <div className="rec-bloque-cab"><h3>2. Datos del cliente</h3><span className="rec-etiqueta">PASO 2 DE 2</span></div>
              <form className="rec-form" onSubmit={guardar}>
                <label>Nombre completo (como figura en el DNI)
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                </label>
                <label>Teléfono (opcional, 9 dígitos)
                  <input inputMode="numeric" maxLength={9} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                </label>
                <label className="rec-consent">
                  <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                  El cliente declara conocer el reglamento y autoriza el tratamiento de sus datos personales (Ley 29733). Obligatorio.
                </label>
                <div className="rec-acciones">
                  <button type="submit" className="rec-btn-principal" disabled={ocupado}>Guardar y generar código de cliente</button>
                  <button type="button" className="rec-btn-sec" onClick={limpiar}>Limpiar</button>
                </div>
              </form>
            </section>
          )}

          {creado && (
            <section className="rec-panel rec-resumen">
              <div className="rec-bloque-cab"><h3>Cliente registrado</h3><span className="rec-etiqueta">ACTIVO SIN PLAN</span></div>
              <div className="rec-total">
                <small>CÓDIGO DE CLIENTE</small>
                <strong className="rec-num">{creado.codigo}</strong>
                <span>Díselo al cliente o anótalo: lo usará para identificarse en la puerta.</span>
              </div>
              <dl className="rec-dl"><dt>Nombre</dt><dd>{creado.nombre}</dd><dt>DNI</dt><dd>{creado.dni}</dd><dt>Teléfono</dt><dd>{creado.telefono || '—'}</dd></dl>
              <div className="rec-acciones">
                <button type="button" className="rec-btn-principal" onClick={() => irA('pagos', onAviso)}>Ir a cobrar membresía o pase</button>
                <button type="button" className="rec-btn-sec" onClick={() => irA('reservar', onAviso)}>Reservar sauna</button>
              </div>
            </section>
          )}
        </div>

        <aside className="rec-col">
          <section className="rec-panel">
            <h3 className="rec-h2">Últimos registros asistidos de hoy</h3>
            {recientes.length === 0 && <p className="rec-nota">Aún no hay registros asistidos hoy.</p>}
            <ul className="rec-feed">
              {recientes.map((r, i) => (
                <li key={i}><div><strong>{r.nombre}</strong><small>{r.codigo_cliente} · DNI {r.dni}</small></div><span className="rec-hora">{hhmm(r.asistido_en)}</span></li>
              ))}
            </ul>
          </section>
          <section className="rec-nota-pie">
            <strong>Reglas del registro asistido</strong>
            <ul>
              <li>Solo DNI de 8 dígitos; el DNI es único.</li>
              <li>Datos mínimos: nombre y DNI. Teléfono opcional.</li>
              <li>El consentimiento debe quedar siempre registrado.</li>
              <li>Pide al cliente con celular que se registre en la web.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
