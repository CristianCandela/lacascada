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

  // --- Migración 3: riesgo, «Canceló», log de tiempo, aforo, duplicados y gráficos ---
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
      id_cita: 'h' + i, id_cliente: 'k2', servicio: 'sauna', sede: 'Año Nuevo', fecha_hora_cita: dias(n, 18),
      fecha_hora_registro: dias(n + 1, 9), estado_asistencia: e }));
    db.citas.push({ id_cita: 'r1', id_cliente: 'k2', servicio: 'gimnasio', sede: 'Año Nuevo', fecha_hora_cita: hoyH(22),
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
  chk('28. «Canceló» se guarda y se muestra', (await q.locator('tr[data-id="c2"] .etq.cancelo').textContent()).includes('Canceló'));
  chk('29. Log de tiempo: guarda marcada_en y segundos_registro (número ≥ 0)',
    !!reg.marcada_en && typeof reg.segundos_registro === 'number' && reg.segundos_registro >= 0);

  // Aforo: en el mock el sauna de Año Nuevo admite 2 por franja
  await q.click('[data-tab="registrar"]');
  const reservar = async (dni) => {
    await llenar(q, { nombre: 'Aforo Prueba Uno', dni, telefono: '9000000' + dni.slice(-2), fecha: manana(20) });
    await q.click('#btn-reserva');
  };
  await reservar('70000091');
  await q.waitForFunction(() => document.getElementById('r-resultado').textContent.includes('guardada'));
  await llenar(q, { dni: '70000092', nombre: 'Aforo Prueba Dos', telefono: '900000092', fecha: manana(20) });
  await q.waitForSelector('#r-cupos');
  chk('30. Formulario muestra los cupos libres de la franja', (await q.textContent('#r-cupos')).includes('1 de 2'));
  await q.click('#btn-reserva');
  await q.waitForFunction(() => document.getElementById('r-resultado').textContent.includes('guardada'));
  const antesAforo = await q.evaluate(() => window.__mock.db.citas.length);
  await llenar(q, { dni: '70000093', nombre: 'Aforo Prueba Tres', telefono: '900000093', fecha: manana(20) });
  await q.waitForFunction(() => (document.getElementById('r-cupos') || {}).textContent?.includes('Aforo máximo'));
  await q.click('#btn-reserva');
  await q.waitForFunction(() => document.querySelector('[data-error="fecha_hora"]').textContent.includes('Aforo máximo'));
  chk('31. Aforo lleno: bloquea la reserva con el mensaje y no guarda',
    (await q.evaluate(() => window.__mock.db.citas.length)) === antesAforo);
  await q.screenshot({ path: carpeta + '/13_aforo_lleno.png' });

  // Cancelar libera el cupo
  await q.click('[data-tab="agenda"]');
  const dm2 = new Date(); dm2.setDate(dm2.getDate() + 1);
  const p2 = (n) => String(n).padStart(2, '0');
  await q.fill('#a-fecha', `${dm2.getFullYear()}-${p2(dm2.getMonth() + 1)}-${p2(dm2.getDate())}`);
  await q.waitForSelector('.tabla-wrap tbody tr');
  await q.locator('.tabla-wrap tbody tr').first().locator('[data-accion="cancelo"]').click();
  await q.waitForFunction(() => window.__mock.db.citas.filter(c => c.estado_asistencia === 'cancelo').length >= 2);
  await q.click('[data-tab="registrar"]');
  await llenar(q, { dni: '70000093', nombre: 'Aforo Prueba Tres', telefono: '900000093', fecha: manana(20) });
  await q.click('#btn-reserva');
  await q.waitForFunction(() => document.getElementById('r-resultado').textContent.includes('guardada'));
  chk('32. Cancelar una cita libera el cupo y permite reservar',
    (await q.evaluate(() => window.__mock.db.citas.length)) === antesAforo + 1);

  // Duplicado: mismo cliente, servicio y hora
  await llenar(q, { dni: '70000093', nombre: 'Aforo Prueba Tres', telefono: '900000093', servicio: 'gimnasio', fecha: manana(9) });
  await q.click('#btn-reserva');
  await q.waitForFunction(() => document.getElementById('r-resultado').textContent.includes('guardada'));
  await llenar(q, { dni: '70000093', nombre: 'Aforo Prueba Tres', telefono: '900000093', servicio: 'gimnasio', fecha: manana(9) });
  await q.click('#btn-reserva');
  await q.waitForSelector('#aviso');
  chk('33. Reserva duplicada (mismo cliente, servicio y hora) se rechaza con mensaje claro',
    (await q.textContent('#aviso')).includes('ya tiene una reserva'));

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
      db.citas.push({ id_cita: 'g' + i, id_cliente: 'kx', servicio: i % 2 ? 'sauna' : 'gimnasio', sede: i % 3 ? 'Año Nuevo' : 'Santa Rosa',
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

  await browser.close(); server.close();
  const fallos = resultados.filter(r => !r[1]);
  console.log(`\n${resultados.length - fallos.length}/${resultados.length} pruebas de interfaz pasaron`);
  process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
