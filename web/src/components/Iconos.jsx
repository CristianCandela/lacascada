import { useState } from 'react';

// Iconos en línea (trazo 1.8). Sin librerías externas.
const RUTAS = {
  agenda: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>,
  mas: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  bandeja: <><path d="M4 13l2.2-7.1A2 2 0 018.1 4.5h7.8a2 2 0 011.9 1.4L20 13" /><path d="M4 13v4.5A2.5 2.5 0 006.5 20h11a2.5 2.5 0 002.5-2.5V13h-4.5l-1 2h-5l-1-2H4z" /></>,
  grafico: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  salir: <><path d="M10 4H6.5A2.5 2.5 0 004 6.5v11A2.5 2.5 0 006.5 20H10M15 8l4 4-4 4M19 12H9" /></>,
  whatsapp: <><path d="M4 20l1.2-4A8 8 0 1112 20a8 8 0 01-3.9-1L4 20z" /><path d="M9.2 9.2c.3 2.2 2.4 4.3 4.6 4.6l1.1-1.1-1.9-.9-.8.7c-.8-.4-1.6-1.2-2-2l.7-.8-.9-1.9-.8 1.4z" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  descargar: <><path d="M12 4v11M7.5 11L12 15.5 16.5 11M5 20h14" /></>,
  papelera: <><path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7" /></>,
  refrescar: <><path d="M20 11a8 8 0 00-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0014 4.5L20 15M20 20v-5h-5" /></>,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  usuarios: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19c.5-3.3 3-5 6-5s5.5 1.7 6 5M16 5.6a3.2 3.2 0 010 5.8M18 14.3c1.7.6 2.8 2 3 4.7" /></>,
  ojo: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  ojoNo: <><path d="M3 3l18 18M10 6a9 9 0 012-.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-3 3.7M6.3 7.7A16 16 0 002.5 12S6 18.5 12 18.5a9 9 0 003.4-.7" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></>,
  correo: <><rect x="3" y="5.5" width="18" height="13" rx="3" /><path d="M4 8l8 5.5L20 8" /></>,
  candado: <><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></>,
  alerta: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></>,
  escudo: <><path d="M12 3.5l7 2.8v5.4c0 4.3-2.9 7.6-7 8.8-4.1-1.2-7-4.5-7-8.8V6.3l7-2.8z" /><path d="M9 12l2.2 2.2L15.2 10" /></>,
  izquierda: <path d="M14.5 6l-6 6 6 6" />,
  derecha: <path d="M9.5 6l6 6-6 6" />,
  sauna: <><path d="M8 4c-1.5 2 1.5 3 0 5M12 4c-1.5 2 1.5 3 0 5M16 4c-1.5 2 1.5 3 0 5" /><path d="M4 13h16v2.5a4.5 4.5 0 01-4.5 4.5h-7A4.5 4.5 0 014 15.5V13z" /></>,
  pesa: <><path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11" /></>
};

export default function Icono({ n, tam = 18, ...resto }) {
  return (
    <svg className="ico" width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...resto}>
      {RUTAS[n]}
    </svg>
  );
}

// Logo de la empresa: web/public/logo.png. Si el archivo no existe, muestra una "C" de respaldo.
export function Logo({ tam = 40 }) {
  const [fallo, setFallo] = useState(false);
  return (
    <span className="logo" style={{ width: tam, height: tam }}>
      {fallo
        ? <span className="logo-respaldo" aria-hidden="true">C</span>
        : <img src="/logo.png" alt="Cascada Gym" onError={() => setFallo(true)} />}
    </span>
  );
}

export function iniciales(nombre = '') {
  const p = String(nombre).trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

// Color estable del avatar según el nombre (tonos de la paleta de marca).
export function tonoAvatar(nombre = '') {
  let h = 0;
  for (const c of String(nombre)) h = (h * 31 + c.charCodeAt(0)) % 4;
  return ['azul', 'naranja', 'verde', 'gris'][h];
}
