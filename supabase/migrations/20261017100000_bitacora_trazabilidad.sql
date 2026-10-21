create table if not exists public.bitacora (
  id_evento    bigint generated always as identity primary key,
  ocurrido_en  timestamptz not null default now(),
  id_usuario   uuid,
  tabla        text not null check (tabla in ('citas', 'solicitudes')),
  accion       text not null check (accion in
                 ('crear', 'marcar', 'reabrir', 'recordar', 'confirmar', 'editar', 'eliminar',
                  'solicitar', 'aprobar', 'rechazar')),
  id_registro  uuid not null,
  id_cliente   uuid,
  detalle      jsonb not null default '{}'::jsonb
);

create index if not exists bitacora_ocurrido_idx on public.bitacora (ocurrido_en desc);
create index if not exists bitacora_registro_idx on public.bitacora (id_registro);

alter table public.bitacora enable row level security;
revoke all on public.bitacora from anon, authenticated;

create or replace function public.es_accion_de_app()
returns boolean
language sql
stable
as $$
  select coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           nullif(current_setting('request.jwt.claim.role', true), ''),
           ''
         ) in ('anon', 'authenticated')
$$;

create or replace function public.bitacora_citas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accion  text;
  v_detalle jsonb;
begin
  if not public.es_accion_de_app() then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_accion := 'crear';
    v_detalle := jsonb_build_object(
      'servicio', new.servicio, 'sede', new.sede,
      'fecha_hora_cita', new.fecha_hora_cita, 'estado', new.estado_asistencia);
    insert into public.bitacora (id_usuario, tabla, accion, id_registro, id_cliente, detalle)
    values (auth.uid(), 'citas', v_accion, new.id_cita, new.id_cliente, v_detalle);

  elsif tg_op = 'UPDATE' then
    if new.estado_asistencia is distinct from old.estado_asistencia then
      v_accion := case when new.estado_asistencia = 'pendiente' then 'reabrir' else 'marcar' end;
      v_detalle := jsonb_build_object(
        'antes', old.estado_asistencia, 'despues', new.estado_asistencia,
        'segundos_registro', new.segundos_registro);
    elsif new.recordatorio_enviado_en is not null
          and new.recordatorio_enviado_en is distinct from old.recordatorio_enviado_en then
      v_accion := 'recordar';
      v_detalle := jsonb_build_object('canal', 'whatsapp');
    elsif new.confirmada_en is not null
          and new.confirmada_en is distinct from old.confirmada_en then
      v_accion := 'confirmar';
      v_detalle := '{}'::jsonb;
    elsif new.fecha_hora_cita is distinct from old.fecha_hora_cita
          or new.servicio is distinct from old.servicio
          or new.sede is distinct from old.sede then
      v_accion := 'editar';
      v_detalle := jsonb_build_object(
        'antes', jsonb_build_object('servicio', old.servicio, 'sede', old.sede, 'fecha_hora_cita', old.fecha_hora_cita),
        'despues', jsonb_build_object('servicio', new.servicio, 'sede', new.sede, 'fecha_hora_cita', new.fecha_hora_cita));
    else
      return null;
    end if;
    insert into public.bitacora (id_usuario, tabla, accion, id_registro, id_cliente, detalle)
    values (auth.uid(), 'citas', v_accion, new.id_cita, new.id_cliente, v_detalle);

  else
    v_detalle := jsonb_build_object(
      'servicio', old.servicio, 'sede', old.sede,
      'fecha_hora_cita', old.fecha_hora_cita, 'estado', old.estado_asistencia);
    insert into public.bitacora (id_usuario, tabla, accion, id_registro, id_cliente, detalle)
    values (auth.uid(), 'citas', 'eliminar', old.id_cita, old.id_cliente, v_detalle);
  end if;

  return null;
end
$$;

drop trigger if exists citas_bitacora on public.citas;
create trigger citas_bitacora
  after insert or update or delete on public.citas
  for each row execute function public.bitacora_citas();

create or replace function public.bitacora_solicitudes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_accion_de_app() then
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.bitacora (id_usuario, tabla, accion, id_registro, detalle)
    values (auth.uid(), 'solicitudes', 'solicitar', new.id_solicitud,
            jsonb_build_object('servicio', new.servicio, 'sede', new.sede,
                               'fecha_hora_preferida', new.fecha_hora_preferida));
  elsif new.estado is distinct from old.estado and new.estado in ('aprobada', 'rechazada') then
    insert into public.bitacora (id_usuario, tabla, accion, id_registro, detalle)
    values (auth.uid(), 'solicitudes',
            case new.estado when 'aprobada' then 'aprobar' else 'rechazar' end,
            new.id_solicitud,
            jsonb_build_object('servicio', new.servicio, 'sede', new.sede,
                               'fecha_hora_preferida', new.fecha_hora_preferida));
  end if;
  return null;
end
$$;

drop trigger if exists solicitudes_bitacora on public.solicitudes;
create trigger solicitudes_bitacora
  after insert or update on public.solicitudes
  for each row execute function public.bitacora_solicitudes();

create or replace function public.bitacora_reciente(p_limite int default 200, p_accion text default null)
returns table (
  id_evento   bigint,
  ocurrido_en timestamptz,
  usuario     text,
  rol         text,
  tabla       text,
  accion      text,
  id_registro uuid,
  cliente     text,
  detalle     jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.rol_actual() is distinct from 'administrador' then
    raise exception 'Acceso denegado: solo el administrador puede ver la trazabilidad'
      using errcode = '42501';
  end if;

  return query
  select b.id_evento,
         b.ocurrido_en,
         case when b.id_usuario is null then 'Cliente (página pública)'
              else coalesce(p.nombre, 'Usuario eliminado') end,
         p.rol,
         b.tabla,
         b.accion,
         b.id_registro,
         coalesce(c.nombre, s.nombre),
         b.detalle
  from public.bitacora b
  left join public.perfiles    p on p.id = b.id_usuario
  left join public.clientes    c on c.id_cliente = b.id_cliente
  left join public.solicitudes s on b.tabla = 'solicitudes' and s.id_solicitud = b.id_registro
  where p_accion is null or b.accion = p_accion
  order by b.ocurrido_en desc, b.id_evento desc
  limit least(greatest(coalesce(p_limite, 200), 1), 500);
end
$$;

revoke all on function public.bitacora_reciente(int, text) from public, anon;
grant execute on function public.bitacora_reciente(int, text) to authenticated;
revoke all on function public.es_accion_de_app() from public, anon;