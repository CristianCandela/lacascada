-- =====================================================================
-- PASO 2: conecta los datos del APF2 con el MVP nuevo. NO cambia nombres, DNI, teléfonos ni las 113 citas
-- (86 asistió · 21 no asistió · 6 canceló). Solo AGREGA lo que el MVP nuevo necesita:
--   · membresías del Plan general (cadena de 30 días que cubre sus citas de octubre) y sus pagos
--   · origen, estado de pago y tarifa de cada cita; pagos de sauna hechos en recepción (S/ 15 afiliado)
--   · visitas (check-ins) de cada cita a la que asistieron
--   · visitas recientes de los afiliados vigentes (alimentan «afiliados ausentes» y el aforo histórico)
--   · pases del día repetidos de 3 clientes sin membresía (oportunidades de conversión)
-- Requiere: 08_apf2_datos_iniciales.sql y todas las migraciones. Se puede ejecutar varias veces.
-- Los estados de membresía dependen de la fecha de HOY: ejecútalo el día de la demo o el anterior.
-- =====================================================================
do $$
declare
  v_plan uuid; v_precio numeric; v_dias int;
  hoy date := (now() at time zone 'America/Lima')::date;
  medios text[] := array['efectivo', 'yape', 'plin'];
  horas int[] := array[6, 7, 7, 8, 9, 12, 13, 17, 18, 18, 19, 19, 20, 20, 21];
  sedes text[] := array['Túpac Amaru', 'Santa Rosa'];
  r record;
  v_b int; v_h int; v_fin date; v_ini date; v_primera date; v_ultima date; v_mem uuid; v_ent timestamptz;
  v_activo boolean; d int; v_hh int;
