// Pruebas de interfaz de recepción (dueña: Leticia). `correr` la llama tests/e2e.mjs.
// Añade aquí tus pruebas con chk('REC-n. descripción', condición).
export async function correr({ nuevaPagina, login, chk }) {
  const p = await nuevaPagina();
  await login(p, 'recepcion@demo.test', 'demo123');
  await p.waitForSelector('.tabs');
  chk('REC-1. Recepción ve Registrar reserva, Agenda y Solicitudes',
    (await p.locator('[data-tab="registrar"]').count()) === 1 && (await p.locator('[data-tab="agenda"]').count()) === 1
    && (await p.locator('[data-tab="solicitudes"]').count()) === 1);
  await p.context().close();
}
