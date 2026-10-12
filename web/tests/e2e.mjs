// Pruebas de interfaz: Playwright sobre el build en modo mock (sin red).
// Uso: npm run test:e2e   (genera capturas en tests/capturas/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..', 'dist-mock');
const carpeta = path.join(aqui, 'capturas');
fs.mkdirSync(carpeta, { recursive: true });

const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let f = path.join(raiz, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});

const resultados = [];
function chk(nombre, cond) { resultados.push([nombre, !!cond]); console.log((cond ? '  Pasó     ' : '  NO PASÓ  ') + nombre); }

function manana(h) {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  async function nuevaPagina() {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    await page.goto(url);
    return page;
  }
  async function login(page, email, pass) {
    await page.fill('#login-email', email);
    await page.fill('#login-pass', pass);
    await page.click('#btn-login');
  }
  async function llenar(page, o) {
    await page.fill('#r-nombre', o.nombre ?? 'Lucía Prueba');
    await page.fill('#r-dni', o.dni ?? '70000099');
    await page.fill('#r-telefono', o.telefono ?? '900000099');
    await page.selectOption('#r-servicio', o.servicio ?? 'sauna');
    await page.selectOption('#r-sede', o.sede ?? 'Año Nuevo');
    await page.fill('#r-fecha', o.fecha ?? manana(18));
    if (o.consent !== false) await page.check('#r-consent');
  }

  // --- Recepcionista ---
  let p = await nuevaPagina();
  await login(p, 'recepcion@demo.test', 'mala');
  chk('1. Login incorrecto muestra mensaje', (await p.textContent('#login-error')).includes('incorrectos'));
  await p.screenshot({ path: carpeta + '/01_login_error.png' });
  await login(p, 'recepcion@demo.test', 'demo123');
  await p.waitForSelector('.tabs');
  chk('2. Login correcto entra a la app', (await p.textContent('#usuario-info')).includes('recepcionista'));

  await p.click('#btn-reserva');
  chk('3. Formulario vacío: muestra errores y no guarda',
    (await p.textContent('[data-error="nombre"]')).length > 0 && (await p.evaluate(() => window.__mock.db.citas.length)) === 2);
  await p.screenshot({ path: carpeta + '/02_formulario_vacio.png' });

  await llenar(p, { telefono: '12345' }); await p.click('#btn-reserva');
  chk('4. Teléfono inválido rechazado', (await p.textContent('[data-error="telefono"]')).includes('9 dígitos'));
  await llenar(p, { dni: '123' }); await p.click('#btn-reserva');
  chk('5. DNI distinto de 8 dígitos rechazado', (await p.textContent('[data-error="dni"]')).includes('8 dígitos'));
  await llenar(p, { fecha: '2020-01-01T10:00' }); await p.click('#btn-reserva');
  chk('6. Fecha pasada rechazada', (await p.textContent('[data-error="fecha_hora"]')).includes('posteriores'));
  await llenar(p, { consent: false }); await p.uncheck('#r-consent'); await p.click('#btn-reserva');
  chk('7. Sin consentimiento no guarda', (await p.textContent('[data-error="consentimiento"]')).includes('29733'));

  await llenar(p, {}); await p.click('#btn-reserva');
  await p.waitForFunction(() => document.getElementById('r-resultado').textContent.includes('guardada'));
  chk('8. Reserva válida se guarda (estado pendiente)',
    await p.evaluate(() => window.__mock.db.citas.length === 3 && window.__mock.db.citas[2].estado_asistencia === 'pendiente'));
  await p.screenshot({ path: carpeta + '/03_reserva_guardada.png' });

  await p.click('[data-tab="agenda"]');
  await p.waitForSelector('.tabla-wrap table');
  chk('9. Agenda del día muestra citas de hoy', (await p.locator('.tabla-wrap tbody tr').count()) === 2);
  chk('10. Recepcionista no ve botón Eliminar', (await p.locator('[data-accion="eliminar"]').count()) === 0);
  await p.screenshot({ path: carpeta + '/04_agenda.png' });

  await p.click('[data-tab="panel"]');
  chk('11. Recepcionista sin acceso al panel', (await p.textContent('main')).includes('Acceso denegado'));

  await p.evaluate(() => window.__mock.caerRed(true));
  await p.click('[data-tab="agenda"]');
  await p.waitForSelector('#aviso');
  chk('12. Falla de red: mensaje claro y la app sigue viva',
    (await p.textContent('#aviso')).includes('No se pudo conectar') && await p.isVisible('.tabs'));
  await p.screenshot({ path: carpeta + '/05_falla_red.png' });
  await p.evaluate(() => window.__mock.caerRed(false));

  // --- Administrador ---
  p = await nuevaPagina();
  await login(p, 'admin@demo.test', 'demo123');
  await p.waitForSelector('.tabs');
  await p.click('[data-tab="agenda"]');
  await p.waitForSelector('.tabla-wrap table');
  chk('13. Administrador ve botón Eliminar', (await p.locator('[data-accion="eliminar"]').count()) > 0);

  await p.click('[data-tab="panel"]');
  await p.waitForSelector('.kpis');
  const antes = await p.textContent('.kpi .num');
  await p.screenshot({ path: carpeta + '/06_panel_admin.png' });
  await p.click('[data-tab="agenda"]');
  await p.waitForSelector('.tabla-wrap table');
  await p.locator('tr[data-id="c2"] [data-accion="no_asistio"]').click();
  await p.waitForFunction(() => window.__mock.db.citas.find(c => c.id_cita === 'c2').estado_asistencia === 'no_asistio');
  await p.click('[data-tab="panel"]');
  await p.waitForSelector('.kpis');
  const despues = await p.textContent('.kpi .num');
  chk('14. Marcar "No asistió" cambia el % de no-shows (' + antes + ' → ' + despues + ')', antes !== despues && parseFloat(despues) > parseFloat(antes));
  await p.screenshot({ path: carpeta + '/07_panel_actualizado.png' });

  // Móvil
  const m = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const pm = await m.newPage();
  await pm.goto(url); await login(pm, 'recepcion@demo.test', 'demo123');
  await pm.waitForSelector('.tabs');
  chk('15. Móvil 375px sin scroll horizontal', await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await pm.screenshot({ path: carpeta + '/08_movil.png' });

  await browser.close(); server.close();
  const fallos = resultados.filter(r => !r[1]);
  console.log(`\n${resultados.length - fallos.length}/${resultados.length} pruebas de interfaz pasaron`);
  process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
