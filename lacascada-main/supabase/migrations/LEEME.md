# Migraciones
- Solo **Cristian** crea y ejecuta migraciones en Supabase. Los demás piden cambios en `docs/CONTRATO_DATOS.md`.
- Nombre: `AAAAMMDDHHMMSS_tema.sql`. Una migración nunca se edita después de ejecutada: se agrega otra.
- Orden vigente: esquema_inicial → whatsapp_y_solicitudes → riesgo_aforo_metricas → renombrar_sede_tupac_amaru → bitacora_trazabilidad → (nuevas del MVP v2).
- No ejecutar `solicitudes_publicas` (duplicada; debe borrarse del repositorio).
