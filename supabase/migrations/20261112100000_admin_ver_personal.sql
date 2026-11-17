-- El administrador puede ver los perfiles del personal (pantalla «Personal» del módulo admin).
-- Hasta ahora cada usuario solo veía su propio perfil.
-- Los clientes siguen sin poder ver perfiles ajenos. Repetible.
drop policy if exists perfiles_admin_ver on public.perfiles;
create policy perfiles_admin_ver on public.perfiles
  for select to authenticated
  using (public.rol_actual() = 'administrador');
