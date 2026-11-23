import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { formatearFechaPe } from './logica';
import './estilos.css';

export default function MiPerfil({ onAviso }) {
  const [datos, setDatos] = useState(null);
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargarPerfil = useCallback(async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase.rpc('mis_datos');
      if (error) throw error;
      if (data) {
        setDatos(data);
        setFechaNacimiento(data.fecha_nacimiento || '');
        setFotoUrl(data.foto_url || '');
      }
    } catch (err) {
      if (onAviso) onAviso(err.message || 'No se pudo cargar tu perfil.', 'error');
    } finally {
      setCargando(false);
    }
  }, [onAviso]);

  useEffect(() => {
    cargarPerfil();
  }, [cargarPerfil]);

  const manejarCambioFoto = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      if (onAviso) onAviso('Selecciona un archivo de imagen válido (JPG, PNG o WEBP).', 'error');
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      if (onAviso) onAviso('La imagen no debe superar los 2 MB.', 'error');
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      setFotoUrl(String(lector.result || ''));
    };
    lector.readAsDataURL(archivo);
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    try {
      const { data, error } = await supabase.rpc('actualizar_mi_perfil', {
        p_fecha_nacimiento: fechaNacimiento,
        p_foto_url: fotoUrl
      });
      if (error) throw error;
      if (data && data.ok === false) {
        if (onAviso) onAviso(data.motivo || 'No se pudo actualizar el perfil.', 'error');
        return;
      }
      if (onAviso) onAviso('Perfil actualizado correctamente.', 'exito');
      await cargarPerfil();
    } catch (err) {
      if (onAviso) onAviso(err.message || 'No se pudo guardar el perfil.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const iniciales = (datos?.nombre || 'CL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  return (
    <div className="cli-contenedor">
      <div className="pag-cab">
        <div>
          <h1>Mi Perfil</h1>
          <p className="ayuda">Consulta tus datos personales, foto de perfil y fecha de nacimiento.</p>
        </div>
      </div>

      <div className="tarjeta">
        <h2>Datos del Cliente</h2>
        {cargando ? (
          <p className="ayuda">Cargando datos de tu perfil...</p>
        ) : datos ? (
          <form onSubmit={guardarPerfil} className="cli-form">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
              {fotoUrl ? (
                <img
                  src={fotoUrl}
                  alt="Foto de perfil"
                  style={{ width: '76px', height: '76px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #cbd5e1' }}
                />
              ) : (
                <div
                  style={{
                    width: '76px',
                    height: '76px',
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.25rem'
                  }}
                >
                  {iniciales}
                </div>
              )}
              <div>
                <label htmlFor="cli-foto-input" className="cli-label" style={{ display: 'block', marginBottom: '6px' }}>
                  Foto de perfil:
                </label>
                <input
                  id="cli-foto-input"
                  type="file"
                  accept="image/*"
                  onChange={manejarCambioFoto}
                />
                {fotoUrl && (
                  <div style={{ marginTop: '6px' }}>
                    <button
                      type="button"
                      className="cli-btn-secundario"
                      onClick={() => setFotoUrl('')}
                    >
                      Quitar foto
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="cli-detalles-plan">
              <p><strong>Nombre completo:</strong> {datos.nombre}</p>
              <p><strong>DNI:</strong> {datos.dni}</p>
              <p><strong>Teléfono / WhatsApp:</strong> {datos.telefono}</p>
              <p><strong>Estado de cuenta:</strong> {datos.estado === 'activo' ? 'Activo' : datos.estado}</p>
              {datos.fecha_nacimiento && (
                <p><strong>Fecha de nacimiento registrada:</strong> {formatearFechaPe(datos.fecha_nacimiento)}</p>
              )}
            </div>

            <label htmlFor="cli-fecha-nac" className="cli-label">Fecha de nacimiento:</label>
            <input
              id="cli-fecha-nac"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              className="cli-input"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
            />

            <button type="submit" disabled={guardando} className="cli-btn-primario">
              {guardando ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>
        ) : (
          <p className="ayuda">No se encontraron datos para tu perfil.</p>
        )}
      </div>
    </div>
  );
}