// Dueño: Abel (rol cliente). Aquí se declaran las pantallas del cliente.
import MisReservas from './MisReservas';

export const modulos = [
  { id: 'mis-reservas', texto: 'Mis reservas', icono: 'agenda', roles: ['cliente'], Componente: MisReservas }
  // Abel: agrega aquí tus pantallas nuevas (ej.: ReservarSauna, MiMembresia, IngresarCodigo).
];

// Páginas del cliente sin sesión (ej.: registro): '#/registro': RegistroCliente
export const rutasPublicas = {};
