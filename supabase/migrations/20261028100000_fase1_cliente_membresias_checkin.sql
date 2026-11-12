-- =====================================================================
-- MVP La Cascada v2 — Fase 1: rol cliente, membresías, check-in y aforo en vivo
-- Ejecutar en Supabase > SQL Editor DESPUÉS de las migraciones anteriores
-- (esquema_inicial, whatsapp_y_solicitudes, riesgo_aforo_metricas,
--  renombrar_sede_tupac_amaru, bitacora_trazabilidad). Es idempotente.
--
-- Diseño:
--  * Sauna: se reserva (tabla citas, con aforo por franja).
--  * Gimnasio: no se reserva; entra quien tiene membresía vigente. El aforo en
--    vivo sale de los check-ins sin salida.
--  * Plan único: «Plan general», 30 días, S/ 150, sin restricción de horario.
--  * El cliente solo opera por funciones (RPC); las tablas no se escriben directo.
--  * IMPORTANTE: las políticas anteriores permitían leer clientes y citas a
--    "cualquier usuario con perfil". Con el rol cliente eso filtraría datos de
--    todos, así que aquí se limitan al personal (es_personal()).
-- Datos de ejemplo (horario 06:00–22:00, precio, capacidades): AJUSTAR con los reales.
-- =====================================================================

-- ---------- 1. Rol cliente y ayudas de seguridad ----------
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.perfiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%rol%'
  loop
    execute format('alter table public.perfiles drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.perfiles
  add constraint perfiles_rol_check
  check (rol in ('recepcionista', 'administrador', 'cliente'));

create or replace function public.es_personal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() in ('recepcionista', 'administrador'), false)
$$;

create or replace function public.hoy_lima()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Lima')::date
$$;

-- ---------- 2. Cambios a tablas existentes ----------
alter table public.clientes
  add column if not exists id_usuario uuid unique references auth.users(id) on delete set null,
  add column if not exists estado text not null default 'activo'
    check (estado in ('activo', 'inactivo', 'suspendido'));

alter table public.citas
  add column if not exists origen text not null default 'recepcion'
    check (origen in ('recepcion', 'cliente', 'solicitud'));

create or replace function public.id_cliente_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id_cliente from public.clientes where id_usuario = auth.uid()
$$;

-- ---------- 3. Políticas: personal ve todo; el cliente solo lo suyo ----------
drop policy if exists clientes_ver on public.clientes;
create policy clientes_ver on public.clientes
  for select to authenticated using (public.es_personal());

drop policy if exists clientes_ver_propio on public.clientes;
create policy clientes_ver_propio on public.clientes
  for select to authenticated using (id_usuario = auth.uid());

drop policy if exists clientes_crear on public.clientes;
create policy clientes_crear on public.clientes
  for insert to authenticated with check (public.es_personal());

drop policy if exists clientes_editar on public.clientes;
create policy clientes_editar on public.clientes
  for update to authenticated
  using (public.es_personal()) with check (public.es_personal());

drop policy if exists citas_ver on public.citas;
create policy citas_ver on public.citas
  for select to authenticated using (public.es_personal());

drop policy if exists citas_ver_propias on public.citas;
create policy citas_ver_propias on public.citas
  for select to authenticated using (id_cliente = public.id_cliente_actual());

drop policy if exists citas_crear on public.citas;
create policy citas_crear on public.citas
  for insert to authenticated with check (public.es_personal());

drop policy if exists citas_editar on public.citas;
create policy citas_editar on public.citas
  for update to authenticated
  using (public.es_personal()) with check (public.es_personal());

drop policy if exists solicitudes_ver on public.solicitudes;
create policy solicitudes_ver on public.solicitudes
  for select to authenticated using (public.es_personal());

drop policy if exists solicitudes_editar on public.solicitudes;
create policy solicitudes_editar on public.solicitudes
  for update to authenticated
  using (public.es_personal()) with check (public.es_personal());

-- aprobar_solicitud: ahora solo personal (antes bastaba con tener cualquier perfil).
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
  if not public.es_personal() then
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

  insert into public.citas (id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia, registrado_por, origen)
  values (v_cliente, s.servicio, s.sede, s.fecha_hora_preferida, 'pendiente', auth.uid(), 'solicitud')
  returning id_cita into v_cita;

  update public.solicitudes set estado = 'aprobada' where id_solicitud = p_id;
  return v_cita;
