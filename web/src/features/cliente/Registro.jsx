// web/src/features/cliente/Registro.jsx
import React, { useState } from 'react';
import { mock } from './mock';
import './estilos.css';

export default function Registro({ onAviso }) {
  const [form, setForm] = useState({
    codigo_local: '123456',
    nombre: '',
    dni: '',
    telefono: '',
    consentimiento: false
  });
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    const res = await mock.rpc.registrar_cliente({
      p_codigo_local: form.codigo_local,
      p_nombre: form.nombre,
      p_dni: form.dni,
      p_telefono: form.telefono,
      p_consentimiento: form.consentimiento
    });
    setCargando(false);

    if (res?.data?.ok) {
      if (onAviso) onAviso('¡Registro completado exitosamente!', 'exito');
      setForm({ codigo_local: '123456', nombre: '', dni: '', telefono: '', consentimiento: false });
    } else {
      if (onAviso) onAviso(res?.data?.motivo || 'Error en el registro', 'error');
    }
  };

  return (
    <div className="cli-contenedor">
      <div className="pag-cab">
        <div>
          <h1>Registro de Cliente Nuevo</h1>
          <p className="ayuda">Formulario de autoregistro con el código del local.</p>
        </div>
      </div>

      <div className="tarjeta">
        <form onSubmit={handleSubmit} className="cli-form">
          <label className="cli-label">Código del local (6 dígitos):</label>
          <input
            type="text"
            className="cli-input"
            value={form.codigo_local}
            onChange={(e) => setForm({ ...form, codigo_local: e.target.value })}
            required
          />

          <label className="cli-label">Nombre Completo:</label>
          <input
            type="text"
            className="cli-input"
            placeholder="Juan Pérez"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
          />

          <label className="cli-label">DNI (8 dígitos):</label>
          <input
            type="text"
            maxLength={8}
            className="cli-input"
            placeholder="70000100"
            value={form.dni}
            onChange={(e) => setForm({ ...form, dni: e.target.value })}
            required
          />

          <label className="cli-label">Teléfono (9 dígitos):</label>
          <input
            type="text"
            maxLength={9}
            className="cli-input"
            placeholder="900000100"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            required
          />

          <label className="cli-checkbox-label">
            <input
              type="checkbox"
              checked={form.consentimiento}
              onChange={(e) => setForm({ ...form, consentimiento: e.target.checked })}
            />
            Acepto el tratamiento de mis datos personales
          </label>

          <button type="submit" disabled={cargando} className="cli-btn-primario">
            {cargando ? 'Registrando...' : 'Completar Registro'}
          </button>
        </form>
      </div>
    </div>
  );
}