-- ============================================================================
-- Unidad de presentacion en salidas y entradas
-- ============================================================================
-- El operador registra "2 botellas" o "3 galones" en vez de la unidad base.
-- Stock se descuenta en la unidad base del producto, pero se preserva la
-- informacion de presentacion para trazabilidad y reportes.
-- ============================================================================

ALTER TABLE venta_detalles
  ADD COLUMN IF NOT EXISTS cantidad_presentacion DECIMAL(12, 3),
  ADD COLUMN IF NOT EXISTS unidad_presentacion VARCHAR(30),
  ADD COLUMN IF NOT EXISTS factor_conversion DECIMAL(12, 6) DEFAULT 1;

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS cantidad_presentacion DECIMAL(12, 3),
  ADD COLUMN IF NOT EXISTS unidad_presentacion VARCHAR(30),
  ADD COLUMN IF NOT EXISTS factor_conversion DECIMAL(12, 6) DEFAULT 1;

-- Comentarios
COMMENT ON COLUMN venta_detalles.cantidad_presentacion IS 'Cantidad en la unidad de presentacion elegida por el operador (ej. 2 botellas)';
COMMENT ON COLUMN venta_detalles.unidad_presentacion IS 'Unidad de presentacion (litro, galon, botella, kilogramo, etc.)';
COMMENT ON COLUMN venta_detalles.factor_conversion IS 'Factor de conversion: 1 unidad_presentacion = factor * unidad_base';

COMMENT ON COLUMN compras.cantidad_presentacion IS 'Cantidad en la unidad de presentacion elegida por el operador';
COMMENT ON COLUMN compras.unidad_presentacion IS 'Unidad de presentacion';
COMMENT ON COLUMN compras.factor_conversion IS 'Factor de conversion: 1 unidad_presentacion = factor * unidad_base';
