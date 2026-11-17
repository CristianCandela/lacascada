# Contrato de datos (v0.2 — implementado en `supabase/migrations/20261028100000_fase1_cliente_membresias_checkin.sql`)

Regla: el frontend **solo** usa lo definido aquí. Para cambiar algo, se edita este documento en un PR y Cristian lo implementa.
Cada rol simula sus funciones en `web/src/features/<rol>/mock.js` con **estos mismos nombres y parámetros**
(ayudas compartidas en `web/src/mock/comunes.js`). Convención: tablas y columnas en español, `snake_case`.
En el modo simulado (`npm run dev:mock`) el código del local es **123456** y el cliente de prueba (`cliente@demo.test`) ya tiene membresía.

## Diseño
- **Sauna:** se reserva (tabla `citas`, franja de 1 hora, aforo por sede en `aforos`).
- **Gimnasio:** no se reserva. Entra quien tiene membresía vigente y registra entrada con el código del local; la salida la marca el cliente o se cierra sola al cerrar el local. El aforo en vivo sale de los check-ins sin salida.
- **Plan único:** «Plan general», 30 días, S/ 150, sin restricción de horario. Horario de ejemplo 06:00–22:00 (tabla `sedes`; reemplazar por el real).
- **No-shows:** aplican a sauna. En gimnasio se usa la lista de clientes inactivos (membresía vigente sin asistir hace N días).
- Los clientes **no escriben tablas directo**: todo pasa por funciones (RPC) que validan rol y reglas.

## Cambios a tablas existentes
| Tabla | Cambio |
|---|---|
| `perfiles.rol` | Acepta `cliente` |
| `clientes.id_usuario` | uuid único, nulo: vincula al cliente con su cuenta de Supabase Auth |
| `clientes.estado` | `activo` / `inactivo` / `suspendido` (solo `activo` puede entrar o reservar) |
| `citas.origen` | `recepcion` / `cliente` / `solicitud` |
| `bitacora` | Nuevas acciones: `autoregistro`, `checkin`, `checkout`, `pago`, `motivo_ausencia` |

## Tablas nuevas
| Tabla | Columnas principales | Quién escribe | Quién lee |
|---|---|---|---|
| `sedes` | `sede`, `abre`, `cierra` | Admin | Todos (incluye público) |
| `planes` | `id_plan`, `nombre`, `dias`, `precio`, `activo` | Admin | Todos (incluye público) |
| `membresias` | `id_membresia`, `id_cliente`, `id_plan`, `inicio`, `fin` (la vigencia se calcula: `inicio ≤ hoy ≤ fin`) | `registrar_pago` | Personal; el cliente las suyas |
| `pagos` | `id_pago`, `id_membresia`, `monto`, `medio` (`efectivo`/`yape`/`plin`), `registrado_por`, `pagado_en` | `registrar_pago` | Personal |
| `codigos_local` | `sede`, `codigo` (6 dígitos), `vigente_desde`, `vigente_hasta` | `codigo_local_actual` | Personal |
| `checkins` | `id_checkin`, `id_cliente`, `sede`, `entrada_en`, `salida_en`, `metodo` (`codigo`/`manual`), `cierre_automatico` | `checkin`, `checkin_manual`, `checkout`, `checkout_manual` | Personal; el cliente los suyos |
| `motivos_ausencia` | `id_cliente`, `motivo` (`horario`/`costo`/`salud`/`viaje`/`otro`), `registrado_por`, `registrado_en` | `registrar_motivo_ausencia` | Administrador |

## Funciones RPC (`supabase.rpc('nombre', { parametros })`)
Las funciones que devuelven `{ ok, motivo }` **no lanzan error** ante un rechazo esperado: muestran `motivo` al usuario. Los errores (`error.message`) son accesos indebidos o datos inválidos.

