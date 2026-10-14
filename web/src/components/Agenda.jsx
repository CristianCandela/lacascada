import { useCallback, useEffect, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { hoyLocal, mensajeRecordatorio, urlWhatsApp } from '../lib/logica';
import Icono, { iniciales, tonoAvatar } from './Iconos';

const ETIQUETAS = { asistio: 'Asistió', no_asistio: 'No asistió', pendiente: 'Pendiente' };
const NOMBRE_SERVICIO = { sauna: 'Sauna', gimnasio: 'Gimnasio' };

function moverDia(dia, n) {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Resumen({ icono, tono, valor, texto }) {
  return (
    <div className={`resumen ${tono}`}>
      <span className="resumen-ico"><Icono n={icono} tam={20} /></span>
      <div><div className="resumen-num">{valor}</div><div className="resumen-eti">{texto}</div></div>
    </div>
  );
}

export default function Agenda({ perfil, onAviso }) {
  const [dia, setDia] = useState(hoyLocal());
  const [filas, setFilas] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [fServicio, setFServicio] = useState('');
  const [fSede, setFSede] = useState('');
  const admin = perfil.rol === 'administrador';

  const cargar = useCallback(async () => {
    const ini = new Date(`${dia}T00:00:00`);
    const fin = new Date(ini.getTime() + 24 * 3600 * 1000);
    try {
      const r = await supabase.from('citas')
        .select('id_cita, servicio, sede, fecha_hora_cita, estado_asistencia, recordatorio_enviado_en, confirmada_en, clientes(nombre, telefono)')
        .gte('fecha_hora_cita', ini.toISOString())
        .lt('fecha_hora_cita', fin.toISOString())
        .order('fecha_hora_cita');
      if (r.error) throw r.error;
      onAviso('');
      setFilas(r.data || []);
    } catch (e) {
      setFilas([]);
      onAviso(mensajeError(e));
    }
  }, [dia, onAviso]);

  useEffect(() => { cargar(); }, [cargar]);

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

  function marcar(f, estado, ev) {
    return ejecutar(ev.currentTarget, () =>
      supabase.from('citas').update({ estado_asistencia: estado }).eq('id_cita', f.id_cita));
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

  const todas = filas || [];
  const q = buscar.trim().toLowerCase();
  const visibles = todas.filter((f) =>
    (!fServicio || f.servicio === fServicio) &&
    (!fSede || f.sede === fSede) &&
    (!q || (f.clientes && f.clientes.nombre.toLowerCase().includes(q))));
  const cuenta = (e) => todas.filter((f) => f.estado_asistencia === e).length;
  const esHoy = dia === hoyLocal();
  const titulo = new Date(`${dia}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <div className="pag-cab">
        <div>
          <h1>Agenda del día</h1>
          <p className="ayuda">Control de asistencia de sauna y gimnasio. {esHoy ? 'Hoy' : titulo}.</p>
        </div>
      </div>

      <div className="resumenes">
        <Resumen icono="usuarios" tono="azul" valor={todas.length} texto="Total de reservas" />
        <Resumen icono="check" tono="verde" valor={cuenta('asistio')} texto="Asistieron" />
        <Resumen icono="x" tono="naranja" valor={cuenta('no_asistio')} texto="No asistieron" />
        <Resumen icono="reloj" tono="gris" valor={cuenta('pendiente')} texto="Pendientes" />
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
            <option value="Año Nuevo">Año Nuevo</option>
            <option value="Santa Rosa">Santa Rosa</option>
          </select>
          <button type="button" id="btn-agenda" className="sec" onClick={cargar}><Icono n="refrescar" tam={16} />Actualizar</button>
        </div>

        <div className="tabla-wrap">
          {filas === null && <p className="vacio">Cargando…</p>}
          {filas && todas.length === 0 && (
            <div className="vacio"><Icono n="agenda" tam={32} /><p>No hay citas para este día.</p><small>Registra una reserva o revisa las solicitudes pendientes.</small></div>
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
                  return (
                    <tr key={f.id_cita} data-id={f.id_cita}>
                      <td data-label="Hora" className="hora">{new Date(f.fecha_hora_cita).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                      <td data-label="Cliente">
                        <span className="persona">
                          <span className={`avatar ${tonoAvatar(nombre)}`} aria-hidden="true">{iniciales(nombre)}</span>
                          <span className="persona-txt"><span>{nombre}</span><small>Sede {f.sede}</small></span>
                        </span>
                      </td>
                      <td data-label="Servicio"><span className={`servicio ${f.servicio}`}><Icono n={f.servicio === 'sauna' ? 'sauna' : 'pesa'} tam={14} />{NOMBRE_SERVICIO[f.servicio] || f.servicio}</span></td>
                      <td data-label="Contacto">
                        <div className="contacto">
                          <span data-contacto>
                            {f.confirmada_en ? <span className="etq asistio">Confirmó</span>
                              : f.recordatorio_enviado_en ? <span className="etq">Recordado</span> : <span className="tenue">Sin contacto</span>}
                          </span>
                          {f.estado_asistencia === 'pendiente' && (
                            <span className="contacto-acc">
                              <button type="button" data-accion="whatsapp" className="sec chico" title="Enviar recordatorio por WhatsApp" aria-label="Enviar recordatorio por WhatsApp" onClick={(e) => recordar(f, e)}><Icono n="whatsapp" tam={16} /><span className="txt-wa">WhatsApp</span></button>
                              {!f.confirmada_en && (
                                <button type="button" data-accion="confirmar" className="sec chico" onClick={(e) => confirmar(f, e)}>Confirmó</button>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-label="Estado"><span className={`etq ${f.estado_asistencia}`}>{ETIQUETAS[f.estado_asistencia]}</span></td>
                      <td data-label="Acción" className="acciones">
                        <button type="button" data-accion="asistio" className="ok-btn chico" onClick={(e) => marcar(f, 'asistio', e)}><Icono n="check" tam={15} />Asistió</button>
                        <button type="button" data-accion="no_asistio" className="peligro chico" onClick={(e) => marcar(f, 'no_asistio', e)}><Icono n="x" tam={15} />No asistió</button>
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
  );
}
