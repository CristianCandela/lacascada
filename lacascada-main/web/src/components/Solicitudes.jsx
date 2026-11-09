import { useCallback, useEffect, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import Icono, { iniciales, tonoAvatar } from './Iconos';

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

  async function resolver(id, tipo, ev, fila) {
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
      const r = tipo === 'aprobar'
        ? await supabase.rpc('aprobar_solicitud', { p_id: id })
        : await supabase.from('solicitudes').update({ estado: 'rechazada' }).eq('id_solicitud', id);
      if (r.error) throw r.error;
      await cargar();
      if (tipo === 'aprobar' && fila) {
        const cuando = new Date(fila.fecha_hora_preferida).toLocaleString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
        onAviso(`Cita creada para ${fila.nombre}: ${cuando}. Búscala en Agenda, en ese día.`, 'ok');
      }
    } catch (e) {
      onAviso(mensajeError(e));
      btn.disabled = false;
    }
  }

  return (
    <>
      <div className="pag-cab">
        <div>
          <h1>Solicitudes pendientes</h1>
          <p className="ayuda">Enviadas por los clientes desde la página pública. Al aprobar, se crea la cita en la agenda.</p>
        </div>
        {filas && filas.length > 0 && <span className="contador">{filas.length} por revisar</span>}
      </div>
      <div className="tarjeta">
        <div className="tabla-wrap">
          {filas === null && <p className="vacio">Cargando…</p>}
          {filas && filas.length === 0 && (
            <div className="vacio"><Icono n="bandeja" tam={32} /><p>No hay solicitudes pendientes.</p><small>Cuando un cliente envíe una solicitud, aparecerá aquí.</small></div>
          )}
          {filas && filas.length > 0 && (
            <table>
              <thead>
                <tr><th>Cliente</th><th>Teléfono</th><th>Servicio</th><th>Sede</th><th>Fecha preferida</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id_solicitud} data-id={f.id_solicitud}>
                    <td data-label="Cliente">
                      <span className="persona">
                        <span className={`avatar ${tonoAvatar(f.nombre)}`} aria-hidden="true">{iniciales(f.nombre)}</span>
                        <span>{f.nombre}</span>
                      </span>
                    </td>
                    <td data-label="Teléfono">{f.telefono}</td>
                    <td data-label="Servicio"><span className={`servicio ${f.servicio}`}><Icono n={f.servicio === 'sauna' ? 'sauna' : 'pesa'} tam={14} />{f.servicio === 'sauna' ? 'Sauna' : 'Gimnasio'}</span></td>
                    <td data-label="Sede">{f.sede}</td>
                    <td data-label="Fecha preferida">{new Date(f.fecha_hora_preferida).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td data-label="Acción" className="acciones">
                      <button type="button" data-accion="aprobar" className="ok-btn chico" onClick={(e) => resolver(f.id_solicitud, 'aprobar', e, f)}><Icono n="check" tam={15} />Aprobar</button>
                      <button type="button" data-accion="rechazar" className="peligro chico" onClick={(e) => resolver(f.id_solicitud, 'rechazar', e)}><Icono n="x" tam={15} />Rechazar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
