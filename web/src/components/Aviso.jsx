import Icono from './Iconos';

export default function Aviso({ mensaje }) {
  if (!mensaje) return null;
  return (
    <div id="aviso" className="aviso" role="alert">
      <Icono n="alerta" tam={18} /><span>{mensaje}</span>
    </div>
  );
}
