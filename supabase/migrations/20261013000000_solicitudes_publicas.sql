-- =====================================================================
-- Módulo cliente (sin cuenta): solicitud pública de reserva.
-- El cliente NO inicia sesión y NO puede leer nada. Solo puede enviar una
-- solicitud mediante la función solicitar_reserva(); el personal la confirma
-- (se convierte en cita) o la rechaza.
-- Ejecutar en: Supabase > SQL Editor > New query > Run
-- =====================================================================

create table if not exists public.solicitudes (
  id_solicitud         uuid primary key default gen_random_uuid(),
  nombre               text not null check (char_length(trim(nombre)) >= 3),
  dni                  text not null check (dni ~ '^[0-9]{8}$'),
  telefono             text not null check (telefono ~ '^[0-9]{9}$'),
  servicio             text not null check (servicio in ('sauna', 'gimnasio')),
  sede                 text not null check (sede in ('Año Nuevo', 'Santa Rosa')),
  fecha_hora_cita      timestamptz not null,
  consentimiento       boolean not null check (consentimiento = true),
  fecha_consentimiento timestamptz not null default now(),
  estado               text not null default 'nueva'
                       check (estado in ('nueva', 'confirmada', 'rechazada')),
  creada_en            timestamptz not null default now()
);

create index if not exists solicitudes_estado_idx on public.solicitudes (estado, creada_en);

alter table public.solicitudes enable row level security;

-- Sin políticas para anon: el público no puede leer ni escribir directamente.
drop policy if exists solicitudes_ver on public.solicitudes;
create policy solicitudes_ver on public.solicitudes
  for select to authenticated using (public.rol_actual() is not null);

drop policy if exists solicitudes_editar on public.solicitudes;
create policy solicitudes_editar on public.solicitudes
  for update to authenticated
  using (public.rol_actual() is not null) with check (public.rol_actual() is not null);

-- Derecho de cancelación (ARCO): solo el administrador elimina.
drop policy if exists solicitudes_eliminar on public.solicitudes;
create policy solicitudes_eliminar on public.solicitudes
  for delete to authenticated using (public.rol_actual() = 'administrador');

-- ---------------------------------------------------------------------
-- Función pública: recibe y valida la solicitud en el servidor.
-- Defensas básicas contra abuso: fecha futura (máx. 60 días) y límite de
-- solicitudes por DNI y por hora.
-- ---------------------------------------------------------------------
create or replace function public.solicitar_reserva(
  p_nombre text, p_dni text, p_telefono text, p_servicio text,
  p_sede text, p_fecha timestamptz, p_consentimiento boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_consentimiento is distinct from true then
    raise exception 'Debes aceptar el tratamiento de datos personales' using errcode = '22023';
  end if;
  if p_fecha is null or p_fecha <= now() then
    raise exception 'La fecha y hora deben ser posteriores al momento actual' using errcode = '22023';
  end if;
  if p_fecha > now() + interval '60 days' then
    raise exception 'Solo se aceptan solicitudes de los próximos 60 días' using errcode = '22023';
  end if;
  if (select count(*) from public.solicitudes
      where dni = p_dni and creada_en > now() - interval '1 hour') >= 3 then
    raise exception 'Demasiadas solicitudes con este DNI. Intenta más tarde' using errcode = '54000';
  end if;
  if (select count(*) from public.solicitudes
      where creada_en > now() - interval '1 hour') >= 200 then
    raise exception 'El servicio está saturado. Intenta más tarde' using errcode = '54000';
  end if;

  insert into public.solicitudes (nombre, dni, telefono, servicio, sede, fecha_hora_cita, consentimiento)
  values (trim(p_nombre), p_dni, p_telefono, p_servicio, p_sede, p_fecha, true);
end;
$$;

-- ---------------------------------------------------------------------
-- Función del personal: convierte la solicitud en cita (atómico).
-- ---------------------------------------------------------------------
create or replace function public.confirmar_solicitud(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.solicitudes;
  v_cliente uuid;
  v_cita uuid;
begin
  if public.rol_actual() is null then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;

  select * into s from public.solicitudes
  where id_solicitud = p_id and estado = 'nueva' for update;
  if not found then
    raise exception 'La solicitud no existe o ya fue atendida' using errcode = 'P0002';
  end if;

  select id_cliente into v_cliente from public.clientes where dni = s.dni;
  if v_cliente is null then
    insert into public.clientes (nombre, dni, telefono, consentimiento, fecha_consentimiento)
    values (s.nombre, s.dni, s.telefono, true, s.fecha_consentimiento)
    returning id_cliente into v_cliente;
  end if;

  insert into public.citas (id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia, registrado_por)
  values (v_cliente, s.servicio, s.sede, s.fecha_hora_cita, 'pendiente', auth.uid())
  returning id_cita into v_cita;

  update public.solicitudes set estado = 'confirmada' where id_solicitud = p_id;
  return v_cita;
end;
$$;

revoke all on function public.solicitar_reserva(text, text, text, text, text, timestamptz, boolean) from public;
revoke all on function public.confirmar_solicitud(uuid) from public, anon;
grant execute on function public.solicitar_reserva(text, text, text, text, text, timestamptz, boolean) to anon, authenticated;
grant execute on function public.confirmar_solicitud(uuid) to authenticated;
