-- =====================================================================
-- Migración 3: estado «Canceló», control de aforo, anti-duplicados,
-- riesgo heurístico, log de tiempo de marcado y métricas del dashboard.
-- Ejecutar en Supabase > SQL Editor (después de las migraciones 1 y 2).
-- Es idempotente: se puede ejecutar más de una vez.
-- =====================================================================

-- ---------- 1. Estado «Canceló» + log de tiempo de marcado ----------
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.citas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado_asistencia%'
  loop
    execute format('alter table public.citas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.citas
  add constraint citas_estado_asistencia_check
  check (estado_asistencia in ('pendiente', 'asistio', 'no_asistio', 'cancelo'));

-- marcada_en: cuándo se registró la asistencia.
-- segundos_registro: segundos entre el clic y la confirmación del guardado
-- (log de tiempo de registro, historia US09 / hipótesis H1).
alter table public.citas
  add column if not exists marcada_en timestamptz,
  add column if not exists segundos_registro numeric(6, 2)
    check (segundos_registro is null or segundos_registro >= 0);

-- ---------- 2. Aforo por servicio y sede (por franja de una hora) ----------
create table if not exists public.aforos (
  servicio  text not null check (servicio in ('sauna', 'gimnasio')),
  sede      text not null check (sede in ('Año Nuevo', 'Santa Rosa')),
  capacidad int  not null check (capacidad > 0),
  primary key (servicio, sede)
);

-- Capacidades de ejemplo: AJUSTAR con los valores reales de La Cascada.
insert into public.aforos (servicio, sede, capacidad) values
  ('sauna', 'Año Nuevo', 6), ('sauna', 'Santa Rosa', 4),
  ('gimnasio', 'Año Nuevo', 30), ('gimnasio', 'Santa Rosa', 20)
on conflict (servicio, sede) do nothing;

alter table public.aforos enable row level security;
revoke all on public.aforos from anon, authenticated;
grant select on public.aforos to authenticated;
grant insert, update, delete on public.aforos to authenticated;

drop policy if exists aforos_ver on public.aforos;
create policy aforos_ver on public.aforos
  for select to authenticated using (public.rol_actual() is not null);

drop policy if exists aforos_admin on public.aforos;
create policy aforos_admin on public.aforos
  for all to authenticated
  using (public.rol_actual() = 'administrador')
  with check (public.rol_actual() = 'administrador');

-- Cupos de una franja (la franja es la hora completa de la cita).
create or replace function public.disponibilidad(p_servicio text, p_sede text, p_fecha_hora timestamptz)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'capacidad', coalesce(a.capacidad, 0),
    'ocupados',  coalesce(o.n, 0),
    'libres',    greatest(coalesce(a.capacidad, 0) - coalesce(o.n, 0), 0)
  )
  from (select 1) base
  left join public.aforos a on a.servicio = p_servicio and a.sede = p_sede
  left join lateral (
    select count(*)::int as n from public.citas c
    where c.servicio = p_servicio and c.sede = p_sede
      and date_trunc('hour', c.fecha_hora_cita) = date_trunc('hour', p_fecha_hora)
      and c.estado_asistencia <> 'cancelo'
  ) o on true
  where public.rol_actual() is not null
$$;

revoke all on function public.disponibilidad(text, text, timestamptz) from public, anon;
grant execute on function public.disponibilidad(text, text, timestamptz) to authenticated;

-- Refuerzo en la base: ninguna vía (formulario, solicitud aprobada, API)
-- puede superar el aforo de una franja futura.
create or replace function public.validar_aforo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap int;
  v_ocup int;
begin
  if new.estado_asistencia = 'cancelo' or new.fecha_hora_cita <= now() then
    return new;
  end if;
  -- Al actualizar, solo se revisa si cambió algo que afecte el cupo.
  if tg_op = 'UPDATE'
     and new.servicio = old.servicio and new.sede = old.sede
     and new.fecha_hora_cita = old.fecha_hora_cita
     and old.estado_asistencia <> 'cancelo' then
    return new;
  end if;

  select capacidad into v_cap from public.aforos
  where servicio = new.servicio and sede = new.sede;
  if v_cap is null then
    return new;
  end if;

  select count(*) into v_ocup from public.citas
  where servicio = new.servicio and sede = new.sede
    and date_trunc('hour', fecha_hora_cita) = date_trunc('hour', new.fecha_hora_cita)
    and estado_asistencia <> 'cancelo'
    and id_cita <> new.id_cita;

  if v_ocup >= v_cap then
    raise exception 'Aforo máximo completado para esta franja horaria' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists citas_validar_aforo on public.citas;
create trigger citas_validar_aforo
  before insert or update on public.citas
  for each row execute function public.validar_aforo();

-- ---------- 3. Anti-duplicados (misma persona, servicio y hora) ----------
do $$
begin
  create unique index if not exists citas_sin_duplicado
    on public.citas (id_cliente, servicio, fecha_hora_cita)
    where estado_asistencia <> 'cancelo';
exception when unique_violation then
  raise notice 'Ya existen citas duplicadas: elimínalas y vuelve a ejecutar este bloque.';
end $$;

