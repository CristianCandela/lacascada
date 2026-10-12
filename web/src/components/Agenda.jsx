import { useCallback, useEffect, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { hoyLocal } from '../lib/logica';

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
        .select('id_cita, servicio, sede, fecha_hora_cita, estado_asistencia, clientes(nombre, telefono)')
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

  async function accion(id, tipo, ev) {
    const btn = ev.currentTarget;
    if (tipo === 'eliminar' && !window.confirm('¿Eliminar esta cita? Esta acción no se puede deshacer.')) return;
    btn.disabled = true;
    try {
      const r = tipo === 'eliminar'
        ? await supabase.from('citas').delete().eq('id_cita', id)
        : await supabase.from('citas').update({ estado_asistencia: tipo }).eq('id_cita', id);
      if (r.error) throw r.error;
      await cargar();
    } catch (e) {
      onAviso(mensajeError(e));
      btn.disabled = false;
    }
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
              <tr><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Sede</th><th>Estado</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id_cita} data-id={f.id_cita}>
                  <td>{new Date(f.fecha_hora_cita).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{f.clientes ? f.clientes.nombre : '—'}</td>
                  <td>{f.servicio}</td>
                  <td>{f.sede}</td>
                  <td><span className={`etq ${f.estado_asistencia}`}>{ETIQUETAS[f.estado_asistencia]}</span></td>
                  <td className="acciones">
                    <button type="button" data-accion="asistio" onClick={(e) => accion(f.id_cita, 'asistio', e)}>Asistió</button>
                    <button type="button" data-accion="no_asistio" className="peligro" onClick={(e) => accion(f.id_cita, 'no_asistio', e)}>No asistió</button>
                    {admin && <button type="button" data-accion="eliminar" className="sec" onClick={(e) => accion(f.id_cita, 'eliminar', e)}>Eliminar</button>}
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
