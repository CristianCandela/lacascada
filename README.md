# La Cascada — Reservas y control de no-shows

MVP académico del curso Innovación y Transformación Digital (UTP, sección 35024) para
Sauna y Gimnasio La Cascada E.I.R.L. (Comas, Lima). Registra reservas y asistencia, mide los
no-shows y deja estructurado el dataset para el modelo predictivo del APF3.

> Todos los datos de demostración son **ficticios** (clientes `Cliente Demo NN`, DNI `7000xxxx`).
> Los porcentajes del panel con estos datos son parámetros de simulación, no resultados del negocio.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `supabase/migrations/` | Esquema SQL: tablas, RLS, funciones y triggers |
| `supabase/seed/` | Usuarios de prueba y datos ficticios |
| `web/` | Frontend React 18 + Vite 5 (PWA) |
| `ml/` | Modelo de predicción en Python/scikit-learn: **APF3** (pendiente) |

## Tecnologías

React 18 · Vite 5 · Supabase (PostgreSQL, Auth, RLS, funciones RPC) · Vercel · lucide-react ·
Playwright y `node:test` para las pruebas. No hay servidor propio: la lógica sensible vive en
funciones SQL y triggers de la base.

## 1. Base de datos (Supabase)

1. Crea el proyecto en https://supabase.com/dashboard
2. En **SQL Editor** ejecuta, **en este orden**:
   1. `supabase/migrations/20261011000000_esquema_inicial.sql`
   2. `supabase/migrations/20261013000000_whatsapp_y_solicitudes.sql`
   3. `supabase/migrations/20261014000000_riesgo_aforo_metricas.sql`

3. **Authentication → Users**: crea 2 usuarios (Auto Confirm): recepción y administrador.
4. Edita los correos de `supabase/seed/01_usuarios.sql` y ejecútalo (deben salir 2 filas).
5. Ejecuta `supabase/seed/02_datos_ficticios.sql` (30 clientes y unas 126 citas ficticias).
6. Opcionales para la demo:
   - `supabase/seed/03_solicitudes_demo.sql`: 2 solicitudes públicas ficticias.
   - `supabase/seed/04_metricas_demo.sql`: tiempos, recordatorios y confirmaciones **simulados**
     al azar. Sirven para ver los gráficos del panel; no son un hallazgo.
7. En **Table Editor** verifica `perfiles` (2), `clientes` (30) y `citas` (~126).

## 2. Frontend (`web/`)

```bash
cd web
cp .env.example .env     # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:5173
```

- `VITE_SUPABASE_URL`: URL del proyecto, sin `/rest/v1/`.
- `VITE_SUPABASE_ANON_KEY`: clave `anon` / *publishable* (pública por diseño).
- **Nunca** pongas la clave `service_role` en el frontend ni subas `.env` a Git.

### Pruebas

```bash
npm test            # 25 pruebas unitarias de lógica (node:test)
npm run test:e2e    # 36 pruebas de interfaz con Supabase simulado (requiere Playwright)
```

Las pruebas de interfaz no usan la base real: antes de entregar, repite los flujos a mano
en la URL desplegada.

### Logo e imágenes

- Logo: `web/public/logo.png` (cuadrado, fondo transparente, 512 px o más).
- Íconos de la PWA: `web/public/icon-192.png` y `web/public/icon-512.png`.

## 3. Despliegue (Vercel)

1. Importa el repositorio en Vercel.
2. **Root Directory** = `web`.
3. Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. En Supabase → Authentication → URL Configuration, agrega la URL de Vercel.

## Funciones del MVP

| Función | Descripción |
| --- | --- |
| Login por rol | Recepcionista opera la agenda; solo el administrador ve el panel y elimina citas (RLS y RPC) |
| Registrar reserva | Valida nombre, DNI de 8 dígitos, teléfono de 9, fecha futura y consentimiento (Ley 29733) |
| Agenda del día | Filtros por fecha, cliente, servicio, sede y riesgo |
| Marcar asistencia | «Asistió», «No asistió» y «Canceló»; guarda `marcada_en` y `segundos_registro` |
| Riesgo heurístico | «Alto riesgo» si la inasistencia es ≥ 30 % en los últimos 30 días, con mínimo 2 citas con estado final |
| Recordatorio por WhatsApp | Botón que abre `wa.me` con el mensaje prellenado y guarda `recordatorio_enviado_en` |
| **Cola de recordatorios** | Ver sección siguiente |
| Confirmación | Botón «Confirmó»: guarda `confirmada_en` |
| Aforo y duplicados | Trigger en la base bloquea franjas llenas; índice único evita la misma cita repetida |
| Solicitud pública | `https://TU-URL/#/reservar`, sin cuenta; el personal la aprueba en «Solicitudes» (`aprobar_solicitud`) |
| Panel del administrador | KPIs, barras por día, dona, mapa de calor, cohortes con y sin recordatorio, clientes de riesgo y CSV sin datos personales |
| PWA | Instalable en el celular; los datos requieren conexión |

