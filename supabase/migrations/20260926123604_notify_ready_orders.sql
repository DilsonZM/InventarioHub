-- 20260926123604_notify_ready_orders.sql
-- Flag para las alertas de "pedido listo" (avisos a meseros).
-- Se controla por comandos de Telegram: /silenciar_listos y /activar_listos.

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS notify_ready_orders BOOLEAN DEFAULT true;