end;
$$;

revoke all on function public.aprobar_solicitud(uuid) from public, anon;
grant execute on function public.aprobar_solicitud(uuid) to authenticated;

-- ---------- 4. Sedes (horario), planes, membresías y pagos ----------
create table if not exists public.sedes (
  sede   text primary key,
  abre   time not null,
  cierra time not null,
  check (cierra > abre)
);

-- Horario de ejemplo: AJUSTAR con el horario real de cada local.
insert into public.sedes (sede, abre, cierra) values
  ('Túpac Amaru', '06:00', '22:00'),
  ('Santa Rosa',  '06:00', '22:00')
on conflict (sede) do nothing;

create table if not exists public.planes (
  id_plan uuid primary key default gen_random_uuid(),
  nombre  text not null unique check (char_length(trim(nombre)) >= 3),
  dias    int  not null check (dias > 0),
  precio  numeric(8, 2) not null check (precio > 0),
  activo  boolean not null default true
);

insert into public.planes (nombre, dias, precio) values ('Plan general', 30, 150.00)
on conflict (nombre) do nothing;

create table if not exists public.membresias (
  id_membresia uuid primary key default gen_random_uuid(),
  id_cliente   uuid not null references public.clientes(id_cliente) on delete cascade,
  id_plan      uuid not null references public.planes(id_plan),
  inicio       date not null,
  fin          date not null,
  creada_en    timestamptz not null default now(),
  check (fin >= inicio)
);
create index if not exists membresias_cliente_idx on public.membresias (id_cliente, fin desc);

create table if not exists public.pagos (
  id_pago        uuid primary key default gen_random_uuid(),
  id_membresia   uuid not null references public.membresias(id_membresia) on delete cascade,
  monto          numeric(8, 2) not null check (monto > 0),
  medio          text not null check (medio in ('efectivo', 'yape', 'plin')),
  registrado_por uuid references auth.users(id) default auth.uid(),
  pagado_en      timestamptz not null default now()
);

-- ---------- 5. Código del local, check-in e intentos ----------
create table if not exists public.codigos_local (
  id_codigo     uuid primary key default gen_random_uuid(),
  sede          text not null references public.sedes(sede),
  codigo        text not null check (codigo ~ '^[0-9]{6}$'),
  vigente_desde timestamptz not null default now(),
  vigente_hasta timestamptz not null
);
create index if not exists codigos_local_codigo_idx on public.codigos_local (codigo, vigente_hasta);

create table if not exists public.checkins (
  id_checkin         uuid primary key default gen_random_uuid(),
  id_cliente         uuid not null references public.clientes(id_cliente) on delete cascade,
  sede               text not null references public.sedes(sede),
  entrada_en         timestamptz not null default now(),
  salida_en          timestamptz,
  metodo             text not null default 'codigo' check (metodo in ('codigo', 'manual')),
  cierre_automatico  boolean not null default false,
  registrado_por     uuid references auth.users(id) default auth.uid(),
  check (salida_en is null or salida_en >= entrada_en)
);
create index if not exists checkins_cliente_idx on public.checkins (id_cliente, entrada_en desc);
-- Una persona no puede tener dos entradas abiertas (evita el préstamo de código).
create unique index if not exists checkins_una_abierta on public.checkins (id_cliente) where salida_en is null;

-- Intentos fallidos de código (bloqueo de fuerza bruta): 5 en 10 minutos.
create table if not exists public.codigo_intentos (
  id         bigint generated always as identity primary key,
  id_usuario uuid not null,
  en         timestamptz not null default now(),
  ok         boolean not null
);
create index if not exists codigo_intentos_idx on public.codigo_intentos (id_usuario, en desc);

create table if not exists public.motivos_ausencia (
  id             uuid primary key default gen_random_uuid(),
  id_cliente     uuid not null references public.clientes(id_cliente) on delete cascade,
  motivo         text not null check (motivo in ('horario', 'costo', 'salud', 'viaje', 'otro')),
  registrado_por uuid references auth.users(id) default auth.uid(),
  registrado_en  timestamptz not null default now()
);

