-- =====================================================================
-- Registro del cliente con fecha de nacimiento, perfil con foto y pago de membresía
-- por el propio cliente (Visa, Yape o Plin). Respalda las pantallas de la rama
-- feat/cliente-perfil-edad (Registro.jsx, MiPerfil.jsx, MiMembresia.jsx).
-- Idempotente: se puede ejecutar más de una vez.
-- NOTA: el cobro es simulado (no hay pasarela de pago); solo registra el pago.
-- =====================================================================

-- ---------- 0. Bitácora: tablas y acciones que ya usan las funciones de recepción ----------
-- Sin esto fallan anular_pago, el cobro del pase del día, el registro asistido y la reserva cobrada
-- con "bitacora_accion_check" / "bitacora_tabla_check".
alter table public.bitacora drop constraint if exists bitacora_tabla_check;
alter table public.bitacora add constraint bitacora_tabla_check
  check (tabla in ('citas', 'solicitudes', 'clientes', 'checkins', 'membresias', 'pagos'));
alter table public.bitacora drop constraint if exists bitacora_accion_check;
alter table public.bitacora add constraint bitacora_accion_check
  check (accion in ('crear', 'marcar', 'reabrir', 'recordar', 'confirmar', 'editar', 'eliminar',
                    'solicitar', 'aprobar', 'rechazar',
                    'autoregistro', 'checkin', 'checkout', 'pago', 'motivo_ausencia',
                    'anulacion', 'reserva_cobrada', 'registro_asistido'));

-- ---------- 1. Columnas nuevas ----------
alter table public.clientes
  add column if not exists fecha_nacimiento date,
  add column if not exists foto_url text;

alter table public.clientes drop constraint if exists clientes_foto_tam_check;
alter table public.clientes add constraint clientes_foto_tam_check
  check (foto_url is null or char_length(foto_url) <= 3000000);

alter table public.clientes drop constraint if exists clientes_fecha_nac_check;
alter table public.clientes add constraint clientes_fecha_nac_check
  check (fecha_nacimiento is null or fecha_nacimiento >= date '1900-01-01');

-- El cliente puede pagar con Visa además de efectivo, Yape y Plin.
alter table public.pagos drop constraint if exists pagos_medio_check;
alter table public.pagos add constraint pagos_medio_check
  check (medio in ('efectivo', 'yape', 'plin', 'visa'));

-- Mayoría de edad (18 años cumplidos al día de hoy en Lima).
create or replace function public.es_mayor_de_edad(p_fecha date)
returns boolean
language sql
stable
as $$
  select p_fecha is not null and p_fecha <= (public.hoy_lima() - interval '18 years')::date
$$;

-- ---------- 2. Registro propio (sin código del local, con fecha de nacimiento) ----------
-- Reemplaza a la versión anterior (con p_codigo_local), que el frontend ya no usa.
drop function if exists public.registrar_cliente(text, text, text, text, boolean);
create or replace function public.registrar_cliente(p_nombre text, p_dni text, p_telefono text,
                                                    p_fecha_nacimiento date, p_consentimiento boolean)
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
  if p_consentimiento is distinct from true then
    return json_build_object('ok', false, 'motivo', 'Debes aceptar el tratamiento de tus datos personales.');
  end if;
  if char_length(trim(coalesce(p_nombre, ''))) < 3 then
    return json_build_object('ok', false, 'motivo', 'Escribe tu nombre completo.');
  end if;
  if coalesce(p_dni, '') !~ '^[0-9]{8}$' or coalesce(p_telefono, '') !~ '^[0-9]{9}$' then
    return json_build_object('ok', false, 'motivo', 'DNI (8 dígitos) o teléfono (9 dígitos) con formato inválido.');
  end if;
  if p_fecha_nacimiento is null then
    return json_build_object('ok', false, 'motivo', 'Ingresa tu fecha de nacimiento.');
  end if;
  if not public.es_mayor_de_edad(p_fecha_nacimiento) then
    perform public.anotar_intento(false);
    return json_build_object('ok', false, 'motivo', 'Debes ser mayor de edad');
  end if;

  select * into v_existente from public.clientes where dni = p_dni for update;
  if found then
    if v_existente.id_usuario is not null then
      perform public.anotar_intento(false);
      return json_build_object('ok', false, 'motivo', 'Ese DNI ya está registrado con otra cuenta.');
    end if;
    if v_existente.telefono <> p_telefono then
      perform public.anotar_intento(false);
      return json_build_object('ok', false, 'motivo', 'Los datos no coinciden con un registro existente. Acude a recepción.');
    end if;
    update public.clientes
       set id_usuario = auth.uid(),
           fecha_nacimiento = coalesce(fecha_nacimiento, p_fecha_nacimiento)
     where id_cliente = v_existente.id_cliente;
    v_id := v_existente.id_cliente;
  else
    insert into public.clientes (nombre, dni, telefono, fecha_nacimiento, consentimiento, id_usuario)
    values (trim(p_nombre), p_dni, p_telefono, p_fecha_nacimiento, true, auth.uid())
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
revoke all on function public.registrar_cliente(text, text, text, date, boolean) from public, anon;
grant execute on function public.registrar_cliente(text, text, text, date, boolean) to authenticated;

