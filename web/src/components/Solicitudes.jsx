import { useCallback, useEffect, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';

export default function Solicitudes({ onAviso }) {
  const [filas, setFilas] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const r = await supabase.from('solicitudes')
        .select('id_solicitud, nombre, telefono, servicio, sede, fecha_hora_preferida, estado')
        .eq('estado', 'pendiente')
        .order('fecha_hora_preferida');
      if (r.error) throw r.error;
      onAviso('');
      setFilas(r.data || []);
    } catch (e) {
      setFilas([]);
      onAviso(mensajeError(e));
    }
  }, [onAviso]);

  useEffect(() => { cargar(); }, [cargar]);

  async function resolver(id, tipo, ev) {
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
      const r = tipo === 'aprobar'
        ? await supabase.rpc('aprobar_solicitud', { p_id: id })
        : await supabase.from('solicitudes').update({ estado: 'rechazada' }).eq('id_solicitud', id);
      if (r.error) throw r.error;
      await cargar();
    } catch (e) {
      onAviso(mensajeError(e));
      btn.disabled = false;
    }
  }

  return (
    <div className="tarjeta">
      <h2>Solicitudes pendientes</h2>
      <p className="ayuda">Enviadas por los clientes desde la página pública. Al aprobar, se crea la cita en la agenda.</p>
      <div className="tabla-wrap">
        {filas === null && <p className="ayuda">Cargando…</p>}
        {filas && filas.length === 0 && <p className="ayuda">No hay solicitudes pendientes.</p>}
        {filas && filas.length > 0 && (
          <table>
            <thead>
              <tr><th>Cliente</th><th>Teléfono</th><th>Servicio</th><th>Sede</th><th>Fecha preferida</th><th>Acción</th></tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id_solicitud} data-id={f.id_solicitud}>
                  <td>{f.nombre}</td>
                  <td>{f.telefono}</td>
                  <td>{f.servicio}</td>
                  <td>{f.sede}</td>
                  <td>{new Date(f.fecha_hora_preferida).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="acciones">
                    <button type="button" data-accion="aprobar" onClick={(e) => resolver(f.id_solicitud, 'aprobar', e)}>Aprobar</button>
                    <button type="button" data-accion="rechazar" className="peligro" onClick={(e) => resolver(f.id_solicitud, 'rechazar', e)}>Rechazar</button>
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
