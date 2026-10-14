// Campos compartidos por el formulario del personal y la solicitud pública.
export const VACIO = {
  nombre: '', dni: '', telefono: '', servicio: '', sede: '', fecha_hora: '', consentimiento: false
};

function Campo({ id, etiqueta, campo, errores, children }) {
  return (
    <div>
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      <p className="error" data-error={campo}>{errores[campo] || ''}</p>
    </div>
  );
}

export default function CamposReserva({ d, setD, errores, textoConsentimiento, etiquetaFecha = 'Fecha y hora' }) {
  const set = (campo) => (e) =>
    setD({ ...d, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <>
      <div className="grid">
        <Campo id="r-nombre" etiqueta="Nombre completo" campo="nombre" errores={errores}>
          <input id="r-nombre" type="text" autoComplete="off" value={d.nombre} onChange={set('nombre')} />
        </Campo>
        <Campo id="r-dni" etiqueta="DNI (8 dígitos)" campo="dni" errores={errores}>
          <input id="r-dni" type="text" inputMode="numeric" maxLength={12} autoComplete="off" value={d.dni} onChange={set('dni')} />
        </Campo>
        <Campo id="r-telefono" etiqueta="WhatsApp (9 dígitos)" campo="telefono" errores={errores}>
          <input id="r-telefono" type="text" inputMode="numeric" maxLength={12} autoComplete="off" value={d.telefono} onChange={set('telefono')} />
        </Campo>
        <Campo id="r-servicio" etiqueta="Servicio" campo="servicio" errores={errores}>
          <select id="r-servicio" value={d.servicio} onChange={set('servicio')}>
            <option value="">Elige…</option>
            <option value="sauna">Sauna</option>
            <option value="gimnasio">Gimnasio</option>
          </select>
        </Campo>
        <Campo id="r-sede" etiqueta="Sede" campo="sede" errores={errores}>
          <select id="r-sede" value={d.sede} onChange={set('sede')}>
            <option value="">Elige…</option>
            <option value="Año Nuevo">Año Nuevo</option>
            <option value="Santa Rosa">Santa Rosa</option>
          </select>
        </Campo>
        <Campo id="r-fecha" etiqueta={etiquetaFecha} campo="fecha_hora" errores={errores}>
          <input id="r-fecha" type="datetime-local" value={d.fecha_hora} onChange={set('fecha_hora')} />
        </Campo>
      </div>
      <label className="check">
        <input id="r-consent" type="checkbox" checked={d.consentimiento} onChange={set('consentimiento')} />
        <span>{textoConsentimiento}</span>
      </label>
      <p className="error" data-error="consentimiento">{errores.consentimiento || ''}</p>
    </>
  );
}
