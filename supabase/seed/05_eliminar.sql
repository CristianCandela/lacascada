delete from public.citas
where id_cliente not in (
  select id_cliente from public.clientes
  where fecha_consentimiento in (timestamptz '2026-10-05 10:00-05',
                                 timestamptz '2026-10-05 10:00:30-05')
);

delete from public.clientes
where fecha_consentimiento not in (timestamptz '2026-10-05 10:00-05',
                                   timestamptz '2026-10-05 10:00:30-05')
  and id_cliente not in (select id_cliente from public.citas);
