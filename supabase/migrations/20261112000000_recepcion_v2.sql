-- =====================================================================
-- Recepción v2 (rol Leticia): 14 funciones del contrato + cambios de tablas que necesitan.
-- Requiere las migraciones anteriores (hasta 20261028100000). Es repetible (idempotente).
-- Contrato: docs/CONTRATO_DATOS.md, sección «Recepción: funciones nuevas».
--
-- Decisiones de diseño (revisar con el equipo):
--  * Tarifas en la tabla `tarifas` (sauna regular 20, sauna afiliado 15, pase del día 20): ajustar a las reales.
--  * Los pagos no tienen sede: los cobros del día se suman para todo el negocio.
--  * `checkin_manual` ahora LANZA error (no devuelve ok:false) para que la pantalla muestre el motivo.
--  * El check-in de sauna marca la cita «asistió» y deja una visita cerrada; no cuenta para el aforo del gimnasio.
--  * Anular un pago solo lo marca como anulado (con motivo); no revierte la membresía ni la cita.
-- =====================================================================

-- ---------- 0. Sede principal: 'Año Nuevo' -> 'Túpac Amaru' ----------
-- Las migraciones iniciales limitaban la sede a 'Año Nuevo' y 'Santa Rosa'. La app usa 'Túpac Amaru'.
do $$
declare t text;
begin
  foreach t in array array['citas', 'solicitudes', 'aforos'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_sede_check');
  end loop;
end $$;
update public.citas        set sede = 'Túpac Amaru' where sede = 'Año Nuevo';
update public.solicitudes  set sede = 'Túpac Amaru' where sede = 'Año Nuevo';
delete from public.aforos old where old.sede = 'Año Nuevo'
  and exists (select 1 from public.aforos n where n.servicio = old.servicio and n.sede = 'Túpac Amaru');
update public.aforos       set sede = 'Túpac Amaru' where sede = 'Año Nuevo';
alter table public.citas        add constraint citas_sede_check        check (sede in ('Túpac Amaru', 'Santa Rosa'));
alter table public.solicitudes  add constraint solicitudes_sede_check  check (sede in ('Túpac Amaru', 'Santa Rosa'));
alter table public.aforos       add constraint aforos_sede_check       check (sede in ('Túpac Amaru', 'Santa Rosa'));

-- ---------- 1. Clientes: código correlativo (C-1001…), teléfono opcional, registro asistido ----------
create sequence if not exists public.clientes_codigo_seq start 1001;

alter table public.clientes
  add column if not exists codigo_cliente text,
  add column if not exists asistido_en timestamptz;

update public.clientes c
set codigo_cliente = 'C-' || nextval('public.clientes_codigo_seq')
from (select id_cliente from public.clientes where codigo_cliente is null order by fecha_consentimiento, id_cliente) x
where c.id_cliente = x.id_cliente;

create unique index if not exists clientes_codigo_uk on public.clientes (codigo_cliente);
alter table public.clientes alter column codigo_cliente set not null;

create or replace function public.asignar_codigo_cliente()
returns trigger
language plpgsql
as $$
begin
  if new.codigo_cliente is null then
    new.codigo_cliente := 'C-' || nextval('public.clientes_codigo_seq');
  end if;
  return new;
end;
$$;
drop trigger if exists clientes_codigo_trg on public.clientes;
create trigger clientes_codigo_trg before insert on public.clientes
  for each row execute function public.asignar_codigo_cliente();

-- El teléfono es opcional en el registro asistido (si se escribe, debe tener 9 dígitos).
alter table public.clientes alter column telefono drop not null;
alter table public.clientes drop constraint if exists clientes_telefono_check;
alter table public.clientes add constraint clientes_telefono_check
  check (telefono is null or telefono ~ '^[0-9]{9}$');

-- ---------- 2. Tarifas, pagos de cualquier concepto, citas con cobro, check-ins por servicio ----------
create table if not exists public.tarifas (
  concepto text primary key check (concepto in ('sauna_regular', 'sauna_afiliado', 'pase_dia')),
  monto    numeric(8, 2) not null check (monto > 0)
);
-- Tarifas de ejemplo: AJUSTAR con las reales de La Cascada.
insert into public.tarifas (concepto, monto) values
  ('sauna_regular', 20), ('sauna_afiliado', 15), ('pase_dia', 20)
on conflict (concepto) do nothing;
alter table public.tarifas enable row level security;
revoke all on public.tarifas from anon, authenticated;
grant select on public.tarifas to authenticated;
drop policy if exists tarifas_personal on public.tarifas;
create policy tarifas_personal on public.tarifas for select to authenticated using (public.es_personal());

alter table public.pagos
  add column if not exists id_cliente uuid references public.clientes(id_cliente) on delete cascade,
  add column if not exists id_cita uuid references public.citas(id_cita) on delete set null,
  add column if not exists concepto text not null default 'membresia',
  add column if not exists estado text not null default 'registrado',
  add column if not exists motivo_anulacion text,
  add column if not exists anulado_por uuid references auth.users(id),
  add column if not exists anulado_en timestamptz;
update public.pagos p set id_cliente = m.id_cliente
from public.membresias m where p.id_membresia = m.id_membresia and p.id_cliente is null;
alter table public.pagos alter column id_cliente set not null;
alter table public.pagos alter column id_membresia drop not null;
alter table public.pagos drop constraint if exists pagos_concepto_check;
alter table public.pagos add constraint pagos_concepto_check check (concepto in ('membresia', 'pase_dia', 'sauna'));
alter table public.pagos drop constraint if exists pagos_estado_check;
alter table public.pagos add constraint pagos_estado_check check (estado in ('registrado', 'anulado'));
alter table public.pagos drop constraint if exists pagos_membresia_check;
alter table public.pagos add constraint pagos_membresia_check check (concepto <> 'membresia' or id_membresia is not null);
create index if not exists pagos_fecha_idx on public.pagos (pagado_en desc);
create index if not exists pagos_cliente_idx on public.pagos (id_cliente, concepto);

alter table public.citas
  add column if not exists estado_pago text not null default 'pagada'
    check (estado_pago in ('pagada', 'pendiente')),
  add column if not exists tarifa_aplicada numeric(8, 2);

alter table public.checkins
  add column if not exists servicio text not null default 'gimnasio' check (servicio in ('gimnasio', 'sauna')),
  add column if not exists id_cita uuid references public.citas(id_cita) on delete set null;

-- ---------- 3. Funciones internas ----------
create or replace function public.tarifa(p_concepto text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select monto from public.tarifas where concepto = p_concepto
$$;
revoke all on function public.tarifa(text) from public, anon, authenticated;

create or replace function public.pase_hoy(p_id_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pagos
    where id_cliente = p_id_cliente and concepto = 'pase_dia' and estado = 'registrado'
      and (pagado_en at time zone 'America/Lima')::date = public.hoy_lima())
$$;
revoke all on function public.pase_hoy(uuid) from public, anon, authenticated;

-- Entrada al gimnasio: membresía vigente O pase del día pagado hoy.
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
  if v_fin is null and not public.pase_hoy(p_id_cliente) then
    return json_build_object('ok', false, 'motivo', 'No hay una membresía vigente ni un pase del día pagado.');
  end if;
  select * into s from public.sedes where sede = p_sede;
  if not found or v_hora < s.abre or v_hora >= s.cierra then
    return json_build_object('ok', false, 'motivo', 'El local está cerrado en este momento.');
  end if;

  begin
    insert into public.checkins (id_cliente, sede, metodo, servicio) values (p_id_cliente, p_sede, p_metodo, 'gimnasio')
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

-- Aforo en vivo: el gimnasio cuenta solo las visitas de gimnasio abiertas.
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

-- ---------- 4. Funciones que cambian de firma (checkin_manual, registrar_pago) ----------
drop function if exists public.checkin_manual(uuid, text);
create or replace function public.checkin_manual(p_id_cliente uuid, p_sede text default null,
                                                 p_servicio text default 'gimnasio', p_id_cita uuid default null)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r    json;
  v_ci public.citas;
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  if p_servicio not in ('gimnasio', 'sauna') then
    raise exception 'Servicio no válido.';
  end if;
  if p_sede is null or not exists (select 1 from public.sedes where sede = p_sede) then
    raise exception 'Sede no válida.';
  end if;

  if p_servicio = 'gimnasio' then
    r := public.entrar_gimnasio(p_id_cliente, p_sede, 'manual');
    if not (r->>'ok')::boolean then
      raise exception '%', r->>'motivo';
    end if;
    return r;
  end if;

  -- Sauna: marca la cita como asistida y deja una visita cerrada (no ocupa el aforo del gimnasio).
  select * into v_ci from public.citas where id_cita = p_id_cita;
  if not found or v_ci.id_cliente <> p_id_cliente or v_ci.servicio <> 'sauna' then
    raise exception 'La cita no existe.';
  end if;
  if v_ci.estado_asistencia = 'asistio' then
    raise exception 'La asistencia ya estaba registrada.';
  end if;
  if v_ci.estado_asistencia = 'cancelo' then
    raise exception 'La cita fue cancelada.';
  end if;
  update public.citas set estado_asistencia = 'asistio', marcada_en = now() where id_cita = p_id_cita;
  insert into public.checkins (id_cliente, sede, metodo, servicio, id_cita, salida_en)
  values (p_id_cliente, v_ci.sede, 'manual', 'sauna', p_id_cita, now());
  perform public.registrar_evento('checkins', 'checkin', p_id_cita, p_id_cliente,
                                  jsonb_build_object('servicio', 'sauna', 'metodo', 'manual'));
  return json_build_object('ok', true, 'sede', v_ci.sede);
end;
$$;
revoke all on function public.checkin_manual(uuid, text, text, uuid) from public, anon;
grant execute on function public.checkin_manual(uuid, text, text, uuid) to authenticated;

-- Cobro de membresía o de pase del día. El monto lo calcula el servidor (plan o tarifa).
-- Membresía: si aún está vigente, la nueva empieza al día siguiente de su fin. Devuelve el id de la membresía
-- (o del pago, para el pase del día).
drop function if exists public.registrar_pago(uuid, uuid, numeric, text);
create or replace function public.registrar_pago(p_id_cliente uuid, p_id_plan uuid default null,
                                                 p_monto numeric default null, p_medio text default 'efectivo',
                                                 p_concepto text default 'membresia')
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
  if p_concepto not in ('membresia', 'pase_dia') then
    raise exception 'Concepto no válido.';
  end if;
  if not exists (select 1 from public.clientes where id_cliente = p_id_cliente) then
    raise exception 'El cliente no existe.';
  end if;
  if p_medio not in ('efectivo', 'yape', 'plin') then
    raise exception 'Medio de pago no válido.';
  end if;

  if p_concepto = 'pase_dia' then
    v_monto := coalesce(p_monto, public.tarifa('pase_dia'));
    if v_monto is null or v_monto <= 0 then
      raise exception 'El monto debe ser mayor que cero.';
    end if;
    insert into public.pagos (id_cliente, concepto, monto, medio)
    values (p_id_cliente, 'pase_dia', v_monto, p_medio) returning id_pago into v_pago;
    perform public.registrar_evento('pagos', 'pago', v_pago, p_id_cliente,
                                    jsonb_build_object('concepto', 'pase_dia', 'monto', v_monto, 'medio', p_medio));
    return v_pago;
  end if;

  select * into p from public.planes where id_plan = p_id_plan and activo;
  if not found then
    raise exception 'El plan no existe o no está activo.';
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
  insert into public.pagos (id_cliente, id_membresia, concepto, monto, medio)
  values (p_id_cliente, v_mem, 'membresia', v_monto, p_medio) returning id_pago into v_pago;

  perform public.registrar_evento('membresias', 'pago', v_mem, p_id_cliente,
                                  jsonb_build_object('plan', p.nombre, 'monto', v_monto, 'medio', p_medio));
  return v_mem;
end;
$$;
revoke all on function public.registrar_pago(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.registrar_pago(uuid, uuid, numeric, text, text) to authenticated;

-- ---------- 5. Funciones de Recepción (solo personal) ----------
-- Búsqueda por DNI (8 dígitos), código de cliente (C-1001, C1001 o 1001) o nombre (sin tildes ni mayúsculas).
create or replace function public.buscar_cliente(p_texto text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t      text := trim(coalesce(p_texto, ''));
  v_cod  text;
  v_res  json;
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  if t = '' then
    return '[]'::json;
  end if;
  if t ~ '^[A-Za-z]{0,3}-?[0-9]{3,6}$' and t !~ '^[0-9]{8}$' then
    v_cod := 'C-' || regexp_replace(t, '^[A-Za-z]*-?', '');
  end if;

  select coalesce(json_agg(f order by f.nombre), '[]'::json) into v_res
  from (
    select c.id_cliente, c.nombre, c.dni, c.telefono, c.codigo_cliente,
           (select max(m.fin) from public.membresias m where m.id_cliente = c.id_cliente) as membresia_fin,
           (select max(k.entrada_en) from public.checkins k where k.id_cliente = c.id_cliente) as ultima_entrada,
           public.pase_hoy(c.id_cliente) as pase_hoy,
           coalesce((select json_agg(json_build_object('id_cita', ci.id_cita, 'fecha_hora_cita', ci.fecha_hora_cita,
                                                       'estado_pago', ci.estado_pago,
                                                       'estado_asistencia', ci.estado_asistencia)
                                     order by ci.fecha_hora_cita)
                    from public.citas ci
                    where ci.id_cliente = c.id_cliente and ci.servicio = 'sauna'
                      and (ci.fecha_hora_cita at time zone 'America/Lima')::date = public.hoy_lima()
                      and ci.estado_asistencia <> 'cancelo'), '[]'::json) as citas_hoy
    from public.clientes c
    where case
            when t ~ '^[0-9]{8}$' then c.dni = t
            when v_cod is not null then upper(c.codigo_cliente) = upper(v_cod)
            else translate(lower(c.nombre), 'áéíóúüñ', 'aeiouun') like '%' || translate(lower(t), 'áéíóúüñ', 'aeiouun') || '%'
          end
    order by c.nombre
    limit 8
  ) f;
  return v_res;
end;
$$;
revoke all on function public.buscar_cliente(text) from public, anon;
grant execute on function public.buscar_cliente(text) to authenticated;

create or replace function public.verificar_dni(p_dni text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.clientes;
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  select * into c from public.clientes where dni = trim(coalesce(p_dni, ''));
  if not found then
    return json_build_object('existe', false);
  end if;
  return json_build_object('existe', true, 'nombre', c.nombre, 'codigo_cliente', c.codigo_cliente);
end;
$$;
revoke all on function public.verificar_dni(text) from public, anon;
grant execute on function public.verificar_dni(text) to authenticated;

create or replace function public.registrar_cliente_asistido(p_nombre text, p_dni text, p_telefono text default null,
                                                             p_consentimiento boolean default false)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_dni    text := trim(coalesce(p_dni, ''));
  v_tel    text := nullif(trim(coalesce(p_telefono, '')), '');
  v_id     uuid;
  v_cod    text;
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  if char_length(v_nombre) < 3 then
    raise exception 'Falta el nombre';
  end if;
  if v_dni !~ '^[0-9]{8}$' then
    raise exception 'El DNI debe tener 8 dígitos';
  end if;
  if v_tel is not null and v_tel !~ '^[0-9]{9}$' then
    raise exception 'El teléfono debe tener 9 dígitos';
  end if;
  if p_consentimiento is distinct from true then
    raise exception 'Falta el consentimiento informado';
  end if;
  if exists (select 1 from public.clientes where dni = v_dni) then
    raise exception 'Ya existe un cliente con ese DNI';
  end if;
  insert into public.clientes (nombre, dni, telefono, consentimiento, asistido_en)
  values (v_nombre, v_dni, v_tel, true, now())
  returning id_cliente, codigo_cliente into v_id, v_cod;
  perform public.registrar_evento('clientes', 'registro_asistido', v_id, v_id, '{}'::jsonb);
  return json_build_object('id_cliente', v_id, 'codigo_cliente', v_cod);
end;
$$;
revoke all on function public.registrar_cliente_asistido(text, text, text, boolean) from public, anon;
grant execute on function public.registrar_cliente_asistido(text, text, text, boolean) to authenticated;

create or replace function public.registros_asistidos_hoy(p_limite int default 5)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return (select coalesce(json_agg(x), '[]'::json) from (
    select c.nombre, c.dni, c.codigo_cliente, c.asistido_en
    from public.clientes c
    where c.asistido_en is not null and (c.asistido_en at time zone 'America/Lima')::date = public.hoy_lima()
    order by c.asistido_en desc
    limit greatest(coalesce(p_limite, 5), 1)) x);
end;
$$;
revoke all on function public.registros_asistidos_hoy(int) from public, anon;
grant execute on function public.registros_asistidos_hoy(int) to authenticated;

create or replace function public.pagos_hoy(p_limite int default 30)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return (select coalesce(json_agg(x), '[]'::json) from (
    select p.id_pago, c.nombre, c.codigo_cliente as codigo, p.concepto, p.medio, p.monto, p.estado, p.pagado_en
    from public.pagos p
    join public.clientes c on c.id_cliente = p.id_cliente
    where (p.pagado_en at time zone 'America/Lima')::date = public.hoy_lima()
    order by p.pagado_en desc
    limit greatest(coalesce(p_limite, 30), 1)) x);
end;
$$;
revoke all on function public.pagos_hoy(int) from public, anon;
grant execute on function public.pagos_hoy(int) to authenticated;

create or replace function public.anular_pago(p_id_pago uuid, p_motivo text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p public.pagos;
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  if p_motivo is null or p_motivo not in ('Error al registrar el cobro', 'Operación duplicada de Yape/Plin',
                                          'El cliente desistió', 'Cambio de plan') then
    raise exception 'Falta el motivo de la anulación';
  end if;
  select * into p from public.pagos where id_pago = p_id_pago for update;
  if not found then
    raise exception 'Pago no encontrado';
  end if;
  if p.estado = 'anulado' then
    raise exception 'El pago ya estaba anulado';
  end if;
  update public.pagos
  set estado = 'anulado', motivo_anulacion = p_motivo, anulado_por = auth.uid(), anulado_en = now()
  where id_pago = p_id_pago;
  perform public.registrar_evento('pagos', 'anulacion', p_id_pago, p.id_cliente,
                                  jsonb_build_object('motivo', p_motivo, 'monto', p.monto, 'concepto', p.concepto));
  return true;
end;
$$;
revoke all on function public.anular_pago(uuid, text) from public, anon;
grant execute on function public.anular_pago(uuid, text) to authenticated;

create or replace function public.entradas_recientes(p_limite int default 5)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return (select coalesce(json_agg(x), '[]'::json) from (
    select c.nombre, c.dni, k.entrada_en, k.metodo, k.servicio,
           (select max(m.fin) from public.membresias m where m.id_cliente = c.id_cliente) as fin
    from public.checkins k
    join public.clientes c on c.id_cliente = k.id_cliente
    order by k.entrada_en desc
    limit greatest(coalesce(p_limite, 5), 1)) x);
end;
$$;
revoke all on function public.entradas_recientes(int) from public, anon;
grant execute on function public.entradas_recientes(int) to authenticated;

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

-- Afiliados con membresía vigente que no entran hace p_dias o más (o nunca entraron).
create or replace function public.afiliados_ausentes(p_dias int default 14)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return (select coalesce(json_agg(x order by x.ultima_visita nulls first), '[]'::json) from (
    select c.id_cliente, c.nombre, c.dni, c.codigo_cliente, c.telefono, v.fin,
           (select max(k.entrada_en) from public.checkins k where k.id_cliente = c.id_cliente) as ultima_visita
    from public.clientes c
    join lateral (select max(m.fin) as fin from public.membresias m
                  where m.id_cliente = c.id_cliente and m.inicio <= public.hoy_lima() and m.fin >= public.hoy_lima()) v
      on v.fin is not null
    where not exists (select 1 from public.checkins k
                      where k.id_cliente = c.id_cliente and k.entrada_en > now() - make_interval(days => coalesce(p_dias, 14)))
  ) x);
end;
$$;
revoke all on function public.afiliados_ausentes(int) from public, anon;
grant execute on function public.afiliados_ausentes(int) to authenticated;

-- Clientes con 3 o más pases del día no anulados: candidatos a membresía.
create or replace function public.oportunidades_conversion()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return (select coalesce(json_agg(x order by x.cuenta desc, x.nombre), '[]'::json) from (
    select c.id_cliente, c.nombre, count(*)::int as cuenta
    from public.pagos p join public.clientes c on c.id_cliente = p.id_cliente
    where p.concepto = 'pase_dia' and p.estado = 'registrado'
    group by c.id_cliente, c.nombre
    having count(*) >= 3) x);
end;
$$;
revoke all on function public.oportunidades_conversion() from public, anon;
grant execute on function public.oportunidades_conversion() to authenticated;

-- Membresías que vencen en p_dias o ya vencidas (solo la última de cada cliente, para no listar a quien ya renovó).
create or replace function public.renovaciones_lista(p_dias int default 7)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return (select coalesce(json_agg(x order by x.fin), '[]'::json) from (
    select c.id_cliente, c.nombre, c.dni, c.codigo_cliente, c.telefono, u.fin,
           (select max(k.entrada_en) from public.checkins k where k.id_cliente = c.id_cliente) as ultima_visita
    from (select m.id_cliente, max(m.fin) as fin from public.membresias m group by m.id_cliente) u
    join public.clientes c on c.id_cliente = u.id_cliente
    where u.fin <= public.hoy_lima() + coalesce(p_dias, 7)) x);
end;
$$;
revoke all on function public.renovaciones_lista(int) from public, anon;
grant execute on function public.renovaciones_lista(int) to authenticated;

create or replace function public.reservas_recepcion_hoy(p_limite int default 5)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  return (select coalesce(json_agg(x), '[]'::json) from (
    select c.nombre, ci.fecha_hora_cita, ci.tarifa_aplicada as tarifa, ci.estado_pago
    from public.citas ci join public.clientes c on c.id_cliente = ci.id_cliente
    where ci.servicio = 'sauna' and ci.origen = 'recepcion'
      and (ci.fecha_hora_registro at time zone 'America/Lima')::date = public.hoy_lima()
    order by ci.fecha_hora_registro desc
    limit greatest(coalesce(p_limite, 5), 1)) x);
end;
$$;
revoke all on function public.reservas_recepcion_hoy(int) from public, anon;
grant execute on function public.reservas_recepcion_hoy(int) to authenticated;

-- Reserva de sauna con cobro en una sola operación: la cita nace pagada; si no hay cupo, no se cobra.
create or replace function public.reservar_sauna_recepcion(p_id_cliente uuid, p_sede text,
                                                           p_fecha_hora timestamptz, p_medio text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_slot  timestamptz := date_trunc('hour', p_fecha_hora);
  v_local timestamp   := date_trunc('hour', p_fecha_hora) at time zone 'America/Lima';
  v_cli   public.clientes;
  s       public.sedes;
  v_cap   int;
  v_monto numeric;
  v_cita  uuid;
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  if p_medio not in ('efectivo', 'yape', 'plin') then
    raise exception 'Medio de pago no válido';
  end if;
  select * into v_cli from public.clientes where id_cliente = p_id_cliente;
  if not found then
    raise exception 'Cliente no encontrado';
  end if;
  if v_cli.estado <> 'activo' then
    raise exception 'La cuenta del cliente no está activa.';
  end if;
  select * into s from public.sedes where sede = p_sede;
  if not found then
    raise exception 'Sede no válida.';
  end if;
  if v_slot < date_trunc('hour', now()) then
    raise exception 'Ese turno ya pasó';
  end if;
  if v_slot > now() + interval '30 days' then
    raise exception 'Solo se puede reservar con hasta 30 días de anticipación.';
  end if;
  if v_local::time < s.abre or v_local::time >= s.cierra then
    raise exception 'Ese horario está fuera del horario de atención.';
  end if;

  -- Bloqueo por franja para que dos recepciones no superen el aforo a la vez.
  perform pg_advisory_xact_lock(hashtext('sauna|' || p_sede || '|' || v_slot::text));
  select capacidad into v_cap from public.aforos where servicio = 'sauna' and sede = p_sede;
  if (select count(*) from public.citas c
      where c.servicio = 'sauna' and c.sede = p_sede and c.estado_asistencia <> 'cancelo'
        and date_trunc('hour', c.fecha_hora_cita) = v_slot) >= coalesce(v_cap, 0) then
    raise exception 'Aforo máximo completado para esta franja horaria';
  end if;
  if exists (select 1 from public.citas c
             where c.id_cliente = p_id_cliente and c.servicio = 'sauna' and c.sede = p_sede
               and c.estado_asistencia <> 'cancelo' and date_trunc('hour', c.fecha_hora_cita) = v_slot) then
    raise exception 'El cliente ya tiene reserva en ese turno';
  end if;

  v_monto := case when public.membresia_vigente(p_id_cliente, v_local::date) is not null
                  then public.tarifa('sauna_afiliado') else public.tarifa('sauna_regular') end;

  insert into public.citas (id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia, registrado_por,
                            origen, estado_pago, tarifa_aplicada)
  values (p_id_cliente, 'sauna', p_sede, v_slot, 'pendiente', auth.uid(), 'recepcion', 'pagada', v_monto)
  returning id_cita into v_cita;
  insert into public.pagos (id_cliente, id_cita, concepto, monto, medio)
  values (p_id_cliente, v_cita, 'sauna', v_monto, p_medio);

  perform public.registrar_evento('citas', 'reserva_cobrada', v_cita, p_id_cliente,
                                  jsonb_build_object('sede', p_sede, 'monto', v_monto, 'medio', p_medio));
  return v_cita;
end;
$$;
revoke all on function public.reservar_sauna_recepcion(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.reservar_sauna_recepcion(uuid, text, timestamptz, text) to authenticated;
