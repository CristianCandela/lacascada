import { nivelAforo } from './logica';
import { textoNivelAforo } from './landing-logica';

// Indicador de aforo en barra. Reutilizable por cualquier rol (cliente, recepción, público).
// Props: titulo, icono (nodo), ocupados, capacidad, unidad (texto bajo el número).
export default function BarraAforo({ titulo, icono, ocupados, capacidad, unidad }) {
  const { pct, nivel } = nivelAforo(ocupados, capacidad);
  const texto = textoNivelAforo(nivel);
  return (
    <div className={`pub-aforo pub-nivel-${nivel}`}>
      <div className="pub-aforo-cab">
        <span className="pub-aforo-titulo">{icono}{titulo}</span>
        <span className="pub-aforo-estado">{texto}</span>
      </div>
      <div className="pub-aforo-pista" role="meter" aria-label={`Aforo de ${titulo}`} aria-valuemin={0} aria-valuemax={capacidad}
        aria-valuenow={Math.min(ocupados, capacidad)} aria-valuetext={`${ocupados} de ${capacidad}. ${texto}`}>
        <span className="pub-aforo-relleno" style={{ width: `${pct}%` }} />
      </div>
      <p className="pub-aforo-cifra"><b>{ocupados}</b> de {capacidad} <span>{unidad}</span></p>
    </div>
  );
}