-- ---------- 6. Permisos y RLS de las tablas nuevas ----------
alter table public.sedes            enable row level security;
alter table public.planes           enable row level security;
alter table public.membresias       enable row level security;
alter table public.pagos            enable row level security;
alter table public.codigos_local    enable row level security;
alter table public.checkins         enable row level security;
alter table public.codigo_intentos  enable row level security;
alter table public.motivos_ausencia enable row level security;

revoke all on public.sedes, public.planes, public.membresias, public.pagos, public.codigos_local,
              public.checkins, public.codigo_intentos, public.motivos_ausencia from anon, authenticated;

grant select on public.sedes, public.planes to anon, authenticated;
grant insert, update, delete on public.sedes, public.planes to authenticated;
grant select on public.membresias, public.pagos, public.codigos_local, public.checkins,
                public.motivos_ausencia to authenticated;
-- codigo_intentos: sin permisos; solo las funciones lo usan.

drop policy if exists sedes_ver on public.sedes;
create policy sedes_ver on public.sedes for select to anon, authenticated using (true);
drop policy if exists sedes_admin on public.sedes;
create policy sedes_admin on public.sedes for all to authenticated
  using (public.rol_actual() = 'administrador') with check (public.rol_actual() = 'administrador');

drop policy if exists planes_ver on public.planes;
create policy planes_ver on public.planes for select to anon, authenticated using (activo);
drop policy if exists planes_admin on public.planes;
create policy planes_admin on public.planes for all to authenticated
  using (public.rol_actual() = 'administrador') with check (public.rol_actual() = 'administrador');

drop policy if exists membresias_personal on public.membresias;
create policy membresias_personal on public.membresias for select to authenticated using (public.es_personal());
drop policy if exists membresias_propias on public.membresias;
create policy membresias_propias on public.membresias for select to authenticated
  using (id_cliente = public.id_cliente_actual());

drop policy if exists pagos_personal on public.pagos;
create policy pagos_personal on public.pagos for select to authenticated using (public.es_personal());

drop policy if exists codigos_personal on public.codigos_local;
create policy codigos_personal on public.codigos_local for select to authenticated using (public.es_personal());

drop policy if exists checkins_personal on public.checkins;
create policy checkins_personal on public.checkins for select to authenticated using (public.es_personal());
drop policy if exists checkins_propios on public.checkins;
create policy checkins_propios on public.checkins for select to authenticated
  using (id_cliente = public.id_cliente_actual());

drop policy if exists motivos_admin on public.motivos_ausencia;
create policy motivos_admin on public.motivos_ausencia for select to authenticated
  using (public.rol_actual() = 'administrador');

