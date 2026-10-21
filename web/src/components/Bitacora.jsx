import { useCallback, useEffect, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { ACCIONES_BITACORA, detalleBitacora, textoAccionBitacora } from '../lib/logica';
import Icono from './Iconos';

// Trazabilidad: quién hizo qué y cuándo. Solo para el administrador (la función SQL también lo exige).
export default function Bitacora({ perfil, onAviso }) {
  const esAdmin = perfil.rol === 'administrador';
  const [filas, setFilas] = useState(null);
  const [accion, setAccion] = useState('');

  const cargar = useCallback(async () => {
    if (!esAdmin) return;
    try {
      const r = await supabase.rpc('bitacora_reciente', { p_limite: 200, p_accion: accion || null });
      if (r.error) throw r.error;
      onAviso('');
      setFilas(r.data || []);
    } catch (e) {
      setFilas([]);
      onAviso(mensajeError(e));
    }
  }, [esAdmin, accion, onAviso]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!esAdmin) {
    return (
      <>
        <div className="pag-cab"><div><h1>Trazabilidad</h1></div></div>
        <div className="tarjeta">
          <p className="error-grande" role="alert"><Icono n="escudo" tam={22} />Acceso denegado: la trazabilidad es solo para el administrador.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pag-cab">
        <div>
          <h1>Trazabilidad</h1>
          <p className="ayuda">Registro de quién hizo qué y cuándo en la agenda y en las solicitudes. No se puede editar ni borrar desde la aplicación y no guarda DNI ni teléfono.</p>
        </div>
      </div>
      <div className="tarjeta">
        <div className="herramientas">
          <label htmlFor="b-accion" className="sr">Acción</label>
          <select id="b-accion" className="filtro" value={accion} onChange={(e) => setAccion(e.target.value)}>
            <option value="">Todas las acciones</option>
            {Object.entries(ACCIONES_BITACORA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="button" id="btn-bitacora" className="sec" onClick={cargar}><Icono n="refrescar" tam={16} />Actualizar</button>
        </div>
        <div className="tabla-wrap">
          {filas === null && <p className="vacio">Cargando…</p>}
          {filas && filas.length === 0 && (
            <div className="vacio"><Icono n="escudo" tam={32} /><p>Aún no hay eventos registrados.</p><small>Aparecerán cuando el personal use la agenda o se envíen solicitudes.</small></div>
          )}
          {filas && filas.length > 0 && (
            <table>
              <thead>
                <tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Cliente</th><th>Detalle</th></tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id_evento} data-evento={f.accion}>
                    <td data-label="Fecha y hora" className="hora">{new Date(f.ocurrido_en).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</td>
                    <td data-label="Usuario"><span className="persona-txt"><span>{f.usuario}</span>{f.rol && <small>{f.rol}</small>}</span></td>
                    <td data-label="Acción"><span className={`etq acc-${f.accion}`}>{textoAccionBitacora(f.accion)}</span></td>
                    <td data-label="Cliente">{f.cliente || '—'}</td>
                    <td data-label="Detalle">{detalleBitacora(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {filas && filas.length > 0 && <p className="tabla-pie">{filas.length === 1 ? 'Último evento' : `Últimos ${filas.length} eventos`} (máximo 200).</p>}
      </div>
    </>
  );
}