update public.citas c
set fecha_hora_cita = c.fecha_hora_cita - interval '1 day'
from public.clientes k
where k.id_cliente = c.id_cliente
<<<<<<< HEAD
  and k.dni in ('50034812', '69267187', '67040737');
=======
  and k.dni in ('50034812', '69267187', '67040737');
>>>>>>> 1a52b6687f0cd954fd83ea34a090776744cccec6
