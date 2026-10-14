import { useState } from 'react';
import { supabase, mensajeError } from '../lib/supabase';
import { validarReserva } from '../lib/logica';
import CamposReserva, { VACIO } from './CamposReserva';
import Cabecera from './Cabecera';
import Aviso from './Aviso';

// Página pública (sin cuenta): el cliente deja su solicitud y el personal la confirma por WhatsApp.
export default function SolicitudPublica() {
  const [d, setD] = useState(VACIO);
  const [trampa, setTrampa] = useState('');   // campo señuelo contra bots (honeypot)
  const [errores, setErrores] = useState({});
  const [ok, setOk] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev) {
    ev.preventDefault();
    setOk(''); setAviso('');
    const datos = { ...d, nombre: d.nombre.trim(), dni: d.dni.trim(), telefono: d.telefono.trim() };
    const v = validarReserva(datos);
    setErrores(v.errores);
    if (!v.ok) return;
    const mensajeOk = 'Solicitud enviada. La Cascada te confirmará tu reserva por WhatsApp.';
    if (trampa) { setOk(mensajeOk); setD(VACIO); return; }   // un bot: se simula éxito sin guardar
    setEnviando(true);
    try {
      const r = await supabase.from('solicitudes').insert({
        nombre: datos.nombre, dni: datos.dni, telefono: datos.telefono,
        servicio: datos.servicio, sede: datos.sede,
        fecha_hora_preferida: new Date(datos.fecha_hora).toISOString(),
        consentimiento: true
      });
      if (r.error) throw r.error;
      setOk(mensajeOk);
      setD(VACIO);
    } catch (e) {
      setAviso(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Cabecera perfil={null} />
      <Aviso mensaje={aviso} />
      <main>
        <section className="tarjeta">
          <h1>Solicita tu reserva</h1>
          <p className="ayuda">Sin cuenta ni contraseña. Elige servicio, sede y horario; el personal te confirmará por WhatsApp.</p>
          <form onSubmit={enviar} noValidate>
            <CamposReserva d={d} setD={setD} errores={errores} etiquetaFecha="Fecha y hora preferida"
              textoConsentimiento="Autorizo el tratamiento de mis datos personales para gestionar mi reserva y recibir recordatorios por WhatsApp (Ley 29733)." />
            <div className="trampa" aria-hidden="true">
              <label htmlFor="r-empresa">Empresa</label>
              <input id="r-empresa" type="text" tabIndex={-1} autoComplete="off"
                value={trampa} onChange={(e) => setTrampa(e.target.value)} />
            </div>
            <p id="r-resultado" className="ok" role="status">{ok}</p>
            <button type="submit" id="btn-reserva" disabled={enviando}>Enviar solicitud</button>
          </form>
          <p className="ayuda"><a href="#/">Soy parte del personal</a></p>
        </section>
      </main>
      <footer className="pie">
        MVP académico UTP · Innovación y Transformación Digital · Datos ficticios para la demostración.
      </footer>
    </>
  );
}
