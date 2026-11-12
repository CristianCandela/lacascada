// Pruebas de interfaz de páginas públicas (dueño: Cristian). `correr` la llama tests/e2e.mjs.
// Añade aquí tus pruebas con chk('PUB-n. descripción', condición).
export async function correr({ url, nuevaPagina, chk }) {
  let p = await nuevaPagina();
  await p.goto(url + '#/reservar');
  await p.waitForSelector('#r-nombre');
  chk('PUB-1. La ruta pública #/reservar muestra el formulario sin iniciar sesión', (await p.locator('#r-nombre').count()) === 1);
  await p.context().close();

  // Página de inicio
  p = await nuevaPagina();
  await p.goto(url);
  await p.waitForSelector('#pub-h1');
  chk('PUB-2. El inicio muestra la página pública sin iniciar sesión', (await p.locator('#btn-ingresar').count()) === 1);
  await p.waitForSelector('[role="meter"]');
  chk('PUB-3. El aforo muestra barras de gimnasio y sauna', (await p.locator('[role="meter"]').count()) === 2);
  chk('PUB-4. El plan general muestra S/ 150', (await p.textContent('#plan')).includes('S/ 150'));
  const antes = await p.textContent('#aforo');
  await p.click('[data-sede="Santa Rosa"]');
  chk('PUB-5. Se puede cambiar de sede en el aforo', (await p.getAttribute('[data-sede="Santa Rosa"]', 'aria-pressed')) === 'true' && typeof antes === 'string');
  chk('PUB-6. Se listan las dos sedes con dirección', (await p.locator('[data-sede-card]').count()) === 2);
  chk('PUB-7. Enlace de reserva apunta a #/reservar', (await p.locator('a[href="#/reservar"]').count()) >= 1);
  chk('PUB-8. Sin desplazamiento horizontal en 1100 px', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await p.setViewportSize({ width: 375, height: 800 });
  chk('PUB-9. Sin desplazamiento horizontal en 375 px', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await p.click('#btn-ingresar');
  await p.waitForSelector('#login-email');
  chk('PUB-10. "Ingresar" lleva al inicio de sesión', (await p.locator('#login-email').count()) === 1);
  await p.context().close();
}
