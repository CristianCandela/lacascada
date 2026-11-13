// Pruebas de interfaz de recepción (dueña: Leticia). `correr` la llama tests/e2e.mjs.
// Añade aquí tus pruebas con chk('REC-n. descripción', condición).
// REC-1..REC-3: pestañas visibles para recepción.
// R1–R5: registro asistido dentro de «Reservar sauna» (antes eran validaciones del formulario viejo).
// R6–R10: aforo, duplicados y cancelación (antes eran las pruebas 30–33 de e2e.mjs).
// R11–R19: pantalla «Registro asistido» (RegistroAsistido.jsx).

const pad = (n) => String(n).padStart(2, '0');
const fechaManana = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// Clientes de mock/recepcion (k101..k106). Ninguno tiene reservas para mañana.
const DNIS = ['47829103', '71209384', '09482716', '44321098', '10293847', '45120398'];

export async function correr({ nuevaPagina, login, chk, carpeta, irASauna }) {
  // ================= Pestañas visibles (pruebas originales de Leticia) =================
  {
    const p = await nuevaPagina();
    await login(p, 'recepcion@demo.test', 'demo123');
    await p.waitForSelector('.tabs');
    chk('REC-1. Recepción ve Reservar sauna, Agenda y Solicitudes',
      (await p.locator('[data-tab="reservar"]').count()) === 1
      && (await p.locator('[data-tab="agenda"]').count()) === 1
      && (await p.locator('[data-tab="solicitudes"]').count()) === 1);
    chk('REC-2. Recepción ve Inicio con aforo',
      (await p.locator('[data-tab="inicio"]').count()) === 1);
    chk('REC-3. Recepción ve Inicio y Check-in',
      (await p.locator('[data-tab="inicio"]').count()) === 1 && (await p.locator('[data-tab="checkin"]').count()) === 1);
    await p.context().close();
  }

  // ================= Registro asistido =================
  const p = await nuevaPagina();
  await login(p, 'recepcion@demo.test', 'demo123');
  await p.waitForSelector('.tabs');
  await irASauna(p);

  await p.fill('#rs-q', '70000055'); // DNI que no existe
  await p.getByRole('button', { name: 'Buscar' }).click();
  await p.waitForSelector('form.rec-form');
  chk('R1. Cliente inexistente: ofrece registro asistido con el DNI ya escrito',
    (await p.locator('form.rec-form input').nth(1).inputValue()) === '70000055');

  const form = p.locator('form.rec-form');
  const llenarRegistro = async ({ nombre = 'Lucía Prueba', dni = '70000055', telefono = '900000055', consent = true } = {}) => {
    await form.getByLabel('Nombre completo').fill(nombre);
    await form.getByLabel(/^DNI/).fill(dni);
    await form.getByLabel(/^Teléfono/).fill(telefono);
    await form.getByRole('checkbox').setChecked(consent);
  };
  const avisoDice = (texto) => p.locator('#aviso').filter({ hasText: texto }).waitFor({ timeout: 2000 }).then(() => true, () => false);
  const enviar = () => form.getByRole('button', { name: 'Registrar y continuar' }).click();

  await llenarRegistro({ telefono: '12345' }); await enviar();
  chk('R2. Teléfono inválido rechazado', await avisoDice('9 dígitos'));
  await llenarRegistro({ dni: '123' }); await enviar();
  chk('R3. DNI distinto de 8 dígitos rechazado', await avisoDice('8 dígitos'));
  await llenarRegistro({ consent: false }); await enviar();
  chk('R4. Sin consentimiento no registra', await avisoDice('consentimiento'));
  await llenarRegistro({}); await enviar();
  await p.waitForSelector('.rec-exito', { timeout: 3000 }).catch(() => {});
  chk('R5. Registro válido: muestra el código y pasa al paso del turno',
    (await p.locator('.rec-exito').count()) === 1 && (await p.locator('.rec-cliente-card').count()) === 1);
  await p.screenshot({ path: carpeta + '/16_registro_asistido.png' });

  // ================= Aforo, duplicados y cancelación =================
  const q = await nuevaPagina();
  await login(q, 'recepcion@demo.test', 'demo123');
  await q.waitForSelector('.tabs');
  await irASauna(q);

  const nCitas = () => q.evaluate(() => window.__mock.db.citas.length);
  const buscar = async (dni) => {
    await q.fill('#rs-q', dni);
    await q.getByRole('button', { name: 'Buscar' }).click();
    await q.waitForSelector('.rec-cliente-card');
    await q.getByRole('button', { name: 'Mañana' }).click();
    await q.waitForTimeout(300); // deja que recargue los turnos
  };
  const cambiarCliente = () => q.getByRole('button', { name: 'Cambiar cliente' }).click();

  await buscar(DNIS[0]);
  await q.waitForSelector('.rec-turno-card:not([disabled])');
  const horaTxt = (await q.locator('.rec-turno-card:not([disabled]) strong').first().textContent()).trim();
  const tarjeta = () => q.locator('.rec-turno-card', { hasText: horaTxt }).first();
  const leer = async () => {
    const m = (await tarjeta().locator('small').textContent()).match(/(\d+) de (\d+)/);
    return { ocup: +m[1], cap: +m[2] };
  };
  const cobrar = async () => {
    await tarjeta().click();
    await q.getByRole('button', { name: /y reservar/ }).click();
    await q.waitForSelector('.rec-exito');
  };

  const { ocup: o0, cap } = await leer();
  await cobrar(); // cliente A reserva el turno
  const idA = await q.evaluate(() => window.__mock.db.citas.filter((c) => c.origen === 'recepcion').slice(-1)[0].id_cita);

  await buscar(DNIS[1]);
  const { ocup: o1 } = await leer();
  chk(`R6. El turno muestra sus cupos y suma 1 ocupado tras reservar (${o0} → ${o1} de ${cap})`, o1 === o0 + 1 && cap >= 2);

  // Duplicado: el mismo cliente A intenta el mismo turno otra vez
  await cambiarCliente();
  await buscar(DNIS[0]);
  const antesDup = await nCitas();
  await tarjeta().click();
  await q.getByRole('button', { name: /y reservar/ }).click();
  await q.waitForSelector('#aviso');
  chk('R7. Reserva duplicada (mismo cliente y turno) se rechaza con mensaje claro y no guarda',
    (await q.textContent('#aviso')).includes('ya tiene reserva') && (await nCitas()) === antesDup);
  await cambiarCliente();

  // Llenar el turno con clientes distintos hasta que quede «Lleno»
  let i = 1;
  while (i < DNIS.length - 1) {
    await buscar(DNIS[i]);
    if (await tarjeta().isDisabled()) break;
    await cobrar();
    i++;
  }
  chk('R8. Aforo lleno: el turno queda «Lleno», deshabilitado, y no se puede reservar',
    (await tarjeta().isDisabled()) && (await tarjeta().textContent()).includes('Lleno'));
  await q.screenshot({ path: carpeta + '/13_aforo_lleno.png' });

  // Cancelar una cita desde la agenda libera el cupo
  await q.click('[data-tab="agenda"]');
  await q.fill('#a-fecha', fechaManana());
  await q.waitForSelector(`tr[data-id="${idA}"]`);
  await q.locator(`tr[data-id="${idA}"] [data-accion="cancelo"]`).click();
  await q.waitForFunction((id) => window.__mock.db.citas.find((c) => c.id_cita === id).estado_asistencia === 'cancelo', idA);
  await irASauna(q);
  await buscar(DNIS[i]);
  chk('R9. Cancelar una cita libera el cupo: el turno vuelve a estar disponible', !(await tarjeta().isDisabled()));
  const antesCancel = await nCitas();
  await cobrar();
  chk('R10. Tras cancelar, el cliente que esperaba puede reservar ese turno', (await nCitas()) === antesCancel + 1);
  // ================= Pantalla «Registro asistido» (RegistroAsistido.jsx, id 'registro') =================
  const r = await nuevaPagina();
  await login(r, 'recepcion@demo.test', 'demo123');
  await r.waitForSelector('.tabs');
  await r.click('[data-tab="registro"]');
  await r.waitForSelector('#ra-dni');
  const verificar = async (dni) => { await r.fill('#ra-dni', dni); await r.getByRole('button', { name: 'Verificar DNI' }).click(); };
  const avisoR = (texto) => r.locator('#aviso').filter({ hasText: texto }).waitFor({ timeout: 2000 }).then(() => true, () => false);

  await verificar('123');
  chk('R11. DNI de menos de 8 dígitos: avisa y no continúa', (await avisoR('exactamente 8 dígitos')) && (await r.locator('form.rec-form').count()) === 0);

  await verificar('47829103'); // Rodrigo Alva ya existe en el mock
  await r.waitForSelector('.rec-aviso-rojo');
  const rojo = await r.textContent('.rec-aviso-rojo');
  chk('R12. DNI existente: muestra quién es (nombre y código) y no abre el formulario',
    rojo.includes('Ya existe') && rojo.includes('Rodrigo Alva') && rojo.includes('C-1001') && (await r.locator('form.rec-form').count()) === 0);

  await verificar('70000066'); // DNI libre
  await r.waitForSelector('form.rec-form');
  chk('R13. DNI libre: confirma que no hay registro previo y abre el paso 2', (await r.textContent('.rec-exito')).includes('verificado'));

  const f2 = r.locator('form.rec-form');
  const llenar2 = async ({ telefono = '900000066', consent = true } = {}) => {
    await f2.getByLabel(/^Nombre completo/).fill('Marta Registro');
    await f2.getByLabel(/^Teléfono/).fill(telefono);
    await f2.getByRole('checkbox').setChecked(consent);
  };
  const guardar2 = () => f2.getByRole('button', { name: /Guardar y generar código/ }).click();
  await llenar2({ telefono: '12345' }); await guardar2();
  chk('R14. Teléfono inválido rechazado', await avisoR('9 dígitos'));
  await llenar2({ consent: false }); await guardar2();
  chk('R15. Sin consentimiento no guarda', await avisoR('consentimiento'));

  await llenar2({}); await guardar2();
  await r.waitForSelector('.rec-resumen');
  const codigo = (await r.textContent('.rec-resumen .rec-total strong')).trim();
  chk('R16. Registro válido: genera código de cliente, lo guarda y lo lista en «últimos registros»',
    /^C-\d{4}$/.test(codigo) && (await r.textContent('.rec-resumen')).includes('Marta Registro') &&
    await r.evaluate(() => window.__mock.db.clientes.some((c) => c.dni === '70000066' && c.asistido_en)) &&
    (await r.textContent('.rec-feed')).includes('Marta Registro'));
  await r.screenshot({ path: carpeta + '/17_registro_asistido_pantalla.png' });

  // Botones de navegación (irA() pulsa la pestaña con data-tab)
  await r.locator('.rec-resumen').getByRole('button', { name: 'Reservar sauna' }).click();
  await r.waitForSelector('#rs-q', { timeout: 2000 }).catch(() => {});
  chk('R17. Tras registrar, «Reservar sauna» lleva a la pantalla de reserva',
    (await r.locator('#rs-q').count()) === 1 && (await r.locator('#ra-dni').count()) === 0);
  await r.click('[data-tab="registro"]');
  await r.waitForSelector('#ra-dni');

  await verificar('70000066');
  await r.waitForSelector('.rec-aviso-rojo');
  chk('R18. Ese mismo DNI ya no se puede registrar dos veces', (await r.textContent('.rec-aviso-rojo')).includes('Marta Registro'));
  await r.locator('.rec-aviso-rojo').getByRole('button', { name: 'Ir a Check-in' }).click();
  await r.waitForSelector('#ra-dni', { state: 'detached', timeout: 2000 }).catch(() => {});
  chk('R19. En DNI existente, «Ir a Check-in» sale de Registro asistido', (await r.locator('#ra-dni').count()) === 0);
}

