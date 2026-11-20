-- RPC que faltaba en el contrato: reservas de sauna del cliente autenticado (más recientes primero).
create or replace function public.mis_reservas()
returns table (id_cita uuid, servicio text, sede text, fecha_hora_cita timestamptz, estado_asistencia text)
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
  select c.id_cita, c.servicio, c.sede, c.fecha_hora_cita, c.estado_asistencia
  from public.citas c
  where c.id_cliente = v_id and c.servicio = 'sauna'
  order by c.fecha_hora_cita desc
  limit 100;
end;
$$;
revoke all on function public.mis_reservas() from public, anon;
grant execute on function public.mis_reservas() to authenticated;
notify pgrst, 'reload schema';
