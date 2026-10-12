-- =====================================================================
-- Paso 3 (opcional): datos 100% FICTICIOS para la demo y las capturas.
-- No hay DNI ni teléfonos reales. Todo se declara como dato de prueba.
-- Idempotente: si lo ejecutas dos veces, no duplica clientes.
--
-- Importante para el informe y APF3: estos datos son simulados.
-- Declara en el informe que el 90% de registro de asistencia de la demo
-- se mide sobre datos ficticios.
-- =====================================================================

select setseed(0.42);  -- reproducible

-- 30 clientes ficticios (DNI 7000000X, teléfono 9000000XX)
insert into public.clientes (nombre, dni, telefono, consentimiento, fecha_consentimiento)
select
  'Cliente Demo ' || lpad(n::text, 2, '0'),
  (70000000 + n)::text,
  (900000000 + n)::text,
  true,
  now() - interval '40 days'
from generate_series(1, 30) as n
on conflict (dni) do nothing;

-- ~120 citas pasadas (últimos 28 días) con asistencia ya marcada,
-- con ~18% de no-shows (más frecuentes viernes/sábado en la noche).
insert into public.citas
  (id_cliente, servicio, sede, fecha_hora_cita, fecha_hora_registro, estado_asistencia)
select
  c.id_cliente,
  case when random() < 0.6 then 'sauna' else 'gimnasio' end,
  case when random() < 0.65 then 'Año Nuevo' else 'Santa Rosa' end,
  d.dia + make_interval(hours => 15 + floor(random() * 7)::int),
  d.dia - interval '1 day',
  case
    when random() < (case when extract(dow from d.dia) in (5, 6) then 0.26 else 0.12 end)
      then 'no_asistio'
    else 'asistio'
  end
from (
  select (date_trunc('day', now()) - make_interval(days => 1 + floor(random() * 28)::int)) as dia,
         n
  from generate_series(1, 120) as n
) d
join lateral (
  select id_cliente from public.clientes
  where dni like '7000000%' or dni like '7000001%' or dni like '7000002%' or dni = '70000030'
  order by random() limit 1
) c on true
where not exists (select 1 from public.citas limit 1);   -- solo si la tabla está vacía

-- 6 citas para HOY, pendientes, para mostrar la agenda del día en la demo.
insert into public.citas
  (id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia)
select
  c.id_cliente,
  case when (row_number() over ()) % 2 = 0 then 'sauna' else 'gimnasio' end,
  case when (row_number() over ()) % 3 = 0 then 'Santa Rosa' else 'Año Nuevo' end,
  date_trunc('day', now()) + make_interval(hours => 16 + (row_number() over ())::int),
  'pendiente'
from (select id_cliente from public.clientes order by dni limit 6) c
where not exists (
  select 1 from public.citas
  where estado_asistencia = 'pendiente'
    and fecha_hora_cita::date = now()::date
);
