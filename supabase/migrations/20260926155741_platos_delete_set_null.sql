-- 20260926155741_platos_delete_set_null.sql
-- Permite eliminar platos permanentemente conservando el historial:
--   venta_detalles.plato_id   → NULL al borrar el plato (nombre denormalizado se mantiene)
--   reserva_items.plato_id    → NULL al borrar el plato (plato_nombre se mantiene)
--   plato_ingredientes        → se eliminan en cascada (ya estaba configurado)

ALTER TABLE reserva_items ALTER COLUMN plato_id DROP NOT NULL;

ALTER TABLE reserva_items DROP CONSTRAINT IF EXISTS reserva_items_plato_id_fkey;
ALTER TABLE reserva_items ADD CONSTRAINT reserva_items_plato_id_fkey
  FOREIGN KEY (plato_id) REFERENCES platos(id) ON DELETE SET NULL;

ALTER TABLE venta_detalles DROP CONSTRAINT IF EXISTS venta_detalles_plato_id_fkey;
ALTER TABLE venta_detalles ADD CONSTRAINT venta_detalles_plato_id_fkey
  FOREIGN KEY (plato_id) REFERENCES platos(id) ON DELETE SET NULL;
