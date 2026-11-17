// aforo.mjs — Pantalla pública de aforo en vivo (#/aforo) + enlace desde la portada + pruebas de interfaz.
// Uso: copia este archivo en la RAÍZ del repositorio y ejecuta:  node aforo.mjs   (con el árbol de Git limpio). Repetible.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const NUEVO = {"web/src/features/publico/AforoPublico.jsx": "import { useCallback, useEffect, useState } from 'react';\nimport { supabase } from '../../lib/supabase';\nimport Icono, { Logo } from '../../components/Iconos';\nimport BarraAforo from './BarraAforo';\nimport { EMPRESA, SEDES } from './contenido';\nimport { aforoDeSede, estadoLocal } from './landing-logica';\nimport './landing.css';\n\nconst REFRESCO_MS = 15000;\n\n// Pantalla pública de aforo en vivo (HU-P2): pensada para abrirla desde el celular o mostrarla en una pantalla del local.\nexport default function AforoPublico() {\n  const [aforo, setAforo] = useState(null);\n  const [falloAforo, setFalloAforo] = useState(false);\n  const [horarios, setHorarios] = useState([]);\n  const [actualizado, setActualizado] = useState(null);\n\n  useEffect(() => {\n    const anterior = document.title;\n    document.title = 'Aforo en vivo · Cascada Gym';\n    return () => { document.title = anterior; };\n  }, []);\n\n  const cargar = useCallback(async () => {\n    try {\n      const r = await supabase.rpc('aforo_actual', {});\n      if (r.error) throw r.error;\n      setAforo(r.data || []); setFalloAforo(false); setActualizado(new Date());\n    } catch {\n      setFalloAforo(true);\n      setAforo((previo) => previo || []);\n    }\n  }, []);\n\n  useEffect(() => {\n    cargar();\n    const t = setInterval(cargar, REFRESCO_MS);\n    return () => clearInterval(t);\n  }, [cargar]);\n\n  useEffect(() => {\n    (async () => {\n      try {\n        const s = await supabase.from('sedes').select('sede, abre, cierra').order('sede');\n        if (!s.error && s.data) setHorarios(s.data);\n      } catch { /* la pantalla funciona sin horarios */ }\n    })();\n  }, []);\n\n  const hora = actualizado\n    ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }).format(actualizado)\n    : null;\n\n  return (\n    <div className=\"pub pub-pagina-aforo\">\n      <header className=\"pub-barra\">\n        <div className=\"pub-barra-in\">\n          <a className=\"pub-marca\" href=\"#/inicio\" aria-label=\"Cascada Gym, inicio\">\n            <Logo tam={44} /><span><b>{EMPRESA.marca}</b><small>Sauna y gimnasio</small></span>\n          </a>\n          <div className=\"pub-acciones\">\n            <a className=\"pub-btn pub-btn-fantasma\" href=\"#/inicio\">Volver al inicio</a>\n          </div>\n        </div>\n      </header>\n\n      <main className=\"pub-cont pub-aforo-main\">\n        <h1 id=\"aforo-h1\">Aforo en vivo</h1>\n        <p className=\"pub-aforo-sub\">\n          Personas dentro ahora y reservas de sauna de la hora actual.\n          {hora && <> Actualizado a las <b>{hora}</b>; se renueva cada 15 segundos.</>}\n        </p>\n        {falloAforo && <p className=\"pub-nota pub-nota-error\" role=\"status\">No pudimos actualizar el aforo. Mostramos el último dato disponible.</p>}\n        {aforo === null && <p className=\"pub-aforo-sub\">Cargando aforo…</p>}\n\n        {aforo !== null && (\n          <div className=\"pub-aforo-sedes\">\n            {Object.entries(SEDES).map(([sede, info]) => {\n              const datos = aforoDeSede(aforo, sede);\n              const h = horarios.find((x) => x.sede === sede);\n              const est = h ? estadoLocal(h.abre, h.cierra) : null;\n              return (\n                <section key={sede} className=\"pub-aforo-sede\" aria-labelledby={`s-${sede}`}>\n                  <div className=\"pub-aforo-sede-cab\">\n                    <div>\n                      <h2 id={`s-${sede}`}>{info.titulo}</h2>\n                      <p>{info.direccion}</p>\n                    </div>\n                    {est && (\n                      <span className={`pub-estado ${est.abierto ? 'abierto' : 'cerrado'}`}>\n                        {est.abierto ? `Abierto hasta las ${est.cierra}` : `Cerrado · abre a las ${est.abre}`}\n                      </span>\n                    )}\n                  </div>\n                  {datos.gimnasio\n                    ? <BarraAforo titulo=\"Gimnasio\" icono={<Icono n=\"pesa\" tam={18} />} ocupados={datos.gimnasio.ocupados} capacidad={datos.gimnasio.capacidad} unidad=\"personas dentro\" />\n                    : <p className=\"pub-nota\">Sin datos del gimnasio.</p>}\n                  {datos.sauna\n                    ? <BarraAforo titulo=\"Sauna\" icono={<Icono n=\"sauna\" tam={18} />} ocupados={datos.sauna.ocupados} capacidad={datos.sauna.capacidad} unidad=\"cupos reservados este turno\" />\n                    : <p className=\"pub-nota\">Sin datos del sauna.</p>}\n                </section>\n              );\n            })}\n          </div>\n        )}\n\n        <p className=\"pub-aforo-pie\">\n          ¿Quieres entrenar o usar el sauna? <a href=\"#/reservar\">Solicita una reserva</a> o <a href=\"#/ingresar\">ingresa a tu cuenta</a>.\n        </p>\n      </main>\n    </div>\n  );\n}\n"};
const CSS = "\n/* ----- Pantalla de aforo en vivo (#/aforo) ----- */\n.pub-aforo-main { padding: 40px 0 64px; }\n.pub-aforo-main h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 600; }\n.pub-aforo-sub { margin-top: 10px; color: var(--suave); line-height: 1.55; max-width: 44em; }\n.pub-aforo-sedes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 24px; margin-top: 28px; }\n.pub-aforo-sede { border: 1px solid var(--borde, #dfe5ea); border-radius: 16px; padding: 24px; background: #fff; display: grid; gap: 18px; align-content: start; }\n.pub-aforo-sede-cab { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }\n.pub-aforo-sede-cab h2 { font-size: 1.3rem; font-weight: 600; }\n.pub-aforo-sede-cab p { margin-top: 4px; color: var(--suave); font-size: .9rem; }\n.pub-aforo-pie { margin-top: 32px; color: var(--suave); }\n.pub-aforo-pie a { color: var(--azul-fuerte); font-weight: 600; }\n.pub .pub-aforo-sub { margin-top: 10px; }\n.pub .pub-aforo-pie { margin-top: 32px; }\n.pub .pub-aforo-sede-cab p { margin-top: 4px; }\n";
const E2E = "\n  // Pantalla #/aforo\n  p = await nuevaPagina();\n  await p.goto(url + '#/aforo');\n  await p.waitForSelector('#aforo-h1');\n  await p.waitForSelector('[role=\"meter\"]');\n  chk('PUB-11. #/aforo muestra el aforo de las dos sedes (4 barras) sin iniciar sesión', (await p.locator('[role=\"meter\"]').count()) === 4);\n  chk('PUB-12. #/aforo indica la hora de actualización', (await p.textContent('.pub-aforo-sub')).includes('Actualizado a las'));\n  await p.setViewportSize({ width: 375, height: 800 });\n  chk('PUB-13. #/aforo sin desplazamiento horizontal en 375 px', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));\n  await p.click('text=Volver al inicio');\n  await p.waitForSelector('#btn-ingresar');\n  chk('PUB-14. \"Volver al inicio\" regresa a la portada', (await p.locator('#btn-ingresar').count()) === 1);\n  await p.context().close();\n";
const ESTRICTOS = {
 "web/src/features/publico/index.js": [
  [
   "import SolicitudPublica from '../../components/SolicitudPublica';\n",
   "import SolicitudPublica from '../../components/SolicitudPublica';\nimport AforoPublico from './AforoPublico';\n"
  ],
  [
   "  '#/reservar': SolicitudPublica\n  // Cristian: agrega aquí páginas nuevas (ej.: '#/aforo': AforoPublico, '#/planes': Planes).",
   "  '#/reservar': SolicitudPublica,\n  '#/aforo': AforoPublico\n  // Cristian: agrega aquí páginas nuevas (ej.: '#/planes': Planes)."
  ]
 ],
 "web/src/features/publico/Landing.jsx": [
  [
   "{actualizado && !falloAforo && <p className=\"pub-nota\">Se actualiza cada 30 segundos.</p>}",
   "{actualizado && !falloAforo && <p className=\"pub-nota\">Se actualiza cada 30 segundos. <a href=\"#/aforo\">Ver en pantalla completa</a></p>}"
  ]
 ]
};

