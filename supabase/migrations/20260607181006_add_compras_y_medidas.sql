-- Agregar unidad_medida a productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(30) DEFAULT 'unidad';

-- Tabla de compras
CREATE TABLE IF NOT EXISTS compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  valor_unitario DECIMAL(12, 2) NOT NULL CHECK (valor_unitario >= 0),
  valor_total DECIMAL(12, 2) GENERATED ALWAYS AS (cantidad * valor_unitario) STORED,
  proveedor_id UUID REFERENCES proveedores(id),
  usuario_id UUID REFERENCES perfiles(id),
  notas TEXT,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vista de indicadores (todos los productos con estado)
DROP VIEW IF EXISTS vista_indicadores;
CREATE OR REPLACE VIEW vista_indicadores AS
SELECT
  p.id,
  p.nombre AS producto,
  p.sku AS codigo,
  p.stock_actual,
  p.stock_minimo,
  p.unidad_medida,
  p.precio_compra AS costo_unitario,
  CASE
    WHEN p.stock_actual = 0 THEN 'Agotado'
    WHEN p.stock_actual <= p.stock_minimo THEN 'Comprar'
    WHEN p.stock_actual <= (p.stock_minimo * 2) THEN 'Por comprar'
    ELSE 'OK'
  END AS estado,
  c.nombre AS categoria
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE p.activo = true
ORDER BY
  CASE
    WHEN p.stock_actual = 0 THEN 0
    WHEN p.stock_actual <= p.stock_minimo THEN 1
    WHEN p.stock_actual <= (p.stock_minimo * 2) THEN 2
    ELSE 3
  END,
  p.nombre;

-- Vista de movimientos completa
DROP VIEW IF EXISTS vista_movimientos;
CREATE OR REPLACE VIEW vista_movimientos AS
SELECT
  m.id,
  m.creado_en AS fecha,
  m.tipo AS movimiento,
  p.nombre AS producto,
  p.sku AS codigo,
  m.cantidad,
  CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END AS cantidad_entrada,
  CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END AS cantidad_salida,
  m.stock_nuevo AS cantidad_stock,
  m.motivo,
  u.username AS usuario
FROM movimientos_inventario m
LEFT JOIN productos p ON m.producto_id = p.id
LEFT JOIN perfiles u ON m.usuario_id = u.id
ORDER BY m.creado_en DESC;

-- RLS para compras
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow backend access" ON compras FOR ALL USING (true) WITH CHECK (true);
