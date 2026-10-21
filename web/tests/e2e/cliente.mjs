// Pruebas de interfaz del rol cliente (dueño: Abel). `correr` la llama tests/e2e.mjs.
// Añade aquí tus pruebas con chk('CLI-n. descripción', condición). Usa una página nueva por escenario.
export async function correr({ url, nuevaPagina, login, chk }) {
  const p = await nuevaPagina();
  await login(p, 'cliente@demo.test', 'demo123');
  await p.waitForSelector('.tabs');
  chk('CLI-1. El cliente ve solo su menú (Mis reservas) y no las pantallas del personal',
    (await p.locator('[data-tab="mis-reservas"]').count()) === 1 && (await p.locator('[data-tab="agenda"]').count()) === 0
    && (await p.locator('[data-tab="panel"]').count()) === 0);
  await p.context().close();
}
