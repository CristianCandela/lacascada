-- =====================================================================
-- No-show automático de sauna (HU-N3).
-- Regla: una cita de sauna que sigue 'pendiente' cuando termina el día de la cita (hora de Lima)
-- pasa a 'no_asistio', sin que recepción tenga que marcarla. Queda marcada como automática.
-- Se ejecuta sola cada vez que alguien consulta el aforo (la portada lo hace cada 30 s) o los resúmenes de recepción,
-- por lo que no necesita tareas programadas. Repetible.
-- Requiere 20261112000000_recepcion_v2.sql.
-- =====================================================================

alter table public.citas add column if not exists marcada_auto boolean not null default false;

create or replace function public.cerrar_citas_vencidas()
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n int;
begin
  with c as (
    update public.citas
    set estado_asistencia = 'no_asistio', marcada_en = now(), marcada_auto = true
    where servicio = 'sauna' and estado_asistencia = 'pendiente'
      and (fecha_hora_cita at time zone 'America/Lima')::date < public.hoy_lima()
    returning 1
  )
  select count(*)::int into n from c;
  return n;
end;
$$;
revoke all on function public.cerrar_citas_vencidas() from public, anon, authenticated;

-- El aforo y los resúmenes ejecutan el cierre antes de calcular.
create or replace function public.aforo_actual(p_sede text default null)
returns table (sede text, servicio text, ocupados int, capacidad int)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.cerrar_citas_vencidas();
  perform public.cerrar_visitas_vencidas();
  return query
  select a.sede, a.servicio,
         case a.servicio
           when 'gimnasio' then (select count(*)::int from public.checkins c
                                 where c.sede = a.sede and c.servicio = 'gimnasio' and c.salida_en is null)
           else (select count(*)::int from public.citas ci
                 where ci.sede = a.sede and ci.servicio = 'sauna'
                   and date_trunc('hour', ci.fecha_hora_cita) = date_trunc('hour', now())
                   and ci.estado_asistencia <> 'cancelo')
         end,
         a.capacidad
  from public.aforos a
  where p_sede is null or a.sede = p_sede
  order by a.sede, a.servicio;
end;
$$;
revoke all on function public.aforo_actual(text) from public;
grant execute on function public.aforo_actual(text) to anon, authenticated;

create or replace function public.resumen_dia(p_sede text)
returns json
language plpgsql
stable
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
stable
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
        'n_efectivo', count(*) filter (where estado = 'registrado' and medio = 'efectivo'),
        'n_yape',     count(*) filter (where estado = 'registrado' and medio = 'yape'),
        'n_plin',     count(*) filter (where estado = 'registrado' and medio = 'plin'),
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
