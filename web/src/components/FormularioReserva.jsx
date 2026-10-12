import { useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { validarReserva } from '../lib/logica';

const VACIO = { nombre: '', dni: '', telefono: '', servicio: '', sede: '', fecha_hora: '', consentimiento: false };

function Campo({ id, etiqueta, error, children }) {
  return (
    <div>
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      <p className="error" data-error={error ? error.campo : undefined}>{error ? error.texto : ''}</p>
    </div>
  );
}

async function obtenerOCrearCliente(d) {
  const f = await supabase.from('clientes').select('id_cliente').eq('dni', d.dni).maybeSingle();
  if (f.error) throw f.error;
  if (f.data) return f.data.id_cliente;
  const c = await supabase.from('clientes').insert({
    nombre: d.nombre, dni: d.dni, telefono: d.telefono,
    consentimiento: true, fecha_consentimiento: new Date().toISOString()
  }).select('id_cliente').single();
  if (c.error) throw c.error;
  return c.data.id_cliente;
}

export default function FormularioReserva({ onAviso }) {
  const [d, setD] = useState(VACIO);
  const [errores, setErrores] = useState({});
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);

  const set = (campo) => (e) =>
    setD({ ...d, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const err = (campo) => ({ campo, texto: errores[campo] || '' });

  async function guardar(ev) {
    ev.preventDefault();
    setOk(''); onAviso('');
    const v = validarReserva({ ...d, nombre: d.nombre.trim(), dni: d.dni.trim(), telefono: d.telefono.trim() });
    setErrores(v.errores);
    if (!v.ok) return;
    setEnviando(true);
    try {
      const idCliente = await obtenerOCrearCliente({ ...d, nombre: d.nombre.trim(), dni: d.dni.trim(), telefono: d.telefono.trim() });
      const r = await supabase.from('citas').insert({
        id_cliente: idCliente, servicio: d.servicio, sede: d.sede,
        fecha_hora_cita: new Date(d.fecha_hora).toISOString(), estado_asistencia: 'pendiente'
      });
      if (r.error) throw r.error;
      setOk('Reserva guardada correctamente.');
      setD(VACIO);
    } catch (e) {
      onAviso(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta">
      <h2>Registrar reserva</h2>
      <form onSubmit={guardar} noValidate>
        <div className="grid">
          <Campo id="r-nombre" etiqueta="Nombre completo" error={err('nombre')}>
            <input id="r-nombre" type="text" autoComplete="off" value={d.nombre} onChange={set('nombre')} />
          </Campo>
          <Campo id="r-dni" etiqueta="DNI (8 dígitos)" error={err('dni')}>
            <input id="r-dni" type="text" inputMode="numeric" maxLength={12} autoComplete="off" value={d.dni} onChange={set('dni')} />
          </Campo>
          <Campo id="r-telefono" etiqueta="Teléfono (9 dígitos)" error={err('telefono')}>
            <input id="r-telefono" type="text" inputMode="numeric" maxLength={12} autoComplete="off" value={d.telefono} onChange={set('telefono')} />
          </Campo>
          <Campo id="r-servicio" etiqueta="Servicio" error={err('servicio')}>
            <select id="r-servicio" value={d.servicio} onChange={set('servicio')}>
              <option value="">Elige…</option>
              <option value="sauna">Sauna</option>
              <option value="gimnasio">Gimnasio</option>
            </select>
          </Campo>
          <Campo id="r-sede" etiqueta="Sede" error={err('sede')}>
            <select id="r-sede" value={d.sede} onChange={set('sede')}>
              <option value="">Elige…</option>
              <option value="Año Nuevo">Año Nuevo</option>
              <option value="Santa Rosa">Santa Rosa</option>
            </select>
          </Campo>
          <Campo id="r-fecha" etiqueta="Fecha y hora" error={err('fecha_hora')}>
            <input id="r-fecha" type="datetime-local" value={d.fecha_hora} onChange={set('fecha_hora')} />
          </Campo>
        </div>
        <label className="check">
          <input id="r-consent" type="checkbox" checked={d.consentimiento} onChange={set('consentimiento')} />
          <span>El cliente autoriza el tratamiento de sus datos personales para gestionar su reserva (Ley 29733).</span>
        </label>
        <p className="error" data-error="consentimiento">{errores.consentimiento || ''}</p>
        <p id="r-resultado" className="ok" role="status">{ok}</p>
        <button type="submit" id="btn-reserva" disabled={enviando}>Guardar reserva</button>
      </form>
    </div>
  );
}
