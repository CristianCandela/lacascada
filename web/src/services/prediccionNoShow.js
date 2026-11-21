import { supabase } from "../lib/supabase";

const API_PREDICCION_URL = (import.meta.env.VITE_API_NOSHOW_URL || "").replace(/\/+$/, "");

/**
 * Construye el payload JSON exacto que espera el endpoint `/predecir` de FastAPI (`predecir.py`).
 */
export function mapearCitaParaModelo(cita, historialCliente = { citas_cerradas: 0, no_shows: 0 }) {
  return {
    id_cita: cita.id_cita,
    id_cliente: cita.id_cliente,
    servicio: cita.servicio,
    sede: cita.sede,
    fecha_hora_cita: cita.fecha_hora_cita,
    fecha_hora_registro: cita.fecha_hora_registro,
    recordatorio_enviado_en: cita.recordatorio_enviado_en || null,
    confirmada_en: cita.confirmada_en || null,
    historial_30d: {
      citas_cerradas: Number(historialCliente?.citas_cerradas ?? 0),
      no_shows: Number(historialCliente?.no_shows ?? 0),
    },
  };
}

/**
 * Lee citas pendientes desde Supabase, consulta `riesgo_clientes()`,
 * obtiene las probabilidades desde `modelo_no_show.joblib` en Render
 * y devuelve la lista ordenada de mayor a menor riesgo.
 */
export async function obtenerCitasPriorizadas() {
  if (!API_PREDICCION_URL) {
    throw new Error("Falta configurar la variable de entorno VITE_API_NOSHOW_URL");
  }

  const { data: citas, error: errCitas } = await supabase
    .from("citas")
    .select(`
      id_cita,
      id_cliente,
      servicio,
      sede,
      fecha_hora_cita,
      fecha_hora_registro,
      recordatorio_enviado_en,
      confirmada_en,
      estado_asistencia,
      clientes ( nombres, apellidos, telefono )
    `)
    .eq("estado_asistencia", "pendiente")
    .order("fecha_hora_cita", { ascending: true });

  if (errCitas) throw errCitas;
  if (!citas || citas.length === 0) return [];

  const { data: riesgos, error: errRiesgo } = await supabase.rpc("riesgo_clientes");
  if (errRiesgo) throw errRiesgo;

  const mapaHistorial = new Map(
    (riesgos || []).map((r) => [
      r.id_cliente,
      { citas_cerradas: r.citas_cerradas, no_shows: r.no_shows },
    ])
  );

  const payloads = citas.map((c) =>
    mapearCitaParaModelo(c, mapaHistorial.get(c.id_cliente))
  );

  const resp = await fetch(`${API_PREDICCION_URL}/predecir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloads),
  });

  if (!resp.ok) {
    throw new Error(`Error del servicio ML (${resp.status})`);
  }

  const predicciones = await resp.json();
  const mapaPred = new Map(predicciones.map((p) => [p.id_cita, p]));

  return citas
    .map((cita) => ({
      ...cita,
      historial_30d: mapaHistorial.get(cita.id_cliente) || { citas_cerradas: 0, no_shows: 0 },
      prediccion: mapaPred.get(cita.id_cita),
    }))
    .sort((a, b) => (b.prediccion?.prob_no_show ?? 0) - (a.prediccion?.prob_no_show ?? 0));
}

export async function marcarRecordatorioEnviado(idCita) {
  const { error } = await supabase
    .from("citas")
    .update({ recordatorio_enviado_en: new Date().toISOString() })
    .eq("id_cita", idCita);
  if (error) throw error;
}

export async function marcarCitaConfirmada(idCita) {
  const { error } = await supabase
    .from("citas")
    .update({ confirmada_en: new Date().toISOString() })
    .eq("id_cita", idCita);
  if (error) throw error;
}

export async function cerrarAsistenciaCita(idCita, nuevoEstado) {
  const { error } = await supabase
    .from("citas")
    .update({
      estado_asistencia: nuevoEstado,
      marcada_en: new Date().toISOString(),
    })
    .eq("id_cita", idCita);
  if (error) throw error;
}