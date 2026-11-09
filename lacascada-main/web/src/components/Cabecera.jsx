import Icono, { Logo, iniciales } from './Iconos';

// Barra superior. Con sesión: fecha de hoy + usuario. Sin sesión (página pública): solo la marca.
export default function Cabecera({ perfil, onSalir }) {
  const f = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const hoy = f.charAt(0).toUpperCase() + f.slice(1);
  return (
    <header className="barra">
      <div className="barra-marca">
        <Logo tam={36} />
        <span className="marca-texto"><b>Cascada Gym</b><small>Sauna y gimnasio</small></span>
      </div>
      {perfil && <span className="chip-fecha"><Icono n="agenda" tam={16} /> {hoy}</span>}
      {perfil && (
        <div className="usuario">
          <span className="avatar azul" aria-hidden="true">{iniciales(perfil.nombre)}</span>
          <span id="usuario-info"><b>{perfil.nombre}</b><small>{perfil.rol}</small></span>
          <button id="btn-salir" type="button" className="sec chico" onClick={onSalir} aria-label="Cerrar sesión">
            <Icono n="salir" tam={16} /><span className="txt-salir">Cerrar sesión</span>
          </button>
        </div>
      )}
    </header>
  );
}
