-- =====================================================================
-- Pago simulado de la reserva de sauna + ingresos del administrador.
--  * pagar_reserva_sauna(p_id_cita, p_medio): el cliente paga su propia reserva con Visa, Yape o Plin
--    (SIMULADO: no hay pasarela; no se guardan datos de tarjeta). Registra el pago, marca la cita como
--    pagada y deja el evento en la bitácora. Al instante aparece en caja, resumen y trazabilidad.
--  * resumen_dia / resumen_completo: ahora incluyen 'visa' (antes los pagos con Visa no sumaban al
--    cuadre) y siguen siendo VOLATILE porque llaman a cerrar_citas_vencidas (escribe).
--  * ingresos_resumen(p_dias): solo administrador. Total recaudado, por medio, por concepto, serie
--    diaria y lo que está por cobrar (sauna reservado y aún sin pagar).
-- Ejecutar después de 20261125000000_sauna_cliente_cobro.sql.
-- =====================================================================

-- ---------- Resumen del día y resumen completo con Visa (VOLATILE) ----------
create or replace function public.resumen_dia(p_sede text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cap int := coalesce((select capacidad from public.aforos where servicio = 'sauna' and sede = p_sede), 0);
begin
  perform public.cerrar_citas_vencidas();
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return json_build_object(
    'entradas', (select count(*)::int from public.checkins k
                 where k.sede = p_sede and (k.entrada_en at time zone 'America/Lima')::date = public.hoy_lima()),
    'cobros', json_build_object(
      'efectivo', coalesce((select sum(monto) from public.pagos where estado = 'registrado' and medio = 'efectivo'
                            and (pagado_en at time zone 'America/Lima')::date = public.hoy_lima()), 0),
      'yape',     coalesce((select sum(monto) from public.pagos where estado = 'registrado' and medio = 'yape'
                            and (pagado_en at time zone 'America/Lima')::date = public.hoy_lima()), 0),
      'plin',     coalesce((select sum(monto) from public.pagos where estado = 'registrado' and medio = 'plin'
                            and (pagado_en at time zone 'America/Lima')::date = public.hoy_lima()), 0),
      'visa',     coalesce((select sum(monto) from public.pagos where estado = 'registrado' and medio = 'visa'
                            and (pagado_en at time zone 'America/Lima')::date = public.hoy_lima()), 0)),
    'no_shows', (select count(*)::int from public.citas c
                 where c.servicio = 'sauna' and c.sede = p_sede and c.estado_asistencia = 'no_asistio'
                   and (c.fecha_hora_cita at time zone 'America/Lima')::date = public.hoy_lima()),
    'turnos', (select json_agg(json_build_object(
                 'hora', ((extract(hour from s.slot at time zone 'America/Lima')::int + 11) % 12 + 1) || ':00 '
                         || case when extract(hour from s.slot at time zone 'America/Lima') >= 12 then 'pm' else 'am' end,
                 'ocupados', (select count(*)::int from public.citas c
                              where c.servicio = 'sauna' and c.sede = p_sede and c.estado_asistencia <> 'cancelo'
                                and date_trunc('hour', c.fecha_hora_cita) = s.slot),
                 'capacidad', v_cap) order by s.slot)
               from (select date_trunc('hour', now()) + (i * interval '1 hour') as slot from generate_series(0, 1) i) s));
end;
$$;
revoke all on function public.resumen_dia(text) from public, anon;
grant execute on function public.resumen_dia(text) to authenticated;

create or replace function public.resumen_completo(p_sede text default null)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_sede text := coalesce(p_sede, 'Santa Rosa');
  hoy    date := public.hoy_lima();
begin
  perform public.cerrar_citas_vencidas();
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return json_build_object(
    'cobros', (select json_build_object(
        'efectivo', coalesce(sum(monto) filter (where estado = 'registrado' and medio = 'efectivo'), 0),
        'yape',     coalesce(sum(monto) filter (where estado = 'registrado' and medio = 'yape'), 0),
        'plin',     coalesce(sum(monto) filter (where estado = 'registrado' and medio = 'plin'), 0),
        'visa',     coalesce(sum(monto) filter (where estado = 'registrado' and medio = 'visa'), 0),
        'n_efectivo', count(*) filter (where estado = 'registrado' and medio = 'efectivo'),
        'n_yape',     count(*) filter (where estado = 'registrado' and medio = 'yape'),
        'n_plin',     count(*) filter (where estado = 'registrado' and medio = 'plin'),
        'n_visa',     count(*) filter (where estado = 'registrado' and medio = 'visa'),
        'membresia', coalesce(sum(monto) filter (where estado = 'registrado' and concepto = 'membresia'), 0),
        'pase_dia',  coalesce(sum(monto) filter (where estado = 'registrado' and concepto = 'pase_dia'), 0),
        'sauna',     coalesce(sum(monto) filter (where estado = 'registrado' and concepto = 'sauna'), 0),
        'anulados',  count(*) filter (where estado = 'anulado'))
      from public.pagos where (pagado_en at time zone 'America/Lima')::date = hoy),
    'sauna', (select json_build_object(
        'asistio',    count(*) filter (where estado_asistencia = 'asistio'),
        'no_asistio', count(*) filter (where estado_asistencia = 'no_asistio'),
        'pendientes', count(*) filter (where estado_asistencia = 'pendiente'))
      from public.citas where servicio = 'sauna' and sede = v_sede and estado_asistencia <> 'cancelo'
        and (fecha_hora_cita at time zone 'America/Lima')::date = hoy),
    'entradas',   (select count(*)::int from public.checkins
                   where sede = v_sede and servicio = 'gimnasio' and (entrada_en at time zone 'America/Lima')::date = hoy),
    'por_codigo', (select count(*)::int from public.checkins
                   where sede = v_sede and servicio = 'gimnasio' and metodo = 'codigo'
                     and (entrada_en at time zone 'America/Lima')::date = hoy),
    'por_hora',   (select coalesce(json_agg(json_build_object('hora', h, 'cuenta', n) order by h), '[]'::json)
                   from (select extract(hour from entrada_en at time zone 'America/Lima')::int as h, count(*)::int as n
                         from public.checkins
                         where sede = v_sede and servicio = 'gimnasio' and (entrada_en at time zone 'America/Lima')::date = hoy
                         group by 1) z),
    'sin_checkin', (select coalesce(json_agg(json_build_object('id_cita', c.id_cita, 'id_cliente', c.id_cliente,
                                                               'nombre', cl.nombre, 'fecha_hora_cita', c.fecha_hora_cita)
                                             order by c.fecha_hora_cita), '[]'::json)
                    from public.citas c join public.clientes cl on cl.id_cliente = c.id_cliente
                    where c.servicio = 'sauna' and c.sede = v_sede and c.estado_pago = 'pagada'
                      and c.estado_asistencia = 'pendiente'
                      and (c.fecha_hora_cita at time zone 'America/Lima')::date = hoy
                      and c.fecha_hora_cita + interval '1 hour' <= now()));
end;
$$;
revoke all on function public.resumen_completo(text) from public, anon;
grant execute on function public.resumen_completo(text) to authenticated;

-- ---------- Pago de la reserva por el propio cliente (simulado) ----------
create or replace function public.pagar_reserva_sauna(p_id_cita uuid, p_medio text default 'visa')
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id    uuid := public.id_cliente_actual();
  v_medio text := lower(trim(coalesce(p_medio, 'visa')));
  v_ci    public.citas;
  v_monto numeric;
  v_pago  uuid;
  v_pagado timestamptz;
begin
  if public.rol_actual() is distinct from 'cliente' or v_id is null then
    raise exception 'Acceso denegado: solo los clientes' using errcode = '42501';
  end if;
  if v_medio not in ('visa', 'yape', 'plin') then
    raise exception 'Medio de pago no válido';
  end if;
  select * into v_ci from public.citas where id_cita = p_id_cita and id_cliente = v_id and servicio = 'sauna' for update;
  if not found then
    raise exception 'La reserva no existe.';
  end if;
  if v_ci.estado_asistencia <> 'pendiente' then
    raise exception 'La reserva ya no está vigente.';
  end if;
  if v_ci.estado_pago = 'pagada' then
    raise exception 'Esta reserva ya está pagada.';
  end if;
  v_monto := coalesce(v_ci.tarifa_aplicada, public.tarifa('sauna_afiliado'));
  insert into public.pagos (id_cliente, id_cita, concepto, monto, medio)
  values (v_id, p_id_cita, 'sauna', v_monto, v_medio)
  returning id_pago, pagado_en into v_pago, v_pagado;
  update public.citas set estado_pago = 'pagada', tarifa_aplicada = v_monto where id_cita = p_id_cita;
  perform public.registrar_evento('pagos', 'pago', v_pago, v_id,
                                  jsonb_build_object('concepto', 'sauna', 'monto', v_monto, 'medio', v_medio,
                                                     'id_cita', p_id_cita, 'origen', 'cliente_en_linea'));
  return json_build_object('ok', true, 'monto', v_monto, 'medio', v_medio, 'pagado_en', v_pagado,
                           'operacion', 'OP-' || upper(substr(replace(v_pago::text, '-', ''), 1, 8)));
end;
$$;
revoke all on function public.pagar_reserva_sauna(uuid, text) from public, anon;
grant execute on function public.pagar_reserva_sauna(uuid, text) to authenticated;

-- ---------- Ingresos para el administrador ----------
create or replace function public.ingresos_resumen(p_dias int default 30)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dias int := least(greatest(coalesce(p_dias, 30), 1), 365);
  hoy    date := public.hoy_lima();
  desde  date := public.hoy_lima() - (least(greatest(coalesce(p_dias, 30), 1), 365) - 1);
begin
  if public.rol_actual() is distinct from 'administrador' then
    raise exception 'Acceso denegado: solo el administrador' using errcode = '42501';
  end if;
  return json_build_object(
    'dias', v_dias,
    'total', coalesce((select sum(monto) from public.pagos
                       where estado = 'registrado' and (pagado_en at time zone 'America/Lima')::date >= desde), 0),
    'n_pagos', (select count(*)::int from public.pagos
                where estado = 'registrado' and (pagado_en at time zone 'America/Lima')::date >= desde),
    'por_medio', (select json_build_object(
        'efectivo', coalesce(sum(monto) filter (where medio = 'efectivo'), 0),
        'yape',     coalesce(sum(monto) filter (where medio = 'yape'), 0),
        'plin',     coalesce(sum(monto) filter (where medio = 'plin'), 0),
        'visa',     coalesce(sum(monto) filter (where medio = 'visa'), 0))
      from public.pagos where estado = 'registrado' and (pagado_en at time zone 'America/Lima')::date >= desde),
    'por_concepto', (select json_build_object(
        'membresia', coalesce(sum(monto) filter (where concepto = 'membresia'), 0),
        'pase_dia',  coalesce(sum(monto) filter (where concepto = 'pase_dia'), 0),
        'sauna',     coalesce(sum(monto) filter (where concepto = 'sauna'), 0))
      from public.pagos where estado = 'registrado' and (pagado_en at time zone 'America/Lima')::date >= desde),
    'por_dia', (select coalesce(json_agg(json_build_object('dia', g.d::date, 'total', coalesce(t.total, 0)) order by g.d), '[]'::json)
                from generate_series(desde::timestamp, hoy::timestamp, interval '1 day') g(d)
                left join (select (pagado_en at time zone 'America/Lima')::date as dia, sum(monto) as total
                           from public.pagos where estado = 'registrado'
                             and (pagado_en at time zone 'America/Lima')::date >= desde
                           group by 1) t on t.dia = g.d::date),
    'por_cobrar', (select json_build_object('n', count(*)::int, 'monto', coalesce(sum(tarifa_aplicada), 0))
                   from public.citas
                   where servicio = 'sauna' and estado_pago = 'pendiente' and estado_asistencia = 'pendiente')
  );
end;
$$;
revoke all on function public.ingresos_resumen(int) from public, anon;
grant execute on function public.ingresos_resumen(int) to authenticated;

notify pgrst, 'reload schema';
