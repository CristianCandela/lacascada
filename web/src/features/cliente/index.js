// Dueño: Abel (rol cliente). Aquí se declaran las pantallas del cliente.
// web/src/features/cliente/index.js
import Registro from './Registro.jsx';
import MiMembresia from './MiMembresia.jsx';
import MisReservas from './MisReservas.jsx';
import MiPerfil from './MiPerfil.jsx';

export const modulos = [
  { id: 'mi-membresia', texto: 'Mi Membresía', icono: 'clientes', roles: ['cliente'], Componente: MiMembresia },
  { id: 'mis-reservas', texto: 'Mis Reservas', icono: 'agenda', roles: ['cliente'], Componente: MisReservas },
  { id: 'mi-perfil', texto: 'Mi Perfil', icono: 'clientes', roles: ['cliente'], Componente: MiPerfil }
];

export const rutasPublicas = {
  '#/registro': Registro
};