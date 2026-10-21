// Junta las simulaciones de cada rol para el modo de pruebas (mock). Normalmente no hace falta editarlo.
import { mock as cliente } from './cliente/mock';
import { mock as recepcion } from './recepcion/mock';
import { mock as admin } from './admin/mock';
import { mock as publico } from './publico/mock';

export const MOCKS = [cliente, recepcion, admin, publico];
