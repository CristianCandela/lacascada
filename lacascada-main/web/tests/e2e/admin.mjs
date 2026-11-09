// Pruebas de interfaz de administración (dueño: Dennis). `correr` la llama tests/e2e.mjs.
// Añade aquí tus pruebas con chk('ADM-n. descripción', condición).
export async function correr({ nuevaPagina, login, chk }) {
  const p = await nuevaPagina();
  await login(p, 'admin@demo.test', 'demo123');
  await p.waitForSelector('.tabs');
  chk('ADM-1. El administrador ve Panel de no-shows y Trazabilidad con la insignia Admin',
    (await p.locator('[data-tab="panel"] .insignia').count()) === 1 && (await p.locator('[data-tab="trazabilidad"] .insignia').count()) === 1);
  await p.context().close();
}
