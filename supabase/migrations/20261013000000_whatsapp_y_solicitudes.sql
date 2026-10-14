-- =====================================================================
-- Migración 2: recordatorio/confirmación por WhatsApp + solicitudes públicas
-- Ejecutar en Supabase > SQL Editor (después de la migración inicial).
-- Es idempotente: se puede ejecutar más de una vez.
-- =====================================================================

-- ---------- 1. Datos de contacto en citas (variables para APF3) ----------
-- recordatorio_enviado_en: cuándo el personal envió el recordatorio.
-- confirmada_en: cuándo el cliente confirmó. Permite calcular el "tiempo de
-- confirmación" que APF1 definió como variable del modelo.
alter table public.citas
  add column if not exists recordatorio_enviado_en timestamptz,
  add column if not exists confirmada_en timestamptz;

-- ---------- 2. Solicitudes públicas de reserva (sin cuenta) ----------
create table if not exists public.solicitudes (
  id_solicitud         uuid primary key default gen_random_uuid(),
  nombre               text not null check (char_length(trim(nombre)) between 3 and 80),
  dni                  text not null check (dni ~ '^[0-9]{8}$'),
  telefono             text not null check (telefono ~ '^[0-9]{9}$'),
  servicio             text not null check (servicio in ('sauna', 'gimnasio')),
  sede                 text not null check (sede in ('Año Nuevo', 'Santa Rosa')),
  fecha_hora_preferida timestamptz not null,
  consentimiento       boolean not null check (consentimiento = true),   -- Ley 29733
  fecha_consentimiento timestamptz not null default now(),
  estado               text not null default 'pendiente'
                       check (estado in ('pendiente', 'aprobada', 'rechazada')),
  creada_en            timestamptz not null default now()
);

create index if not exists solicitudes_estado_idx on public.solicitudes (estado, creada_en);

alter table public.solicitudes enable row level security;

-- Permisos explícitos: el público solo puede INSERTAR; nunca leer.
revoke all on public.solicitudes from anon, authenticated;
grant insert on public.solicitudes to anon;
grant select, insert, update, delete on public.solicitudes to authenticated;

drop policy if exists solicitudes_publica_crear on public.solicitudes;
create policy solicitudes_publica_crear on public.solicitudes
  for insert to anon, authenticated
  with check (estado = 'pendiente' and fecha_hora_preferida > now());

drop policy if exists solicitudes_ver on public.solicitudes;
create policy solicitudes_ver on public.solicitudes
  for select to authenticated using (public.rol_actual() is not null);

drop policy if exists solicitudes_editar on public.solicitudes;
create policy solicitudes_editar on public.solicitudes
  for update to authenticated
  using (public.rol_actual() is not null) with check (public.rol_actual() is not null);

drop policy if exists solicitudes_eliminar on public.solicitudes;
create policy solicitudes_eliminar on public.solicitudes
  for delete to authenticated using (public.rol_actual() = 'administrador');

-- ---------- 3. Aprobar una solicitud (atómico, solo personal) ----------
-- Crea el cliente si no existe, crea la cita pendiente y marca la solicitud.
create or replace function public.aprobar_solicitud(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.solicitudes;
  v_cliente  uuid;
  v_cita     uuid;
begin
  if public.rol_actual() is null then
    raise exception 'Acceso denegado: solo el personal puede aprobar solicitudes'
      using errcode = '42501';
  end if;

  select * into s from public.solicitudes
  where id_solicitud = p_id and estado = 'pendiente'
  for update;

  if not found then
    raise exception 'La solicitud no existe o ya fue atendida';
  end if;

  if s.fecha_hora_preferida <= now() then
    raise exception 'La fecha solicitada ya pasó; rechaza la solicitud o pide otra fecha';
  end if;

  select id_cliente into v_cliente from public.clientes where dni = s.dni;
  if v_cliente is null then
    insert into public.clientes (nombre, dni, telefono, consentimiento, fecha_consentimiento)
    values (s.nombre, s.dni, s.telefono, true, s.fecha_consentimiento)
    returning id_cliente into v_cliente;
  end if;

  insert into public.citas (id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia, registrado_por)
  values (v_cliente, s.servicio, s.sede, s.fecha_hora_preferida, 'pendiente', auth.uid())
  returning id_cita into v_cita;

  update public.solicitudes set estado = 'aprobada' where id_solicitud = p_id;
  return v_cita;
end;
$$;

revoke all on function public.aprobar_solicitud(uuid) from public, anon;
grant execute on function public.aprobar_solicitud(uuid) to authenticated;
