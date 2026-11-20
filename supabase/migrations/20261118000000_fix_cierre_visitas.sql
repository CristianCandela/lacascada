-- Corrige cerrar_visitas_vencidas(): si una visita abierta empezó DESPUÉS de la hora de cierre
-- (p. ej. datos de demostración cargados de noche), la salida calculada quedaba antes de la entrada
-- y violaba checkins_check. Ahora la salida nunca es menor que la entrada.
create or replace function public.cerrar_visitas_vencidas()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.checkins c
  set salida_en = greatest(
        c.entrada_en,
        (((c.entrada_en at time zone 'America/Lima')::date + s.cierra) at time zone 'America/Lima')),
      cierre_automatico = true
  from public.sedes s
  where s.sede = c.sede and c.salida_en is null
    and now() > (((c.entrada_en at time zone 'America/Lima')::date + s.cierra) at time zone 'America/Lima')
$$;
revoke all on function public.cerrar_visitas_vencidas() from public, anon, authenticated;

-- Cierra ya las visitas abiertas que quedaron pendientes.
select public.cerrar_visitas_vencidas();
select count(*) as visitas_abiertas from public.checkins where salida_en is null;

-- resumen_dia y resumen_completo llaman a funciones que escriben (cierre automático),
-- por lo que no pueden ser STABLE (error "cannot execute SELECT in a read-only transaction").
alter function public.resumen_dia(text) volatile;
alter function public.resumen_completo(text) volatile;
