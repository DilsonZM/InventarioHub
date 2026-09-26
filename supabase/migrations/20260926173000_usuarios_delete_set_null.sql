-- 20260926173000_usuarios_delete_set_null.sql
-- Permite eliminar usuarios permanentemente conservando el historial:
-- las referencias de auditoria (quien hizo el movimiento/venta/compra)
-- quedan en NULL al borrar el usuario.

ALTER TABLE movimientos_inventario DROP CONSTRAINT IF EXISTS movimientos_inventario_usuario_id_fkey;
ALTER TABLE movimientos_inventario ADD CONSTRAINT movimientos_inventario_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_usuario_id_fkey;
ALTER TABLE ventas ADD CONSTRAINT ventas_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE compras DROP CONSTRAINT IF EXISTS compras_usuario_id_fkey;
ALTER TABLE compras ADD CONSTRAINT compras_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE SET NULL;

ALTER TABLE inventario_aperturas DROP CONSTRAINT IF EXISTS inventario_aperturas_usuario_id_fkey;
ALTER TABLE inventario_aperturas ADD CONSTRAINT inventario_aperturas_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE SET NULL;
