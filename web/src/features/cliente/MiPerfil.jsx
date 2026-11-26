import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { guardarFotoPerfil, leerFotoPerfil } from '../../components/Cabecera';
import { formatearFechaPe } from './logica';
import './estilos.css';

export default function MiPerfil({ perfil, onAviso }) {
  const [datos, setDatos] = useState(null);
  const [fotoUrl, setFotoUrl] = useState(() => leerFotoPerfil(perfil));
  const [cargando, setCargando] = useState(true);

  // Estados del modal de edición
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editFechaNac, setEditFechaNac] = useState('');
  const [editFotoUrl, setEditFotoUrl] = useState('');
  const [errorModal, setErrorModal] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarPerfil = useCallback(async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase.rpc('mis_datos');
      if (error) throw error;
      if (data) {
        setDatos(data);
        const fotoGuardada = leerFotoPerfil(data) || leerFotoPerfil(perfil) || data.foto_url || '';
        setFotoUrl(fotoGuardada);
        guardarFotoPerfil(data, fotoGuardada);
        guardarFotoPerfil(perfil, fotoGuardada);
      }
    } catch (err) {
      if (onAviso) onAviso(err.message || 'No se pudo cargar tu perfil.', 'error');
    } finally {
      setCargando(false);
    }
  }, [onAviso, perfil]);

  useEffect(() => {
    cargarPerfil();
  }, [cargarPerfil]);

  useEffect(() => {
    if (!modalAbierto) return;
    const alPresionarTecla = (e) => {
      if (e.key === 'Escape' && !guardando) setModalAbierto(false);
    };
    window.addEventListener('keydown', alPresionarTecla);
    return () => window.removeEventListener('keydown', alPresionarTecla);
  }, [modalAbierto, guardando]);

  const abrirModalEdicion = () => {
    if (!datos) return;
    setEditNombre(datos.nombre || '');
    setEditTelefono(datos.telefono || '');
    setEditFechaNac(datos.fecha_nacimiento || '');
    setEditFotoUrl(fotoUrl || '');
    setErrorModal('');
    setModalAbierto(true);
  };

  const manejarCambioFotoModal = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      setErrorModal('Selecciona un archivo de imagen válido (JPG, PNG o WEBP).');
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      setErrorModal('La imagen no debe superar los 2 MB.');
      return;
    }
    setErrorModal('');
    const lector = new FileReader();
    lector.onload = () => {
      setEditFotoUrl(String(lector.result || ''));
    };
    lector.readAsDataURL(archivo);
  };

  const guardarCambiosModal = async (e) => {
    e.preventDefault();
    if (guardando) return;
    setErrorModal('');
    setGuardando(true);

    try {
      const { data, error } = await supabase.rpc('actualizar_mi_perfil', {
        p_nombre: editNombre.trim(),
        p_telefono: editTelefono.trim(),
        p_fecha_nacimiento: editFechaNac,
        p_foto_url: editFotoUrl
      });
      if (error) throw error;
      if (data && data.ok === false) {
        setErrorModal(data.motivo || 'No se pudo actualizar el perfil.');
        return;
      }

      setFotoUrl(editFotoUrl);
      guardarFotoPerfil(datos, editFotoUrl);
      guardarFotoPerfil(perfil, editFotoUrl);

      const infoCabecera = document.querySelector('#usuario-info b');
      if (infoCabecera && editNombre.trim()) {
        infoCabecera.textContent = editNombre.trim();
      }

      setModalAbierto(false);
      if (onAviso) onAviso('Perfil actualizado correctamente.', 'exito');
      await cargarPerfil();
    } catch (err) {
      setErrorModal(err.message || 'No se pudo guardar el perfil.');
    } finally {
      setGuardando(false);
    }
  };

  const irAPestana = (idTab) => {
    window.dispatchEvent(new CustomEvent('lacascada:navegar', { detail: { tab: idTab } }));
    const btnTab =
      document.querySelector(`button[role="tab"][data-tab="${idTab}"]`) ||
      Array.from(document.querySelectorAll('button[role="tab"]')).find((b) =>
        b.textContent?.toLowerCase().includes(idTab)
      );
    if (btnTab) btnTab.click();
  };

  const obtenerIniciales = (nombre) =>
    (nombre || 'CL')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');

  const esActivo = datos?.estado === 'activo';
  const camposCompletos = [
    Boolean(datos?.nombre?.trim()),
    Boolean(datos?.telefono?.trim()),
    Boolean(datos?.fecha_nacimiento),
    Boolean(fotoUrl)
  ];
  const porcentajePerfil = Math.round((camposCompletos.filter(Boolean).length / camposCompletos.length) * 100);

  return (
    <div className="cli-contenedor">
      <div className="pag-cab cli-pag-cab">
        <div>
          <h1>Mi Perfil</h1>
          <p className="ayuda">Consulta tus datos personales, foto de perfil y fecha de nacimiento.</p>
        </div>
        {datos && !cargando && (
          <button
            type="button"
            className="cli-btn-primario cli-btn-editar"
            onClick={abrirModalEdicion}
          >
            <span>✎</span>
            <span>Editar perfil</span>
          </button>
        )}
      </div>

      {cargando ? (
        <div className="tarjeta">
          <p className="ayuda">Cargando datos de tu perfil...</p>
        </div>
      ) : datos ? (
        <div className="cli-perfil-layout">
          <div className="tarjeta cli-perfil-tarjeta-principal">
            <div className="cli-perfil-banner" />
            <div className="cli-perfil-cuerpo">
              <div className="cli-perfil-cabecera">
                {fotoUrl ? (
                  <img
                    src={fotoUrl}
                    alt="Foto de perfil"
                    className="cli-perfil-avatar-img"
                  />
                ) : (
                  <div className="cli-perfil-avatar-iniciales">
                    {obtenerIniciales(datos.nombre || perfil?.nombre)}
                  </div>
                )}
                <div className="cli-perfil-identidad">
                  <h2>{datos.nombre}</h2>
                  <div className="cli-perfil-meta">
                    <span className={`cli-perfil-estado ${esActivo ? 'activo' : 'inactivo'}`}>
                      {esActivo ? 'Cuenta Activa' : datos.estado}
                    </span>
                    <span className="cli-perfil-rol-tag">Cliente Cascada Gym</span>
                  </div>
                </div>
              </div>

              <div className="cli-detalles-plan">
                <div className="cli-dato-card">
                  <span className="cli-dato-etiqueta">Nombre completo</span>
                  <strong className="cli-dato-valor">{datos.nombre}</strong>
                </div>
                <div className="cli-dato-card">
                  <span className="cli-dato-etiqueta">DNI</span>
                  <strong className="cli-dato-valor">{datos.dni}</strong>
                </div>
                <div className="cli-dato-card">
                  <span className="cli-dato-etiqueta">Teléfono / WhatsApp</span>
                  <strong className="cli-dato-valor">{datos.telefono || 'No registrado'}</strong>
                </div>
                <div className="cli-dato-card">
                  <span className="cli-dato-etiqueta">Fecha de nacimiento</span>
                  <strong className="cli-dato-valor">
                    {datos.fecha_nacimiento ? formatearFechaPe(datos.fecha_nacimiento) : 'No registrada'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <aside className="cli-perfil-lateral">
            <div className="tarjeta cli-resumen-tarjeta">
              <h3>Estado del perfil</h3>
              <p className="ayuda cli-resumen-desc">
                Mantén tus datos al día para reservas de sauna y avisos de membresía.
              </p>

              <div className="cli-progreso-cab">
                <span>Completado</span>
                <strong>{porcentajePerfil}%</strong>
              </div>
              <div className="cli-progreso-barra" aria-hidden="true">
                <div
                  className="cli-progreso-relleno"
                  style={{ width: `${porcentajePerfil}%` }}
                />
              </div>

              <div className="cli-resumen-lista">
                <div className="cli-resumen-fila">
                  <span>Datos personales</span>
                  <span className="cli-badge cli-badge-asistio">Verificado</span>
                </div>
                <div className="cli-resumen-fila">
                  <span>Foto de perfil</span>
                  <span className={`cli-badge ${fotoUrl ? 'cli-badge-asistio' : 'cli-badge-neutro'}`}>
                    {fotoUrl ? 'Configurada' : 'Por subir'}
                  </span>
                </div>
                <div className="cli-resumen-fila">
                  <span>Privacidad (Ley 29733)</span>
                  <span className={`cli-badge ${datos.consentimiento ? 'cli-badge-asistio' : 'cli-badge-pendiente'}`}>
                    {datos.consentimiento ? 'Autorizado' : 'Pendiente'}
                  </span>
                </div>
              </div>

              <div className="cli-accesos-rapidos">
                <button
                  type="button"
                  className="cli-btn-secundario cli-acceso-btn"
                  onClick={() => irAPestana('membresia')}
                >
                  Ver Mi Membresía
                </button>
                <button
                  type="button"
                  className="cli-btn-secundario cli-acceso-btn"
                  onClick={() => irAPestana('reservas')}
                >
                  Ir a Mis Reservas
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="tarjeta">
          <p className="ayuda">No se encontraron datos para tu perfil.</p>
        </div>
      )}

      {modalAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-perfil"
          className="cli-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !guardando) setModalAbierto(false);
          }}
        >
          <div className="cli-modal-caja">
            <div className="cli-modal-cabecera">
              <h2 id="titulo-modal-perfil">Editar perfil</h2>
              <button
                type="button"
                className="cli-modal-cerrar"
                onClick={() => !guardando && setModalAbierto(false)}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            {errorModal && <p className="cli-error">{errorModal}</p>}

            <form onSubmit={guardarCambiosModal} className="cli-form cli-modal-form">
              <div className="cli-modal-foto-box">
                {editFotoUrl ? (
                  <img
                    src={editFotoUrl}
                    alt="Vista previa"
                    className="cli-modal-foto-img"
                  />
                ) : (
                  <div className="cli-perfil-avatar-iniciales cli-modal-foto-img">
                    {obtenerIniciales(editNombre)}
                  </div>
                )}
                <div className="cli-modal-foto-controles">
                  <label htmlFor="modal-foto-input" className="cli-label">
                    Foto de perfil (máx. 2 MB)
                  </label>
                  <input
                    id="modal-foto-input"
                    type="file"
                    accept="image/*"
                    onChange={manejarCambioFotoModal}
                  />
                  {editFotoUrl && (
                    <button
                      type="button"
                      className="cli-btn-secundario cli-btn-quitar-foto"
                      onClick={() => setEditFotoUrl('')}
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="modal-dni" className="cli-label">DNI (no editable)</label>
                <input
                  id="modal-dni"
                  type="text"
                  className="cli-input"
                  value={datos?.dni || ''}
                  disabled
                />
              </div>

              <div>
                <label htmlFor="modal-nombre" className="cli-label">Nombre completo</label>
                <input
                  id="modal-nombre"
                  type="text"
                  className="cli-input"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="modal-telefono" className="cli-label">Teléfono / WhatsApp (9 dígitos)</label>
                <input
                  id="modal-telefono"
                  type="tel"
                  maxLength={9}
                  className="cli-input"
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>

              <div>
                <label htmlFor="modal-fecha-nac" className="cli-label">Fecha de nacimiento</label>
                <input
                  id="modal-fecha-nac"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  className="cli-input"
                  value={editFechaNac}
                  onChange={(e) => setEditFechaNac(e.target.value)}
                />
              </div>

              <div className="cli-modal-acciones">
                <button
                  type="button"
                  className="cli-btn-secundario"
                  onClick={() => setModalAbierto(false)}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cli-btn-primario"
                  disabled={guardando}
                >
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}