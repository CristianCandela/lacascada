// web/src/features/cliente/Registro.jsx
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { validarDatosRegistro } from './logica';
import './estilos.css';

export default function Registro({ onAviso }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    codigo_local: '',
    nombre: '',
    dni: '',
    telefono: '',
    consentimiento: false
  });
  const [errorForm, setErrorForm] = useState('');
  const [cargando, setCargando] = useState(false);

  const actualizarCampo = (campo, valor) => {
    if (errorForm) setErrorForm('');
    let valorLimpio = valor;
    if (campo === 'dni') {
      valorLimpio = String(valor).replace(/\D/g, '').slice(0, 8);
    } else if (campo === 'telefono') {
      valorLimpio = String(valor).replace(/\D/g, '').slice(0, 9);
    }
    setForm((prev) => ({ ...prev, [campo]: valorLimpio }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorForm('');

    const emailLimpio = form.email.trim();
    if (!emailLimpio || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      const msg = 'Ingresa un correo electrónico válido.';
      setErrorForm(msg);
      if (onAviso) onAviso(msg, 'error');
      return;
    }

    if (form.password.length < 6) {
      const msg = 'La contraseña debe tener al menos 6 caracteres.';
      setErrorForm(msg);
      if (onAviso) onAviso(msg, 'error');
      return;
    }

    if (!/^\d{8}$/.test(form.dni)) {
      const msg = 'El DNI debe tener exactamente 8 dígitos numéricos.';
      setErrorForm(msg);
      if (onAviso) onAviso(msg, 'error');
      return;
    }

    if (!/^\d{9}$/.test(form.telefono)) {
      const msg = 'El número de WhatsApp debe tener exactamente 9 dígitos numéricos.';
      setErrorForm(msg);
      if (onAviso) onAviso(msg, 'error');
      return;
    }

    const validacion = validarDatosRegistro({
      email: emailLimpio,
      password: form.password,
      nombre: form.nombre,
      dni: form.dni,
      telefono: form.telefono,
      consentimiento: form.consentimiento,
      codigoLocal: form.codigo_local
    });

    if (!validacion.valido) {
      setErrorForm(validacion.motivo);
      if (onAviso) onAviso(validacion.motivo, 'error');
      return;
    }

    setCargando(true);
    try {
      // 1. Crear cuenta en Auth solo si aún no hay una sesión creada en un intento previo
      const { data: sesionData } = await supabase.auth.getSession();
      if (!sesionData?.session) {
        const { error: authError } = await supabase.auth.signUp({
          email: emailLimpio,
          password: form.password
        });
        if (authError) throw authError;
      }

      // 2. Registrar o vincular los datos del cliente y crear su perfil
      const { data, error: rpcError } = await supabase.rpc('registrar_cliente', {
        p_codigo_local: form.codigo_local.trim(),
        p_nombre: form.nombre.trim(),
        p_dni: form.dni.trim(),
        p_telefono: form.telefono.trim(),
        p_consentimiento: form.consentimiento
      });
      if (rpcError) throw rpcError;

      if (data && data.ok === false) {
        throw new Error(data.motivo || 'No se pudo completar el registro.');
      }

      // 3. Refrescar sesión para que App.jsx cargue el perfil con rol 'cliente'
      try {
        await supabase.auth.signInWithPassword({
          email: emailLimpio,
          password: form.password
        });
      } catch {
        // Si ya está autenticado en modo mock o Supabase, continúa sin bloquear
      }

      if (onAviso) onAviso('¡Registro completado exitosamente!', 'exito');
      setForm({
        email: '',
        password: '',
        codigo_local: '',
        nombre: '',
        dni: '',
        telefono: '',
        consentimiento: false
      });
      window.location.hash = '#/mis-reservas';
    } catch (err) {
      const mensaje = err.message || 'Error en el registro';
      setErrorForm(mensaje);
      if (onAviso) onAviso(mensaje, 'error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="cli-contenedor">
      <div className="pag-cab">
        <div>
          <h1>Registro de Cliente Nuevo</h1>
          <p className="ayuda">Crea tu cuenta y regístrate con el código del local.</p>
        </div>
      </div>

      <div className="tarjeta">
        <form onSubmit={handleSubmit} className="cli-form" noValidate>
          {errorForm && (
            <p className="cli-error" role="alert">
              {errorForm}
            </p>
          )}

          <label htmlFor="reg-email" className="cli-label">Correo electrónico:</label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            className="cli-input"
            placeholder="cliente@correo.com"
            value={form.email}
            onChange={(e) => actualizarCampo('email', e.target.value)}
          />

          <label htmlFor="reg-password" className="cli-label">Contraseña (mínimo 6 caracteres):</label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            className="cli-input"
            placeholder="••••••"
            value={form.password}
            onChange={(e) => actualizarCampo('password', e.target.value)}
          />

          <label htmlFor="reg-codigo" className="cli-label">Código del local (6 dígitos):</label>
          <input
            id="reg-codigo"
            type="text"
            inputMode="numeric"
            maxLength={6}
            className="cli-input"
            placeholder="Ingresa el código de recepción"
            value={form.codigo_local}
            onChange={(e) => actualizarCampo('codigo_local', e.target.value)}
          />

          <label htmlFor="reg-nombre" className="cli-label">Nombre Completo:</label>
          <input
            id="reg-nombre"
            type="text"
            autoComplete="name"
            className="cli-input"
            placeholder="Juan Pérez"
            value={form.nombre}
            onChange={(e) => actualizarCampo('nombre', e.target.value)}
          />

          <label htmlFor="reg-dni" className="cli-label">DNI (8 dígitos):</label>
          <input
            id="reg-dni"
            type="text"
            inputMode="numeric"
            maxLength={8}
            pattern="\d{8}"
            className="cli-input"
            placeholder="70000100"
            value={form.dni}
            onChange={(e) => actualizarCampo('dni', e.target.value)}
          />

          <label htmlFor="reg-telefono" className="cli-label">WhatsApp (9 dígitos):</label>
          <input
            id="reg-telefono"
            type="tel"
            inputMode="numeric"
            maxLength={9}
            pattern="\d{9}"
            className="cli-input"
            placeholder="900000100"
            value={form.telefono}
            onChange={(e) => actualizarCampo('telefono', e.target.value)}
          />

          <label htmlFor="reg-consentimiento" className="cli-checkbox-label">
            <input
              id="reg-consentimiento"
              type="checkbox"
              checked={form.consentimiento}
              onChange={(e) => actualizarCampo('consentimiento', e.target.checked)}
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