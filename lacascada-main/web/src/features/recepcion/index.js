// Dueña: Leticia (rol recepcionista). Aquí se declaran las pantallas de recepción.
import FormularioReserva from '../../components/FormularioReserva';
import Agenda from '../../components/Agenda';
import Solicitudes from '../../components/Solicitudes';

const PERSONAL = ['recepcionista', 'administrador'];

export const modulos = [
  { id: 'registrar', texto: 'Registrar reserva', icono: 'mas', roles: PERSONAL, Componente: FormularioReserva },
  { id: 'agenda', texto: 'Agenda', icono: 'agenda', roles: PERSONAL, Componente: Agenda },
  { id: 'solicitudes', texto: 'Solicitudes', icono: 'bandeja', roles: PERSONAL, Componente: Solicitudes }
  // Leticia: agrega aquí tus pantallas nuevas (ej.: CodigoLocal, Pagos). Crea el componente en esta carpeta.
];
