-- Opcional: 2 solicitudes FICTICIAS pendientes para mostrar la bandeja en la demo.
-- (Ejecutar después de la migración 2.)
insert into public.solicitudes
  (nombre, dni, telefono, servicio, sede, fecha_hora_preferida, consentimiento)
select * from (values
  ('Cliente Demo 31', '70000031', '900000031', 'sauna',    'Año Nuevo',  date_trunc('day', now()) + interval '1 day 18 hours', true),
  ('Cliente Demo 32', '70000032', '900000032', 'gimnasio', 'Santa Rosa', date_trunc('day', now()) + interval '2 days 19 hours', true)
) as v(nombre, dni, telefono, servicio, sede, fecha_hora_preferida, consentimiento)
where not exists (select 1 from public.solicitudes where dni in ('70000031', '70000032'));
