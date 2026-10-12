-- =====================================================================
-- Paso 2: asignar rol a los 2 usuarios de prueba.
--
-- ANTES de ejecutar esto, crea los usuarios en:
--   Supabase > Authentication > Users > Add user > Create new user
--   (marca "Auto Confirm User" y define una contraseña simple)
--
-- Luego cambia los dos correos de abajo por los que creaste y ejecuta.
-- =====================================================================

insert into public.perfiles (id, nombre, rol)
select id, 'Recepcionista de prueba', 'recepcionista'
from auth.users
where email = 'recepcion@example.com'      -- <-- cambia por tu correo
on conflict (id) do update set rol = excluded.rol, nombre = excluded.nombre;

insert into public.perfiles (id, nombre, rol)
select id, 'Administrador de prueba', 'administrador'
from auth.users
where email = 'admin@example.com'          -- <-- cambia por tu correo
on conflict (id) do update set rol = excluded.rol, nombre = excluded.nombre;

-- Verifica: deben salir 2 filas.
select p.nombre, p.rol, u.email
from public.perfiles p join auth.users u on u.id = p.id;
