-- ============================================
-- Reservas: asignacion de mesa + auto-pedido
-- ============================================
-- Anade mesa_id a reservas para que el admin pueda asignar una mesa
-- del restaurante. Tambien guarda numero_venta para vincular con el
-- pedido que se crea automaticamente al confirmar.
-- ============================================

ALTER TABLE reservas ADD COLUMN IF NOT EXISTS mesa_id UUID REFERENCES mesas(id) ON DELETE SET NULL;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS mesa_nombre VARCHAR(100);
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS numero_venta VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_reservas_mesa ON reservas(mesa_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_hora ON reservas(fecha, hora);
