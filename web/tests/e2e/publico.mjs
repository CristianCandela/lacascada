// Pruebas de interfaz de páginas públicas (dueño: Cristian). `correr` la llama tests/e2e.mjs.
// Añade aquí tus pruebas con chk('PUB-n. descripción', condición).
export async function correr({ url, nuevaPagina, chk }) {
  const p = await nuevaPagina();
  await p.goto(url + '#/reservar');
  await p.waitForSelector('#r-nombre');
  chk('PUB-1. La ruta pública #/reservar muestra el formulario sin iniciar sesión', (await p.locator('#r-nombre').count()) === 1);
  await p.context().close();
}