-- ---------- 4. Riesgo heurístico (sin ML) ----------
-- Regla del informe: tasa de inasistencia >= 30 % en los últimos 30 días.
-- Se exigen al menos 2 citas con estado final para no marcar a alguien
-- por una sola falta (1 de 1 = 100 %). Citas «canceló» no cuentan.
create or replace function public.riesgo_clientes(p_ids uuid[])
returns table (id_cliente uuid, total int, no_asistio int, tasa numeric, alto_riesgo boolean)
language sql
stable
as $$
  select c.id_cliente,
         count(*)::int,
         (count(*) filter (where c.estado_asistencia = 'no_asistio'))::int,
         coalesce(round(100.0 * count(*) filter (where c.estado_asistencia = 'no_asistio')
                        / nullif(count(*), 0), 1), 0),
         (count(*) >= 2 and 100.0 * count(*) filter (where c.estado_asistencia = 'no_asistio')
                            / nullif(count(*), 0) >= 30)
  from public.citas c
  where c.id_cliente = any (p_ids)
    and c.estado_asistencia in ('asistio', 'no_asistio')
    and c.fecha_hora_cita >= now() - interval '30 days'
    and c.fecha_hora_cita <= now()
  group by c.id_cliente
$$;

revoke all on function public.riesgo_clientes(uuid[]) from public, anon;
grant execute on function public.riesgo_clientes(uuid[]) to authenticated;

-- ---------- 5. Dashboard: métricas de contabilidad de innovación ----------
create or replace function public.resumen_no_shows()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v json;
begin
  if public.rol_actual() is distinct from 'administrador' then
    raise exception 'Acceso denegado: solo el administrador puede ver el panel'
      using errcode = '42501';
  end if;

  select json_build_object(
    'total_citas',  count(*),
    'citas_vencidas', count(*) filter (where fecha_hora_cita <= now()),
    'vencidas_con_registro', count(*) filter (where fecha_hora_cita <= now() and estado_asistencia <> 'pendiente'),
    'asistio',    count(*) filter (where estado_asistencia = 'asistio'),
    'no_asistio', count(*) filter (where estado_asistencia = 'no_asistio'),
    'cancelo',    count(*) filter (where estado_asistencia = 'cancelo'),
    'pendiente',  count(*) filter (where estado_asistencia = 'pendiente'),
    'confirmadas', count(*) filter (where confirmada_en is not null),
    'tiempo_promedio_seg', round(avg(segundos_registro), 2),
    'registros_completos', count(*) filter (where estado_asistencia in ('asistio', 'no_asistio')),

    'por_servicio', (
      select coalesce(json_agg(x), '[]'::json) from (
        select servicio as clave,
               count(*) filter (where estado_asistencia = 'asistio')    as asistio,
               count(*) filter (where estado_asistencia = 'no_asistio') as no_asistio
        from public.citas group by servicio order by servicio) x),

    'por_sede', (
      select coalesce(json_agg(y), '[]'::json) from (
        select sede as clave,
               count(*) filter (where estado_asistencia = 'asistio')    as asistio,
               count(*) filter (where estado_asistencia = 'no_asistio') as no_asistio
        from public.citas group by sede order by sede) y),

    -- Últimos 14 días (hora de Lima) para el gráfico de tendencia.
    'por_dia', (
      select coalesce(json_agg(z order by z.dia), '[]'::json) from (
        select (fecha_hora_cita at time zone 'America/Lima')::date as dia,
               count(*) filter (where estado_asistencia = 'asistio')    as asistio,
               count(*) filter (where estado_asistencia = 'no_asistio') as no_asistio,
               count(*) filter (where estado_asistencia = 'cancelo')    as cancelo
        from public.citas
        where fecha_hora_cita <= now()
          and fecha_hora_cita >= now() - interval '14 days'
        group by 1) z),

    -- Mapa de calor: día de la semana (1 = lunes) x hora (hora de Lima).
    'por_dia_hora', (
      select coalesce(json_agg(h), '[]'::json) from (
        select extract(isodow from fecha_hora_cita at time zone 'America/Lima')::int as dow,
               extract(hour   from fecha_hora_cita at time zone 'America/Lima')::int as hora,
               count(*) filter (where estado_asistencia = 'asistio')    as asistio,
               count(*) filter (where estado_asistencia = 'no_asistio') as no_asistio
        from public.citas
        where estado_asistencia in ('asistio', 'no_asistio')
        group by 1, 2) h),

    -- Cohortes: citas con y sin recordatorio de WhatsApp (solo estado final).
    'recordatorio', json_build_object(
      'con_total',  count(*) filter (where recordatorio_enviado_en is not null and estado_asistencia in ('asistio', 'no_asistio')),
      'con_no',     count(*) filter (where recordatorio_enviado_en is not null and estado_asistencia = 'no_asistio'),
      'sin_total',  count(*) filter (where recordatorio_enviado_en is null and estado_asistencia in ('asistio', 'no_asistio')),
      'sin_no',     count(*) filter (where recordatorio_enviado_en is null and estado_asistencia = 'no_asistio')),

    -- Clientes de alto riesgo (misma regla que riesgo_clientes).
    'clientes_riesgo', (
      select coalesce(json_agg(r), '[]'::json) from (
        select cl.nombre, k.total, k.no_asistio, k.tasa
        from public.riesgo_clientes((select array_agg(id_cliente) from public.clientes)) k
        join public.clientes cl on cl.id_cliente = k.id_cliente
        where k.alto_riesgo
        order by k.tasa desc, k.no_asistio desc
        limit 5) r)
  ) into v
  from public.citas;

  return v;
end;
$$;

revoke all on function public.resumen_no_shows() from public, anon;
grant execute on function public.resumen_no_shows() to authenticated;
