# Contrato de datos (borrador v0.1 — Cristian lo congela antes de la Fase 2)

Regla: el frontend **solo** usa lo definido aquí. Para cambiar algo, se edita este documento en un PR y Cristian lo implementa.
Mientras la migración no esté lista, cada dueño simula la función en `web/src/features/<rol>/mock.js`
con exactamente estos nombres y estos parámetros. Convención: tablas y columnas en español, `snake_case`.

## Tablas existentes (no cambian de nombre)
`perfiles(id, nombre, rol)` · `clientes(id_cliente, nombre, dni, telefono, …)` · `citas(id_cita, id_cliente, servicio, sede, fecha_hora_cita, estado_asistencia, …)` ·
`aforos` · `solicitudes` · `bitacora` (solo lectura vía `bitacora_reciente`).

## Cambios a tablas existentes
| Tabla | Cambio | Quién lo usa |
|---|---|---|
| `perfiles.rol` | Se agrega el valor `cliente` | todos |
| `clientes.id_usuario` (uuid, único, nulo) | Vincula al cliente con su cuenta | Cliente |
| `citas.origen` (`recepcion` / `cliente` / `solicitud`) | De dónde nació la reserva | Recepción, Admin |

## Tablas nuevas
| Tabla | Columnas principales | Quién escribe | Quién lee |
|---|---|---|---|
| `codigos_local` | `id`, `sede`, `codigo`, `vigente_desde`, `vigente_hasta` | `codigo_local_actual` | Recepción, Admin (el cliente solo lo ingresa) |
| `checkins` | `id_checkin`, `id_cliente`, `id_cita` (nulo), `sede`, `entrada_en`, `metodo` (`codigo` / `manual`) | `checkin`, `checkin_manual` | Recepción, Admin; el cliente ve los suyos |
| `planes` | `id_plan`, `nombre`, `servicio` (`sauna` / `gimnasio` / `combo`), `dias`, `precio`, `activo` | Admin | Todos (lectura) |
| `membresias` | `id_membresia`, `id_cliente`, `id_plan`, `inicio`, `fin`, `estado` (`activa` / `vencida`) | `registrar_pago` | Recepción, Admin; el cliente la suya |
| `pagos` | `id_pago`, `id_membresia`, `monto`, `medio` (`efectivo` / `yape` / `plin`), `registrado_por`, `pagado_en` | `registrar_pago` | Recepción, Admin |
| `motivos_ausencia` | `id`, `id_cliente`, `motivo` (`horario` / `costo` / `salud` / `viaje` / `otro`), `registrado_por`, `registrado_en` | `registrar_motivo_ausencia` | Admin |

## Funciones RPC
Entre paréntesis, quién la consume. Todas son `security definer` y validan el rol dentro de la función.

| Función | Parámetros | Devuelve | Rol permitido |
|---|---|---|---|
| `registrar_cliente` (Abel) | `p_codigo_local`, `p_nombre`, `p_dni`, `p_telefono`, `p_consentimiento` | `id_cliente` | Cuenta nueva autenticada sin perfil |
| `checkin` (Abel) | `p_codigo` | `{ ok, motivo?, membresia_fin? }` | cliente |
| `checkin_manual` (Leticia) | `p_id_cliente` | `id_checkin` | recepcionista, administrador |
| `codigo_local_actual` (Leticia) | `p_sede` | `{ codigo, vigente_hasta }` | recepcionista, administrador |
| `disponibilidad` (Abel, existente) | `p_servicio`, `p_sede`, `p_fecha_hora` | `{ capacidad, ocupados, libres }` | autenticado |
| `reservar_sauna` (Abel) | `p_sede`, `p_fecha_hora` | `id_cita` | cliente con membresía vigente |
| `cancelar_reserva` (Abel) | `p_id_cita` | `ok` | cliente (solo la suya) |
| `mi_membresia` (Abel) | — | `{ plan, inicio, fin, dias_restantes }` | cliente |
| `mis_visitas` (Abel) | `p_limite` | lista `{ entrada_en, sede }` | cliente |
| `mis_datos` (Abel) | — | datos del propio cliente | cliente |
| `aforo_actual` (Cristian, Abel) | `p_sede` | `{ servicio, ocupados, capacidad }[]` (solo totales, sin datos personales) | público (anon) |
| `registrar_pago` (Leticia) | `p_id_cliente`, `p_id_plan`, `p_monto`, `p_medio` | `id_membresia` | recepcionista, administrador |
| `membresias_por_vencer` (Leticia) | `p_dias` (por defecto 7) | lista `{ id_cliente, nombre, fin }` | recepcionista, administrador |
| `clientes_inactivos` (Dennis) | `p_dias` (por defecto 14) | lista `{ id_cliente, nombre, telefono, ultima_visita }` | administrador |
| `registrar_motivo_ausencia` (Dennis) | `p_id_cliente`, `p_motivo` | `ok` | administrador |
| `resumen_no_shows` (Dennis, existente) | — | resumen del panel | administrador |
| `bitacora_reciente` (Dennis, existente) | `p_limite`, `p_accion` | lista de eventos | administrador |
| `invitar_personal` (Dennis) | `p_correo`, `p_rol` | `ok` | administrador |

## Seguridad (RLS) por rol
| Dato | Cliente | Recepción | Administrador | Público (sin cuenta) |
|---|---|---|---|---|
| Sus propios datos y visitas | lee | — | — | — |
| Clientes, citas, checkins | solo los suyos | lee y escribe | lee y escribe | — |
| Membresías y pagos | solo las suyas | lee y escribe | lee y escribe | — |
| Planes | lee | lee | lee y escribe | lee (página de planes) |
| Aforo (totales) | lee | lee | lee | lee |
| Bitácora | — | — | lee | — |

## Reglas de negocio acordadas
- Un cliente **sin membresía vigente** no puede hacer check-in ni reservar sauna.
- El código del local se renueva cada día (decisión pendiente de Cristian: diario o por turno).
- El aforo del gimnasio se calcula con los check-ins de los últimos 90 minutos frente a la capacidad (valor ajustable).
- Una cita de sauna sin check-in pasa a `no_asistio` automáticamente al terminar su turno.
- Toda acción nueva se registra en la bitácora (check-in, reserva, pago, motivo de ausencia).
- Datos ficticios: DNI y teléfonos inventados con formato válido; ningún dato real de clientes de la empresa.
