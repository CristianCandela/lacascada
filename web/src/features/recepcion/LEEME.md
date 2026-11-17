# rol recepcionista — dueño: Leticia

Todo lo de este rol va en esta carpeta: pantallas (`.jsx`), estilos (`estilos.css`, clases con prefijo `rec-`),
lógica pura (`logica.js`), simulación (`mock.js`). Pruebas: `tests/recepcion.test.js` y `tests/e2e/recepcion.mjs`.
Para añadir una pantalla: crea el componente aquí y agrégalo a `index.js`. No edites `App.jsx`, `styles.css` ni otras carpetas.
Los componentes existentes de este rol siguen en `src/components/` (ver `.github/CODEOWNERS`); puedes moverlos aquí en un PR aparte.
Tareas: ver `docs/ASIGNACIONES.md`. Datos y funciones del servidor: ver `docs/CONTRATO_DATOS.md`.

## Pantallas

- **Inicio / Resumen del día**: aforo, total cobrado, número de transacciones y gráfico de barras.
- **Alertas** (`Alertas.jsx`): avisos ordenados por severidad. Se generan con `alertasCompletas` en `logica.js`.
- **Pagos** (`Pagos.jsx`): busca clientes con `buscar_cliente` y registra el cobro. Si hay un único resultado, lo selecciona solo.
- **Renovaciones** (`Renovaciones.jsx`): lista de vencimientos, aviso por WhatsApp y cobro de la renovación.
- **Reservar sauna**: pasos, selección de turno (Hoy / Mañana) y cobro.

## Puente entre pantallas (`puente.js`)

`App.jsx` no pasa datos entre pantallas, así que se usa un puente propio:

- `enviarAPagos(texto)`: guarda el cliente que Pagos debe buscar.
- `tomarPendiente()`: Pagos lee el dato guardado al abrirse.
- `alLlegar(fn)`: Pagos escucha avisos nuevos si ya estaba abierta.
- `irA(id, onAviso, texto)` (en `sede.js`): cambia de pestaña.

Se usa así, antes de navegar:

```js
enviarAPagos(x.codigo_cliente);
irA('pagos', onAviso);
```

Lo usan **Renovaciones** (botón de cobro) y **Alertas** (alerta de conversión, que abre Pagos con el cliente preseleccionado).

## Estilos

- Todo está en `estilos.css`, con prefijo `rec-`.
- Tema visual "Stitch": variables CSS (`--p`, `--sl`, `--tx`...) definidas en `.rec-inicio` y `.rec-pagina`.
- Se eliminó el bloque duplicado de «Reservar sauna».
- Pendiente: `.rec-medios` se usa para dos cosas distintas (texto en Inicio y botones de pago en el cobro). Conviene renombrar una.
- Pendiente: revisar clases del diseño antiguo que ya no se usen (`rec-borde-*`, `rec-fondo-*`, `rec-fila3`, `rec-fila2`).

## Cómo probar

1. Ejecuta `npm run dev:mock`.
2. **Renovaciones**: pulsa cobrar en Joaquín Paredes (`C-1005`) o Mateo Castro (`C-1003`). Debe abrir Pagos con el cliente seleccionado.
3. **Alertas**: la alerta de conversión abre Pagos con Fernanda Silva seleccionada.
4. **Resumen del día**: tras cobrar, el total y las transacciones deben subir.

## Limitaciones conocidas

- El mock se reinicia al recargar la página (F5). Los cobros de prueba desaparecen. Es normal.
- "Avisado ✓" en Renovaciones se marca al abrir WhatsApp. No verifica que el mensaje se haya enviado.
- **Agenda del día** (pantalla ajena a Recepción): los botones Asistió / No asistió / Canceló no guardan y muestran «No se pudo guardar el cambio. Revisa tu sesión o tus permisos.» Solo funciona Confirmó. Reportado a Cristian; puede requerir un RPC o permiso aprobado por él.
