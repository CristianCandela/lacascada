import { useEffect, useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { hayCupo, textoCupos, validarReserva } from '../lib/logica';
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
  const [cupos, setCupos] = useState(null);

  // Muestra los cupos de la franja apenas se eligen servicio, sede y hora.
  useEffect(() => {
    setCupos(null);
    const f = new Date(d.fecha_hora);
    if (!d.servicio || !d.sede || !d.fecha_hora || Number.isNaN(f.getTime())) return undefined;
    let vivo = true;
    (async () => {
      try {
        const r = await supabase.rpc('disponibilidad', { p_servicio: d.servicio, p_sede: d.sede, p_fecha_hora: f.toISOString() });
        if (vivo && !r.error) setCupos(r.data);
      } catch { /* si falla la consulta, la base igualmente bloquea al guardar */ }
    })();
    return () => { vivo = false; };
  }, [d.servicio, d.sede, d.fecha_hora]);

  async function guardar(ev) {
    ev.preventDefault();
    setOk(''); onAviso('');
    const datos = { ...d, nombre: d.nombre.trim(), dni: d.dni.trim(), telefono: d.telefono.trim() };
    const v = validarReserva(datos);
    setErrores(v.errores);
    if (!v.ok) return;
    setEnviando(true);
    try {
      // Control de aforo: se revisa en pantalla y la base lo vuelve a exigir.
      const disp = await supabase.rpc('disponibilidad', {
        p_servicio: datos.servicio, p_sede: datos.sede, p_fecha_hora: new Date(datos.fecha_hora).toISOString() });
      if (disp.error) throw disp.error;
      if (disp.data && Number(disp.data.capacidad) > 0 && !hayCupo(disp.data)) {
        setErrores({ fecha_hora: 'Aforo máximo completado para esta franja horaria.' });
        setCupos(disp.data);
        return;
      }
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
          {cupos && Number(cupos.capacidad) > 0 && (
            <p id="r-cupos" className={`cupos ${hayCupo(cupos) ? '' : 'lleno'}`} role="status">
              {hayCupo(cupos) ? textoCupos(cupos) : 'Aforo máximo completado para esta franja horaria.'}
            </p>
          )}
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