-- ---------- 7. Bitácora: nuevos tipos de evento ----------
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.bitacora'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%tabla%' or pg_get_constraintdef(oid) ilike '%accion%')
  loop
    execute format('alter table public.bitacora drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.bitacora
  add constraint bitacora_tabla_check
  check (tabla in ('citas', 'solicitudes', 'clientes', 'checkins', 'membresias'));
alter table public.bitacora
  add constraint bitacora_accion_check
  check (accion in ('crear', 'marcar', 'reabrir', 'recordar', 'confirmar', 'editar', 'eliminar',
                    'solicitar', 'aprobar', 'rechazar',
                    'autoregistro', 'checkin', 'checkout', 'pago', 'motivo_ausencia'));

-- Uso interno (no se concede a nadie): registra un evento solo si viene de la aplicación.
create or replace function public.registrar_evento(p_tabla text, p_accion text, p_id_registro uuid,
                                                   p_id_cliente uuid, p_detalle jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.es_accion_de_app() then
    insert into public.bitacora (id_usuario, tabla, accion, id_registro, id_cliente, detalle)
    values (auth.uid(), p_tabla, p_accion, p_id_registro, p_id_cliente, coalesce(p_detalle, '{}'::jsonb));
  end if;
end
$$;
revoke all on function public.registrar_evento(text, text, uuid, uuid, jsonb) from public, anon, authenticated;

-- ---------- 8. Funciones internas ----------
-- Fin de la membresía que cubre un día (null si no hay).
create or replace function public.membresia_vigente(p_id_cliente uuid, p_dia date default public.hoy_lima())
returns date
language sql
stable
security definer
set search_path = public
as $$
  select max(fin) from public.membresias
  where id_cliente = p_id_cliente and inicio <= p_dia and fin >= p_dia
$$;
revoke all on function public.membresia_vigente(uuid, date) from public, anon, authenticated;

-- Cierra las visitas abiertas cuando el local ya cerró (sin necesidad de cron).
create or replace function public.cerrar_visitas_vencidas()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.checkins c
  set salida_en = (((c.entrada_en at time zone 'America/Lima')::date + s.cierra) at time zone 'America/Lima'),
      cierre_automatico = true
  from public.sedes s
  where s.sede = c.sede and c.salida_en is null
    and now() > (((c.entrada_en at time zone 'America/Lima')::date + s.cierra) at time zone 'America/Lima')
$$;
revoke all on function public.cerrar_visitas_vencidas() from public, anon, authenticated;

create or replace function public.intentos_excedidos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) >= 5 from public.codigo_intentos
  where id_usuario = auth.uid() and not ok and en > now() - interval '10 minutes'
$$;
revoke all on function public.intentos_excedidos() from public, anon, authenticated;

create or replace function public.anotar_intento(p_ok boolean)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.codigo_intentos (id_usuario, ok) values (auth.uid(), p_ok)
$$;
revoke all on function public.anotar_intento(boolean) from public, anon, authenticated;

create or replace function public.sede_de_codigo(p_codigo text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select sede from public.codigos_local
  where codigo = trim(p_codigo) and vigente_hasta > now()
  order by vigente_desde desc limit 1
$$;
revoke all on function public.sede_de_codigo(text) from public, anon, authenticated;

-- Valida y registra una entrada (usada por checkin y checkin_manual).
create or replace function public.entrar_gimnasio(p_id_cliente uuid, p_sede text, p_metodo text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_cli  public.clientes;
  v_fin  date;
  v_hora time := (now() at time zone 'America/Lima')::time;
  s      public.sedes;
  v_id   uuid;
begin
  perform public.cerrar_visitas_vencidas();
  select * into v_cli from public.clientes where id_cliente = p_id_cliente;
  if not found then
    return json_build_object('ok', false, 'motivo', 'Cliente no encontrado');
  end if;
  if v_cli.estado <> 'activo' then
    return json_build_object('ok', false, 'motivo', 'La cuenta no está activa. Acude a recepción.');
  end if;
  v_fin := public.membresia_vigente(p_id_cliente);
  if v_fin is null then
    return json_build_object('ok', false, 'motivo', 'No hay una membresía vigente.');
  end if;
  select * into s from public.sedes where sede = p_sede;
  if not found or v_hora < s.abre or v_hora >= s.cierra then
    return json_build_object('ok', false, 'motivo', 'El local está cerrado en este momento.');
  end if;

  begin
    insert into public.checkins (id_cliente, sede, metodo) values (p_id_cliente, p_sede, p_metodo)
    returning id_checkin into v_id;
  exception when unique_violation then
    return json_build_object('ok', false, 'motivo', 'Ya hay una entrada abierta. Registra la salida antes de volver a entrar.');
  end;

  perform public.registrar_evento('checkins', 'checkin', v_id, p_id_cliente,
                                  jsonb_build_object('sede', p_sede, 'metodo', p_metodo));
  return json_build_object('ok', true, 'sede', p_sede, 'membresia_fin', v_fin);
end;
$$;
revoke all on function public.entrar_gimnasio(uuid, text, text) from public, anon, authenticated;

-- ---------- 9. Funciones públicas: aforo en vivo ----------
create or replace function public.aforo_actual(p_sede text default null)
returns table (sede text, servicio text, ocupados int, capacidad int)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.cerrar_visitas_vencidas();
  return query
  select a.sede, a.servicio,
         case a.servicio
           when 'gimnasio' then (select count(*)::int from public.checkins c
                                 where c.sede = a.sede and c.salida_en is null)
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

-- ---------- 10. Funciones del cliente ----------
-- Registro propio: la cuenta ya existe en Supabase Auth; aquí se crea (o vincula) el cliente.
create or replace function public.registrar_cliente(p_codigo_local text, p_nombre text, p_dni text,
                                                    p_telefono text, p_consentimiento boolean)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_existente public.clientes;
  v_id        uuid;
begin
  if auth.uid() is null then
    raise exception 'Acceso denegado: inicia sesión primero' using errcode = '42501';
  end if;
  if exists (select 1 from public.perfiles where id = auth.uid()) then
    return json_build_object('ok', false, 'motivo', 'Esta cuenta ya tiene un perfil.');
  end if;
  if public.intentos_excedidos() then
    return json_build_object('ok', false, 'motivo', 'Demasiados intentos fallidos. Espera 10 minutos o acude a recepción.');
  end if;
  if public.sede_de_codigo(p_codigo_local) is null then
    perform public.anotar_intento(false);
    return json_build_object('ok', false, 'motivo', 'Código del local incorrecto o vencido.');
  end if;
  if p_consentimiento is distinct from true then
    return json_build_object('ok', false, 'motivo', 'Debes aceptar el tratamiento de tus datos personales.');
  end if;
  if char_length(trim(coalesce(p_nombre, ''))) < 3 then
    return json_build_object('ok', false, 'motivo', 'Escribe tu nombre completo.');
  end if;
  if coalesce(p_dni, '') !~ '^[0-9]{8}$' or coalesce(p_telefono, '') !~ '^[0-9]{9}$' then
    return json_build_object('ok', false, 'motivo', 'DNI (8 dígitos) o teléfono (9 dígitos) con formato inválido.');
  end if;

  select * into v_existente from public.clientes where dni = p_dni for update;
  if found then
    if v_existente.id_usuario is not null then
      return json_build_object('ok', false, 'motivo', 'Ese DNI ya está registrado con otra cuenta.');
    end if;
    if v_existente.telefono <> p_telefono then
      return json_build_object('ok', false, 'motivo', 'Los datos no coinciden con un registro existente. Acude a recepción.');
    end if;
    update public.clientes set id_usuario = auth.uid() where id_cliente = v_existente.id_cliente;
    v_id := v_existente.id_cliente;
  else
    insert into public.clientes (nombre, dni, telefono, consentimiento, id_usuario)
    values (trim(p_nombre), p_dni, p_telefono, true, auth.uid())
    returning id_cliente into v_id;
  end if;

  insert into public.perfiles (id, nombre, rol)
  values (auth.uid(), coalesce(v_existente.nombre, trim(p_nombre)), 'cliente');

  perform public.anotar_intento(true);
  perform public.registrar_evento('clientes', 'autoregistro', v_id, v_id,
                                  jsonb_build_object('vinculado', v_existente.id_cliente is not null));
  return json_build_object('ok', true, 'id_cliente', v_id);
end;
$$;
revoke all on function public.registrar_cliente(text, text, text, text, boolean) from public, anon;
grant execute on function public.registrar_cliente(text, text, text, text, boolean) to authenticated;

create or replace function public.checkin(p_codigo text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id   uuid := public.id_cliente_actual();
  v_sede text;
begin
  if public.rol_actual() is distinct from 'cliente' or v_id is null then
    raise exception 'Acceso denegado: solo los clientes registran su entrada con código'
      using errcode = '42501';
  end if;
  if public.intentos_excedidos() then
    return json_build_object('ok', false, 'motivo', 'Demasiados intentos fallidos. Espera 10 minutos o acude a recepción.');
  end if;
  v_sede := public.sede_de_codigo(p_codigo);
  if v_sede is null then
    perform public.anotar_intento(false);
    return json_build_object('ok', false, 'motivo', 'Código incorrecto o vencido.');
  end if;
  perform public.anotar_intento(true);
  return public.entrar_gimnasio(v_id, v_sede, 'codigo');
end;
$$;
revoke all on function public.checkin(text) from public, anon;
grant execute on function public.checkin(text) to authenticated;

create or replace function public.checkout()
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := public.id_cliente_actual();
  v_chk uuid;
begin
  if public.rol_actual() is distinct from 'cliente' or v_id is null then
    raise exception 'Acceso denegado: solo los clientes' using errcode = '42501';
  end if;
  update public.checkins set salida_en = now()
  where id_cliente = v_id and salida_en is null
  returning id_checkin into v_chk;
  if v_chk is null then
    return json_build_object('ok', false, 'motivo', 'No tienes una entrada abierta.');
  end if;
  perform public.registrar_evento('checkins', 'checkout', v_chk, v_id, '{}'::jsonb);
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.checkout() from public, anon;
grant execute on function public.checkout() to authenticated;

create or replace function public.mi_membresia()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid := public.id_cliente_actual();
  m    record;
begin
  if public.rol_actual() is distinct from 'cliente' or v_id is null then
    raise exception 'Acceso denegado: solo los clientes' using errcode = '42501';
  end if;
  select ms.inicio, ms.fin, p.nombre as plan into m
  from public.membresias ms join public.planes p on p.id_plan = ms.id_plan
  where ms.id_cliente = v_id
  order by ms.fin desc limit 1;
  if not found then
    return json_build_object('vigente', false, 'plan', null, 'inicio', null, 'fin', null, 'dias_restantes', 0);
  end if;
  -- fin = último día pagado (incluye renovaciones adelantadas); inicio = desde cuándo
  -- tiene cobertura continua. vigente = hoy está cubierto por alguna membresía.
  return json_build_object('vigente', public.membresia_vigente(v_id) is not null,
                           'plan', m.plan,
                           'inicio', coalesce((select min(x.inicio) from public.membresias x
                                               where x.id_cliente = v_id and x.fin >= public.hoy_lima()), m.inicio),
                           'fin', m.fin,
                           'dias_restantes', greatest(m.fin - public.hoy_lima(), 0));
end;
$$;
revoke all on function public.mi_membresia() from public, anon;
grant execute on function public.mi_membresia() to authenticated;

create or replace function public.mis_visitas(p_limite int default 20)
returns table (entrada_en timestamptz, salida_en timestamptz, sede text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid := public.id_cliente_actual();
begin
  if public.rol_actual() is distinct from 'cliente' or v_id is null then
    raise exception 'Acceso denegado: solo los clientes' using errcode = '42501';
  end if;
  return query
  select c.entrada_en, c.salida_en, c.sede from public.checkins c
  where c.id_cliente = v_id
  order by c.entrada_en desc
  limit least(greatest(coalesce(p_limite, 20), 1), 100);
end;
$$;
revoke all on function public.mis_visitas(int) from public, anon;
grant execute on function public.mis_visitas(int) to authenticated;

create or replace function public.mis_datos()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid := public.id_cliente_actual();
begin
  if public.rol_actual() is distinct from 'cliente' or v_id is null then
    raise exception 'Acceso denegado: solo los clientes' using errcode = '42501';
  end if;
  return (select json_build_object('nombre', nombre, 'dni', dni, 'telefono', telefono, 'estado', estado,
                                   'consentimiento', consentimiento, 'fecha_consentimiento', fecha_consentimiento)
          from public.clientes where id_cliente = v_id);
end;
$$;
revoke all on function public.mis_datos() from public, anon;
grant execute on function public.mis_datos() to authenticated;

-- Reserva de sauna del propio cliente (franja de una hora). El aforo y los duplicados
-- los controlan los disparadores ya existentes (validar_aforo, citas_sin_duplicado).
create or replace function public.reservar_sauna(p_sede text, p_fecha_hora timestamptz)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id    uuid := public.id_cliente_actual();
  v_slot  timestamptz := date_trunc('hour', p_fecha_hora);
  v_local timestamp := (date_trunc('hour', p_fecha_hora) at time zone 'America/Lima');
  s       public.sedes;
  v_cli   public.clientes;
  v_cita  uuid;
begin
  if public.rol_actual() is distinct from 'cliente' or v_id is null then
    raise exception 'Acceso denegado: solo los clientes reservan por esta vía' using errcode = '42501';
  end if;
  select * into v_cli from public.clientes where id_cliente = v_id;
  if v_cli.estado <> 'activo' then
    raise exception 'Tu cuenta no está activa. Acude a recepción.';
  end if;
  if v_slot <= now() then
    raise exception 'Elige un horario futuro.';
  end if;
  if v_slot > now() + interval '30 days' then
    raise exception 'Solo se puede reservar con hasta 30 días de anticipación.';
  end if;
  select * into s from public.sedes where sede = p_sede;
  if not found then
    raise exception 'Sede no válida.';
  end if;
  if v_local::time < s.abre or v_local::time >= s.cierra then
    raise exception 'Ese horario está fuera del horario de atención.';
  end if;
  if public.membresia_vigente(v_id, v_local::date) is null then
    raise exception 'Tu membresía no cubre esa fecha.';
  end if;

  insert into public.citas (id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia, registrado_por, origen)
  values (v_id, 'sauna', p_sede, v_slot, 'pendiente', auth.uid(), 'cliente')
  returning id_cita into v_cita;
  return v_cita;
end;
$$;
revoke all on function public.reservar_sauna(text, timestamptz) from public, anon;
grant execute on function public.reservar_sauna(text, timestamptz) to authenticated;

create or replace function public.cancelar_reserva(p_id_cita uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := public.id_cliente_actual();
  c    public.citas;
begin
  if public.rol_actual() is distinct from 'cliente' or v_id is null then
    raise exception 'Acceso denegado: solo los clientes' using errcode = '42501';
  end if;
  select * into c from public.citas where id_cita = p_id_cita and id_cliente = v_id for update;
  if not found then
    return json_build_object('ok', false, 'motivo', 'La reserva no existe.');
  end if;
  if c.estado_asistencia <> 'pendiente' or c.fecha_hora_cita <= now() then
    return json_build_object('ok', false, 'motivo', 'Solo se pueden cancelar reservas pendientes y futuras.');
  end if;
  update public.citas set estado_asistencia = 'cancelo', marcada_en = now() where id_cita = p_id_cita;
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.cancelar_reserva(uuid) from public, anon;
grant execute on function public.cancelar_reserva(uuid) to authenticated;

-- ---------- 11. Funciones del personal ----------
create or replace function public.codigo_local_actual(p_sede text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c       public.codigos_local;
  v_cod   text;
  v_hasta timestamptz := ((date_trunc('day', now() at time zone 'America/Lima') + interval '1 day')
                          at time zone 'America/Lima');
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sedes where sede = p_sede) then
    raise exception 'Sede no válida.';
  end if;
  select * into c from public.codigos_local
  where sede = p_sede and vigente_hasta > now()
  order by vigente_desde desc limit 1;
  if not found then
    loop
      v_cod := lpad((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0');
      exit when not exists (select 1 from public.codigos_local where codigo = v_cod and vigente_hasta > now());
    end loop;
    insert into public.codigos_local (sede, codigo, vigente_hasta) values (p_sede, v_cod, v_hasta)
    returning * into c;
  end if;
  return json_build_object('codigo', c.codigo, 'sede', c.sede, 'vigente_hasta', c.vigente_hasta);
end;
$$;
revoke all on function public.codigo_local_actual(text) from public, anon;
grant execute on function public.codigo_local_actual(text) to authenticated;

create or replace function public.checkin_manual(p_id_cliente uuid, p_sede text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return public.entrar_gimnasio(p_id_cliente, p_sede, 'manual');
end;
$$;
revoke all on function public.checkin_manual(uuid, text) from public, anon;
grant execute on function public.checkin_manual(uuid, text) to authenticated;

create or replace function public.checkout_manual(p_id_cliente uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_chk uuid;
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  update public.checkins set salida_en = now()
  where id_cliente = p_id_cliente and salida_en is null
  returning id_checkin into v_chk;
  if v_chk is null then
    return json_build_object('ok', false, 'motivo', 'El cliente no tiene una entrada abierta.');
  end if;
  perform public.registrar_evento('checkins', 'checkout', v_chk, p_id_cliente, jsonb_build_object('metodo', 'manual'));
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.checkout_manual(uuid) from public, anon;
grant execute on function public.checkout_manual(uuid) to authenticated;

-- Pago de membresía: si aún está vigente, la nueva empieza al día siguiente de su fin.
create or replace function public.registrar_pago(p_id_cliente uuid, p_id_plan uuid,
                                                 p_monto numeric default null,
                                                 p_medio text default 'efectivo')
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p        public.planes;
  v_monto  numeric;
  v_ultimo date;
  v_inicio date;
  v_mem    uuid;
  v_pago   uuid;
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  select * into p from public.planes where id_plan = p_id_plan and activo;
  if not found then
    raise exception 'El plan no existe o no está activo.';
  end if;
  if not exists (select 1 from public.clientes where id_cliente = p_id_cliente) then
    raise exception 'El cliente no existe.';
  end if;
  if p_medio not in ('efectivo', 'yape', 'plin') then
    raise exception 'Medio de pago no válido.';
  end if;
  v_monto := coalesce(p_monto, p.precio);
  if v_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero.';
  end if;

  select max(fin) into v_ultimo from public.membresias where id_cliente = p_id_cliente;
  v_inicio := case when v_ultimo is not null and v_ultimo >= public.hoy_lima()
                   then v_ultimo + 1 else public.hoy_lima() end;

  insert into public.membresias (id_cliente, id_plan, inicio, fin)
  values (p_id_cliente, p_id_plan, v_inicio, v_inicio + p.dias - 1)
  returning id_membresia into v_mem;
  insert into public.pagos (id_membresia, monto, medio) values (v_mem, v_monto, p_medio)
  returning id_pago into v_pago;

  perform public.registrar_evento('membresias', 'pago', v_mem, p_id_cliente,
                                  jsonb_build_object('plan', p.nombre, 'monto', v_monto, 'medio', p_medio));
  return v_mem;
end;
$$;
revoke all on function public.registrar_pago(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.registrar_pago(uuid, uuid, numeric, text) to authenticated;

-- Membresías que vencen pronto (o vencieron en los últimos 30 días sin renovar).
create or replace function public.membresias_por_vencer(p_dias int default 7)
returns table (id_cliente uuid, nombre text, fin date, dias_restantes int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return query
  select u.id_cliente, c.nombre, u.fin, (u.fin - public.hoy_lima())::int
  from (select distinct on (m.id_cliente) m.id_cliente, m.fin
        from public.membresias m order by m.id_cliente, m.fin desc) u
  join public.clientes c on c.id_cliente = u.id_cliente
  where u.fin <= public.hoy_lima() + coalesce(p_dias, 7)
    and u.fin >= public.hoy_lima() - 30
  order by u.fin;
end;
$$;
revoke all on function public.membresias_por_vencer(int) from public, anon;
grant execute on function public.membresias_por_vencer(int) to authenticated;

-- ---------- 12. Funciones del administrador ----------
-- Clientes con membresía vigente que no asisten hace N días (o nunca asistieron).
create or replace function public.clientes_inactivos(p_dias int default 14)
returns table (id_cliente uuid, nombre text, telefono text, ultima_visita timestamptz,
               dias_sin_asistir int, membresia_fin date, ultimo_motivo text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.rol_actual() is distinct from 'administrador' then
    raise exception 'Acceso denegado: solo el administrador' using errcode = '42501';
  end if;
  return query
  select c.id_cliente, c.nombre, c.telefono, v.ultima,
         case when v.ultima is null then null
              else (public.hoy_lima() - (v.ultima at time zone 'America/Lima')::date)::int end,
         public.membresia_vigente(c.id_cliente),
         (select m.motivo from public.motivos_ausencia m where m.id_cliente = c.id_cliente
          order by m.registrado_en desc limit 1)
  from public.clientes c
  left join lateral (select max(k.entrada_en) as ultima from public.checkins k where k.id_cliente = c.id_cliente) v on true
  where c.estado = 'activo'
    and public.membresia_vigente(c.id_cliente) is not null
    and (v.ultima is null or v.ultima < now() - make_interval(days => coalesce(p_dias, 14)))
  order by v.ultima nulls first;
end;
$$;
revoke all on function public.clientes_inactivos(int) from public, anon;
grant execute on function public.clientes_inactivos(int) to authenticated;

create or replace function public.registrar_motivo_ausencia(p_id_cliente uuid, p_motivo text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if public.rol_actual() is distinct from 'administrador' then
    raise exception 'Acceso denegado: solo el administrador' using errcode = '42501';
  end if;
  if p_motivo not in ('horario', 'costo', 'salud', 'viaje', 'otro') then
    raise exception 'Motivo no válido.';
  end if;
  if not exists (select 1 from public.clientes where id_cliente = p_id_cliente) then
    raise exception 'El cliente no existe.';
  end if;
  insert into public.motivos_ausencia (id_cliente, motivo) values (p_id_cliente, p_motivo) returning id into v_id;
  perform public.registrar_evento('clientes', 'motivo_ausencia', v_id, p_id_cliente, jsonb_build_object('motivo', p_motivo));
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.registrar_motivo_ausencia(uuid, text) from public, anon;
grant execute on function public.registrar_motivo_ausencia(uuid, text) to authenticated;

-- Funciones auxiliares de seguridad: solo usuarios con sesión.
revoke all on function public.es_personal() from public, anon;
grant execute on function public.es_personal() to authenticated;
revoke all on function public.id_cliente_actual() from public, anon;
grant execute on function public.id_cliente_actual() to authenticated;
