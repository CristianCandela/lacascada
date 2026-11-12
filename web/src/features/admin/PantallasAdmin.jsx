import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { validarPlan, generarMensajeReactivacion, MOTIVOS_VALIDOS } from './logica';
import './estilos.css';

// 1. PANTALLA: PLANES Y MEMBRESÍAS (usa las tablas `planes` y `membresias` del contrato)
export function PantallaMembresias({ perfil }) {
  const [planes, setPlanes] = useState([]);
  const [membresias, setMembresias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorForm, setErrorForm] = useState(null);
  const [nuevoPlan, setNuevoPlan] = useState({
    nombre: '',
    dias: 30,
    precio: ''
  });

  const esAdmin = !perfil || perfil.rol === 'administrador';

  const cargarDatos = async () => {
    setCargando(true);
    const [{ data: dataPlanes }, { data: dataMembresias }, { data: dataClientes }] = await Promise.all([
      supabase.from('planes').select('*'),
      supabase.from('membresias').select('*'),
      supabase.from('clientes').select('*')
    ]);
    const listaPlanes = dataPlanes || [];
    const listaClientes = dataClientes || [];
    setPlanes(listaPlanes);
    setMembresias(
      (dataMembresias || []).map((m) => ({
        ...m,
        cliente_nombre: listaClientes.find((c) => c.id_cliente === m.id_cliente)?.nombre || m.id_cliente,
        plan_nombre: listaPlanes.find((p) => p.id_plan === m.id_plan)?.nombre || m.id_plan
      }))
    );
    setCargando(false);
  };

  useEffect(() => {
    if (esAdmin) cargarDatos();
  }, [esAdmin]);

  if (!esAdmin) return <p className="vacio">Acceso denegado: solo el administrador.</p>;

  const handleCrearPlan = async (e) => {
    e.preventDefault();
    setErrorForm(null);

    const validacion = validarPlan(nuevoPlan);
    if (!validacion.esValido) {
      setErrorForm(validacion.errores.join(' '));
      return;
    }

    const payload = {
      id_plan: `p${Date.now()}`,
      nombre: nuevoPlan.nombre.trim(),
      dias: Number(nuevoPlan.dias),
      precio: Number(nuevoPlan.precio),
      activo: true
    };

    const { error } = await supabase.from('planes').insert(payload);
    if (error) {
      setErrorForm(error.message);
      return;
    }
    setNuevoPlan({ nombre: '', dias: 30, precio: '' });
    cargarDatos();
  };

  const handleToggleEstado = async (plan) => {
    await supabase.from('planes').update({ activo: !plan.activo }).eq('id_plan', plan.id_plan);
    cargarDatos();
  };

  return (
    <div className="adm-seccion">
      <div className="adm-header">
        <h2>Planes y Membresías</h2>
        <p>Configuración del catálogo de planes (`planes`) y consulta de membresías activas.</p>
      </div>

      <div className="adm-card">
        <h3>Nuevo Plan</h3>
        {errorForm && <div className="adm-alerta-error">{errorForm}</div>}
        <form onSubmit={handleCrearPlan} className="adm-form-grid">
          <div>
            <label htmlFor="adm-plan-nombre">Nombre del Plan</label>
            <input
              id="adm-plan-nombre"
              type="text"
              placeholder="Ej. Plan Trimestral"
              value={nuevoPlan.nombre}
              onChange={(e) => setNuevoPlan({ ...nuevoPlan, nombre: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="adm-plan-dias">Duración (días)</label>
            <input
              id="adm-plan-dias"
              type="number"
              min="1"
              value={nuevoPlan.dias}
              onChange={(e) => setNuevoPlan({ ...nuevoPlan, dias: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="adm-plan-precio">Precio (S/)</label>
            <input
              id="adm-plan-precio"
              type="number"
              step="0.5"
              placeholder="150.00"
              value={nuevoPlan.precio}
              onChange={(e) => setNuevoPlan({ ...nuevoPlan, precio: e.target.value })}
              required
            />
          </div>
          <div className="adm-form-accion">
            <button type="submit" className="adm-btn adm-btn-primario">Guardar Plan</button>
          </div>
        </form>
      </div>

      <div className="adm-card">
        <h3>Catálogo de Planes</h3>
        {cargando ? (
          <p>Cargando planes...</p>
        ) : (
          <div className="adm-tabla-wrap">
            <table className="adm-tabla">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Vigencia</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {planes.map((p) => (
                  <tr key={p.id_plan}>
                    <td><strong>{p.nombre}</strong></td>
                    <td>{p.dias} días</td>
                    <td>S/ {Number(p.precio).toFixed(2)}</td>
                    <td>
                      <span className={p.activo ? 'adm-badge-activo' : 'adm-badge-inactivo'}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="adm-btn-sm"
                        onClick={() => handleToggleEstado(p)}
                      >
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="adm-card">
        <h3>Membresías Registradas ({membresias.length})</h3>
        {membresias.length === 0 ? (
          <p>No hay membresías registradas todavía.</p>
        ) : (
          <div className="adm-tabla-wrap">
            <table className="adm-tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Plan</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                </tr>
              </thead>
              <tbody>
                {membresias.map((m) => (
                  <tr key={m.id_membresia}>
                    <td><strong>{m.cliente_nombre}</strong></td>
                    <td>{m.plan_nombre}</td>
                    <td>{m.inicio}</td>
                    <td>{m.fin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// 2. PANTALLA: REACTIVACIÓN DE CLIENTES (usa RPCs oficiales `clientes_inactivos` y `registrar_motivo_ausencia`)
export function PantallaReactivacion({ perfil }) {
  const [inactivos, setInactivos] = useState([]);
  const [diasFiltro, setDiasFiltro] = useState(14);
  const [motivosSel, setMotivosSel] = useState({});
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);

  const esAdmin = !perfil || perfil.rol === 'administrador';

  const cargarInactivos = async (dias = diasFiltro) => {
    setCargando(true);
    const { data, error } = await supabase.rpc('clientes_inactivos', { p_dias: Number(dias) });
    if (!error && data) {
      setInactivos(data);
    } else {
      setInactivos([]);
    }
    setCargando(false);
  };

  useEffect(() => {
    if (esAdmin) cargarInactivos(diasFiltro);
  }, [esAdmin, diasFiltro]);

  if (!esAdmin) return <p className="vacio">Acceso denegado: solo el administrador.</p>;

  const handleRegistrarMotivo = async (idCliente) => {
    const motivo = motivosSel[idCliente] || 'horario';
    const { error } = await supabase.rpc('registrar_motivo_ausencia', {
      p_id_cliente: idCliente,
      p_motivo: motivo
    });
    if (!error) {
      setAviso(`Motivo "${motivo}" guardado correctamente.`);
      cargarInactivos(diasFiltro);
    }
  };

  const handleContactarWhatsApp = (cliente) => {
    const mensaje = generarMensajeReactivacion(cliente);
    const tlfLimpio = (cliente.telefono || '').replace(/\D/g, '');
    const url = `https://api.whatsapp.com/send?phone=51${tlfLimpio}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="adm-seccion">
      <div className="adm-header">
        <h2>Reactivación de Clientes Inactivos</h2>
        <p>Clientes activos con membresía vigente sin asistir y registro de motivos de ausencia.</p>
      </div>

      <div className="adm-card">
        <div className="adm-barra-filtro">
          <h3>Clientes Inactivos ({inactivos.length})</h3>
          <div className="adm-filtro-dias">
            <label htmlFor="adm-select-dias">Sin asistir hace:</label>
            <select
              id="adm-select-dias"
              value={diasFiltro}
              onChange={(e) => setDiasFiltro(Number(e.target.value))}
            >
              <option value={7}>7+ días</option>
              <option value={14}>14+ días</option>
              <option value={30}>30+ días</option>
            </select>
          </div>
        </div>

        {aviso && <div className="adm-alerta-ok">{aviso}</div>}

        {cargando ? (
          <p>Consultando clientes inactivos...</p>
        ) : inactivos.length === 0 ? (
          <p>No hay clientes con membresía vigente e inactividad mayor a {diasFiltro} días.</p>
        ) : (
          <div className="adm-tabla-wrap">
            <table className="adm-tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Última Visita</th>
                  <th>Fin Membresía</th>
                  <th>Último Motivo</th>
                  <th>Registrar Motivo</th>
                  <th>Contacto</th>
                </tr>
              </thead>
              <tbody>
                {inactivos.map((c) => (
                  <tr key={c.id_cliente}>
                    <td><strong>{c.nombre}</strong></td>
                    <td>{c.telefono || '—'}</td>
                    <td>
                      <span className="adm-badge-alerta">
                        {c.dias_sin_asistir !== null ? `Hace ${c.dias_sin_asistir} días` : 'Nunca asistió'}
                      </span>
                    </td>
                    <td>{c.membresia_fin || '—'}</td>
                    <td>
                      {c.ultimo_motivo ? (
                        <span className="adm-badge-servicio">{c.ultimo_motivo}</span>
                      ) : (
                        'Sin registrar'
                      )}
                    </td>
                    <td>
                      <div className="adm-motivo-inline">
                        <select
                          aria-label={`Motivo de ${c.nombre}`}
                          value={motivosSel[c.id_cliente] || 'horario'}
                          onChange={(e) => setMotivosSel({ ...motivosSel, [c.id_cliente]: e.target.value })}
                        >
                          {MOTIVOS_VALIDOS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="adm-btn-sm"
                          onClick={() => handleRegistrarMotivo(c.id_cliente)}
                        >
                          Guardar
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="adm-btn adm-btn-whatsapp"
                        onClick={() => handleContactarWhatsApp(c)}
                      >
                        WhatsApp
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// 3. PANTALLA: PERSONAL (lee `perfiles` de la base compartida y horaros de `sedes`)
export function PantallaPersonal({ perfil }) {
  const [personal, setPersonal] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [cargando, setCargando] = useState(true);

  const esAdmin = !perfil || perfil.rol === 'administrador';

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const [{ data: dataPerfiles }, { data: dataSedes }] = await Promise.all([
        supabase.from('perfiles').select('*'),
        supabase.from('sedes').select('*')
      ]);
      setPersonal((dataPerfiles || []).filter((p) => p.rol === 'administrador' || p.rol === 'recepcionista'));
      setSedes(dataSedes || []);
      setCargando(false);
    }
    if (esAdmin) cargar();
  }, [esAdmin]);

  if (!esAdmin) return <p className="vacio">Acceso denegado: solo el administrador.</p>;

  return (
    <div className="adm-seccion">
      <div className="adm-header">
        <h2>Personal y Sedes</h2>
        <p>Equipo operativo con acceso al sistema y horarios activos por sede.</p>
      </div>

      <div className="adm-card">
        <h3>Equipo Operativo (`perfiles`)</h3>
        {cargando ? (
          <p>Cargando personal...</p>
        ) : (
          <div className="adm-tabla-wrap">
            <table className="adm-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {personal.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.nombre}</strong></td>
                    <td><span className="adm-badge-servicio">{p.rol}</span></td>
                    <td><span className="adm-badge-activo">Activo</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="adm-card">
        <h3>Horarios de Sedes (`sedes`)</h3>
        <div className="adm-tabla-wrap">
          <table className="adm-tabla">
            <thead>
              <tr>
                <th>Sede</th>
                <th>Apertura</th>
                <th>Cierre</th>
              </tr>
            </thead>
            <tbody>
              {sedes.map((s) => (
                <tr key={s.sede}>
                  <td><strong>{s.sede}</strong></td>
                  <td>{s.abre}</td>
                  <td>{s.cierra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}