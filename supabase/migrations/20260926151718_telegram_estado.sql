-- 20260926151718_telegram_estado.sql
-- Estado de conversaciones del bot (wizard de /gasto).
--
--   telegram_estado: un registro por chat con el paso actual del flujo
--   y los datos parciales (monto, categoria, etc.)

CREATE TABLE IF NOT EXISTS telegram_estado (
  chat_id BIGINT PRIMARY KEY,
  estado TEXT NOT NULL,
  datos JSONB NOT NULL DEFAULT '{}'::jsonb,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
