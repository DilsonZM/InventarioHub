-- ============================================================================
-- Stock con decimales (para recetas con cantidades fraccionarias)
-- ============================================================================

-- 1. Dropear vistas que dependen de productos.stock_actual
DROP VIEW IF EXISTS vista_productos_completo;
DROP VIEW IF EXISTS vista_stock_bajo;
DROP VIEW IF EXISTS vista_indicadores;

-- 2. Cambiar stock_actual de INTEGER a NUMERIC
ALTER TABLE productos ALTER COLUMN stock_actual TYPE NUMERIC(12, 4);

-- 3. Recrear vistas
CREATE OR REPLACE VIEW vista_productos_completo AS
SELECT
  p.*,
  c.nombre AS categoria_nombre,
  pr.nombre AS proveedor_nombre
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
WHERE p.activo = true;

CREATE OR REPLACE VIEW vista_stock_bajo AS
SELECT
  p.id, p.nombre, p.sku, p.stock_actual, p.stock_minimo,
  c.nombre AS categoria_nombre,
  CASE
    WHEN p.stock_actual <= 0 THEN 'Agotado'
    WHEN p.stock_actual <= p.stock_minimo THEN 'Stock bajo'
    ELSE 'Normal'
  END AS estado_stock
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE p.activo = true AND p.stock_actual <= p.stock_minimo;

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
    WHEN p.stock_actual <= p.stock_minimo THEN 'Stock bajo'
    ELSE 'Normal'
  END AS estado,
  p.activo
FROM productos p;

-- 4. Reemplazar registrar_movimiento para no redondear a integer el stock
DROP FUNCTION IF EXISTS registrar_movimiento(UUID, VARCHAR, NUMERIC, VARCHAR, UUID, UUID);
CREATE OR REPLACE FUNCTION registrar_movimiento(
  p_producto_id UUID,
  p_tipo VARCHAR,
  p_cantidad NUMERIC,
  p_motivo VARCHAR DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_proveedor_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_movimiento_id UUID;
  v_stock_actual NUMERIC(12,4);
  v_stock_nuevo NUMERIC(12,4);
  v_cantidad_int INTEGER;
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
      RAISE EXCEPTION 'Stock insuficiente. Disponible: %', ROUND(v_stock_actual, 2);
    END IF;
  ELSIF p_tipo = 'ajuste' THEN
    v_stock_nuevo := p_cantidad;
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento invalido: %', p_tipo;
  END IF;

  v_cantidad_int := ROUND(p_cantidad)::INTEGER;

  INSERT INTO movimientos_inventario (
    producto_id, tipo, cantidad, stock_anterior, stock_nuevo,
    motivo, usuario_id, proveedor_id
  ) VALUES (
    p_producto_id, p_tipo, v_cantidad_int,
    ROUND(v_stock_actual)::INTEGER, ROUND(v_stock_nuevo)::INTEGER,
    p_motivo, p_usuario_id, p_proveedor_id
  ) RETURNING id INTO v_movimiento_id;

  UPDATE productos SET stock_actual = v_stock_nuevo WHERE id = p_producto_id;

  RETURN v_movimiento_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Reemplazar procesar_venta para manejar stock NUMERIC
DROP FUNCTION IF EXISTS procesar_venta(JSONB, VARCHAR, UUID, VARCHAR);
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
  v_cantidad_base DECIMAL(12,4);
  v_cantidad_pres DECIMAL(12,3);
  v_unidad_pres VARCHAR;
  v_factor DECIMAL(12,6);
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

    v_cantidad_pres := NULLIF(v_item->>'cantidad_presentacion', '')::DECIMAL(12,3);
    v_unidad_pres := NULLIF(v_item->>'unidad_presentacion', '');
    v_factor := COALESCE(NULLIF(v_item->>'factor_conversion', '')::DECIMAL(12,6), 1);
    v_cantidad_base := (v_item->>'cantidad')::DECIMAL;

    IF v_cantidad_base IS NULL OR v_cantidad_base <= 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para %', v_producto.nombre;
    END IF;

    IF v_producto.stock_actual < v_cantidad_base THEN
      RAISE EXCEPTION 'Stock insuficiente para %. Disponible: %', v_producto.nombre, ROUND(v_producto.stock_actual, 2);
    END IF;

    INSERT INTO venta_detalles (
      venta_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal,
      cantidad_presentacion, unidad_presentacion, factor_conversion
    ) VALUES (
      v_venta_id,
      v_producto.id,
      v_producto.nombre,
      ROUND(v_cantidad_base)::INTEGER,
      v_producto.precio_venta,
      v_producto.precio_venta * v_cantidad_base,
      v_cantidad_pres,
      v_unidad_pres,
      v_factor
    );

    v_subtotal := v_subtotal + (v_producto.precio_venta * v_cantidad_base);

    PERFORM registrar_movimiento(
      v_producto.id,
      'salida',
      v_cantidad_base,
      'Venta ' || v_numero_venta,
      p_usuario_id
    );
  END LOOP;

  UPDATE ventas
  SET subtotal = ROUND(v_subtotal, 2), impuesto = ROUND(v_subtotal * 0.19, 2), total = ROUND(v_subtotal * 1.19, 2)
  WHERE id = v_venta_id;

  RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;
