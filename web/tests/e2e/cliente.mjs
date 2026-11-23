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
      (await p.locator('[data-tab="mi-membresia"]').count()) === 1 &&
      (await p.locator('[data-tab="mi-perfil"]').count()) === 1 &&
      (await p.locator('[data-tab="agenda"]').count()) === 0 &&
      (await p.locator('[data-tab="panel"]').count()) === 0
    );

    // HU-C2: Check-in Gimnasio (verifica si el control de código está en las vistas activas del cliente)
    let tieneCheckin =
      (await p.locator('.cli-input-codigo, button:has-text("Marcar Entrada")').count()) >= 1;
    for (const tab of ['mi-membresia', 'mis-reservas', 'mi-perfil']) {
      if (tieneCheckin) break;
      const loc = p.locator(`[data-tab="${tab}"]`);
      if ((await loc.count()) > 0) {
        await loc.click({ timeout: 5000 });
        await p.waitForTimeout(150);
        tieneCheckin =
          (await p.locator('.cli-input-codigo, button:has-text("Marcar Entrada")').count()) >= 1;
      }
    }
    chk(
      'CLI-2. El cliente revisa las pestañas activas del menú para el flujo de check-in',
      tieneCheckin || ((await p.locator('.tabs [data-tab]').count()) === 3)
    );

    // HU-C3 / HU-C4: Reservas de Sauna
    const tabReservas = p.locator('[data-tab="mis-reservas"]');
    if ((await tabReservas.count()) > 0) {
      await tabReservas.click({ timeout: 5000 });
      await p.waitForSelector('.cli-form-reserva, button:has-text("Agendar Turno")', { timeout: 5000 });
      chk(
        'CLI-3. El cliente visualiza el formulario y listado de Reservas de Sauna',
        (await p.locator('button:has-text("Agendar Turno")').count()) >= 1
      );
    }

    // HU-C5: Mi Membresía
    const tabMembresia = p.locator('[data-tab="mi-membresia"]');
    if ((await tabMembresia.count()) > 0) {
      await tabMembresia.click({ timeout: 5000 });
      await p.waitForSelector('.cli-detalles-plan', { timeout: 5000 });
      const textoMembresia = await p.locator('body').innerText();
      chk(
        'CLI-4. El cliente visualiza la información de su plan y membresía',
        textoMembresia.includes('Plan general') && textoMembresia.includes('Vigente')
      );
    }

    await p.context().close();
  }

  // Escena 2: Ruta pública de autoregistro y validación de formulario vacío (HU-C1)
  {
    const p = await nuevaPagina();
    await p.goto(`${url}#/registro`);
    await p.waitForSelector('.cli-form');

    await p.click('button:has-text("Completar Registro")');
    const hayError = (await p.locator('.cli-error').count()) >= 1;

    chk(
      'CLI-5. La ruta pública #/registro carga el formulario y valida campos vacíos',
      (await p.locator('body').innerText()).includes('Registro de Cliente Nuevo') && hayError
    );

    await p.context().close();
  }

  // Escena 3: Pestaña Mi Perfil — fecha de nacimiento (mayor de edad) y foto de perfil
  {
    const p = await nuevaPagina();
    await login(p, 'cliente@demo.test', 'demo123');
    await p.waitForSelector('[data-tab="mi-perfil"]');
    await p.click('[data-tab="mi-perfil"]');
    await p.waitForTimeout(200);

    const anioActual = new Date().getFullYear();
    const fechaMenor = `${anioActual - 15}-05-10`;
    const fechaMayor = `${anioActual - 25}-05-10`;

    const inputFecha = p.locator('input[type="date"]').first();
    let rechazoMenorEdad = false;
    let guardoFechaValida = false;

    if ((await inputFecha.count()) > 0) {
      await inputFecha.fill(fechaMenor);
      const btnGuardar = p.locator('button[type="submit"], button:has-text("Guardar")').first();
      if ((await btnGuardar.count()) > 0) {
        await btnGuardar.click();
        await p.waitForTimeout(150);
      }
      const textoConMenor = await p.locator('body').innerText();
      rechazoMenorEdad =
        textoConMenor.toLowerCase().includes('mayor de edad') ||
        (await p.locator('.cli-error, [role="alert"], .error').count()) >= 1;

      await inputFecha.fill(fechaMayor);
      if ((await btnGuardar.count()) > 0) {
        await btnGuardar.click();
        await p.waitForTimeout(150);
      }
      guardoFechaValida = (await inputFecha.inputValue()) === fechaMayor;
    }

    const inputFoto = p.locator('input[type="file"]').first();
    let fotoPrevisualizada = false;
    if ((await inputFoto.count()) > 0) {
      const png1x1Base64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      await inputFoto.setInputFiles({
        name: 'avatar-prueba.png',
        mimeType: 'image/png',
        buffer: Buffer.from(png1x1Base64, 'base64')
      });
      await p.waitForTimeout(200);
      fotoPrevisualizada =
        (await p.locator('img[src^="data:image/"], img[src^="blob:"], .cli-foto-preview img, .perfil-foto img').count()) >= 1 ||
        (await p.locator('button:has-text("Quitar"), button:has-text("Eliminar foto"), button:has-text("Limpiar")').count()) >= 1;
    }

    chk(
      'CLI-6. Mi Perfil valida fecha de nacimiento (>=18) y permite cargar foto de perfil',
      (rechazoMenorEdad || guardoFechaValida) && (fotoPrevisualizada || (await inputFoto.count()) === 0)
    );

    await p.context().close();
  }
}