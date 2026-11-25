-- =====================================================================
-- Cobro de la reserva de sauna hecha por el cliente (pago en recepción).
--  * reservar_sauna: la cita nace con estado_pago = 'pendiente' y la tarifa de afiliado
--    (reservar exige membresía vigente). El monto lo calcula el servidor.
--  * mis_reservas: ahora devuelve estado_pago y tarifa_aplicada para mostrarlos al cliente.
--  * buscar_cliente: las citas de hoy incluyen tarifa_aplicada (para mostrar cuánto cobrar).
--  * cobrar_cita_sauna(p_id_cita, p_medio): recepción/admin cobra la cita pendiente (efectivo, yape o plin),
--    registra el pago y marca la cita como pagada.
--  * Las citas futuras ya creadas por clientes sin pago registrado pasan a 'pendiente' con su tarifa.
--  * Los ingresos del día solo cuentan citas 'pagada' (ya era así), por lo que lo pendiente no suma.
-- Tarifas de ejemplo en la tabla `tarifas`: ajustar a las reales.
-- =====================================================================

-- ---------- reservar_sauna (cliente): nace pendiente de pago ----------
-- Reserva de sauna del propio cliente (franja de una hora). Queda con el pago PENDIENTE: se cobra en recepción. El aforo y los duplicados
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

  insert into public.citas (id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia, registrado_por, origen,
                            estado_pago, tarifa_aplicada)
  values (v_id, 'sauna', p_sede, v_slot, 'pendiente', auth.uid(), 'cliente',
          'pendiente', public.tarifa('sauna_afiliado'))
  returning id_cita into v_cita;
  return v_cita;
end;
$$;
revoke all on function public.reservar_sauna(text, timestamptz) from public, anon;
grant execute on function public.reservar_sauna(text, timestamptz) to authenticated;


-- ---------- buscar_cliente: incluye tarifa_aplicada en las citas de hoy ----------
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
                                                       'estado_pago', ci.estado_pago, 'tarifa_aplicada', ci.tarifa_aplicada,
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

-- ---------- Citas ya creadas por clientes sin cobro registrado ----------
update public.citas c
set estado_pago = 'pendiente', tarifa_aplicada = public.tarifa('sauna_afiliado')
where c.origen = 'cliente' and c.servicio = 'sauna' and c.estado_pago = 'pagada' and c.tarifa_aplicada is null
  and c.estado_asistencia = 'pendiente' and c.fecha_hora_cita > now()
  and not exists (select 1 from public.pagos p where p.id_cita = c.id_cita);

-- ---------- mis_reservas con datos de pago (cambia el tipo de retorno: se recrea) ----------
drop function if exists public.mis_reservas();
create or replace function public.mis_reservas()
returns table (id_cita uuid, servicio text, sede text, fecha_hora_cita timestamptz, estado_asistencia text,
               estado_pago text, tarifa_aplicada numeric)
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
  select c.id_cita, c.servicio, c.sede, c.fecha_hora_cita, c.estado_asistencia, c.estado_pago, c.tarifa_aplicada
  from public.citas c
  where c.id_cliente = v_id and c.servicio = 'sauna'
  order by c.fecha_hora_cita desc
  limit 100;
end;
$$;
revoke all on function public.mis_reservas() from public, anon;
grant execute on function public.mis_reservas() to authenticated;

-- ---------- Cobro en recepción ----------
create or replace function public.cobrar_cita_sauna(p_id_cita uuid, p_medio text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ci    public.citas;
  v_monto numeric;
  v_pago  uuid;
begin
  if not public.es_personal() then
    raise exception 'Acceso denegado: solo el personal' using errcode = '42501';
  end if;
  if p_medio not in ('efectivo', 'yape', 'plin') then
    raise exception 'Medio de pago no válido';
  end if;
  select * into v_ci from public.citas where id_cita = p_id_cita for update;
  if not found or v_ci.servicio <> 'sauna' then
    raise exception 'La cita no existe.';
  end if;
  if v_ci.estado_asistencia = 'cancelo' then
    raise exception 'La cita fue cancelada.';
  end if;
  if v_ci.estado_pago = 'pagada' then
    raise exception 'La cita ya está pagada.';
  end if;
  v_monto := coalesce(v_ci.tarifa_aplicada, public.tarifa('sauna_regular'));
  insert into public.pagos (id_cliente, id_cita, concepto, monto, medio)
  values (v_ci.id_cliente, p_id_cita, 'sauna', v_monto, p_medio)
  returning id_pago into v_pago;
  update public.citas set estado_pago = 'pagada', tarifa_aplicada = v_monto where id_cita = p_id_cita;
  perform public.registrar_evento('pagos', 'pago', v_pago, v_ci.id_cliente,
                                  jsonb_build_object('concepto', 'sauna', 'monto', v_monto, 'medio', p_medio, 'id_cita', p_id_cita));
  return json_build_object('ok', true, 'monto', v_monto, 'medio', p_medio);
end;
$$;
revoke all on function public.cobrar_cita_sauna(uuid, text) from public, anon;
grant execute on function public.cobrar_cita_sauna(uuid, text) to authenticated;

notify pgrst, 'reload schema';
