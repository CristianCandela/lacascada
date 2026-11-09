-- =====================================================================
<<<<<<< HEAD
-- Seed 06: AGENDA DEL DÍA y SOLICITUDES (simulación) — DATOS 100 % SINTÉTICOS.
-- =====================================================================

-- Limpieza de ejecuciones previas de este seed y de citas de hoy en adelante de clientes sintéticos
=======
-- Seed 06: AGENDA DEL DÍA y SOLICITUDES
-- =====================================================================

-- Limpieza de ejecuciones previas 
>>>>>>> 1a52b6687f0cd954fd83ea34a090776744cccec6
delete from public.citas
where fecha_hora_cita >= (date_trunc('day', now() at time zone 'America/Lima') at time zone 'America/Lima')
  and id_cliente in (select id_cliente from public.clientes
                     where fecha_consentimiento in (timestamptz '2026-10-05 10:00-05', timestamptz '2026-10-05 10:00:30-05'));
delete from public.solicitudes where fecha_consentimiento = timestamptz '2026-10-05 10:00:30-05';
delete from public.clientes    where fecha_consentimiento = timestamptz '2026-10-05 10:00:30-05';

<<<<<<< HEAD
-- Clientes nuevos (los de las solicitudes aprobadas)
=======
-- Clientes nuevos 
>>>>>>> 1a52b6687f0cd954fd83ea34a090776744cccec6
insert into public.clientes (nombre, dni, telefono, consentimiento, fecha_consentimiento) values
  ('Kevin Ramos Campos', '50034812', '979855585', true, timestamptz '2026-10-05 10:00:30-05'),
  ('Nathaly Rojas Zapata', '69267187', '947643075', true, timestamptz '2026-10-05 10:00:30-05'),
  ('Pamela Ramos Fuentes', '67040737', '954693153', true, timestamptz '2026-10-05 10:00:30-05');

-- Citas de HOY (offset en minutos desde el inicio de la hora actual)
<<<<<<< HEAD
-- est: A asistió · N no asistió · C canceló · P pendiente (la fila «P» con hora pasada = por marcar)
=======
-- est: A asistió · N no asistió · C canceló · P pendiente 
>>>>>>> 1a52b6687f0cd954fd83ea34a090776744cccec6
with base as (select date_trunc('hour', now()) as h)
insert into public.citas
  (id_cliente, servicio, sede, fecha_hora_cita, fecha_hora_registro, estado_asistencia,
   marcada_en, segundos_registro, recordatorio_enviado_en, confirmada_en)
select c.id_cliente,
       case v.serv when 'S' then 'sauna' else 'gimnasio' end,
       case v.sede when 'AN' then 'Túpac Amaru' else 'Santa Rosa' end,
       b.h + make_interval(mins => v.off),
       b.h + make_interval(mins => v.off) - make_interval(mins => v.reg),
       case v.est when 'A' then 'asistio' when 'N' then 'no_asistio' when 'C' then 'cancelo' else 'pendiente' end,
       case when v.marca is null then null else b.h + make_interval(mins => v.off + v.marca) end,
       v.seg,
       case when v.rec is null then null else b.h + make_interval(mins => v.rec) end,
       case when v.conf is null then null else b.h + make_interval(mins => v.conf) end
