# Asignaciones — MVP v2 La Cascada

Objetivo (crítica del docente): que todo el flujo del gimnasio sea automático, incluya al cliente y supere a AppsFit.
Núcleo del alcance: **membresía + registro automático + check-in por código + aforo + sauna + reactivación**.
El **sauna se reserva** (con aforo por turno); el **gimnasio no**: se paga una membresía y se registra la asistencia con el código del local.
Los no-shows se enfocan en sauna; en gimnasio se usa la lista de clientes inactivos para motivar y entender por qué dejan de asistir
(hipótesis a validar con la empresa; no se presenta como hallazgo).
**Plan único:** «Plan general», 30 días, S/ 150, sin restricción de horario.

## Reparto
| Persona | Rol | Carpeta | Pantallas |
|---|---|---|---|
| Abel | Cliente | `web/src/features/cliente/` | Registro, check-in, reserva de sauna, mis reservas, mi membresía |
| Leticia | Recepción | `web/src/features/recepcion/` | Código del local, agenda, solicitudes, pagos, alertas |
| Dennis | Administración | `web/src/features/admin/` | Planes y membresías, reactivación, panel, trazabilidad, personal |
| Cristian | Público + núcleo | `web/src/features/publico/`, `supabase/`, `web/src/{App.jsx,lib,hooks,mock}` | Inicio público, aforo en barras, autenticación, base de datos, integración |

## Historias de usuario
Prioridad: **A** = imprescindible, **B** = si alcanza el tiempo. "Servidor" indica lo que Cristian entrega (ver `CONTRATO_DATOS.md`).

### Abel — Cliente
| ID | Historia | Prio | Servidor | Prueba mínima |
|---|---|---|---|---|
| HU-C1 | Como cliente nuevo, me registro con correo, contraseña, DNI, teléfono, consentimiento y el código del local, sin ayuda de recepción (ruta `#/registro`: `supabase.auth.signUp` y luego `registrar_cliente`) | A | `registrar_cliente` | Formulario vacío muestra errores; registro válido entra a "Mis reservas" |
| HU-C2 | Como cliente, ingreso el código del local al llegar y queda registrada mi entrada; marco mi salida con un botón (o se cierra sola al cerrar el local) | A | `checkin`, `checkout` | Código correcto confirma; incorrecto o membresía vencida muestra el motivo |
| HU-C3 | Como cliente, reservo un turno de sauna viendo cupos libres (el gimnasio no se reserva) | A | `reservar_sauna`, `disponibilidad` | Turno lleno se deshabilita; reserva válida aparece en "Mis reservas" |
| HU-C4 | Como cliente, veo y cancelo mis reservas | A | `cancelar_reserva` | Cancelar cambia el estado y libera el cupo |
| HU-C5 | Como cliente, veo mi membresía (plan, vencimiento) y mi historial de visitas | A | `mi_membresia`, `mis_visitas` | Muestra días restantes; aviso si vence en 7 días |
| HU-C6 | Como cliente, veo el aforo del gimnasio en barras antes de ir | B | `aforo_actual` | Usa el componente de barras de Cristian |
| HU-C7 | Como cliente, consulto mis datos y retiro mi consentimiento | B | `mis_datos` | Muestra solo mis datos |

### Leticia — Recepción
| ID | Historia | Prio | Servidor | Prueba mínima |
|---|---|---|---|---|
| HU-R1 | Como recepcionista, muestro el código (o QR) del local para que los clientes se registren y hagan check-in | A | `codigo_local_actual` | El código cambia al renovarlo; solo lo ve personal |
| HU-R2 | Como recepcionista, uso la agenda con las reservas de sauna; el formulario de reserva y las solicitudes ya no ofrecen gimnasio | A | tabla `citas` | Una cita con check-in aparece como "Asistió" sin pulsar nada |
| HU-R3 | Como recepcionista, registro el pago de una membresía (efectivo, Yape, Plin; simulado) | A | `registrar_pago` | El pago extiende la fecha de vencimiento |
| HU-R4 | Como recepcionista, veo alertas de membresías vencidas o por vencer | A | `membresias_por_vencer` | Usa `diasParaVencer`; ordena por urgencia |
| HU-R5 | Como recepcionista, registro un check-in o una salida manual de respaldo si el cliente no puede usar el código | B | `checkin_manual`, `checkout_manual` | Queda en trazabilidad como acción manual |
| HU-R6 | Mantener Registrar reserva y Solicitudes (ya existen) | A | existentes | Las pruebas actuales siguen pasando |

### Dennis — Administración
| ID | Historia | Prio | Servidor | Prueba mínima |
|---|---|---|---|---|
| HU-A1 | Como administrador, veo y edito el plan general (duración y precio) y el horario de cada sede | A | tablas `planes`, `sedes` | Crear un plan lo muestra en la lista |
| HU-A2 | Como administrador, veo clientes sin asistir hace N días, envío un mensaje por WhatsApp (Mago de Oz) y registro el motivo de ausencia | A | `clientes_inactivos`, `registrar_motivo_ausencia` | Usa `diasSinAsistir`; el filtro de días cambia la lista |
| HU-A3 | Como administrador, veo el panel de no-shows enfocado en sauna, con ocupación por hora | A | `resumen_no_shows` (existente) | Panel actual sigue funcionando con filtro por servicio |
| HU-A4 | Como administrador, veo en trazabilidad también check-ins, pagos y reservas | B | `bitacora_reciente` | Nuevos tipos aparecen en el filtro |
| HU-A5 | Como administrador, invito a recepcionistas (no se registran solos) | B | `invitar_personal` | Solo administrador accede |
| HU-A6 | Como administrador, veo reportes de ingresos y ocupación por semana | B | `reporte_semanal` | Gráfico con datos ficticios |

### Cristian — Público y núcleo
| ID | Historia | Prio |
|---|---|---|
| HU-P1 | Página pública con planes, horarios y botón de registro | A |
| HU-P2 | Componente `BarraAforo` reutilizable (usa `nivelAforo`) y página `#/aforo` | A |
| HU-N1 | Rol `cliente`, autoregistro con código, RLS por rol | A |
| HU-N2 | Tablas y funciones del contrato (`membresias`, `pagos`, `checkins`, etc.) con sus migraciones y pruebas en Postgres | A |
| HU-N3 | Marcado automático de no-shows tras la hora de la cita | A |
| HU-N4 | Datos sintéticos v2 (clientes con cuenta, membresías, check-ins) | A |
| HU-N5 | Revisión de PR, despliegue en Vercel, README y Anexo C | A |

## Fases
1. **Fase 0 (ya preparada):** estructura por carpetas, guía de trabajo, contrato de datos.
2. **Fase 1 — Núcleo (Cristian):** migraciones del contrato y rol cliente. Mientras tanto los demás avanzan con `mock.js`.
3. **Fase 2 — Pantallas por rol:** cada uno trabaja su carpeta contra el contrato.
4. **Fase 3 — Integración:** pruebas cruzadas (el cliente reserva → recepción lo ve → check-in → admin lo ve en el panel y en trazabilidad).
5. **Fase 4 — Cierre:** datos ficticios, informe, PPT, Anexo C.

## Definición de terminado
Pantalla funcional con datos ficticios, prueba de lógica y/o de interfaz que pasa, PR aprobado, prompts de IA anotados en el Anexo C.
