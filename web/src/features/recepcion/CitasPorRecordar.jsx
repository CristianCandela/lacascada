import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cerrarAsistenciaCita,
  marcarCitaConfirmada,
  marcarRecordatorioEnviado,
  obtenerCitasPriorizadas,
} from "../../services/prediccionNoShow";
import "./CitasPorRecordar.css";

function construirEnlaceWhatsApp(cita) {
  const telefonoRaw = (cita.clientes?.telefono || "").replace(/\D/g, "");
  const telefonoPe = telefonoRaw.length === 9 ? `51${telefonoRaw}` : telefonoRaw;
  const nombre = cita.clientes?.nombres || "estimado(a) cliente";
  const fecha = new Date(cita.fecha_hora_cita).toLocaleString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const mensaje =
    `Hola ${nombre}, te saludamos de *Sauna y Gimnasio LA CASCADA* (sede ${cita.sede}). ` +
    `Te recordamos tu reserva de *${cita.servicio}* para el *${fecha}*. ` +
    `¿Nos confirmas tu asistencia por favor?`;

  return `https://wa.me/${telefonoPe}?text=${encodeURIComponent(mensaje)}`;
}

export default function CitasPorRecordar({ onAviso }) {
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  const [filtroRiesgo, setFiltroRiesgo] = useState("todos");
  const [filtroSede, setFiltroSede] = useState("todas");
  const [filtroServicio, setFiltroServicio] = useState("todos");
  const [soloSinRecordatorio, setSoloSinRecordatorio] = useState(false);

  const cargarAgenda = useCallback(async () => {
    try {
      setCargando(true);
      onAviso?.(null);
      const data = await obtenerCitasPriorizadas();
      setCitas(data);
    } catch (err) {
      onAviso?.(err.message || "No se pudieron cargar las predicciones de citas.", "error");
    } finally {
      setCargando(false);
    }
  }, [onAviso]);

  useEffect(() => {
    cargarAgenda();
  }, [cargarAgenda]);

  const resumen = useMemo(() => {
    const total = citas.length;
    const alto = citas.filter((c) => c.prediccion?.nivel_riesgo === "alto").length;
    const bajo = total - alto;
    const sinRecordar = citas.filter((c) => !c.recordatorio_enviado_en).length;
    const confirmadas = citas.filter((c) => Boolean(c.confirmada_en)).length;
    return { total, alto, bajo, sinRecordar, confirmadas };
  }, [citas]);

  const citasFiltradas = useMemo(() => {
    return citas.filter((c) => {
      if (filtroRiesgo !== "todos" && c.prediccion?.nivel_riesgo !== filtroRiesgo) return false;
      if (filtroSede !== "todas" && c.sede !== filtroSede) return false;
      if (filtroServicio !== "todos" && c.servicio !== filtroServicio) return false;
      if (soloSinRecordatorio && c.recordatorio_enviado_en) return false;
      return true;
    });
  }, [citas, filtroRiesgo, filtroSede, filtroServicio, soloSinRecordatorio]);

  async function handleEnviarWhatsApp(cita) {
    window.open(construirEnlaceWhatsApp(cita), "_blank", "noopener,noreferrer");
    if (cita.recordatorio_enviado_en) return;
    try {
      setProcesandoId(cita.id_cita);
      await marcarRecordatorioEnviado(cita.id_cita);
      await cargarAgenda();
      onAviso?.("Recordatorio registrado correctamente.", "ok");
    } catch (err) {
      onAviso?.(`No se pudo registrar el recordatorio: ${err.message}`, "error");
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleConfirmarCita(cita) {
    try {
      setProcesandoId(cita.id_cita);
      await marcarCitaConfirmada(cita.id_cita);
      await cargarAgenda();
      onAviso?.("Asistencia confirmada por el cliente.", "ok");
    } catch (err) {
      onAviso?.(`No se pudo confirmar la cita: ${err.message}`, "error");
    } finally {
      setProcesandoId(null);
    }
  }

  async function handleCerrarAsistencia(cita, nuevoEstado) {
    try {
      setProcesandoId(cita.id_cita);
      await cerrarAsistenciaCita(cita.id_cita, nuevoEstado);
      await cargarAgenda();
      onAviso?.(`Cita marcada como ${nuevoEstado}.`, "ok");
    } catch (err) {
      onAviso?.(`Error al actualizar asistencia: ${err.message}`, "error");
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <section className="recepcion-ml-container">
      <header className="recepcion-ml-header">
        <div>
          <h2>Citas por recordar · Priorización ML</h2>
          <p className="subtitulo">
            Ordenadas por probabilidad de inasistencia (modelo{" "}
            <code>{citas[0]?.prediccion?.version_modelo || "apf3-g04-v1"}</code>)
          </p>
        </div>
        <button type="button" className="btn-secundario" onClick={cargarAgenda} disabled={cargando}>
          {cargando ? "Actualizando..." : "Recargar scores"}
        </button>
      </header>

      <div className="kpi-grid">
        <button
          type="button"
          className={`kpi-card ${filtroRiesgo === "todos" ? "activo" : ""}`}
          onClick={() => setFiltroRiesgo("todos")}
        >
          <span className="kpi-valor">{resumen.total}</span>
          <span className="kpi-label">Pendientes totales</span>
        </button>

        <button
          type="button"
          className={`kpi-card kpi-alto ${filtroRiesgo === "alto" ? "activo" : ""}`}
          onClick={() => setFiltroRiesgo("alto")}
        >
          <span className="kpi-valor">{resumen.alto}</span>
          <span className="kpi-label">Riesgo Alto (Priorizar)</span>
        </button>

        <button
          type="button"
          className={`kpi-card kpi-bajo ${filtroRiesgo === "bajo" ? "activo" : ""}`}
          onClick={() => setFiltroRiesgo("bajo")}
        >
          <span className="kpi-valor">{resumen.bajo}</span>
          <span className="kpi-label">Riesgo Bajo</span>
        </button>

        <div className="kpi-card kpi-info">
          <span className="kpi-valor">
            {resumen.confirmadas}/{resumen.total}
          </span>
          <span className="kpi-label">Confirmadas por cliente</span>
        </div>
      </div>

      <div className="filtros-barra">
        <label>
          Nivel de riesgo:
          <select value={filtroRiesgo} onChange={(e) => setFiltroRiesgo(e.target.value)}>
            <option value="todos">Todos ({resumen.total})</option>
            <option value="alto">Alto ({resumen.alto})</option>
            <option value="bajo">Bajo ({resumen.bajo})</option>
          </select>
        </label>

        <label>
          Sede:
          <select value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}>
            <option value="todas">Todas las sedes</option>
            <option value="Túpac Amaru">Túpac Amaru</option>
            <option value="Santa Rosa">Santa Rosa</option>
            <option value="Año Nuevo">Año Nuevo</option>
          </select>
        </label>

        <label>
          Servicio:
          <select value={filtroServicio} onChange={(e) => setFiltroServicio(e.target.value)}>
            <option value="todos">Sauna y Gimnasio</option>
            <option value="sauna">Sauna</option>
            <option value="gimnasio">Gimnasio</option>
          </select>
        </label>

        <label className="checkbox-filtro">
          <input
            type="checkbox"
            checked={soloSinRecordatorio}
            onChange={(e) => setSoloSinRecordatorio(e.target.checked)}
          />
          Solo sin WhatsApp enviado ({resumen.sinRecordar})
        </label>
      </div>

      {cargando ? (
        <p className="estado-vacio">Calculando probabilidades de no-show...</p>
      ) : citasFiltradas.length === 0 ? (
        <p className="estado-vacio">No hay citas pendientes que coincidan con los filtros.</p>
      ) : (
        <div className="tabla-wrapper">
          <table className="tabla-riesgo">
            <thead>
              <tr>
                <th>Riesgo ML</th>
                <th>Cliente / Historial 30d</th>
                <th>Turno y Sede</th>
                <th>Estado Contacto</th>
                <th>Acción Recepción (Mago de Oz)</th>
              </tr>
            </thead>
            <tbody>
              {citasFiltradas.map((cita) => {
                const pred = cita.prediccion || {};
                const esAlto = pred.nivel_riesgo === "alto";
                const pct = ((pred.prob_no_show ?? 0) * 100).toFixed(1);
                const ocupado = procesandoId === cita.id_cita;

                return (
                  <tr key={cita.id_cita} className={esAlto ? "fila-riesgo-alto" : ""}>
                    <td>
                      <span className={`badge-riesgo ${esAlto ? "alto" : "bajo"}`}>
                        {esAlto ? "ALTO" : "BAJO"} · {pct}%
                      </span>
                      <div className="meta-umbral">
                        Umbral: {((pred.umbral ?? 0.45) * 100).toFixed(0)}%
                      </div>
                    </td>

                    <td>
                      <strong>
                        {cita.clientes?.nombres} {cita.clientes?.apellidos}
                      </strong>
                      <div className="meta-sub">
                        Tel: {cita.clientes?.telefono || "Sin número"} · Faltas 30d:{" "}
                        {cita.historial_30d.no_shows}/{cita.historial_30d.citas_cerradas}
                      </div>
                    </td>

                    <td>
                      <span className="tag-servicio">{cita.servicio.toUpperCase()}</span> ·{" "}
                      <strong>{cita.sede}</strong>
                      <div className="meta-sub">
                        {new Date(cita.fecha_hora_cita).toLocaleString("es-PE", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>

                    <td>
                      <div className="estados-pildoras">
                        <span
                          className={`pildora ${
                            cita.recordatorio_enviado_en ? "ok" : "pendiente"
                          }`}
                        >
                          {cita.recordatorio_enviado_en ? "WA enviado" : "Sin WA"}
                        </span>
                        <span className={`pildora ${cita.confirmada_en ? "ok" : "pendiente"}`}>
                          {cita.confirmada_en ? "Confirmada" : "Sin confirmar"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="acciones-celda">
                        <button
                          type="button"
                          className="btn-whatsapp"
                          disabled={ocupado || !cita.clientes?.telefono}
                          onClick={() => handleEnviarWhatsApp(cita)}
                          title={pred.accion_sugerida}
                        >
                          WhatsApp
                        </button>

                        {!cita.confirmada_en && (
                          <button
                            type="button"
                            className="btn-confirmar"
                            disabled={ocupado}
                            onClick={() => handleConfirmarCita(cita)}
                          >
                            Confirmar
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-asistio"
                          disabled={ocupado}
                          onClick={() => handleCerrarAsistencia(cita, "asistio")}
                        >
                          Asistió
                        </button>

                        <button
                          type="button"
                          className="btn-noshow"
                          disabled={ocupado}
                          onClick={() => handleCerrarAsistencia(cita, "no_asistio")}
                        >
                          No-show
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}