-- ---------- 3. Datos y perfil del cliente ----------
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
                                   'consentimiento', consentimiento, 'fecha_consentimiento', fecha_consentimiento,
                                   'fecha_nacimiento', fecha_nacimiento, 'foto_url', coalesce(foto_url, ''))
          from public.clientes where id_cliente = v_id);
end;
$$;
revoke all on function public.mis_datos() from public, anon;
grant execute on function public.mis_datos() to authenticated;

-- Parámetro null = no cambia; '' = borra (foto) o deja vacía (fecha).
create or replace function public.actualizar_mi_perfil(p_fecha_nacimiento text default null,
                                                       p_foto_url text default null)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id    uuid := public.id_cliente_actual();
  v_fecha date;
begin
  if public.rol_actual() is distinct from 'cliente' or v_id is null then
    raise exception 'Acceso denegado: solo los clientes' using errcode = '42501';
  end if;

  if p_fecha_nacimiento is not null and trim(p_fecha_nacimiento) <> '' then
    if trim(p_fecha_nacimiento) !~ '^\d{4}-\d{2}-\d{2}$' then
      return json_build_object('ok', false, 'motivo', 'Formato de fecha de nacimiento no válido.');
    end if;
    begin
      v_fecha := trim(p_fecha_nacimiento)::date;
    exception when others then
      return json_build_object('ok', false, 'motivo', 'Formato de fecha de nacimiento no válido.');
    end;
    if not public.es_mayor_de_edad(v_fecha) then
      return json_build_object('ok', false, 'motivo', 'Debes ser mayor de edad');
    end if;
    update public.clientes set fecha_nacimiento = v_fecha where id_cliente = v_id;
  end if;

  if p_foto_url is not null then
    if char_length(p_foto_url) > 3000000 then
      return json_build_object('ok', false, 'motivo', 'La imagen es demasiado grande.');
    end if;
    update public.clientes set foto_url = nullif(p_foto_url, '') where id_cliente = v_id;
  end if;

  perform public.registrar_evento('clientes', 'editar', v_id, v_id,
                                  jsonb_build_object('fecha_nacimiento', p_fecha_nacimiento is not null,
                                                     'foto', p_foto_url is not null));
  return (select json_build_object('ok', true,
                                   'fecha_nacimiento', coalesce(fecha_nacimiento::text, ''),
                                   'foto_url', coalesce(foto_url, ''))
          from public.clientes where id_cliente = v_id);
end;
$$;
revoke all on function public.actualizar_mi_perfil(text, text) from public, anon;
grant execute on function public.actualizar_mi_perfil(text, text) to authenticated;

-- ---------- 4. Pago de membresía por el propio cliente ----------
-- Una sola membresía vigente a la vez. El monto lo fija el plan en el servidor.
create or replace function public.pagar_membresia(p_id_plan uuid, p_medio text default 'visa')
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id     uuid := public.id_cliente_actual();
  v_medio  text := lower(trim(coalesce(p_medio, 'visa')));
  v_estado text;
  p        public.planes;
  v_ini    date := public.hoy_lima();
  v_mem    uuid;
  v_pago   uuid;
