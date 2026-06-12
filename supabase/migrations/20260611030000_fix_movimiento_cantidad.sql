-- Permitir cantidad >= 0 en movimientos_inventario (para deducciones < 0.5)
ALTER TABLE movimientos_inventario DROP CONSTRAINT IF EXISTS movimientos_inventario_cantidad_check;
ALTER TABLE movimientos_inventario ADD CONSTRAINT movimientos_inventario_cantidad_check CHECK (cantidad >= 0);
