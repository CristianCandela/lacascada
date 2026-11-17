// Pruebas de interfaz del rol cliente (dueño: Abel). `correr` la llama tests/e2e.mjs.
// Añade aquí tus pruebas con chk('CLI-n. descripción', condición). Usa una página nueva por escena

export async function correr({ url, nuevaPagina, login, chk }) {
  // Escena 1: Cliente autenticado y sus módulos (HU-C2 a HU-C5)
  {
    const p = await nuevaPagina();
    await login(p, 'cliente@demo.test', 'demo123');
    await p.waitForSelector('.tabs');

    // HU-C5 / Seguridad: Menú del cliente aislado de recepción y admin
    chk(
      'CLI-1. El cliente ve solo su menú y no las pantallas del personal',
      (await p.locator('[data-tab="mis-reservas"]').count()) === 1 &&
      (await p.locator('[data-tab="agenda"]').count()) === 0 &&
      (await p.locator('[data-tab="panel"]').count()) === 0
    );

    // HU-C2: Check-in Gimnasio
    await p.click('[data-tab="ingresar-codigo"]');
    await p.waitForSelector('.cli-input-codigo');
    chk(
      'CLI-2. El cliente visualiza la pantalla de Check-in Gimnasio',
      (await p.locator('button:has-text("Marcar Entrada")').count()) === 1
    );

    // HU-C3 / HU-C4: Reservas de Sauna
    await p.click('[data-tab="mis-reservas"]');
    await p.waitForSelector('.cli-form-reserva');
    chk(
      'CLI-3. El cliente visualiza el formulario y listado de Reservas de Sauna',
      (await p.locator('button:has-text("Agendar Turno")').count()) === 1
    );

    // HU-C5: Mi Membresía
    await p.click('[data-tab="mi-membresia"]');
    await p.waitForSelector('.cli-detalles-plan');
    const textoMembresia = await p.locator('body').innerText();
    chk(
      'CLI-4. El cliente visualiza la información de su plan y membresía',
      textoMembresia.includes('Plan general') && textoMembresia.includes('Vigente')
    );

    await p.context().close();
  }

  // Escena 2: Ruta pública de autoregistro y validación de formulario vacío (HU-C1)
  {
    const p = await nuevaPagina();
    await p.goto(`${url}/#/registro`);
    await p.waitForSelector('.cli-form');

    await p.click('button:has-text("Completar Registro")');
    const hayError = (await p.locator('.cli-error').count()) === 1;

    chk(
      'CLI-5. La ruta pública #/registro carga el formulario y valida campos vacíos',
      (await p.locator('body').innerText()).includes('Registro de Cliente Nuevo') && hayError
    );

    await p.context().close();
  }
}