from base b,
(values
  ('67483635', 'G', 'AN', -300, 'A', 95, 4, 6, null::int, null::int),
  ('57763412', 'G', 'AN', -300, 'A', 180, 2, 5, null::int, null::int),
  ('54502179', 'S', 'AN', -270, 'A', 180, 3, 7, -330, -318),
  ('67245192', 'G', 'SR', -240, 'A', 600, 5, 5, null::int, null::int),
  ('48236643', 'G', 'AN', -240, 'A', 320, 1, 6, -300, -290),
  ('71977355', 'S', 'SR', -210, 'A', 320, 6, 8, null::int, null::int),
  ('41485273', 'G', 'AN', -180, 'N', 180, 20, 5, -240, null::int),
  ('61019362', 'S', 'AN', -150, 'A', 320, 2, 6, null::int, null::int),
  ('65474648', 'G', 'SR', -120, 'C', 600, -45, 4, null::int, null::int),
  ('46951292', 'G', 'AN', -120, 'A', 95, 3, 5, null::int, null::int),
  ('72083463', 'S', 'AN', -90, 'A', 320, 4, 7, -150, -140),
  ('59577861', 'G', 'AN', -60, 'A', 180, 2, 6, null::int, null::int),
  ('66788231', 'S', 'SR', -60, 'A', 600, 5, 5, null::int, null::int),
  ('46346279', 'G', 'AN', -30, 'P', 320, null::int, null::int, null::int, null::int),
  ('73923419', 'S', 'AN', -30, 'P', 180, null::int, null::int, -100, -92),
  ('51277696', 'G', 'AN', 60, 'P', 240, null::int, null::int, null::int, null::int),
  ('54474452', 'S', 'AN', 60, 'P', 620, null::int, null::int, null::int, null::int),
  ('49486488', 'G', 'SR', 90, 'P', 1300, null::int, null::int, null::int, null::int),
  ('40117266', 'S', 'AN', 90, 'P', 240, null::int, null::int, -30, null::int),
  ('66033721', 'S', 'AN', 120, 'P', 240, null::int, null::int, null::int, null::int),
  ('55390350', 'G', 'AN', 120, 'P', 620, null::int, null::int, -20, -8),
  ('60954915', 'G', 'AN', 150, 'P', 2000, null::int, null::int, null::int, null::int),
  ('65038088', 'S', 'SR', 150, 'P', 620, null::int, null::int, null::int, null::int),
  ('61845988', 'G', 'AN', 180, 'P', 240, null::int, null::int, null::int, null::int),
  ('73965559', 'G', 'SR', 210, 'P', 1300, null::int, null::int, null::int, null::int),
  ('73395334', 'S', 'AN', 240, 'P', 2000, null::int, null::int, null::int, null::int),
  ('51944952', 'G', 'AN', 270, 'P', 620, null::int, null::int, null::int, null::int),
  ('67692966', 'G', 'AN', 300, 'P', 1300, null::int, null::int, null::int, null::int),
  ('76050250', 'S', 'AN', 300, 'P', 620, null::int, null::int, null::int, null::int),
  ('59921495', 'G', 'SR', 360, 'P', 2000, null::int, null::int, null::int, null::int)
) as v(dni, serv, sede, off, est, reg, marca, seg, rec, conf)
join public.clientes c on c.dni = v.dni;

<<<<<<< HEAD
-- Citas de MAÑANA (hora de Lima) y de las solicitudes aprobadas
=======
-- Citas de MAÑANA y de las solicitudes aprobadas
>>>>>>> 1a52b6687f0cd954fd83ea34a090776744cccec6
with dia as (select (date_trunc('day', now() at time zone 'America/Lima') + interval '1 day') as d)
insert into public.citas
  (id_cliente, servicio, sede, fecha_hora_cita, fecha_hora_registro, estado_asistencia,
   segundos_registro, recordatorio_enviado_en, confirmada_en)
select c.id_cliente,
       case v.serv when 'S' then 'sauna' else 'gimnasio' end,
       case v.sede when 'AN' then 'Túpac Amaru' else 'Santa Rosa' end,
       ts.t, now() - make_interval(mins => v.reg), 'pendiente', v.seg,
       case when v.conf then now() - interval '25 minutes' end,
       case when v.conf then now() - interval '12 minutes' end
from dia,
(values
  ('64844326', 'G', 'AN', 420, true, 300, 7),
  ('63356610', 'G', 'AN', 480, false, 300, 5),
  ('50108735', 'S', 'AN', 540, true, 300, 9),
  ('44664077', 'G', 'SR', 630, false, 700, 5),
  ('50598826', 'S', 'SR', 720, false, 700, 7),
  ('56380906', 'G', 'AN', 1020, true, 300, 5),
  ('73666395', 'G', 'AN', 1080, false, 1500, 6),
  ('54502179', 'S', 'AN', 1140, false, 1500, 9),
  ('50034812', 'G', 'AN', 2400, false, 40, 0),
  ('69267187', 'S', 'AN', 2550, false, 40, 0),
  ('67040737', 'G', 'SR', 3540, false, 90, 0)
) as v(dni, serv, sede, min_dia, conf, reg, seg)
join public.clientes c on c.dni = v.dni
cross join lateral (select ((dia.d + make_interval(mins => v.min_dia - 0)) at time zone 'America/Lima') as t) ts;

