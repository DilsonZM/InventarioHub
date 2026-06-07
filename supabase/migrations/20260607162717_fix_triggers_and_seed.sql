-- Fix triggers: drop first, then recreate
DROP TRIGGER IF EXISTS trigger_perfiles_actualizado ON perfiles;
DROP TRIGGER IF EXISTS trigger_productos_actualizado ON productos;
DROP TRIGGER IF EXISTS trigger_proveedores_actualizado ON proveedores;

CREATE TRIGGER trigger_perfiles_actualizado
  BEFORE UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION actualizar_actualizado_en();

CREATE TRIGGER trigger_productos_actualizado
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION actualizar_actualizado_en();

CREATE TRIGGER trigger_proveedores_actualizado
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION actualizar_actualizado_en();

-- Funcion: registrar_movimiento (recreate if needed)
CREATE OR REPLACE FUNCTION registrar_movimiento(
  p_producto_id UUID,
  p_tipo VARCHAR,
  p_cantidad INTEGER,
  p_motivo VARCHAR DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_proveedor_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_movimiento_id UUID;
  v_stock_actual INTEGER;
  v_stock_nuevo INTEGER;
BEGIN
  SELECT stock_actual INTO v_stock_actual
  FROM productos WHERE id = p_producto_id;

  IF v_stock_actual IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF p_tipo = 'entrada' THEN
    v_stock_nuevo := v_stock_actual + p_cantidad;
  ELSIF p_tipo = 'salida' THEN
    v_stock_nuevo := v_stock_actual - p_cantidad;
    IF v_stock_nuevo < 0 THEN
      RAISE EXCEPTION 'Stock insuficiente. Disponible: %', v_stock_actual;
    END IF;
  ELSIF p_tipo = 'ajuste' THEN
    v_stock_nuevo := p_cantidad;
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento invalido: %', p_tipo;
  END IF;

  INSERT INTO movimientos_inventario (
    producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
    motivo, usuario_id, proveedor_id
  ) VALUES (
    p_producto_id, p_tipo, p_cantidad, v_stock_actual, v_stock_nuevo,
    p_motivo, p_usuario_id, p_proveedor_id
  ) RETURNING id INTO v_movimiento_id;

  UPDATE productos SET stock_actual = v_stock_nuevo WHERE id = p_producto_id;

  RETURN v_movimiento_id;
END;
$$ LANGUAGE plpgsql;

-- Funcion: procesar_venta
CREATE OR REPLACE FUNCTION procesar_venta(
  p_items JSONB,
  p_metodo_pago VARCHAR,
  p_usuario_id UUID DEFAULT NULL,
  p_cliente_nombre VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_venta_id UUID;
  v_item JSONB;
  v_producto RECORD;
  v_subtotal DECIMAL(12,2) := 0;
  v_numero_venta VARCHAR;
BEGIN
  v_numero_venta := 'V-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  INSERT INTO ventas (numero_venta, cliente_nombre, usuario_id, metodo_pago)
  VALUES (v_numero_venta, p_cliente_nombre, p_usuario_id, p_metodo_pago)
  RETURNING id INTO v_venta_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, nombre, precio_venta, stock_actual INTO v_producto
    FROM productos
    WHERE id = (v_item->>'producto_id')::UUID AND activo = true
    FOR UPDATE;

    IF v_producto IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado o inactivo';
    END IF;

    IF v_producto.stock_actual < (v_item->>'cantidad')::INTEGER THEN
      RAISE EXCEPTION 'Stock insuficiente para %. Disponible: %', v_producto.nombre, v_producto.stock_actual;
    END IF;

    INSERT INTO venta_detalles (venta_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal)
    VALUES (
      v_venta_id,
      v_producto.id,
      v_producto.nombre,
      (v_item->>'cantidad')::INTEGER,
      v_producto.precio_venta,
      v_producto.precio_venta * (v_item->>'cantidad')::INTEGER
    );

    v_subtotal := v_subtotal + (v_producto.precio_venta * (v_item->>'cantidad')::INTEGER);

    PERFORM registrar_movimiento(
      v_producto.id,
      'salida',
      (v_item->>'cantidad')::INTEGER,
      'Venta ' || v_numero_venta,
      p_usuario_id
    );
  END LOOP;

  UPDATE ventas
  SET subtotal = v_subtotal, impuesto = v_subtotal * 0.19, total = v_subtotal * 1.19
  WHERE id = v_venta_id;

  RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;

-- Vistas
DROP VIEW IF EXISTS vista_productos_completo;
CREATE OR REPLACE VIEW vista_productos_completo AS
SELECT p.*, c.nombre AS categoria_nombre, pr.nombre AS proveedor_nombre
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
WHERE p.activo = true;

DROP VIEW IF EXISTS vista_stock_bajo;
CREATE OR REPLACE VIEW vista_stock_bajo AS
SELECT
  p.id, p.nombre, p.sku, p.stock_actual, p.stock_minimo,
  c.nombre AS categoria_nombre,
  CASE
    WHEN p.stock_actual = 0 THEN 'Agotado'
    WHEN p.stock_actual <= p.stock_minimo THEN 'Stock bajo'
    ELSE 'Normal'
  END AS estado_stock
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE p.activo = true AND p.stock_actual <= p.stock_minimo;

DROP VIEW IF EXISTS vista_ventas_resumen;
CREATE OR REPLACE VIEW vista_ventas_resumen AS
SELECT
  v.id, v.numero_venta, v.cliente_nombre, v.total, v.metodo_pago,
  v.estado, v.creado_en,
  pf.username AS vendedor,
  COUNT(vd.id) AS cantidad_items
FROM ventas v
LEFT JOIN perfiles pf ON v.usuario_id = pf.id
LEFT JOIN venta_detalles vd ON v.id = vd.venta_id
GROUP BY v.id, pf.username;

-- RLS policies (drop and recreate to be safe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow backend access' AND tablename = 'perfiles') THEN
    ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow backend access" ON perfiles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow backend access' AND tablename = 'categorias') THEN
    ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow backend access" ON categorias FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow backend access' AND tablename = 'proveedores') THEN
    ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow backend access" ON proveedores FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow backend access' AND tablename = 'productos') THEN
    ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow backend access" ON productos FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow backend access' AND tablename = 'movimientos_inventario') THEN
    ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow backend access" ON movimientos_inventario FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow backend access' AND tablename = 'ventas') THEN
    ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow backend access" ON ventas FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow backend access' AND tablename = 'venta_detalles') THEN
    ALTER TABLE venta_detalles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow backend access" ON venta_detalles FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- Seed data
INSERT INTO perfiles (username, password_hash, email, nombre_completo, role) VALUES
('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin@inventoriohub.com', 'Administrador Sistema', 'admin'),
('vendedor1', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'vendedor1@inventoriohub.com', 'Maria Garcia', 'vendedor'),
('vendedor2', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'vendedor2@inventoriohub.com', 'Carlos Lopez', 'vendedor')
ON CONFLICT (username) DO NOTHING;

INSERT INTO categorias (nombre, descripcion) VALUES
('Electronica', 'Dispositivos electronicos, computadoras, tablets y accesorios'),
('Accesorios', 'Accesorios para computadoras, cables, perifericos'),
('Oficina', 'Suministros y mobiliario de oficina'),
('Redes', 'Equipos de networking, routers, switches, cables de red'),
('Almacenamiento', 'Discos duros, SSD, memorias USB, tarjetas SD')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, ciudad) VALUES
('TechDistribuciones S.A.S', 'Juan Perez', '+57 300 123 4567', 'ventas@techdistri.com', 'Cra 45 #26-85', 'Bogota'),
('CompuMayor', 'Ana Rodriguez', '+57 310 987 6543', 'pedidos@compumayor.com', 'Cl 10 #30-25', 'Medellin'),
('GlobalTech Import', 'Roberto Sanchez', '+57 320 555 7890', 'info@globaltech.com', 'Av 68 #15-40', 'Cali')
ON CONFLICT DO NOTHING;

INSERT INTO productos (nombre, descripcion, sku, precio_compra, precio_venta, stock_actual, stock_minimo, categoria_id, proveedor_id)
SELECT
  p.nombre, p.descripcion, p.sku, p.precio_compra, p.precio_venta,
  p.stock_actual, p.stock_minimo,
  (SELECT id FROM categorias WHERE nombre = p.categoria LIMIT 1),
  (SELECT id FROM proveedores WHERE nombre = p.proveedor LIMIT 1)
FROM (VALUES
  ('Laptop HP 15', 'Laptop HP 15.6 pulgadas, Intel Core i5, 8GB RAM, 256GB SSD', 'LAP-HP-001', 650.00, 899.99, 25, 5, 'Electronica', 'TechDistribuciones S.A.S'),
  ('Mouse Inalambrico Logitech', 'Mouse inalambrico ergonomico Logitech M185', 'MOU-LOG-001', 15.00, 29.99, 150, 20, 'Accesorios', 'CompuMayor'),
  ('Teclado Mecanico RGB', 'Teclado mecanico con switches Cherry MX, retroiluminacion RGB', 'TEC-MEC-001', 45.00, 79.99, 3, 10, 'Accesorios', 'CompuMayor'),
  ('Monitor Samsung 27"', 'Monitor Samsung 27 pulgadas 4K IPS, HDR10', 'MON-SAM-001', 220.00, 349.99, 12, 3, 'Electronica', 'TechDistribuciones S.A.S'),
  ('Cable HDMI 2m', 'Cable HDMI 2.1 alta velocidad, 2 metros, dorado', 'CAB-HDM-001', 4.50, 12.99, 200, 30, 'Accesorios', 'GlobalTech Import'),
  ('Webcam HD 1080p', 'Webcam Full HD 1080p con microfono integrado', 'WEB-HD-001', 30.00, 59.99, 8, 5, 'Accesorios', 'CompuMayor'),
  ('Disco Duro Externo 1TB', 'Disco duro externo USB 3.0, 1TB, portatil', 'HDD-EXT-001', 40.00, 69.99, 2, 5, 'Almacenamiento', 'GlobalTech Import'),
  ('Router WiFi 6', 'Router WiFi 6 doble banda AX1800, 4 antenas', 'ROU-WF6-001', 75.00, 129.99, 15, 3, 'Redes', 'TechDistribuciones S.A.S'),
  ('SSD NVMe 500GB', 'Unidad de estado solido NVMe M.2, 500GB, lectura 3500MB/s', 'SSD-NV-001', 35.00, 59.99, 30, 8, 'Almacenamiento', 'GlobalTech Import'),
  ('Switch 8 Puertos', 'Switch Gigabit administrable 8 puertos, rackmount', 'SWI-8P-001', 25.00, 45.99, 20, 5, 'Redes', 'TechDistribuciones S.A.S')
) AS p(nombre, descripcion, sku, precio_compra, precio_venta, stock_actual, stock_minimo, categoria, proveedor)
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE sku = p.sku);
