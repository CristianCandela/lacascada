# Rol cliente — dueño: Abel

Todo lo de este rol va en esta carpeta: pantallas (`.jsx`), estilos (`estilos.css`, clases con prefijo `cli-`), lógica pura (`logica.js`), simulación (`mock.js`). Pruebas: `tests/cliente.test.js` y `tests/e2e/cliente.mjs`.

Para añadir una pantalla: crea el componente aquí y agrégalo a `index.js`. No edites `App.jsx`, `styles.css` ni otras carpetas.

Tareas: ver `docs/ASIGNACIONES.md`. Datos y funciones del servidor: ver `docs/CONTRATO_DATOS.md`.

---

## Pantallas

- **Registro de Cliente** (`Registro.jsx`, **HU-C1**): ruta pública (`#/registro`). Formulario de autoregistro con correo electrónico, contraseña (mínimo 6 caracteres), código del local de 6 dígitos (inicia vacío; `123456` en modo mock), nombre completo, DNI (8 dígitos), teléfono (9 dígitos) y casilla de consentimiento. Valida campos vacíos, crea la cuenta con `supabase.auth.signUp`, ejecuta `supabase.rpc('registrar_cliente')`, refresca la sesión y redirige a `#/mis-reservas`.
- **Check-in / Checkout Gimnasio** (`IngresarCodigo.jsx`, **HU-C2**): ingreso y salida del gimnasio mediante código diario de 6 dígitos de la sede (`123456` en modo mock para *Túpac Amaru* y *Santa Rosa*). Ejecuta `supabase.rpc('checkin')` y `supabase.rpc('checkout')`, mostrando el motivo en caso de código inválido, membresía vencida o bloqueo por intentos fallidos.
- **Mi Membresía e Historial** (`MiMembresia.jsx`, **HU-C5**): consulta del plan activo (*Plan general*), fechas de vigencia, días restantes (con alerta visual si vence en 7 días o menos) e historial de visitas pasadas. Usa `supabase.rpc('mi_membresia')` y `supabase.rpc('mis_visitas')`.
- **Mis Reservas de Sauna** (`MisReservas.jsx`, **HU-C3** y **HU-C4**): consulta cupos libres de sauna en tiempo real por sede (*Túpac Amaru* y *Santa Rosa*) y horario mediante `supabase.rpc('disponibilidad')` (deshabilitando el botón si el turno está lleno); agenda turnos con `supabase.rpc('reservar_sauna')`, lista los turnos del cliente con `supabase.rpc('mis_reservas')` y permite cancelar citas pendientes futuras con `supabase.rpc('cancelar_reserva')`.
- **Aforo y Perfil** (**HU-C6** y **HU-C7**, Prioridad B): `mock.js` ya soporta `mis_datos` (y el núcleo público expone `aforo_actual`); sus vistas quedan como mejora opcional para la Fase 3.

---

## Exportaciones y Rutas (`index.js`)

El enrutador principal del proyecto consume lo que exporta este módulo sin necesidad de modificar `App.jsx`:

- **`modulos`**: arreglo con las pestañas para el usuario autenticado con el rol `cliente`:
  - `ingresar-codigo`: Check-in Gimnasio (`IngresarCodigo.jsx`).
  - `mi-membresia`: Mi Membresía (`MiMembresia.jsx`).
  - `mis-reservas`: Mis reservas (`MisReservas.jsx`).
- **`rutasPublicas`**: objeto con las rutas accesibles antes de iniciar sesión:
  - `'#/registro'`: Registro de Cliente (`Registro.jsx`).

---

## Estilos

- Todo está en `estilos.css`, con el prefijo **`cli-`** en todas las clases para evitar colisiones con otros módulos (`.cli-contenedor`, `.cli-form`, `.cli-form-reserva`, `.cli-input`, `.cli-btn-primario`, `.cli-btn-cancelar`, `.cli-lista`, `.cli-badge`, `.cli-alerta-aviso`, `.cli-error`), reutilizando los contenedores base `.pag-cab`, `.tarjeta` y `.ayuda`.
- **Pendiente (Prioridad B)**: integrar el componente compartido `BarraAforo` en la Fase 3.

---

## Cómo probar

1. Ejecuta `npm run dev:mock` dentro de `web/`.
2. **Ruta Pública (`HU-C1`)**: abre `http://localhost:5173/#/registro`, verifica que al enviar vacío muestre errores de validación y regístrate usando correo, contraseña, código del local `123456`, DNI (8 dígitos), teléfono (9 dígitos) y consentimiento; comprueba que redirija a *Mis reservas*.
3. **Inicio de sesión**: entra en `http://localhost:5173` con las credenciales simuladas `cliente@demo.test` / `demo123`.
4. **Check-in / Checkout (`HU-C2`)**: en *Check-in Gimnasio*, ingresa el código `123456` para registrar entrada y luego pulsa en marcar salida.
5. **Mi Membresía (`HU-C5`)**: comprueba que el plan activo (*Plan general*), vigencia, días restantes y el historial de visitas carguen correctamente.
6. **Mis Reservas (`HU-C3` y `HU-C4`)**: selecciona sede (*Túpac Amaru* o *Santa Rosa*) y fecha/hora futura para ver los cupos libres de sauna, agenda un turno y prueba el botón **Cancelar**.
7. **Pruebas automatizadas**: en `web/`, ejecuta `npm test` (lógica pura y `mock.js`), `npm run build:mock` (compilación) y `npm run test:e2e` (escenarios `CLI-1` a `CLI-5` en `tests/e2e/cliente.mjs`).

---

## Limitaciones conocidas

- **Reinicio en modo mock**: al recargar la página (**F5**) en `dev:mock`, la base compartida en memoria (`ctx.db`) vuelve a su estado inicial. Es el comportamiento esperado en entorno simulado.
- **Conexión con Supabase**: todas las vistas ya invocan directamente `supabase.auth` y `supabase.rpc(...)` (en `dev:mock` son interceptadas por `supabase-mock.js` + `mock.js` compartiendo `ctx.db`). En entorno real con Postgres solo queda pendiente que Cristian habilite la RPC `mis_reservas` solicitada en `docs/CONTRATO_DATOS.md`.
- **Aforo en vivo (`HU-C6`) y Mis datos (`HU-C7`)**: son historias de Prioridad B; las RPCs de respaldo ya están disponibles y sus pantallas se ensamblarán en la Fase 3 si alcanza el tiempo.