### Cliente (Abel)
| Función | Parámetros | Devuelve |
|---|---|---|
| `registrar_cliente` | `p_codigo_local`, `p_nombre`, `p_dni`, `p_telefono`, `p_consentimiento` | `{ ok, id_cliente? , motivo? }`. Requiere cuenta creada con `supabase.auth.signUp`. Si el DNI ya existe sin cuenta y el teléfono coincide, se vincula |
| `checkin` | `p_codigo` | `{ ok, sede?, membresia_fin?, motivo? }` |
| `checkout` | — | `{ ok, motivo? }` |
| `reservar_sauna` | `p_sede`, `p_fecha_hora` | `id_cita`. Errores: aforo completo, duplicado, fuera de horario, sin membresía, fecha pasada o a más de 30 días |
| `cancelar_reserva` | `p_id_cita` | `{ ok, motivo? }` |
| `mis_reservas` | — | lista `{ id_cita, servicio, sede, fecha_hora_cita, estado_asistencia }` |
| `mi_membresia` | — | `{ vigente, plan, inicio, fin, dias_restantes }` |
| `mis_visitas` | `p_limite` (20) | lista `{ entrada_en, salida_en, sede }` |
| `mis_datos` | — | `{ nombre, dni, telefono, estado, consentimiento, fecha_consentimiento }` |
| `disponibilidad` (existente) | `p_servicio`, `p_sede`, `p_fecha_hora` | `{ capacidad, ocupados, libres }` |

### Recepción (Leticia)
| Función | Parámetros | Devuelve |
|---|---|---|
| `codigo_local_actual` | `p_sede` | `{ codigo, sede, vigente_hasta }` (cambia cada día) |
| `registrar_pago` | `p_id_cliente`, `p_id_plan`, `p_monto` (opcional: precio del plan), `p_medio` (`efectivo`) | `id_membresia`. Si aún hay membresía vigente, la nueva empieza al día siguiente de su fin |
| `membresias_por_vencer` | `p_dias` (7) | lista `{ id_cliente, nombre, fin, dias_restantes }` (incluye vencidas en los últimos 30 días) |
| `checkin_manual` | `p_id_cliente`, `p_sede` | `{ ok, motivo? }` |
| `checkout_manual` | `p_id_cliente` | `{ ok, motivo? }` |
| `aprobar_solicitud` (existente) | `p_id` | `id_cita` |

### Administración (Dennis)
| Función | Parámetros | Devuelve |
|---|---|---|
| `clientes_inactivos` | `p_dias` (14) | lista `{ id_cliente, nombre, telefono, ultima_visita, dias_sin_asistir, membresia_fin, ultimo_motivo }`: clientes activos con membresía vigente sin asistir hace `p_dias` (o que nunca asistieron) |
| `registrar_motivo_ausencia` | `p_id_cliente`, `p_motivo` | `{ ok }` |
| `resumen_no_shows`, `bitacora_reciente` (existentes) | — | como antes |

### Público y núcleo (Cristian)
| Función | Parámetros | Devuelve |
|---|---|---|
| `aforo_actual` | `p_sede` (opcional) | lista `{ sede, servicio, ocupados, capacidad }`. **Solo totales, sin datos personales**; callable sin sesión. Gimnasio = personas dentro; sauna = reservas de la hora actual |

Pendientes de contrato (no implementados aún): `invitar_personal`, reportes semanales, notificación de vencimiento.

## Seguridad (RLS) por rol
| Dato | Cliente | Recepción | Administrador | Público (sin cuenta) |
|---|---|---|---|---|
| `clientes`, `citas` | solo los suyos (lectura) | lee y escribe | lee y escribe | — |
| `membresias`, `checkins` | solo los suyos (lectura) | lectura | lectura | — |
| `pagos`, `codigos_local` | — | lectura | lectura | — |
| `motivos_ausencia`, `bitacora` | — | — | lectura | — |
| `planes`, `sedes` | lectura | lectura | lee y escribe | lectura |
| `aforos` | lectura | lectura | lee y escribe | — |
| `solicitudes` | — | lee, edita | lee, edita, elimina | solo insertar |

Importante: antes de la Fase 1 las políticas permitían leer `clientes`, `citas` y `solicitudes` a *cualquier usuario con perfil*. Con el rol cliente eso habría expuesto los datos de todos; ahora se limitan al personal con `es_personal()`.

## Reglas de negocio
- Sin membresía vigente no se puede hacer check-in ni reservar sauna (la reserva exige que la membresía cubra la fecha).
- El código del local es de 6 dígitos y cambia cada día. 5 códigos incorrectos en 10 minutos bloquean los intentos 10 minutos.
- Una persona no puede tener dos entradas abiertas.
- Una visita sin salida se cierra a la hora de cierre del local.
- Toda acción de la aplicación se registra en la bitácora (sin DNI ni teléfono). Las cargas por SQL Editor (seeds) no se registran.
- Datos ficticios: DNI y teléfonos inventados con formato válido; ningún dato real de clientes de la empresa.
