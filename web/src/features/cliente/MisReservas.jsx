import './estilos.css';
import { etiquetaEstadoReserva } from './logica';

// Pantalla de ejemplo (esqueleto). Abel la reemplaza por la real: lista de reservas del cliente.
export default function MisReservas({ perfil }) {
  return (
    <>
      <div className="pag-cab"><div><h1>Mis reservas</h1><p className="ayuda">Hola, {perfil.nombre}. Esta pantalla está en construcción.</p></div></div>
      <div className="tarjeta"><p className="cli-ejemplo">Ejemplo de estado: {etiquetaEstadoReserva('pendiente')}</p></div>
    </>
  );
}
