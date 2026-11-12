import './estilos.css';
import { SEDES, CAPACIDAD_GIM } from './sede';

export default function SedeSelector({ sede, onCambiar }) {
  return (
    <div className="rec-sedes-claro" role="group" aria-label="Sede">
      {SEDES.map((s) => (
        <button key={s} type="button" className={sede === s ? 'rec-sede-act' : ''} onClick={() => onCambiar(s)}>
          {s} <small>Cap {CAPACIDAD_GIM[s]}</small>
        </button>
      ))}
    </div>
  );
}