### Cola de recordatorios

Implementa el protocolo operativo «recordar 2 horas antes» (Mago de Oz, sin API de pago).
El MVP **no envía** mensajes por sí solo: señala a recepción a quién recordar y registra la hora de envío.

- Una cita entra en la cola si está **pendiente**, empieza en **120 minutos o menos**, y no tiene
  recordatorio enviado ni confirmación del cliente.
- La agenda muestra un aviso «N citas por recordar» con el botón «Ver solo estas», y la etiqueta
  «Recordar · faltan X min» en la columna Contacto; el botón de WhatsApp aparece resaltado.
- Al usar WhatsApp o «Confirmó», la cita sale de la cola. El reloj se actualiza cada minuto.
- Lógica: `minutosParaRecordar()` en `web/src/lib/logica.js` (con pruebas unitarias).

## Contrato de datos para el APF3

- Variable objetivo `no_show`: 1 si `estado_asistencia = 'no_asistio'`, 0 si `'asistio'`.
  Se excluyen las citas `pendiente` y `cancelo`.
- Exportación CSV (panel y agenda): `id_cita, id_cliente, servicio, sede, fecha_hora_cita,
  fecha_hora_registro, recordatorio_enviado_en, confirmada_en, estado_asistencia,
  segundos_registro, no_show`. **No incluye nombre, DNI ni teléfono.**

## Seguridad y datos personales (Ley 29733)

- Consentimiento obligatorio: casilla en pantalla y `CHECK (consentimiento = true)` en la base.
- DNI enmascarado en listados; CSV sin datos personales.
- Permisos por rol aplicados en el servidor (RLS y funciones `security definer`).
- Solo el administrador elimina registros (derecho de cancelación).

## Limitaciones declaradas

- Sin API oficial de WhatsApp: el recordatorio es semi-manual (`wa.me`). La API queda para el APF3.
- Sin modelo de ML (APF3): el riesgo usa una regla simple, no inteligencia artificial.
- Sin captcha en la solicitud pública: usa un campo señuelo y límites por DNI y por hora.
- Las capacidades de `aforos` (sauna 6 y 4; gimnasio 30 y 20) son valores de ejemplo: ajústalas a los reales.
- `segundos_registro` mide del clic al guardado, no el tiempo humano de la tarea.
# La Cascada — Reservas y control de no-shows

MVP académico del curso Innovación y Transformación Digital (UTP, sección 35024) para
Sauna y Gimnasio La Cascada E.I.R.L. (Comas, Lima). Registra reservas y asistencia, mide los
no-shows y deja estructurado el dataset para el modelo predictivo del APF3.

> Todos los datos de demostración son **ficticios** (clientes `Cliente Demo NN`, DNI `7000xxxx`).
> Los porcentajes del panel con estos datos son parámetros de simulación, no resultados del negocio.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `supabase/migrations/` | Esquema SQL: tablas, RLS, funciones y triggers |
| `supabase/seed/` | Usuarios de prueba y datos ficticios |
| `web/` | Frontend React 18 + Vite 5 (PWA) |
| `ml/` | Modelo de predicción en Python/scikit-learn: **APF3** (pendiente) |

## Tecnologías

React 18 · Vite 5 · Supabase (PostgreSQL, Auth, RLS, funciones RPC) · Vercel · lucide-react ·
Playwright y `node:test` para las pruebas. No hay servidor propio: la lógica sensible vive en
funciones SQL y triggers de la base.

## 1. Base de datos (Supabase)

1. Crea el proyecto en https://supabase.com/dashboard
2. En **SQL Editor** ejecuta, **en este orden**:
   1. `supabase/migrations/20261011000000_esquema_inicial.sql`
   2. `supabase/migrations/20261013000000_whatsapp_y_solicitudes.sql`
   3. `supabase/migrations/20261014000000_riesgo_aforo_metricas.sql`

   No ejecutes `20261013000000_solicitudes_publicas.sql`: la reemplaza la migración 2.
3. **Authentication → Users**: crea 2 usuarios (Auto Confirm): recepción y administrador.
4. Edita los correos de `supabase/seed/01_usuarios.sql` y ejecútalo (deben salir 2 filas).
5. Ejecuta `supabase/seed/02_datos_ficticios.sql` (30 clientes y unas 126 citas ficticias).
6. Opcionales para la demo:
   - `supabase/seed/03_solicitudes_demo.sql`: 2 solicitudes públicas ficticias.
   - `supabase/seed/04_metricas_demo.sql`: tiempos, recordatorios y confirmaciones **simulados**
     al azar. Sirven para ver los gráficos del panel; no son un hallazgo.
7. En **Table Editor** verifica `perfiles` (2), `clientes` (30) y `citas` (~126).

## 2. Frontend (`web/`)

```bash
cd web
cp .env.example .env     # completa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:5173
```

