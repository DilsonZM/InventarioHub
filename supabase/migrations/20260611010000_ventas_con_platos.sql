-- ============================================================================
-- Ventas con Platos/Bebidas (Fase 3)
-- ============================================================================
-- Permite vender platos del menú (con receta). Al confirmar se descuenta
-- cada ingrediente proporcional a la cantidad pedida.
-- Convive con ventas directas de productos (hacia atras compatible).
-- ============================================================================

-- venta_detalles: permitir NULL en producto_id (para ventas de platos)
ALTER TABLE venta_detalles ALTER COLUMN producto_id DROP NOT NULL;
ALTER TABLE venta_detalles ADD COLUMN IF NOT EXISTS plato_id UUID REFERENCES platos(id);
ALTER TABLE venta_detalles ADD COLUMN IF NOT EXISTS es_plato BOOLEAN DEFAULT FALSE;

-- Nuevo estado de venta para pedidos pendientes de confirmar
-- (el CHECK ya incluye 'pendiente' desde la migracion original)
