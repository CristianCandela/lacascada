-- =====================================================================
-- Paso 4 (opcional): completa los datos FICTICIOS de la demo con las
-- columnas nuevas (tiempo de marcado, recordatorio y confirmación) para
-- que los gráficos del panel tengan información.
--
-- IMPORTANTE (integridad académica): todo es SIMULADO y se asigna al azar,
-- de forma INDEPENDIENTE del resultado de la cita. Por eso no se debe
-- presentar la "reducción con recordatorio" de estos datos como un hallazgo
-- real: sirve solo para mostrar cómo funciona el panel. Declara esto en el
-- informe. Los resultados reales se medirán con el uso en la sede piloto.
-- Idempotente: solo toca citas demo sin marca de tiempo.
-- =====================================================================
select setseed(0.43);

update public.citas c set
  marcada_en        = c.fecha_hora_cita + interval '20 minutes',
  segundos_registro = round((1 + random() * 5)::numeric, 2),
  recordatorio_enviado_en = case when random() < 0.4 then c.fecha_hora_cita - interval '2 hours' end,
  confirmada_en           = case when random() < 0.3 then c.fecha_hora_cita - interval '90 minutes' end
from public.clientes k
where k.id_cliente = c.id_cliente
  and k.dni like '7000%'
  and c.estado_asistencia <> 'pendiente'
  and c.marcada_en is null;
