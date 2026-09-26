-- 20260926130917_stock_alerts.sql
-- Alertas de stock bajo a Telegram:
--   notify_low_stock: flag para silenciar/activar las alertas
--   alerta_stock_enviada_en: marca de la ultima alerta enviada por producto
--   (evita repetir la misma alerta cada pocos minutos)

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN DEFAULT true;

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS alerta_stock_enviada_en TIMESTAMPTZ;