const raiz = process.cwd();
const salir = (m) => { console.error('\nERROR: ' + m); process.exit(1); };
const existe = (r) => fs.existsSync(path.join(raiz, r));
const leer = (r) => fs.readFileSync(path.join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
if (!existe('web/src/features/publico/Landing.jsx')) salir('Primero aplica publico.mjs (falta la portada).');
if (!process.argv.includes('--forzar')) {
  try {
    const sucio = execSync('git status --porcelain', { cwd: raiz }).toString().split('\n').filter((l) => l.trim() && !l.trim().endsWith('aforo.mjs'));
    if (sucio.length) salir('Hay cambios sin commit. Haz commit (o stash) antes, o usa --forzar.');
  } catch { salir('No se pudo leer el estado de Git. Usa --forzar si no usas Git.'); }
}
const salida = new Map();
for (const [rel, cambios] of Object.entries(ESTRICTOS)) {
  if (!existe(rel)) salir('No existe ' + rel);
  let t = leer(rel);
  for (const [ancla, nuevo] of cambios) {
    if (t.includes(nuevo)) continue;
    if (t.split(ancla).length - 1 !== 1) salir('En ' + rel + ' no se encontró (o está repetido) este texto:\n' + ancla + '\nNo se modificó nada.');
    t = t.replace(ancla, () => nuevo);
  }
  salida.set(rel, t);
}
for (const [rel, contenido] of Object.entries(NUEVO)) if (!existe(rel)) salida.set(rel, contenido);
const css = 'web/src/features/publico/landing.css';
if (!existe(css)) salir('No existe ' + css);
{ const t = leer(css); salida.set(css, t.includes('Pantalla de aforo en vivo (#/aforo)') ? t : t.replace(/\n*$/, '\n') + CSS); }
const e2e = 'web/tests/e2e/publico.mjs';
if (!existe(e2e)) salir('No existe ' + e2e);
{
  const t = leer(e2e);
  if (t.includes('PUB-11.')) salida.set(e2e, t);
  else {
    const i = t.lastIndexOf('}');
    if (i < 0) salir('No se reconoció el final de ' + e2e);
    salida.set(e2e, t.slice(0, i) + E2E.replace(/\n}\n?$/, '\n') + '}\n');
  }
}
for (const [rel, contenido] of salida) {
  fs.mkdirSync(path.dirname(path.join(raiz, rel)), { recursive: true });
  fs.writeFileSync(path.join(raiz, rel), contenido, 'utf8');
  console.log('  Escrito: ' + rel);
}
console.log('\nListo. Siguiente: cd web && npm test && npm run test:e2e && npm run dev:mock  (abre #/aforo)');
