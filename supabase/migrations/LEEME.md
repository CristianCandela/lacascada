# Migraciones
- Solo **Cristian** crea y ejecuta migraciones en Supabase. Los demás piden cambios en `docs/CONTRATO_DATOS.md`.
- Nombre: `AAAAMMDDHHMMSS_tema.sql`. Una migración ya ejecutada no se edita: se agrega otra.
- Orden vigente: esquema_inicial → whatsapp_y_solicitudes → riesgo_aforo_metricas → renombrar_sede_tupac_amaru → bitacora_trazabilidad → **fase1_cliente_membresias_checkin** (MVP v2).
- No ejecutar `solicitudes_publicas` (duplicada; debe borrarse del repositorio).
- La migración de la Fase 1 es idempotente. Requiere, además, en Supabase: Authentication → Providers → Email → desactivar «Confirm email» (o el cliente deberá confirmar su correo antes de registrarse).
