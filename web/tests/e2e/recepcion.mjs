// Pruebas de interfaz de recepción (dueña: Leticia). `correr` la llama tests/e2e.mjs.
// Añade aquí tus pruebas con chk('REC-n. descripción', condición).
export async function correr({ nuevaPagina, login, chk }) {
  const p = await nuevaPagina();
  await login(p, 'recepcion@demo.test', 'demo123');
  await p.waitForSelector('.tabs');
  chk('REC-1. Recepción ve Reservar sauna, Agenda y Solicitudes',
    (await p.locator('[data-tab="reservar"]').count()) === 1
    && (await p.locator('[data-tab="agenda"]').count()) === 1
    && (await p.locator('[data-tab="solicitudes"]').count()) === 1);
  chk('REC-2. Recepción ve Inicio con aforo',
    (await p.locator('[data-tab="inicio"]').count()) === 1);
  chk('REC-2. Recepción ve Inicio y Check-in',
    (await p.locator('[data-tab="inicio"]').count()) === 1 && (await p.locator('[data-tab="checkin"]').count()) === 1);

  await p.context().close();

}
