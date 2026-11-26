import { useEffect, useState } from 'react';
import Icono, { Logo, iniciales } from './Iconos';

const CLAVE_FOTO_PREFIJO = 'lacascada_foto_perfil:';
const EVENTO_FOTO = 'lacascada:foto-perfil';

function claveFotoUsuario(perfil) {
  const id = perfil?.id || perfil?.usuario_id || perfil?.dni || perfil?.nombre;
  return id ? `${CLAVE_FOTO_PREFIJO}${String(id).trim().toLowerCase()}` : null;
}

export function leerFotoPerfil(perfil) {
  const clave = claveFotoUsuario(perfil);
  if (clave) {
    try {
      const guardada = window.localStorage.getItem(clave);
      if (guardada !== null) return guardada;
    } catch {
      // Ignorar errores de acceso a localStorage en modo restringido
    }
  }
  return perfil?.foto_url || '';
}

export function guardarFotoPerfil(perfil, fotoUrl) {
  const clave = claveFotoUsuario(perfil);
  const valor = fotoUrl || '';
  if (clave) {
    try {
      if (valor) {
        window.localStorage.setItem(clave, valor);
      } else {
        window.localStorage.removeItem(clave);
      }
    } catch {
      // Ignorar errores de cuota o acceso a localStorage
    }
  }
  window.dispatchEvent(new CustomEvent(EVENTO_FOTO, { detail: { clave, fotoUrl: valor } }));
}

// Barra superior. Con sesión: fecha de hoy + usuario. Sin sesión (página pública): solo la marca.
export default function Cabecera({ perfil, onSalir }) {
  const [fotoBarra, setFotoBarra] = useState(() => leerFotoPerfil(perfil));

  useEffect(() => {
    setFotoBarra(leerFotoPerfil(perfil));
  }, [perfil]);

  useEffect(() => {
    const claveActual = claveFotoUsuario(perfil);
    const alCambiarFoto = (e) => {
      if (!claveActual || !e.detail?.clave || e.detail.clave === claveActual) {
        setFotoBarra(leerFotoPerfil(perfil));
      }
    };
    const alCambiarStorage = (e) => {
      if (!e.key || e.key === claveActual) {
        setFotoBarra(leerFotoPerfil(perfil));
      }
    };

    window.addEventListener(EVENTO_FOTO, alCambiarFoto);
    window.addEventListener('storage', alCambiarStorage);
    return () => {
      window.removeEventListener(EVENTO_FOTO, alCambiarFoto);
      window.removeEventListener('storage', alCambiarStorage);
    };
  }, [perfil]);

  const f = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const hoy = f.charAt(0).toUpperCase() + f.slice(1);
  const fotoMostrada = fotoBarra || perfil?.foto_url || '';

  return (
    <header className="barra">
      <div className="barra-marca">
        <Logo tam={36} />
        <span className="marca-texto"><b>Cascada Gym</b><small>Sauna y gimnasio</small></span>
      </div>
      {perfil && <span className="chip-fecha"><Icono n="agenda" tam={16} /> {hoy}</span>}
      {perfil && (
        <div className="usuario">
          {fotoMostrada ? (
            <img
              src={fotoMostrada}
              alt={perfil.nombre || 'Foto de perfil'}
              className="avatar"
              style={{ objectFit: 'cover' }}
              onError={() => setFotoBarra('')}
            />
          ) : (
            <span className="avatar azul" aria-hidden="true">{iniciales(perfil.nombre)}</span>
          )}
          <span id="usuario-info"><b>{perfil.nombre}</b><small>{perfil.rol}</small></span>
          <button id="btn-salir" type="button" className="sec chico" onClick={onSalir} aria-label="Cerrar sesión">
            <Icono n="salir" tam={16} /><span className="txt-salir">Cerrar sesión</span>
          </button>
        </div>
      )}
    </header>
  );
}