-- =====================================================================
-- Cancelación de una reserva de sauna ya pagada: reembolso simulado.
--  * Cancelar con 2 horas o más de anticipación: reembolso completo. El pago pasa a 'anulado'
--    (el cuadre y los ingresos lo ignoran), la cita queda con estado_pago = 'reembolsada' y se
--    deja la anulación en la bitácora. Es un reembolso SIMULADO: no se devuelve dinero real.
--  * Cancelar con menos de 2 horas: la cita se cancela, el cupo se libera, pero el pago se retiene.
--  * Sin pago registrado (pendiente): se cancela como antes.
-- El plazo de 2 horas es una política propuesta: confirmarla con el negocio y, si cambia,
-- modificar solo el intervalo de esta función.
-- Ejecutar después de 20261126000000_pago_simulado_ingresos.sql.
-- =====================================================================

-- citas.estado_pago admite ahora 'reembolsada' (se busca la restricción por contenido, sin depender de su nombre).
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.citas'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%estado_pago%' loop
    execute format('alter table public.citas drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.citas add constraint citas_estado_pago_check
  check (estado_pago in ('pagada', 'pendiente', 'reembolsada'));

create or replace function public.cancelar_reserva(p_id_cita uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id   uuid := public.id_cliente_actual();
  c      public.citas;
  v_pago public.pagos;
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

  if c.estado_pago = 'pagada' then
    select * into v_pago from public.pagos
    where id_cita = c.id_cita and concepto = 'sauna' and estado = 'registrado'
    order by pagado_en desc limit 1;
  end if;

  if v_pago.id_pago is not null and c.fecha_hora_cita - now() >= interval '2 hours' then
    -- Reembolso completo (simulado)
    update public.pagos
    set estado = 'anulado', motivo_anulacion = 'Cancelación del cliente (reembolso)',
        anulado_por = auth.uid(), anulado_en = now()
    where id_pago = v_pago.id_pago;
    update public.citas
    set estado_asistencia = 'cancelo', marcada_en = now(), estado_pago = 'reembolsada'
    where id_cita = c.id_cita;
    perform public.registrar_evento('pagos', 'anulacion', v_pago.id_pago, v_id,
                                    jsonb_build_object('motivo', 'Cancelación del cliente (reembolso)', 'monto', v_pago.monto,
                                                       'concepto', 'sauna', 'id_cita', c.id_cita));
    return json_build_object('ok', true, 'reembolso', true, 'monto', v_pago.monto, 'medio', v_pago.medio);
  end if;

  update public.citas set estado_asistencia = 'cancelo', marcada_en = now() where id_cita = c.id_cita;
  if v_pago.id_pago is not null then
    -- Cancelación tardía: el pago se retiene
    return json_build_object('ok', true, 'reembolso', false, 'monto', v_pago.monto, 'medio', v_pago.medio);
  end if;
  return json_build_object('ok', true, 'reembolso', false);
end;
$$;
revoke all on function public.cancelar_reserva(uuid) from public, anon;
grant execute on function public.cancelar_reserva(uuid) to authenticated;

notify pgrst, 'reload schema';
