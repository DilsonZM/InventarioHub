-- 20260926121713_bot_settings_flags.sql
-- Flags de control del bot de Telegram (editables por comandos del chat).
--   notifications_active: pausa/reanuda TODAS las notificaciones
--   notify_pos_orders:    silencia solo los pedidos registrados en el POS

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS notifications_active BOOLEAN DEFAULT true;

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS notify_pos_orders BOOLEAN DEFAULT true;
