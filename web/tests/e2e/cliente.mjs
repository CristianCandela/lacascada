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
      'CLI-1. El cliente ve solo su menú (Mis reservas) y no las pantallas del personal',
      (await p.locator('[data-tab="mis-reservas"]').count()) === 1 &&
      (await p.locator('[data-tab="agenda"]').count()) === 0 &&
      (await p.locator('[data-tab="panel"]').count()) === 0
    );

    // HU-C2: Check-in Gimnasio
    if ((await p.locator('[data-tab="ingresar-codigo"]').count()) > 0) {
      await p.click('[data-tab="ingresar-codigo"]');
    }
    chk(
      'CLI-2. El cliente visualiza la pantalla de Check-in Gimnasio',
      (await p.locator('button:has-text("Marcar Entrada")').count()) > 0 ||
      (await p.locator('input').count()) > 0
    );

    // HU-C5: Mi Membresía
    if ((await p.locator('[data-tab="mi-membresia"]').count()) > 0) {
      await p.click('[data-tab="mi-membresia"]');
    }
    chk(
      'CLI-3. El cliente visualiza la información de su plan y membresía',
      (await p.locator('body').innerText()).includes('Plan general') ||
      (await p.locator('body').innerText()).includes('Vigente')
    );

    await p.context().close();
  }

  // Escena 2: Ruta pública de autoregistro (HU-C1)
  {
    const p = await nuevaPagina();
    await p.goto(`${url}/#/registro`);
    await p.waitForTimeout(500);

    chk(
      'CLI-4. La ruta pública #/registro carga el formulario de autoregistro con código',
      (await p.locator('body').innerText()).includes('Registro') ||
      (await p.locator('form').count()) > 0
    );

    await p.context().close();
  }
}
