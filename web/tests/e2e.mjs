// Pruebas de interfaz: Playwright sobre el build en modo mock (sin red).
// Uso: npm run test:e2e   (genera capturas en tests/capturas/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
    if (await page.locator('#btn-ingresar').count()) await page.click('#btn-ingresar');
    await page.fill('#login-email', email);
    await page.fill('#login-pass', pass);
    await page.click('#btn-login');
  }
  // Formulario de la reserva PÚBLICA (#/reservar). No cambia.
  async function llenar(page, o) {
       await page.fill('#r-nombre', o.nombre ?? 'Lucía Prueba');
    await page.fill('#r-dni', o.dni ?? '70000099');
    await page.fill('#r-telefono', o.telefono ?? '900000099');
    await page.selectOption('#r-servicio', o.servicio ?? 'sauna');
    await page.selectOption('#r-sede', o.sede ?? 'Túpac Amaru');
    await page.fill('#r-fecha', o.fecha ?? manana(18));
    if (o.consent !== false) await page.check('#r-consent');
  }

  // Entra a la pestaña «Reservar sauna» de recepción (id del módulo = 'reservar').
  async function irASauna(page) {
    await page.locator('[data-tab="reservar"]').or(page.locator('.tabs').getByText('Reservar sauna')).first().click();
    await page.waitForSelector('#rs-q');
  }

  // --- Recepcionista ---
  let p = await nuevaPagina();
  await login(p, 'recepcion@demo.test', 'mala');
  chk('1. Login incorrecto muestra mensaje', (await p.textContent('#login-error')).includes('incorrectos'));
  await p.screenshot({ path: carpeta + '/01_login_error.png' });
  await login(p, 'recepcion@demo.test', 'demo123');
  await p.waitForSelector('.tabs');
  chk('2. Login correcto entra a la app', (await p.textContent('#usuario-info')).includes('recepcionista'));

  // Pruebas 3 a 8: pantalla nueva «Reservar sauna» (las validaciones del registro asistido están en tests/e2e/recepcion.mjs)
  await irASauna(p);
  const citasAntes = await p.evaluate(() => window.__mock.db.citas.length);
  chk('3. Pestaña «Reservar sauna» abre: pide cliente y el cobro aún no se muestra',
    (await p.isVisible('#rs-q')) && (await p.textContent('.rec-resumen')).includes('Elige cliente y turno'));
  await p.screenshot({ path: carpeta + '/02_reservar_sauna.png' });

  await p.fill('#rs-q', '47829103'); // Rodrigo Alva (afiliado vigente, mock de recepción)
  await p.getByRole('button', { name: 'Buscar' }).click();
  await p.waitForSelector('.rec-cliente-card');
  await p.getByRole('button', { name: 'Mañana' }).click();   // mañana: no altera la agenda de HOY (prueba 9)
  await p.waitForTimeout(300);                                // deja que recargue los turnos del nuevo día
  await p.waitForSelector('.rec-turno-card:not([disabled])');
  chk('4. Cliente existente: muestra su tarjeta y los turnos con cupos',
    (await p.textContent('.rec-cliente-card')).includes('Rodrigo Alva') && (await p.locator('.rec-turno-card').count()) > 0);

  chk('5. Sin elegir turno no hay botón de cobrar', (await p.getByRole('button', { name: /y reservar/ }).count()) === 0);
  await p.locator('.rec-turno-card:not([disabled])').first().click();
  await p.getByRole('button', { name: /y reservar/ }).waitFor();
  const total = (await p.textContent('.rec-total strong')).trim();
  chk('6. Elegir turno muestra el total y el botón de cobro con el mismo monto',
    /^S\/ \d+\.\d{2}$/.test(total) && (await p.getByRole('button', { name: /y reservar/ }).textContent()).includes(total));

  await p.getByRole('button', { name: 'Yape' }).click();
  chk('7. Medio de pago seleccionable (Yape queda activo)',
    (await p.getByRole('button', { name: 'Yape' }).getAttribute('class')).includes('rec-medio-act'));

  await p.getByRole('button', { name: /y reservar/ }).click();
  await p.waitForSelector('.rec-exito');
  chk('8. Reserva cobrada: +1 cita (pendiente, pagada, de recepción) y un pago de sauna con el medio elegido',
    (await p.textContent('.rec-exito')).includes('Reserva cobrada') &&
    await p.evaluate((antes) => {
      const { citas, pagos } = window.__mock.db; const c = citas[citas.length - 1];
      return citas.length === antes + 1 && c.estado_asistencia === 'pendiente' && c.estado_pago === 'pagada' && c.origen === 'recepcion' &&
        pagos.some((g) => g.id_cita === c.id_cita && g.concepto === 'sauna' && g.medio === 'yape');
    }, citasAntes));
  await p.screenshot({ path: carpeta + '/03_reserva_guardada.png' });

  await p.click('[data-tab="agenda"]');
  await p.waitForSelector('.tabla-wrap table');
  const idNueva = await p.evaluate(() => window.__mock.db.citas[window.__mock.db.citas.length - 1].id_cita);
  chk('9. Agenda del día muestra citas de hoy (incluye c2) y no la reserva hecha para mañana',
    (await p.locator('.tabla-wrap tbody tr').count()) >= 2 && (await p.locator('tr[data-id="c2"]').count()) === 1 &&
    (await p.locator(`tr[data-id="${idNueva}"]`).count()) === 0);
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

  // --- Nuevas funciones: WhatsApp, confirmación, solicitud pública, aprobación ---
  p = await nuevaPagina();
  await p.context().route('https://wa.me/**', (r) => r.fulfill({ contentType: 'text/html', body: 'ok' }));
  await login(p, 'recepcion@demo.test', 'demo123');
  await p.waitForSelector('.tabs');
  await p.click('[data-tab="agenda"]');
  await p.waitForSelector('.tabla-wrap table');
  const [popup] = await Promise.all([
    p.context().waitForEvent('page'),
    p.locator('tr[data-id="c2"] [data-accion="whatsapp"]').click()
  ]);
  await popup.waitForURL(/wa\.me\/51900000001/);
  chk('16. Botón WhatsApp abre wa.me con el teléfono del cliente (+51)', popup.url().includes('wa.me/51900000001') && popup.url().includes('text='));
  await popup.close();
  await p.waitForFunction(() => !!window.__mock.db.citas.find(c => c.id_cita === 'c2').recordatorio_enviado_en);
  chk('17. Se registra recordatorio_enviado_en', await p.evaluate(() => !!window.__mock.db.citas.find(c => c.id_cita === 'c2').recordatorio_enviado_en));
  await p.locator('tr[data-id="c2"] [data-accion="confirmar"]').click();
  await p.waitForFunction(() => !!window.__mock.db.citas.find(c => c.id_cita === 'c2').confirmada_en);
  chk('18. Marcar "Confirmó" registra confirmada_en y lo muestra', (await p.locator('tr[data-id="c2"] [data-contacto]').textContent()).includes('Confirmó'));
  await p.screenshot({ path: carpeta + '/09_agenda_whatsapp.png' });

  // Solicitud pública (sin sesión)
  const pub = await nuevaPagina();
  await pub.goto(url + '#/reservar');
  await pub.waitForSelector('#btn-reserva');
  chk('19. Página pública abre sin iniciar sesión', (await pub.textContent('h1')).includes('Solicita tu reserva'));
  await pub.click('#btn-reserva');
  chk('20. Solicitud vacía muestra errores y no guarda',
    (await pub.textContent('[data-error="nombre"]')).length > 0 && (await pub.evaluate(() => window.__mock.db.solicitudes.length)) === 1);
  await llenar(pub, { nombre: 'Marta Ficticia', dni: '70000077', telefono: '900000077', consent: false });
  await pub.uncheck('#r-consent'); await pub.click('#btn-reserva');
  chk('21. Solicitud sin consentimiento rechazada', (await pub.textContent('[data-error="consentimiento"]')).includes('29733'));
  await pub.check('#r-consent'); await pub.click('#btn-reserva');
  await pub.waitForFunction(() => document.getElementById('r-resultado').textContent.includes('Solicitud enviada'));
  chk('22. Solicitud válida se guarda como pendiente', await pub.evaluate(() => window.__mock.db.solicitudes.length === 2 && window.__mock.db.solicitudes[1].estado === 'pendiente'));
  await pub.screenshot({ path: carpeta + '/10_solicitud_publica.png' });
  await llenar(pub, { nombre: 'Bot Spam', dni: '70000078', telefono: '900000078' });
  await pub.fill('#r-empresa', 'soy un bot');
  await pub.click('#btn-reserva');
  await pub.waitForTimeout(300);
  chk('23. Señuelo anti-bot: no se guarda la solicitud', await pub.evaluate(() => window.__mock.db.solicitudes.length === 2));

  // Aprobación por el personal
  await p.click('[data-tab="solicitudes"]');
  await p.waitForSelector('tr[data-id="s1"]');
  await p.locator('tr[data-id="s1"] [data-accion="aprobar"]').click();
  await p.waitForFunction(() => window.__mock.db.solicitudes.find(s => s.id_solicitud === 's1').estado === 'aprobada');
  await p.click('[data-tab="agenda"]');
  const dm = new Date(); dm.setDate(dm.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  await p.fill('#a-fecha', `${dm.getFullYear()}-${pad(dm.getMonth() + 1)}-${pad(dm.getDate())}`);
  await p.waitForSelector('.tabla-wrap tbody tr');
  chk('24. Aprobar solicitud crea la cita en la agenda', (await p.textContent('.tabla-wrap tbody')).includes('Cliente Demo 31'));
  await p.screenshot({ path: carpeta + '/11_solicitud_aprobada.png' });

  // --- Migración 3: riesgo, «Canceló», log de tiempo (el aforo y los duplicados de recepción están en tests/e2e/recepcion.mjs) ---
  const q = await nuevaPagina();
  await login(q, 'recepcion@demo.test', 'demo123');
  await q.waitForSelector('.tabs');
  // Historial ficticio: Cliente Demo 02 faltó 2 de 3 veces en los últimos días; k1 solo tiene 1 cita con estado final.
  await q.evaluate(() => {
    const { db } = window.__mock;
    const dias = (n, h) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
    const hoyH = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
    db.clientes.push({ id_cliente: 'k2', nombre: 'Cliente Demo 02', dni: '70000002', telefono: '900000002' });
    [['no_asistio', 3], ['no_asistio', 5], ['asistio', 8]].forEach(([e, n], i) => db.citas.push({
      id_cita: 'h' + i, id_cliente: 'k2', servicio: 'sauna', sede: 'Túpac Amaru', fecha_hora_cita: dias(n, 18),
      fecha_hora_registro: dias(n + 1, 9), estado_asistencia: e }));
    db.citas.push({ id_cita: 'r1', id_cliente: 'k2', servicio: 'gimnasio', sede: 'Túpac Amaru', fecha_hora_cita: hoyH(22),
      fecha_hora_registro: hoyH(0), estado_asistencia: 'pendiente' });
  });
  await q.click('[data-tab="agenda"]');
  await q.waitForSelector('.tabla-wrap table');
  await q.click('#btn-agenda');
  await q.waitForSelector('[data-riesgo="alto"]');
  chk('25. Alto riesgo: etiqueta solo al cliente con ≥30 % de inasistencia (2 de 3)',
    (await q.locator('[data-riesgo="alto"]').count()) === 1 && (await q.locator('tr[data-id="r1"] [data-riesgo="alto"]').count()) === 1);
  chk('26. Cliente con 1 sola cita no se marca como riesgo', (await q.locator('tr[data-id="c2"] [data-riesgo="alto"]').count()) === 0);
  await q.screenshot({ path: carpeta + '/12_alto_riesgo.png' });
  await q.check('#a-riesgo');
  chk('27. Filtro «Solo alto riesgo» deja solo la cita de riesgo', (await q.locator('.tabla-wrap tbody tr').count()) === 1);
  await q.uncheck('#a-riesgo');

  await q.locator('tr[data-id="c2"] [data-accion="cancelo"]').click();
  await q.waitForFunction(() => window.__mock.db.citas.find(c => c.id_cita === 'c2').estado_asistencia === 'cancelo');
  const reg = await q.evaluate(() => window.__mock.db.citas.find(c => c.id_cita === 'c2'));
 
   chk('28. «Canceló» se guarda y se muestra',
     (await q.locator('tr[data-id="c2"] .etq.cancelo').textContent({ timeout: 3000 }).catch(() => '')).includes('Canceló'));
  chk('29. Log de tiempo: guarda marcada_en y segundos_registro (número ≥ 0)',
    !!reg.marcada_en && typeof reg.segundos_registro === 'number' && reg.segundos_registro >= 0);

  // Panel con gráficos (administrador)
  const a = await nuevaPagina();
  await login(a, 'admin@demo.test', 'demo123');
  await a.waitForSelector('.tabs');
  await a.evaluate(() => {
    const { db } = window.__mock;
    const dias = (n, h) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
    db.clientes.push({ id_cliente: 'kx', nombre: 'Cliente Demo 09', dni: '70000009', telefono: '900000009' });
    for (let i = 0; i < 30; i++) {
      const no = i % 4 === 0, rec = i % 3 === 0;
      db.citas.push({ id_cita: 'g' + i, id_cliente: 'kx', servicio: i % 2 ? 'sauna' : 'gimnasio', sede: i % 3 ? 'Túpac Amaru' : 'Santa Rosa',
        fecha_hora_cita: dias(1 + (i % 13), 8 + (i % 14)), fecha_hora_registro: dias(2 + (i % 13), 8),
        estado_asistencia: no ? 'no_asistio' : (i % 11 === 0 ? 'cancelo' : 'asistio'),
        recordatorio_enviado_en: rec ? dias(1, 7) : null, segundos_registro: 1.2 + (i % 5) / 10 });
    }
  });
  await a.click('[data-tab="panel"]');
  await a.waitForSelector('.grafico svg');
  chk('34. Panel muestra gráfico de barras por día, dona, mapa de calor y cohortes',
    (await a.locator('.grafico svg rect').count()) > 0 && (await a.locator('.dona-lista li').count()) === 4 &&
    (await a.locator('table.calor').count()) === 1 && (await a.locator('.barra-fila').count()) >= 2);
  chk('35. KPI de tiempo de marcado y registros completos con valores numéricos',
    /s$/.test((await a.locator('.kpi', { hasText: 'Tiempo promedio' }).locator('.num').textContent()).trim()) &&
    (await a.locator('.kpi', { hasText: 'Registros completos' }).locator('.num').textContent()).trim() >= 20);
  await a.screenshot({ path: carpeta + '/14_panel_graficos.png', fullPage: true });
  const ma = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const pa = await ma.newPage();
  await pa.goto(url); await login(pa, 'admin@demo.test', 'demo123');
  await pa.waitForSelector('.tabs'); await pa.click('[data-tab="panel"]'); await pa.waitForSelector('.kpis');
  chk('36. Panel en móvil 375px sin scroll horizontal de la página', await pa.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await pa.screenshot({ path: carpeta + '/15_panel_movil.png', fullPage: true });

  // Móvil
  const m = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const pm = await m.newPage();
  await pm.goto(url); await login(pm, 'recepcion@demo.test', 'demo123');
  await pm.waitForSelector('.tabs');
  chk('15. Móvil 375px sin scroll horizontal', await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await pm.screenshot({ path: carpeta + '/08_movil.png' });

  // Pruebas de interfaz por rol: cada archivo de tests/e2e/ exporta `correr(ctx)`.
  const carpetaRoles = path.join(aqui, 'e2e');
  for (const f of fs.readdirSync(carpetaRoles).filter((n) => n.endsWith('.mjs')).sort()) {
    const { correr } = await import(pathToFileURL(path.join(carpetaRoles, f)).href);
    await correr({ browser, url, login, nuevaPagina, chk, carpeta, irASauna });
  }

  await browser.close(); server.close();
  const fallos = resultados.filter(r => !r[1]);
  console.log(`\n${resultados.length - fallos.length}/${resultados.length} pruebas de interfaz pasaron`);
  process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
