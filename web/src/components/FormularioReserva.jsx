import { useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { validarReserva } from '../lib/logica';
import CamposReserva, { VACIO } from './CamposReserva';
import Icono from './Iconos';

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

  async function guardar(ev) {
    ev.preventDefault();
    setOk(''); onAviso('');
    const datos = { ...d, nombre: d.nombre.trim(), dni: d.dni.trim(), telefono: d.telefono.trim() };
    const v = validarReserva(datos);
    setErrores(v.errores);
    if (!v.ok) return;
    setEnviando(true);
    try {
      const idCliente = await obtenerOCrearCliente(datos);
      const r = await supabase.from('citas').insert({
        id_cliente: idCliente, servicio: datos.servicio, sede: datos.sede,
        fecha_hora_cita: new Date(datos.fecha_hora).toISOString(), estado_asistencia: 'pendiente'
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
    <>
      <div className="pag-cab">
        <div>
          <h1>Registrar reserva</h1>
          <p className="ayuda">Ingresa los datos del cliente para agendar su turno en sauna o gimnasio.</p>
        </div>
      </div>
      <div className="tarjeta formulario">
        <form onSubmit={guardar} noValidate>
          <CamposReserva d={d} setD={setD} errores={errores}
            textoConsentimiento="El cliente autoriza el tratamiento de sus datos personales para gestionar su reserva (Ley 29733)." />
          <p id="r-resultado" className="ok" role="status">{ok}</p>
          <div className="form-pie">
            <button type="button" className="sec" onClick={() => { setD(VACIO); setErrores({}); setOk(''); }}>
              <Icono n="refrescar" tam={16} />Limpiar formulario
            </button>
            <button type="submit" id="btn-reserva" disabled={enviando}>
              <Icono n="check" tam={16} />{enviando ? 'Guardando…' : 'Guardar reserva'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
