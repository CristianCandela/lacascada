// Registro central de módulos. Cada rol declara sus pantallas en SU carpeta (features/<rol>/index.js).
// Este archivo solo junta las listas: normalmente no hace falta editarlo.
import { modulos as publico, rutasPublicas } from './publico';
import { modulos as recepcion } from './recepcion';
import { modulos as admin } from './admin';
import { modulos as cliente } from './cliente';

// Orden del menú lateral. Cada módulo: { id, texto, icono, roles, admin?, Componente }
export const MODULOS = [...recepcion, ...admin, ...cliente, ...publico];

// Rutas sin sesión (hash). Ejemplo: '#/reservar' -> componente de página completa.
export const RUTAS_PUBLICAS = { ...rutasPublicas };

// Módulos que ve un rol concreto.
export const modulosDeRol = (rol) => MODULOS.filter((m) => m.roles.includes(rol));
