import Icono from './Iconos';

export default function Aviso({ mensaje, tipo = 'error' }) {
  if (!mensaje) return null;
  return (
    <div id="aviso" className={`aviso ${tipo === 'ok' ? 'ok' : ''}`} role={tipo === 'ok' ? 'status' : 'alert'}>
      <Icono n="alerta" tam={18} /><span>{mensaje}</span>
    </div>
  );
}