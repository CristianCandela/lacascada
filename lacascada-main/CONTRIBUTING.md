# Guía de trabajo en equipo

Equipo: Cristian (público + núcleo e integración), Abel (cliente), Leticia (recepción), Dennis (administración).
Cada uno trabaja en **su carpeta** para no pisarse. Tareas por persona: `docs/ASIGNACIONES.md`. Datos y funciones del servidor: `docs/CONTRATO_DATOS.md`.

## 1. Instalación (una vez)
```
git clone https://github.com/CristianCandela/lacascada.git
cd lacascada/web
npm install
npm run dev:mock      # abre http://localhost:5173 con datos simulados: no necesita Supabase ni .env
```
Cuentas del modo simulado (clave `demo123`): `recepcion@demo.test`, `admin@demo.test`, `cliente@demo.test`.
Para usar Supabase real: copia `.env.example` como `.env` y pide las claves a Cristian. Nunca subas `.env` ni la llave `service_role`.

## 2. Dónde va cada cosa
| Qué | Dónde | Quién edita |
|---|---|---|
| Pantallas de un rol | `web/src/features/<rol>/` (`.jsx`) | Dueño del rol |
| Menú y rutas del rol | `web/src/features/<rol>/index.js` | Dueño del rol |
| Estilos del rol | `web/src/features/<rol>/estilos.css` (clases con prefijo `cli-`, `rec-`, `adm-`, `pub-`) | Dueño del rol |
| Lógica pura | `web/src/features/<rol>/logica.js` + `web/tests/<rol>.test.js` | Dueño del rol |
| Simulación del servidor | `web/src/features/<rol>/mock.js` | Dueño del rol |
| Pruebas de interfaz | `web/tests/e2e/<rol>.mjs` | Dueño del rol |
| `App.jsx`, `styles.css`, `lib/`, `hooks/`, `mock/`, `components/` compartidos (Iconos, Aviso, Cabecera, Login, CamposReserva) | núcleo | **Solo Cristian**; los demás piden el cambio por Pull Request o en el grupo |
| Migraciones SQL | `supabase/migrations/` | **Solo Cristian** |

Cómo añadir una pantalla: crea `MiPantalla.jsx` en tu carpeta, impórtala en tu `index.js` y agrégala a `modulos`
(`{ id, texto, icono, roles, Componente }`). El menú la muestra solo a los roles indicados. No hace falta tocar `App.jsx`.
Cada pantalla recibe `perfil` y `onAviso(mensaje, tipo)`. Íconos disponibles: `web/src/components/Iconos.jsx`.

## 3. Flujo de Git
1. `main` está protegida: no se hace push directo.
2. Antes de empezar: `git checkout main && git pull`.
3. Crea una rama por tarea: `git checkout -b feature/abel-mis-reservas` (formato `feature/<nombre>-<tema>`).
4. Commits pequeños y claros: `git commit -m "HU-C3: reservar turno de sauna"`.
5. Sube la rama: `git push -u origin feature/abel-mis-reservas` y abre un Pull Request hacia `main`.
6. Completa la plantilla del PR. Vercel crea una URL de vista previa para revisar sin desplegar.
7. Revisa el dueño de carpeta o Cristian. Cuando se aprueba, se hace **Squash and merge**.
8. Si `main` cambió mientras trabajabas: `git fetch && git merge origin/main` en tu rama y resuelve conflictos antes del PR.

Configuración de GitHub (Cristian, una vez): Settings → Branches → Add rule para `main`:
*Require a pull request before merging*, *Require approvals = 1*, *Require review from Code Owners*.
Settings → Collaborators: agregar a Abel, Leticia y Dennis con rol *Write*. Luego reemplazar los `@USUARIO-...` de `.github/CODEOWNERS`.

## 4. Reglas del proyecto
- **Datos 100 % ficticios** en pantallas, pruebas y capturas. La empresa no autorizó datos reales.
- **Sin secretos**: no subir `.env`, claves ni `service_role`. Solo la anon key va en el frontend.
- **Seguridad en el servidor**: lo que debe protegerse se hace con RLS y funciones RPC, no solo ocultando botones.
- **IA declarada**: cada prompt a una IA se anota en el Anexo C (prompt, para qué, qué se corrigió). Código o texto con IA no declarado resta puntos.
- **Pruebas**: antes de abrir el PR, `npm test` y `npm run test:e2e` deben pasar. Cada historia nueva trae al menos una prueba.
- **Tablas o funciones nuevas en Supabase**: se piden en `docs/CONTRATO_DATOS.md`; Cristian crea la migración. Mientras tanto se programa contra `mock.js`.
- Cambios en archivos compartidos (`App.jsx`, `styles.css`, `lib/`): pídelos en el grupo o en un PR separado.

## 5. Comandos útiles (dentro de `web/`)
| Comando | Qué hace |
|---|---|
| `npm run dev:mock` | Desarrollo con datos simulados (sin Supabase) |
| `npm run dev` | Desarrollo con Supabase real (requiere `.env`) |
| `npm test` | Pruebas de lógica de todos los roles |
| `npm run test:e2e` | Pruebas de interfaz (Playwright; requiere Chromium) |
| `npm run build` | Compilación de producción |
