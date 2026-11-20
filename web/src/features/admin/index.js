// Dueño: Dennis (rol administrador). Aquí se declaran las pantallas de administración.
import PanelNoShows from '../../components/PanelNoShows';
import Bitacora from '../../components/Bitacora';
import { PantallaMembresias, PantallaReactivacion, PantallaPersonal } from './PantallasAdmin';

const PERSONAL = ['recepcionista', 'administrador'];

// admin: true muestra la insignia "Admin". Los componentes validan el rol y muestran "Acceso denegado".
export const modulos = [
  { id: 'panel', texto: 'Panel de no-shows', icono: 'grafico', roles: PERSONAL, admin: true, Componente: PanelNoShows },
  { id: 'membresias', texto: 'Planes y membresías', icono: 'agenda', roles: PERSONAL, admin: true, Componente: PantallaMembresias },
  { id: 'reactivacion', texto: 'Reactivación', icono: 'alerta', roles: PERSONAL, admin: true, Componente: PantallaReactivacion },
  { id: 'personal', texto: 'Personal', icono: 'usuario', roles: PERSONAL, admin: true, Componente: PantallaPersonal },
  { id: 'trazabilidad', texto: 'Trazabilidad', icono: 'escudo', roles: PERSONAL, admin: true, Componente: Bitacora }
];
