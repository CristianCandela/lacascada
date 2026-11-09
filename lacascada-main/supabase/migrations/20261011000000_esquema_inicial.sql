-- =====================================================================
-- MVP La Cascada — Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Tablas ----------

-- Perfil del personal: rol de cada usuario que inicia sesión.
create table if not exists public.perfiles (
  id     uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol    text not null check (rol in ('recepcionista', 'administrador'))
);

-- Clientes (contrato de datos, sección 4 del plan).
create table if not exists public.clientes (
  id_cliente           uuid primary key default gen_random_uuid(),
  nombre               text not null check (char_length(trim(nombre)) >= 3),
  dni                  text not null unique check (dni ~ '^[0-9]{8}$'),
  telefono             text not null check (telefono ~ '^[0-9]{9}$'),
  -- Ley 29733: no se puede guardar un cliente sin consentimiento.
  consentimiento       boolean not null check (consentimiento = true),
  fecha_consentimiento timestamptz not null default now()
);

-- Citas. estado_asistencia es la variable objetivo del modelo de APF3
-- ('no_asistio' = no-show).
create table if not exists public.citas (
  id_cita             uuid primary key default gen_random_uuid(),
  id_cliente          uuid not null references public.clientes(id_cliente) on delete cascade,
  servicio            text not null check (servicio in ('sauna', 'gimnasio')),
  sede                text not null check (sede in ('Año Nuevo', 'Santa Rosa')),
  fecha_hora_cita     timestamptz not null,
  fecha_hora_registro timestamptz not null default now(),
  estado_asistencia   text not null default 'pendiente'
                      check (estado_asistencia in ('pendiente', 'asistio', 'no_asistio')),
  registrado_por      uuid references auth.users(id) default auth.uid()
);

create index if not exists citas_fecha_idx on public.citas (fecha_hora_cita);
create index if not exists citas_cliente_idx on public.citas (id_cliente);

-- ---------- Funciones auxiliares ----------

-- Devuelve el rol del usuario conectado (null si no tiene perfil).
create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid()
$$;

-- Resumen para el panel de no-shows. Solo el administrador puede llamarlo:
-- el control se hace aquí, en el servidor, no solo en la pantalla.
create or replace function public.resumen_no_shows()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.rol_actual() is distinct from 'administrador' then
    raise exception 'Acceso denegado: solo el administrador puede ver el panel'
      using errcode = '42501';
  end if;

  return (
    select json_build_object(
      'total_citas',        count(*),
      'citas_vencidas',     count(*) filter (where fecha_hora_cita <= now()),
      'vencidas_con_registro',
                            count(*) filter (where fecha_hora_cita <= now()
                                             and estado_asistencia <> 'pendiente'),
      'asistio',            count(*) filter (where estado_asistencia = 'asistio'),
      'no_asistio',         count(*) filter (where estado_asistencia = 'no_asistio'),
      'por_servicio', (
        select coalesce(json_agg(x), '[]'::json) from (
          select servicio as clave,
                 count(*) filter (where estado_asistencia = 'asistio')    as asistio,
                 count(*) filter (where estado_asistencia = 'no_asistio') as no_asistio
          from public.citas group by servicio order by servicio
        ) x
      ),
      'por_sede', (
        select coalesce(json_agg(y), '[]'::json) from (
          select sede as clave,
                 count(*) filter (where estado_asistencia = 'asistio')    as asistio,
                 count(*) filter (where estado_asistencia = 'no_asistio') as no_asistio
          from public.citas group by sede order by sede
        ) y
      )
    )
    from public.citas
  );
end;
$$;

revoke all on function public.rol_actual() from public, anon;
revoke all on function public.resumen_no_shows() from public, anon;
grant execute on function public.rol_actual() to authenticated;
grant execute on function public.resumen_no_shows() to authenticated;

-- ---------- Seguridad por filas (RLS) ----------
-- Sin sesión no se ve nada. Con sesión, solo quien tiene perfil.

alter table public.perfiles enable row level security;
alter table public.clientes enable row level security;
alter table public.citas    enable row level security;

drop policy if exists perfiles_ver_propio on public.perfiles;
create policy perfiles_ver_propio on public.perfiles
  for select to authenticated using (id = auth.uid());

-- Clientes
drop policy if exists clientes_ver on public.clientes;
create policy clientes_ver on public.clientes
  for select to authenticated using (public.rol_actual() is not null);

drop policy if exists clientes_crear on public.clientes;
create policy clientes_crear on public.clientes
  for insert to authenticated with check (public.rol_actual() is not null);

drop policy if exists clientes_editar on public.clientes;
create policy clientes_editar on public.clientes
  for update to authenticated
  using (public.rol_actual() is not null) with check (public.rol_actual() is not null);

-- Derecho de cancelación (ARCO): solo el administrador elimina.
drop policy if exists clientes_eliminar on public.clientes;
create policy clientes_eliminar on public.clientes
  for delete to authenticated using (public.rol_actual() = 'administrador');

-- Citas
drop policy if exists citas_ver on public.citas;
create policy citas_ver on public.citas
  for select to authenticated using (public.rol_actual() is not null);

drop policy if exists citas_crear on public.citas;
create policy citas_crear on public.citas
  for insert to authenticated with check (public.rol_actual() is not null);

drop policy if exists citas_editar on public.citas;
create policy citas_editar on public.citas
  for update to authenticated
  using (public.rol_actual() is not null) with check (public.rol_actual() is not null);

drop policy if exists citas_eliminar on public.citas;
create policy citas_eliminar on public.citas
  for delete to authenticated using (public.rol_actual() = 'administrador');
