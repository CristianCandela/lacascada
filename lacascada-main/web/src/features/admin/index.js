// Dueño: Dennis (rol administrador). Aquí se declaran las pantallas de administración.
import PanelNoShows from '../../components/PanelNoShows';
import Bitacora from '../../components/Bitacora';

const PERSONAL = ['recepcionista', 'administrador'];

// admin: true muestra la insignia "Admin". Los componentes validan el rol y muestran "Acceso denegado".
export const modulos = [
  { id: 'panel', texto: 'Panel de no-shows', icono: 'grafico', roles: PERSONAL, admin: true, Componente: PanelNoShows },
  { id: 'trazabilidad', texto: 'Trazabilidad', icono: 'escudo', roles: PERSONAL, admin: true, Componente: Bitacora }
  // Dennis: agrega aquí tus pantallas nuevas (ej.: Membresias, Reactivacion). Crea el componente en esta carpeta.
];