begin
  if public.rol_actual() is distinct from 'cliente' or v_id is null then
    raise exception 'Acceso denegado: solo los clientes' using errcode = '42501';
  end if;
  select estado into v_estado from public.clientes where id_cliente = v_id;
  if v_estado is distinct from 'activo' then
    return json_build_object('ok', false, 'motivo', 'Tu cuenta no está activa.');
  end if;
  if v_medio not in ('visa', 'yape', 'plin') then
    return json_build_object('ok', false, 'motivo', 'Selecciona una opción de pago válida (Visa, Yape o Plin).');
  end if;
  if public.membresia_vigente(v_id) is not null then
    return json_build_object('ok', false, 'motivo', 'Solo puedes tener 1 membresía vigente a la vez.');
  end if;
  select * into p from public.planes where id_plan = p_id_plan and activo;
  if not found then
    return json_build_object('ok', false, 'motivo', 'El plan seleccionado no está disponible.');
  end if;

  insert into public.membresias (id_cliente, id_plan, inicio, fin)
  values (v_id, p.id_plan, v_ini, v_ini + p.dias - 1)
  returning id_membresia into v_mem;
  insert into public.pagos (id_cliente, id_membresia, concepto, monto, medio)
  values (v_id, v_mem, 'membresia', p.precio, v_medio)
  returning id_pago into v_pago;

  perform public.registrar_evento('membresias', 'pago', v_mem, v_id,
                                  jsonb_build_object('plan', p.nombre, 'monto', p.precio, 'medio', v_medio));
  return json_build_object('ok', true, 'id_membresia', v_mem, 'plan', p.nombre, 'medio', v_medio,
                           'inicio', v_ini, 'fin', v_ini + p.dias - 1);
end;
$$;
revoke all on function public.pagar_membresia(uuid, text) from public, anon;
grant execute on function public.pagar_membresia(uuid, text) to authenticated;

-- ---------- 5. Anular un cobro de membresía también retira esa membresía ----------
-- Antes anular_pago solo marcaba el pago y la membresía seguía vigente. Ahora el pago anulado
-- conserva su registro (cliente, monto, motivo) pero sin membresía asociada.
do $$
declare r record;
begin
  for r in select c.conname from pg_constraint c
           where c.conrelid = 'public.pagos'::regclass and c.contype = 'f'
             and c.confrelid = 'public.membresias'::regclass loop
    execute format('alter table public.pagos drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.pagos add constraint pagos_id_membresia_fkey
  foreign key (id_membresia) references public.membresias(id_membresia) on delete set null;

alter table public.pagos drop constraint if exists pagos_membresia_check;
alter table public.pagos add constraint pagos_membresia_check
  check (concepto <> 'membresia' or id_membresia is not null or estado = 'anulado');

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
  -- Retira la membresía cobrada (el pago queda con id_membresia nulo por la clave foránea).
  if p.concepto = 'membresia' and p.id_membresia is not null
     and not exists (select 1 from public.pagos x
                     where x.id_membresia = p.id_membresia and x.id_pago <> p.id_pago and x.estado = 'registrado') then
    delete from public.membresias where id_membresia = p.id_membresia;
  end if;
  perform public.registrar_evento('pagos', 'anulacion', p_id_pago, p.id_cliente,
                                  jsonb_build_object('motivo', p_motivo, 'monto', p.monto, 'concepto', p.concepto));
  return true;
end;
$$;
revoke all on function public.anular_pago(uuid, text) from public, anon;
grant execute on function public.anular_pago(uuid, text) to authenticated;

-- Reparación: membresías cuyo cobro ya fue anulado antes de este cambio (siguen vigentes por error).
delete from public.membresias m
where exists (select 1 from public.pagos x where x.id_membresia = m.id_membresia and x.estado = 'anulado')
  and not exists (select 1 from public.pagos x where x.id_membresia = m.id_membresia and x.estado = 'registrado');

notify pgrst, 'reload schema';
