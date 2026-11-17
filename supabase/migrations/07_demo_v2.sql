-- =====================================================================
-- Seed 07: DATOS DE DEMOSTRACIÓN v2 (MVP) — 100 % SINTÉTICOS.
-- 16 clientes ficticios (DNI 7200xxxx, teléfono 9001xxxxx) con membresías, visitas, reservas de sauna y pagos
-- repartidos en los últimos 60 días, para mostrar: aforo, panel de no-shows, renovaciones, afiliados ausentes,
-- oportunidades de conversión y resúmenes de recepción.
-- Requiere las migraciones hasta 20261117000000. Se puede ejecutar varias veces: borra y recrea solo lo suyo (DNI 7200%).
-- Las fechas son relativas a HOY, así que los datos siempre se ven recientes.
-- =====================================================================

delete from public.clientes where dni like '7200%';

do $$
declare
  nombres text[] := array[
    'Lucía Paredes Marín', 'Diego Ramos Cueva', 'Valeria Torres Lino', 'Marcos Salinas Ugarte',
    'Camila Bravo Echevarría', 'Andrés Farfán Lozano', 'Renata Mejía Solís', 'Joaquín Delgado Pinto',
    'Alejandra Cornejo Vera', 'Sebastián Aliaga Roca', 'Daniela Escudero Pardo', 'Mateo Quiroz Valdez',
    'Isabela Fuentes Arce', 'Gael Montoya Tapia', 'Mía Castañeda Luna', 'Thiago Benavides Rey'];
  horas int[] := array[6, 7, 7, 8, 9, 12, 13, 17, 18, 18, 19, 19, 20, 20, 21];
  medios text[] := array['efectivo', 'yape', 'plin'];
  sedes text[] := array['Túpac Amaru', 'Santa Rosa'];
  v_plan uuid;
  v_precio numeric;
  v_dias int;
  hoy date := (now() at time zone 'America/Lima')::date;
  ids uuid[] := '{}';
  v_id uuid; v_mem uuid; v_ini date; v_cita uuid;
  i int; d int; h int; k int;
  v_ent timestamptz; v_sede text; v_est text; v_orig text; v_hash int;
