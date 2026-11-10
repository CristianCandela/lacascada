# Rol cliente — dueño: Abel

Todo lo de este rol va en esta carpeta: pantallas (`.jsx`), estilos (`estilos.css`, clases con prefijo `cli-`), lógica pura (`logica.js`), simulación (`mock.js`). Pruebas: `tests/cliente.test.js` y `tests/e2e/cliente.mjs`.

Para añadir una pantalla: crea el componente aquí y agrégalo a `index.js`. No edites `App.jsx`, `styles.css` ni otras carpetas.

Tareas: ver `docs/ASIGNACIONES.md`. Datos y funciones del servidor: ver `docs/CONTRATO_DATOS.md`.

---

## Pantallas

- **Registro de Cliente** (`Registro.jsx`, **HU-C1**): ruta pública (`#/registro`). Formulario de autoregistro con código del local (`123456`), DNI (8 dígitos), teléfono (9 dígitos) y casilla de consentimiento. Ejecuta la RPC `registrar_cliente`.
- **Check-in / Checkout Gimnasio** (`IngresarCodigo.jsx`, **HU-C2**): ingreso y salida mediante código diario de 6 dígitos de la sede (`123456` / `123987`). Ejecuta las RPCs `checkin` y `checkout`.
- **Mi Membresía e Historial** (`MiMembresia.jsx`, **HU-C5**): consulta del plan activo (*Plan general*), días restantes de vigencia e historial de visitas pasadas. Usa las RPCs `mi_membresia` y `mis_visitas`.
- **Mis Reservas de Sauna** (`MisReservas.jsx`, **HU-C3** y **HU-C4**): agendamiento de turnos de sauna por fecha/hora y cancelación de citas activas. Maneja las RPCs `reservar_sauna` y `cancelar_reserva`.
- **Aforo y Perfil** (**HU-C6** y **HU-C7**): consulta la RPC `disponibilidad` para aforo y la RPC `mis_datos` para información del cliente.

---

## Exportaciones y Rutas (`index.js`)

El enrutador principal del proyecto consume lo que exporta este módulo sin necesidad de modificar `App.jsx`:

- **`modulos`**: contiene las pestañas para el usuario autenticado con el rol cliente:
  - `ingresar-codigo`: Check-in Gimnasio (`IngresarCodigo.jsx`).
  - `mi-membresia`: Mi Membresía (`MiMembresia.jsx`).
  - `mis-reservas`: Mis reservas (`MisReservas.jsx`).
- **`rutasPublicas`**: contiene la ruta accesible antes de iniciar sesión:
  - `#/registro`: Registro de Cliente (`Registro.jsx`).

---

## Estilos

- Todo está en `estilos.css`, con el prefijo **`cli-`** en todas las clases para evitar colisiones con otros módulos.
- Estructura visual basada en contenedores aislados (`.cli-pagina`, `.cli-tarjeta`, `.cli-boton`, `.cli-tabla`, `.cli-alerta`).
- **Pendiente**: integrar la visualización del componente compartido `BarraAforo` cuando Cristian libere la versión del núcleo en la Fase 3.

---

## Cómo probar

1. Ejecuta `npm run dev:mock`.
2. **Ruta Pública (HU-C1)**: abre `http://localhost:5173/#/registro` e intenta autoregistrarte usando el código del local `123456`.
3. **Inicio de sesión**: entra en `http://localhost:5173` con las credenciales simuladas `cliente@demo.test` / `demo123`.
4. **Check-in / Checkout (HU-C2)**: en la pestaña *Check-in Gimnasio*, ingresa el código `123456` para marcar entrada y pulsa en marcar salida.
5. **Mi Membresía (HU-C5)**: comprueba que el plan activo (*Plan general*), la fecha de fin y el historial de visitas carguen correctamente.
6. **Mis Reservas (HU-C3 y HU-C4)**: agenda un turno de sauna y prueba el botón de cancelar reserva.
7. **Pruebas E2E**: abre la terminal en `web/` y ejecuta `npm run test:e2e` para validar los escenarios `CLI-1` a `CLI-4`.

---

## Limitaciones conocidas

- El mock se reinicia al recargar la página (**F5**). Las reservas realizadas y marcas de entrada/salida de prueba vuelven a su estado por defecto. Es el comportamiento esperado en entorno simulado.
- **Barra de Aforo en vivo (HU-C6)**: la RPC `disponibilidad` ya responde los datos en `mock.js`, pero el componente gráfico se ensamblará en la Fase 3.
- **Supabase Real**: las funciones RPC se ejecutan actualmente sobre datos en memoria dentro de `mock.js`. La conexión directa con la base de datos Postgres y políticas RLS se activará al pasar de `dev:mock` a `dev`.