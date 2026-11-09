// Simulación (solo para pruebas con `npm run test:e2e`) de lo que el rol cliente necesita del servidor.
// usuarios: cuentas de prueba | iniciar(db): crea tablas/datos | rpc: funciones simuladas (args, ctx) => {data,error}
export const mock = {
  usuarios: {
    'cliente@demo.test': { id: 'u3', pass: 'demo123', perfil: { nombre: 'Cliente de prueba', rol: 'cliente' } }
  },
  iniciar() {},
  rpc: {}
};
