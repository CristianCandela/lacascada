// Dueña: Leticia (rol recepcionista). Aquí se declaran las pantallas de recepción.
import Inicio from './Inicio';
import Checkin from './Checkin';
import ReservaSauna from './ReservaSauna';
import Agenda from '../../components/Agenda';
import Solicitudes from '../../components/Solicitudes';
import Pagos from './Pagos';
import RegistroAsistido from './RegistroAsistido';
import Renovaciones from './Renovaciones';
import Alertas from './Alertas';
import ResumenDia from './ResumenDia';

const PERSONAL = ['recepcionista', 'administrador'];

export const modulos = [
  { id: 'inicio', texto: 'Inicio', icono: 'agenda', roles: PERSONAL, Componente: Inicio },
  { id: 'checkin', texto: 'Check-in', icono: 'check', roles: PERSONAL, Componente: Checkin },
  { id: 'reservar', texto: 'Reservar sauna', icono: 'sauna', roles: PERSONAL, Componente: ReservaSauna },
  { id: 'agenda', texto: 'Agenda', icono: 'agenda', roles: PERSONAL, Componente: Agenda },
  { id: 'solicitudes', texto: 'Solicitudes', icono: 'bandeja', roles: PERSONAL, Componente: Solicitudes },
  { id: 'pagos', texto: 'Pagos', icono: 'bandeja', roles: PERSONAL, Componente: Pagos },
  { id: 'registro', texto: 'Registro asistido', icono: 'usuarios', roles: PERSONAL, Componente: RegistroAsistido },
  { id: 'renovaciones', texto: 'Renovaciones', icono: 'refrescar', roles: PERSONAL, Componente: Renovaciones },
  { id: 'alertas', texto: 'Alertas', icono: 'alerta', roles: PERSONAL, Componente: Alertas },
  { id: 'resumen', texto: 'Resumen del día', icono: 'reloj', roles: PERSONAL, Componente: ResumenDia },
   // Leticia: agrega aquí tus pantallas nuevas (ej.: CodigoLocal, Pagos). Crea el componente en esta carpeta.
];