begin
  select id_plan, precio, dias into v_plan, v_precio, v_dias from public.planes where nombre = 'Plan general' limit 1;
  if v_plan is null then
    raise exception 'Falta el Plan general. Ejecuta primero las migraciones.';
  end if;

  -- ---------- Clientes ----------
  for i in 1..16 loop
    insert into public.clientes (nombre, dni, telefono, consentimiento, fecha_consentimiento)
    values (nombres[i], '7200' || lpad(i::text, 4, '0'), '9001' || lpad(i::text, 5, '0'), true, now() - make_interval(days => 70 - i))
    returning id_cliente into v_id;
    ids := ids || v_id;
  end loop;
  -- Los dos últimos se registraron hoy en recepción (registro asistido).
  update public.clientes set asistido_en = now() - interval '25 minutes' where id_cliente = ids[16];
  update public.clientes set asistido_en = now() - interval '2 hours'   where id_cliente = ids[15];

  -- ---------- Membresías y pagos ----------
  -- 1-8 vigentes (inicio hace 3, 6, … 24 días); 9-10 vencen mañana y hoy; 11-12 vencidas.
  for i in 1..12 loop
    v_ini := case when i <= 8 then hoy - (3 * i) when i = 9 then hoy - 28 when i = 10 then hoy - 29
                  when i = 11 then hoy - 45 else hoy - 70 end;
    insert into public.membresias (id_cliente, id_plan, inicio, fin, creada_en)
    values (ids[i], v_plan, v_ini, v_ini + v_dias - 1, (v_ini::timestamp + interval '10 hours') at time zone 'America/Lima')
    returning id_membresia into v_mem;
    insert into public.pagos (id_cliente, id_membresia, concepto, monto, medio, pagado_en)
    values (ids[i], v_mem, 'membresia', v_precio, medios[1 + i % 3], (v_ini::timestamp + interval '10 hours') at time zone 'America/Lima');
  end loop;
  -- El cliente 11 renovó hace poco (así no aparece como vencido): segunda membresía vigente.
  insert into public.membresias (id_cliente, id_plan, inicio, fin, creada_en)
  values (ids[11], v_plan, hoy - 12, hoy - 12 + v_dias - 1, now() - interval '12 days') returning id_membresia into v_mem;
  insert into public.pagos (id_cliente, id_membresia, concepto, monto, medio, pagado_en)
  values (ids[11], v_mem, 'membresia', v_precio, 'yape', now() - interval '12 days');

  -- ---------- Pases del día: el cliente 13 los compra seguido (oportunidad de conversión); el 14, hoy ----------
  foreach d in array array[2, 5, 9, 13] loop
    insert into public.pagos (id_cliente, concepto, monto, medio, pagado_en)
    values (ids[13], 'pase_dia', 20, medios[1 + d % 3], ((hoy - d)::timestamp + interval '18 hours') at time zone 'America/Lima');
    insert into public.checkins (id_cliente, sede, metodo, servicio, entrada_en, salida_en)
    values (ids[13], 'Túpac Amaru', 'manual', 'gimnasio',
            ((hoy - d)::timestamp + interval '18 hours 10 minutes') at time zone 'America/Lima',
            ((hoy - d)::timestamp + interval '19 hours 40 minutes') at time zone 'America/Lima');
  end loop;
  insert into public.pagos (id_cliente, concepto, monto, medio, pagado_en) values (ids[14], 'pase_dia', 20, 'efectivo', now() - interval '40 minutes');

  -- ---------- Historial de visitas al gimnasio (últimos 21 días; los afiliados 6-8 dejaron de venir) ----------
  for i in 1..12 loop
    for d in 1..60 loop
      -- Rango de días en que cada cliente asistió.
      if (i in (1, 2, 3, 4, 5, 9, 10) and d <= 21)
         or (i in (6, 7, 8) and d between 16 and 24)
         or (i = 11 and d between 20 and 55 and d > 12) or (i = 12 and d between 45 and 65) then
        v_hash := abs(hashtext(i::text || '-' || d::text));
        if v_hash % 100 < 55 then
          h := horas[1 + (v_hash / 7) % array_length(horas, 1)];
          v_sede := sedes[1 + i % 2];
          v_ent := ((hoy - d)::timestamp + make_interval(hours => h, mins => v_hash % 50)) at time zone 'America/Lima';
          insert into public.checkins (id_cliente, sede, metodo, servicio, entrada_en, salida_en)
          values (ids[i], v_sede, case when v_hash % 10 < 7 then 'codigo' else 'manual' end, 'gimnasio',
                  v_ent, v_ent + make_interval(mins => 60 + v_hash % 60));
        end if;
      end if;
    end loop;
  end loop;

  -- ---------- Entradas de hoy (abiertas): alimentan el aforo en vivo ----------
  for i in 1..5 loop
    insert into public.checkins (id_cliente, sede, metodo, servicio, entrada_en)
    values (ids[i], 'Túpac Amaru', 'codigo', 'gimnasio', now() - make_interval(mins => 8 * i));
  end loop;
  for i in 9..10 loop
    insert into public.checkins (id_cliente, sede, metodo, servicio, entrada_en)
    values (ids[i], 'Santa Rosa', 'codigo', 'gimnasio', now() - make_interval(mins => 12 * (i - 8)));
  end loop;
  insert into public.checkins (id_cliente, sede, metodo, servicio, entrada_en)
  values (ids[14], 'Túpac Amaru', 'manual', 'gimnasio', now() - interval '30 minutes');

  -- ---------- Reservas de sauna pasadas (21 días): asistió / no asistió ----------
  for i in 1..11 loop
    for d in 1..21 loop
      v_hash := abs(hashtext('s' || i::text || '-' || d::text));
      if i in (1, 2, 3, 4, 5, 9, 10, 11) and v_hash % 100 < 22 then
        v_sede := sedes[1 + i % 2];
        h := 17 + (v_hash / 5) % 4;
        v_est := case when v_hash % 10 < 7 then 'asistio' else 'no_asistio' end;
        v_orig := case when v_hash % 10 < 4 then 'recepcion' else 'cliente' end;
        v_ent := ((hoy - d)::timestamp + make_interval(hours => h)) at time zone 'America/Lima';
        insert into public.citas (id_cliente, servicio, sede, fecha_hora_cita, fecha_hora_registro, estado_asistencia, origen,
                                  marcada_en, segundos_registro, estado_pago, tarifa_aplicada)
        values (ids[i], 'sauna', v_sede, v_ent, v_ent - make_interval(hours => 4 + v_hash % 40), v_est, v_orig,
                v_ent + interval '10 minutes', 30 + v_hash % 500,
                'pagada', case when v_orig = 'recepcion' then 15 end)
        returning id_cita into v_cita;
        if v_orig = 'recepcion' then
          insert into public.pagos (id_cliente, id_cita, concepto, monto, medio, pagado_en)
          values (ids[i], v_cita, 'sauna', 15, medios[1 + v_hash % 3], v_ent - make_interval(hours => 4 + v_hash % 40));
        end if;
      end if;
    end loop;
  end loop;

  -- ---------- Reservas de hoy y de los próximos días (si no hay cupo, se omiten) ----------
  for k in 1..2 loop
    for i in 1..4 loop
      begin
        insert into public.citas (id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia, origen, estado_pago)
        values (ids[i], 'sauna', sedes[1 + i % 2], date_trunc('hour', now()) + make_interval(hours => k), 'pendiente',
                case when i % 2 = 0 then 'cliente' else 'recepcion' end, 'pagada');
      exception when others then null;
      end;
    end loop;
  end loop;
  for i in 1..8 loop
    begin
      insert into public.citas (id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia, origen, estado_pago)
      values (ids[i], 'sauna', sedes[1 + i % 2],
              ((hoy + 1 + i % 3)::timestamp + make_interval(hours => 17 + i % 4)) at time zone 'America/Lima',
              'pendiente', 'cliente', 'pagada');
    exception when others then null;
    end;
  end loop;

  -- ---------- Cobros de hoy (para el cierre de caja de recepción) ----------
  -- El cliente 16, registrado hoy en recepción, paga su Plan general.
  insert into public.membresias (id_cliente, id_plan, inicio, fin) values (ids[16], v_plan, hoy, hoy + v_dias - 1) returning id_membresia into v_mem;
  insert into public.pagos (id_cliente, id_membresia, concepto, monto, medio, pagado_en)
  values (ids[16], v_mem, 'membresia', v_precio, 'yape', now() - interval '15 minutes');
  -- Las reservas de sauna hechas en recepción para hoy y los próximos días quedan cobradas hoy.
  insert into public.pagos (id_cliente, id_cita, concepto, monto, medio, pagado_en)
  select c.id_cliente, c.id_cita, 'sauna', 15, medios[1 + (row_number() over (order by c.fecha_hora_cita))::int % 3], now() - interval '1 hour'
  from public.citas c
  where c.id_cliente = any (ids) and c.servicio = 'sauna' and c.origen = 'recepcion' and c.fecha_hora_cita > now()
    and not exists (select 1 from public.pagos p where p.id_cita = c.id_cita);
  update public.citas c set tarifa_aplicada = 15
  where c.id_cliente = any (ids) and c.origen = 'recepcion' and c.tarifa_aplicada is null;
end $$;

-- Resumen
select
  (select count(*) from public.clientes where dni like '7200%')                                    as clientes,
  (select count(*) from public.membresias m join public.clientes c using (id_cliente) where c.dni like '7200%') as membresias,
  (select count(*) from public.checkins k join public.clientes c using (id_cliente) where c.dni like '7200%')   as visitas,
  (select count(*) from public.citas k join public.clientes c using (id_cliente) where c.dni like '7200%')     as citas_sauna,
  (select count(*) from public.pagos p join public.clientes c using (id_cliente) where c.dni like '7200%')     as pagos;
