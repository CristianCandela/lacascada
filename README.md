# La Cascada — Reservas y control de no-shows

Monorepo:
- `supabase/` base de datos (migraciones SQL, RLS, funciones) — **paso 1**
- `web/` frontend con componentes (React + Vite) — paso 2
- `ml/` modelo de predicción de no-shows en Python/scikit-learn — APF3 (pendiente)

## Paso 1 — Base de datos (Supabase)
1. Crea el proyecto en https://supabase.com/dashboard
2. SQL Editor → pega y ejecuta `supabase/migrations/20261011000000_esquema_inicial.sql`
3. Authentication → Users → crea 2 usuarios (Auto Confirm)
4. Edita los correos de `supabase/seed/01_usuarios.sql` y ejecútalo (deben salir 2 filas)
5. Ejecuta `supabase/seed/02_datos_ficticios.sql` (datos 100% ficticios)
6. Table Editor: verifica `perfiles` (2), `clientes` (30), `citas` (~126)

## Paso 2 — Frontend (web/)
```
cd web
cp .env.example .env     # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:5173
npm test                 # 10 pruebas de lógica
npm run test:e2e         # 15 pruebas de interfaz con Supabase simulado (requiere Playwright)
```
Componentes: `Login`, `Cabecera`, `FormularioReserva`, `Agenda`, `PanelNoShows`, `Aviso`.
Hook: `useSesion`. Lógica pura: `src/lib/logica.js`.

Despliegue en Vercel: importar el repositorio, *Root Directory* = `web`, variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