- `VITE_SUPABASE_URL`: URL del proyecto, sin `/rest/v1/`.
- `VITE_SUPABASE_ANON_KEY`: clave `anon` / *publishable* (pública por diseño).
- **Nunca** pongas la clave `service_role` en el frontend ni subas `.env` a Git.

### Pruebas

```bash
npm test            # 25 pruebas unitarias de lógica (node:test)
npm run test:e2e    # 36 pruebas de interfaz con Supabase simulado (requiere Playwright)
```

Las pruebas de interfaz no usan la base real: antes de entregar, repite los flujos a mano
en la URL desplegada.

### Logo e imágenes

- Logo: `web/public/logo.png` (cuadrado, fondo transparente, 512 px o más).
- Íconos de la PWA: `web/public/icon-192.png` y `web/public/icon-512.png`.

## 3. Despliegue (Vercel)

1. Importa el repositorio en Vercel.
2. **Root Directory** = `web`.
3. Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. En Supabase → Authentication → URL Configuration, agrega la URL de Vercel.

## Funciones del MVP

| Función | Descripción |
| --- | --- |
| Login por rol | Recepcionista opera la agenda; solo el administrador ve el panel y elimina citas (RLS y RPC) |
| Registrar reserva | Valida nombre, DNI de 8 dígitos, teléfono de 9, fecha futura y consentimiento (Ley 29733) |
| Agenda del día | Filtros por fecha, cliente, servicio, sede y riesgo |
| Marcar asistencia | «Asistió», «No asistió» y «Canceló»; guarda `marcada_en` y `segundos_registro` |
| Riesgo heurístico | «Alto riesgo» si la inasistencia es ≥ 30 % en los últimos 30 días, con mínimo 2 citas con estado final |
| Recordatorio por WhatsApp | Botón que abre `wa.me` con el mensaje prellenado y guarda `recordatorio_enviado_en` |
| **Cola de recordatorios** | Ver sección siguiente |
| Confirmación | Botón «Confirmó»: guarda `confirmada_en` |
| Aforo y duplicados | Trigger en la base bloquea franjas llenas; índice único evita la misma cita repetida |
| Solicitud pública | `https://TU-URL/#/reservar`, sin cuenta; el personal la aprueba en «Solicitudes» (`aprobar_solicitud`) |
| Panel del administrador | KPIs, barras por día, dona, mapa de calor, cohortes con y sin recordatorio, clientes de riesgo y CSV sin datos personales |
| PWA | Instalable en el celular; los datos requieren conexión |

### Cola de recordatorios

Implementa el protocolo operativo «recordar 2 horas antes» (Mago de Oz, sin API de pago).
El MVP **no envía** mensajes por sí solo: señala a recepción a quién recordar y registra la hora de envío.

- Una cita entra en la cola si está **pendiente**, empieza en **120 minutos o menos**, y no tiene
  recordatorio enviado ni confirmación del cliente.
- La agenda muestra un aviso «N citas por recordar» con el botón «Ver solo estas», y la etiqueta
  «Recordar · faltan X min» en la columna Contacto; el botón de WhatsApp aparece resaltado.
- Al usar WhatsApp o «Confirmó», la cita sale de la cola. El reloj se actualiza cada minuto.
- Lógica: `minutosParaRecordar()` en `web/src/lib/logica.js` (con pruebas unitarias).

## Contrato de datos para el APF3

- Variable objetivo `no_show`: 1 si `estado_asistencia = 'no_asistio'`, 0 si `'asistio'`.
  Se excluyen las citas `pendiente` y `cancelo`.
- Exportación CSV (panel y agenda): `id_cita, id_cliente, servicio, sede, fecha_hora_cita,
  fecha_hora_registro, recordatorio_enviado_en, confirmada_en, estado_asistencia,
  segundos_registro, no_show`. **No incluye nombre, DNI ni teléfono.**

## Seguridad y datos personales (Ley 29733)

- Consentimiento obligatorio: casilla en pantalla y `CHECK (consentimiento = true)` en la base.
- DNI enmascarado en listados; CSV sin datos personales.
- Permisos por rol aplicados en el servidor (RLS y funciones `security definer`).
- Solo el administrador elimina registros (derecho de cancelación).

## Limitaciones declaradas

- Sin API oficial de WhatsApp: el recordatorio es semi-manual (`wa.me`). La API queda para el APF3.
- Sin modelo de ML (APF3): el riesgo usa una regla simple, no inteligencia artificial.
- Sin captcha en la solicitud pública: usa un campo señuelo y límites por DNI y por hora.
- Las capacidades de `aforos` (sauna 6 y 4; gimnasio 30 y 20) son valores de ejemplo: ajústalas a los reales.
- `segundos_registro` mide del clic al guardado, no el tiempo humano de la tarea.
- El horario del formulario (06:00 a 22:00) es un supuesto a validar con la empresa.