-- Solicitudes públicas: pendientes (bandeja), aprobadas y rechazada
insert into public.solicitudes
  (nombre, dni, telefono, servicio, sede, fecha_hora_preferida, consentimiento, fecha_consentimiento, estado, creada_en)
select v.nombre, v.dni, v.tel, v.serv, v.sede,
       (date_trunc('day', now() at time zone 'America/Lima') + make_interval(mins => v.min_dia)) at time zone 'America/Lima',
       true, timestamptz '2026-10-05 10:00:30-05', v.estado, now() - make_interval(mins => v.hace)
from (values
  ('Sebastián Torres Rivera', '40804028', '905461661', 'gimnasio', 'Túpac Amaru', 1800, 'pendiente', 35),
  ('Lucero Ibarra Campos', '58283184', '950520304', 'sauna', 'Túpac Amaru', 2340, 'pendiente', 70),
  ('Gianella Ramos Díaz', '40126820', '941587150', 'gimnasio', 'Santa Rosa', 2490, 'pendiente', 130),
  ('Diego Quispe Rivera', '72174806', '903023853', 'sauna', 'Santa Rosa', 2640, 'pendiente', 190),
  ('Alonso Vera Medina', '40030760', '932199331', 'gimnasio', 'Túpac Amaru', 3330, 'pendiente', 260),
  ('Kevin Mamani Chávez', '75656795', '948293200', 'sauna', 'Túpac Amaru', 3870, 'pendiente', 340),
  ('Ximena Aguilar Valdez', '74797646', '977970774', 'gimnasio', 'Túpac Amaru', 4020, 'pendiente', 520),
  ('Diego Mamani Medina', '45125870', '967559266', 'sauna', 'Túpac Amaru', 5400, 'pendiente', 900),
  ('Ximena Gómez Herrera', '72812941', '969366456', 'gimnasio', 'Santa Rosa', 4860, 'pendiente', 1300),
  ('Alonso Flores León', '70500710', '992360255', 'gimnasio', 'Túpac Amaru', 5430, 'pendiente', 1700),
  ('Kevin Ramos Campos', '50034812', '979855585', 'gimnasio', 'Túpac Amaru', 2400, 'aprobada', 200),
  ('Nathaly Rojas Zapata', '69267187', '947643075', 'sauna', 'Túpac Amaru', 2550, 'aprobada', 420),
  ('Pamela Ramos Fuentes', '67040737', '954693153', 'gimnasio', 'Santa Rosa', 3540, 'aprobada', 1500),
  ('Diego Salas León', '69158639', '961581680', 'sauna', 'Túpac Amaru', 2160, 'rechazada', 2300)
) as v(nombre, dni, tel, serv, sede, min_dia, estado, hace);

-- Verificación
select (select count(*) from public.citas where fecha_hora_cita >= date_trunc('day', now() at time zone 'America/Lima') at time zone 'America/Lima'
          and id_cliente in (select id_cliente from public.clientes where fecha_consentimiento in (timestamptz '2026-10-05 10:00-05', timestamptz '2026-10-05 10:00:30-05')))  as citas_hoy_y_futuro,
<<<<<<< HEAD
       (select count(*) from public.solicitudes where estado = 'pendiente' and fecha_consentimiento = timestamptz '2026-10-05 10:00:30-05') as solicitudes_pendientes;
=======
       (select count(*) from public.solicitudes where estado = 'pendiente' and fecha_consentimiento = timestamptz '2026-10-05 10:00:30-05') as solicitudes_pendientes;
>>>>>>> 1a52b6687f0cd954fd83ea34a090776744cccec6
