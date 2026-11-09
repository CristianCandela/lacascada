// web/src/features/admin/PantallasAdmin.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { validarPlan, generarMensajeReactivacion, diasSinAsistir } from './logica';
import './estilos.css';

// 1. PANTALLA: PLANES Y MEMBRESÍAS
export function PantallaMembresias() {
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorForm, setErrorForm] = useState(null);
  const [nuevoPlan, setNuevoPlan] = useState({
    nombre: '',
    tipo_servicio: 'sauna',
    precio: '',
    duracion_dias: 30,
    sesiones_totales: ''
  });

  const cargarPlanes = async () => {
    setCargando(true);
    const { data } = await supabase.rpc('admin_obtener_planes');
    setPlanes(data || []);
    setCargando(false);
  };

  useEffect(() => {
    cargarPlanes();
  }, []);

  const handleCrearPlan = async (e) => {
    e.preventDefault();
    setErrorForm(null);

    const validacion = validarPlan(nuevoPlan);
    if (!validacion.esValido) {
      setErrorForm(validacion.errores.join(' '));
      return;
    }

    const planPayload = {
      nombre: nuevoPlan.nombre.trim(),
      tipo_servicio: nuevoPlan.tipo_servicio,
      precio: Number(nuevoPlan.precio),
      duracion_dias: Number(nuevoPlan.duracion_dias),
      sesiones_totales: nuevoPlan.sesiones_totales ? Number(nuevoPlan.sesiones_totales) : null
    };

    await supabase.rpc('admin_crear_plan', { plan: planPayload });
    setNuevoPlan({ nombre: '', tipo_servicio: 'sauna', precio: '', duracion_dias: 30, sesiones_totales: '' });
    cargarPlanes();
  };

  const handleToggleEstado = async (id) => {
    await supabase.rpc('admin_toggle_plan', { id });
    cargarPlanes();
  };

  return (
    <div className="adm-seccion">
      <div className="adm-header">
        <h2>Planes y Membresías</h2>
        <p>Configuración del catálogo comercial para sauna, gimnasio y paquetes mixtos.</p>
      </div>

      <div className="adm-card">
        <h3>Nuevo Plan o Membresía</h3>
        {errorForm && <div className="adm-alerta-error">{errorForm}</div>}
        <form onSubmit={handleCrearPlan} className="adm-form-grid">
          <div>
            <label>Nombre del Plan</label>
            <input
              type="text"
              placeholder="Ej. Boletera 10 Sesiones Sauna"
              value={nuevoPlan.nombre}
              onChange={(e) => setNuevoPlan({ ...nuevoPlan, nombre: e.target.value })}
              required
            />
          </div>
          <div>
            <label>Tipo de Servicio</label>
            <select
              value={nuevoPlan.tipo_servicio}
              onChange={(e) => setNuevoPlan({ ...nuevoPlan, tipo_servicio: e.target.value })}
            >
              <option value="sauna">Sauna</option>
              <option value="gimnasio">Gimnasio</option>
              <option value="completo">Completo (Sauna + Gym)</option>
              <option value="paquete_sesiones">Paquete por Sesiones</option>
            </select>
          </div>
          <div>
            <label>Precio (S/.)</label>
            <input
              type="number"
              step="0.5"
              placeholder="120.00"
              value={nuevoPlan.precio}
              onChange={(e) => setNuevoPlan({ ...nuevoPlan, precio: e.target.value })}
              required
            />
          </div>
          <div>
            <label>Duración (días)</label>
            <input
              type="number"
              value={nuevoPlan.duracion_dias}
              onChange={(e) => setNuevoPlan({ ...nuevoPlan, duracion_dias: e.target.value })}
              required
            />
          </div>
          <div>
            <label>N° Sesiones (Opcional)</label>
            <input
              type="number"
              placeholder="Ilimitado si está vacío"
              value={nuevoPlan.sesiones_totales}
              onChange={(e) => setNuevoPlan({ ...nuevoPlan, sesiones_totales: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="adm-btn adm-btn-primario">Guardar Plan</button>
          </div>
        </form>
      </div>

      <div className="adm-card">
        <h3>Planes Registrados</h3>
        {cargando ? (
          <p>Cargando planes...</p>
        ) : (
          <table className="adm-tabla">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Servicio</th>
                <th>Precio</th>
                <th>Vigencia</th>
                <th>Sesiones</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {planes.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong></td>
                  <td><span className="adm-badge-servicio">{p.tipo_servicio}</span></td>
                  <td>S/. {Number(p.precio).toFixed(2)}</td>
                  <td>{p.duracion_dias} días</td>
                  <td>{p.sesiones_totales || 'Ilimitadas'}</td>
                  <td>
                    <span className={p.activo ? 'adm-badge-activo' : 'adm-badge-inactivo'}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="adm-btn-sm"
                      onClick={() => handleToggleEstado(p.id)}
                    >
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// 2. PANTALLA: REACTIVACIÓN DE CLIENTES
export function PantallaReactivacion() {
  const [inactivos, setInactivos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargarInactivos = async () => {
    setCargando(true);
    const { data: clientes } = await supabase.from('clientes').select('*');
    const hoy = new Date();
    const filtrados = (clientes || [])
      .map((c) => ({
        ...c,
        dias: diasSinAsistir(c.ultima_visita, hoy)
      }))
      .filter((c) => c.dias === null || c.dias >= 25);

    setInactivos(filtrados);
    setCargando(false);
  };

  useEffect(() => {
    cargarInactivos();
  }, []);

  const handleEnviarMensaje = async (cliente) => {
    const mensaje = generarMensajeReactivacion(cliente);
    await supabase.rpc('admin_registrar_reactivacion', {
      cliente_id: cliente.id,
      mensaje
    });

    const tlfLimpio = (cliente.telefono || '').replace(/\D/g, '');
    const url = `https://api.whatsapp.com/send?phone=${tlfLimpio}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="adm-seccion">
      <div className="adm-header">
        <h2>Reactivación de Clientes</h2>
        <p>Identificación de clientes sin asistencia reciente para envío de promociones de retorno.</p>
      </div>

      <div className="adm-card">
        <h3>Clientes Inactivos (+25 días)</h3>
        {cargando ? (
          <p>Analizando asistencias...</p>
        ) : inactivos.length === 0 ? (
          <p>No hay clientes con inactividad prolongada.</p>
        ) : (
          <table className="adm-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Última Asistencia</th>
                <th>Días Inactivo</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {inactivos.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.nombre}</strong></td>
                  <td>{c.telefono || 'Sin teléfono'}</td>
                  <td>{c.ultima_visita || 'Nunca asistió'}</td>
                  <td>
                    <span className="adm-badge-alerta">
                      {c.dias !== null ? `${c.dias} días` : 'Sin registro'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="adm-btn adm-btn-whatsapp"
                      onClick={() => handleEnviarMensaje(c)}
                    >
                      Contactar por WhatsApp
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// 3. PANTALLA: PERSONAL
export function PantallaPersonal() {
  const [personal, setPersonal] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const { data } = await supabase.rpc('admin_listar_personal');
      setPersonal(data || []);
      setCargando(false);
    }
    cargar();
  }, []);

  return (
    <div className="adm-seccion">
      <div className="adm-header">
        <h2>Personal y Accesos</h2>
        <p>Equipo operativo registrado con acceso a la gestión de La Cascada.</p>
      </div>

      <div className="adm-card">
        <h3>Lista de Personal</h3>
        {cargando ? (
          <p>Cargando lista...</p>
        ) : (
          <table className="adm-tabla">
            <thead>
              <tr>
                <th>Nombre / Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {personal.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong></td>
                  <td>{p.email}</td>
                  <td><span className="adm-badge-servicio">{p.rol}</span></td>
                  <td><span className="adm-badge-activo">Activo</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}