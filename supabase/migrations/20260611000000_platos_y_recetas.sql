-- ============================================================================
-- Platos y Recetas (Fase 1)
-- ============================================================================
-- Tabla de platos/bebidas del menú. Un plato tiene una receta compuesta
-- por ingredientes del inventario. Al vender un plato se descuenta
-- automáticamente cada ingrediente según su receta.
-- ============================================================================

-- Platos y bebidas (misma tabla, diferenciados por tipo)
CREATE TABLE IF NOT EXISTS platos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT DEFAULT '',
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('plato', 'bebida')),
  precio_venta NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ingredientes que componen cada plato (la receta)
CREATE TABLE IF NOT EXISTS plato_ingredientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plato_id UUID NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad NUMERIC(12, 4) NOT NULL CHECK (cantidad > 0),
  unidad VARCHAR(30) NOT NULL DEFAULT 'unidad',
  UNIQUE (plato_id, producto_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_platos_tipo ON platos(tipo);
CREATE INDEX IF NOT EXISTS idx_platos_activo ON platos(activo);
CREATE INDEX IF NOT EXISTS idx_plato_ingredientes_plato ON plato_ingredientes(plato_id);
CREATE INDEX IF NOT EXISTS idx_plato_ingredientes_producto ON plato_ingredientes(producto_id);

-- RLS
ALTER TABLE platos ENABLE ROW LEVEL SECURITY;
ALTER TABLE plato_ingredientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow backend access" ON platos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow backend access" ON plato_ingredientes FOR ALL USING (true) WITH CHECK (true);
