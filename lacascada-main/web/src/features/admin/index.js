// web/src/features/admin/index.js
// Dueño: Dennis (rol administrador). Aquí se declaran las pantallas de administración.
// web/src/features/admin/index.js
// Dueño: Dennis (rol administrador). Aquí se declaran las pantallas de administración.
import PanelNoShows from '../../components/PanelNoShows';
import Bitacora from '../../components/Bitacora';
import { PantallaMembresias, PantallaReactivacion, PantallaPersonal } from './PantallasAdmin';

const PERSONAL = ['recepcionista', 'administrador'];
const SOLO_ADMIN = ['administrador'];

export const modulos = [
  { id: 'panel', texto: 'Panel de no-shows', icono: 'grafico', roles: PERSONAL, admin: true, Componente: PanelNoShows },
  { id: 'membresias', texto: 'Planes y membresías', icono: 'calendario', roles: SOLO_ADMIN, admin: true, Componente: PantallaMembresias },
  { id: 'reactivacion', texto: 'Reactivación', icono: 'reloj', roles: SOLO_ADMIN, admin: true, Componente: PantallaReactivacion },
  { id: 'personal', texto: 'Personal', icono: 'solicitudes', roles: SOLO_ADMIN, admin: true, Componente: PantallaPersonal },
  { id: 'trazabilidad', texto: 'Trazabilidad', icono: 'escudo', roles: PERSONAL, admin: true, Componente: Bitacora }
];