export default function Cabecera({ perfil, onSalir }) {
  return (
    <header className="top">
      <div className="marca">
        <strong>La Cascada</strong>
        <span className="sub">Reservas y control de asistencia · Demo con datos ficticios</span>
      </div>
      {perfil && (
        <div className="usuario">
          <span id="usuario-info">{perfil.nombre} · {perfil.rol}</span>
          <button id="btn-salir" type="button" className="sec" onClick={onSalir}>Salir</button>
        </div>
      )}
    </header>
  );
}
