// Simulación (solo para pruebas con `npm run test:e2e`) de lo que este rol necesita del servidor.
// usuarios: cuentas de prueba | iniciar(db): crea tablas/datos | rpc: funciones simuladas (args, ctx) => {data,error}
export const mock = {
  usuarios: {},
  iniciar() {},
  rpc: {}
};
