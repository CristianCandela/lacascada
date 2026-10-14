import { useCallback, useEffect, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { hoyLocal, mensajeRecordatorio, urlWhatsApp } from '../lib/logica';

const ETIQUETAS = { asistio: 'Asistió', no_asistio: 'No asistió', pendiente: 'Pendiente' };

export default function Agenda({ perfil, onAviso }) {
  const [dia, setDia] = useState(hoyLocal());
  const [filas, setFilas] = useState(null);
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

  return (
    <div className="tarjeta">
      <h2>Agenda</h2>
      <div className="fila">
        <label htmlFor="a-fecha">Día</label>
        <input id="a-fecha" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        <button type="button" id="btn-agenda" className="sec" onClick={cargar}>Actualizar</button>
      </div>
      <div className="tabla-wrap">
        {filas === null && <p className="ayuda">Cargando…</p>}
        {filas && filas.length === 0 && <p className="ayuda">No hay citas para este día.</p>}
        {filas && filas.length > 0 && (
          <table>
            <thead>
              <tr><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Sede</th><th>Contacto</th><th>Estado</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id_cita} data-id={f.id_cita}>
                  <td>{new Date(f.fecha_hora_cita).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{f.clientes ? f.clientes.nombre : '—'}</td>
                  <td>{f.servicio}</td>
                  <td>{f.sede}</td>
                  <td data-contacto>
                    {f.confirmada_en ? <span className="etq asistio">Confirmó</span>
                      : f.recordatorio_enviado_en ? <span className="etq">Recordado</span> : '—'}
                  </td>
                  <td><span className={`etq ${f.estado_asistencia}`}>{ETIQUETAS[f.estado_asistencia]}</span></td>
                  <td className="acciones">
                    {f.estado_asistencia === 'pendiente' && (
                      <>
                        <button type="button" data-accion="whatsapp" className="sec" onClick={(e) => recordar(f, e)}>WhatsApp</button>
                        {!f.confirmada_en && (
                          <button type="button" data-accion="confirmar" className="sec" onClick={(e) => confirmar(f, e)}>Confirmó</button>
                        )}
                      </>
                    )}
                    <button type="button" data-accion="asistio" onClick={(e) => marcar(f, 'asistio', e)}>Asistió</button>
                    <button type="button" data-accion="no_asistio" className="peligro" onClick={(e) => marcar(f, 'no_asistio', e)}>No asistió</button>
                    {admin && <button type="button" data-accion="eliminar" className="sec" onClick={(e) => eliminar(f, e)}>Eliminar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
