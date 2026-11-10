// Dueño: Abel (rol cliente). Aquí se declaran las pantallas del cliente.
// web/src/features/cliente/index.js
import Registro from './Registro.jsx';
import IngresarCodigo from './IngresarCodigo.jsx';
import MiMembresia from './MiMembresia.jsx';
import MisReservas from './MisReservas.jsx';

export const modulos = [
  { id: 'ingresar-codigo', texto: 'Check-in Gimnasio', icono: 'codigo', roles: ['cliente'], Componente: IngresarCodigo },
  { id: 'mi-membresia', texto: 'Mi Membresía', icono: 'tarjeta', roles: ['cliente'], Componente: MiMembresia },
  { id: 'mis-reservas', texto: 'Mis reservas', icono: 'agenda', roles: ['cliente'], Componente: MisReservas }
];

export const rutasPublicas = [
  { id: 'registro', ruta: '#/registro', texto: 'Registro', Componente: Registro }
];