begin
  select id_plan, precio, dias into v_plan, v_precio, v_dias from public.planes where nombre = 'Plan general' limit 1;
  if v_plan is null then raise exception 'Falta el Plan general. Ejecuta primero las migraciones.'; end if;
  if (select count(*) from public.clientes where fecha_consentimiento = timestamptz '2026-10-05 10:00-05') = 0 then
    raise exception 'Faltan los clientes del APF2. Ejecuta primero 08_apf2_datos_iniciales.sql.';
  end if;

  -- Limpieza de lo que agrega este paso (para poder repetirlo)
  delete from public.pagos    where id_cliente in (select id_cliente from public.clientes where fecha_consentimiento = timestamptz '2026-10-05 10:00-05');
  delete from public.checkins where id_cliente in (select id_cliente from public.clientes where fecha_consentimiento = timestamptz '2026-10-05 10:00-05');
  delete from public.membresias where id_cliente in (select id_cliente from public.clientes where fecha_consentimiento = timestamptz '2026-10-05 10:00-05');

  -- ---------- 1. Citas: origen, estado de pago y tarifa ----------
  update public.citas c
  set origen = case when abs(hashtext(c.id_cita::text)) % 10 < 4 then 'recepcion' else 'cliente' end,
      estado_pago = 'pagada'
  where c.id_cliente in (select id_cliente from public.clientes where fecha_consentimiento = timestamptz '2026-10-05 10:00-05');
  update public.citas set tarifa_aplicada = case when servicio = 'sauna' and origen = 'recepcion' then 15 end
  where id_cliente in (select id_cliente from public.clientes where fecha_consentimiento = timestamptz '2026-10-05 10:00-05');

  -- ---------- 2. Membresías y pagos por cliente ----------
  for r in
    select k.id_cliente, k.dni, row_number() over (order by k.dni)::int as n
    from public.clientes k where k.fecha_consentimiento = timestamptz '2026-10-05 10:00-05'
  loop
    v_h := abs(hashtext(r.dni));
    v_b := (r.n - 1) % 10;
    select min((fecha_hora_cita at time zone 'America/Lima')::date), max((fecha_hora_cita at time zone 'America/Lima')::date)
      into v_primera, v_ultima from public.citas where id_cliente = r.id_cliente;

    v_fin := case
      when r.n in (3, 17, 31) then hoy + (v_dias - 1)           -- renovaron hoy: entran al cierre de caja
      when v_b in (0, 1, 2, 3, 4, 9) then hoy + 8 + v_h % 22    -- vigentes
      when v_b in (5, 6) then hoy + v_h % 7                     -- por vencer (0 a 6 días)
      when v_b = 7 then hoy - 1 - v_h % 25                      -- vencidas recientes
      else hoy - 31 - v_h % 5                                   -- sin renovar hace más de 30 días
    end;
    v_fin := greatest(v_fin, v_ultima);
    v_ini := v_fin - (v_dias - 1);
    loop
      insert into public.membresias (id_cliente, id_plan, inicio, fin, creada_en)
      values (r.id_cliente, v_plan, v_ini, v_ini + v_dias - 1, ((v_ini::timestamp + interval '10 hours') at time zone 'America/Lima'))
      returning id_membresia into v_mem;
      insert into public.pagos (id_cliente, id_membresia, concepto, monto, medio, pagado_en)
      values (r.id_cliente, v_mem, 'membresia', v_precio, medios[1 + (v_h + v_ini - date '2026-01-01') % 3],
              case when v_ini = hoy then now() - make_interval(mins => 20 + r.n * 9)
                   else ((v_ini::timestamp + make_interval(hours => 9 + v_h % 8)) at time zone 'America/Lima') end);
      exit when v_ini <= v_primera;
      v_ini := v_ini - v_dias;
    end loop;
  end loop;

  -- ---------- 3. Pagos de sauna hechos en recepción (afiliado S/ 15) ----------
  insert into public.pagos (id_cliente, id_cita, concepto, monto, medio, pagado_en)
  select c.id_cliente, c.id_cita, 'sauna', 15, medios[1 + abs(hashtext(c.id_cita::text)) % 3], c.fecha_hora_registro
  from public.citas c
  where c.servicio = 'sauna' and c.origen = 'recepcion' and c.estado_asistencia <> 'cancelo'
    and c.id_cliente in (select id_cliente from public.clientes where fecha_consentimiento = timestamptz '2026-10-05 10:00-05');

  -- ---------- 4. Visitas de las citas a las que asistieron ----------
  insert into public.checkins (id_cliente, sede, metodo, servicio, id_cita, entrada_en, salida_en)
  select c.id_cliente, c.sede,
         case when c.origen = 'recepcion' or abs(hashtext(c.id_cita::text)) % 10 >= 7 then 'manual' else 'codigo' end,
         c.servicio, c.id_cita,
         c.fecha_hora_cita + make_interval(mins => abs(hashtext(c.id_cita::text)) % 10),
         c.fecha_hora_cita + make_interval(mins => abs(hashtext(c.id_cita::text)) % 10 + 60 + abs(hashtext(c.id_cita::text)) % 50)
  from public.citas c
  where c.estado_asistencia = 'asistio'
    and c.id_cliente in (select id_cliente from public.clientes where fecha_consentimiento = timestamptz '2026-10-05 10:00-05');

  -- ---------- 5. Visitas recientes de los afiliados vigentes (excepto el grupo de «ausentes») ----------
  for r in
    select k.id_cliente, k.dni, row_number() over (order by k.dni)::int as n
    from public.clientes k where k.fecha_consentimiento = timestamptz '2026-10-05 10:00-05'
  loop
    v_b := (r.n - 1) % 10;
    select exists (select 1 from public.membresias m where m.id_cliente = r.id_cliente and m.inicio <= hoy and m.fin >= hoy) into v_activo;
    if v_activo and v_b <> 9 then
      for d in 1..13 loop
        v_h := abs(hashtext(r.dni || '-' || d::text));
        if v_h % 100 < 38 or d = 1 + abs(hashtext(r.dni)) % 12 then
          v_hh := horas[1 + (v_h / 7) % array_length(horas, 1)];
          v_ent := ((hoy - d)::timestamp + make_interval(hours => v_hh, mins => v_h % 50)) at time zone 'America/Lima';
          insert into public.checkins (id_cliente, sede, metodo, servicio, entrada_en, salida_en)
          values (r.id_cliente, sedes[1 + r.n % 2], case when v_h % 10 < 7 then 'codigo' else 'manual' end, 'gimnasio',
                  v_ent, v_ent + make_interval(mins => 60 + v_h % 60));
        end if;
      end loop;
    end if;
  end loop;

  -- ---------- 6. Pases del día repetidos (oportunidades de conversión): clientes 9, 19 y 29, sin membresía vigente ----------
  for r in
    select k.id_cliente, row_number() over (order by k.dni)::int as n
    from public.clientes k where k.fecha_consentimiento = timestamptz '2026-10-05 10:00-05'
  loop
    if r.n in (9, 19, 29) then
      foreach d in array array[2, 6, 11, 17] loop
        insert into public.pagos (id_cliente, concepto, monto, medio, pagado_en)
        values (r.id_cliente, 'pase_dia', 20, medios[1 + (d + r.n) % 3], ((hoy - d)::timestamp + interval '18 hours') at time zone 'America/Lima');
        insert into public.checkins (id_cliente, sede, metodo, servicio, entrada_en, salida_en)
        values (r.id_cliente, 'Túpac Amaru', 'manual', 'gimnasio',
                ((hoy - d)::timestamp + interval '18 hours 10 minutes') at time zone 'America/Lima',
                ((hoy - d)::timestamp + interval '19 hours 40 minutes') at time zone 'America/Lima');
      end loop;
    end if;
  end loop;
end $$;

-- Verificación
select
  (select count(*) from public.citas where estado_asistencia = 'asistio')    as asistio,
  (select count(*) from public.citas where estado_asistencia = 'no_asistio') as no_asistio,
  (select count(*) from public.citas where estado_asistencia = 'cancelo')    as cancelo,
  (select count(distinct id_cliente) from public.membresias where inicio <= (now() at time zone 'America/Lima')::date and fin >= (now() at time zone 'America/Lima')::date) as con_membresia_vigente,
  (select count(*) from public.membresias) as membresias,
  (select count(*) from public.pagos)      as pagos,
  (select count(*) from public.checkins)   as visitas;