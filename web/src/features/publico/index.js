// Dueño: Cristian (páginas sin sesión + núcleo). Rutas públicas por hash.
import SolicitudPublica from '../../components/SolicitudPublica';
import AforoPublico from './AforoPublico';

export const modulos = [];

export const rutasPublicas = {
  '#/reservar': SolicitudPublica,
  '#/aforo': AforoPublico
  // Cristian: agrega aquí páginas nuevas (ej.: '#/planes': Planes).
};
