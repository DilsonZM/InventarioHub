-- 20260624000000_printer_config.sql
-- Sub-paso "Impresion Hibrida": agregar columnas de impresora termica
-- y comanda separada a la tabla app_config. Estas permiten al backend
-- saber la IP/puerto de la impresora termica cuando recibe POST /api/print
-- y si debe enviar automaticamente la comanda de cocina al confirmar
-- un pedido.

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS printer_host TEXT DEFAULT '127.0.0.1';

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS printer_port INTEGER DEFAULT 9100;

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS printer_enabled BOOLEAN DEFAULT false;

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS comanda_enabled BOOLEAN DEFAULT false;

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS printer_kind TEXT DEFAULT 'browser';
