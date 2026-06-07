-- ============================================================================
-- Acumular cantidades del mismo producto en una venta
-- ============================================================================
-- Antes: si una venta tenia 2 items del mismo producto, el FOR loop
-- validaba cada uno contra stock_actual sin acumular, pero al decrementar
-- 2 veces el mismo producto podia llegar a stock negativo en un solo
-- movimiento (dependiendo del orden).
-- Ahora: agrupamos los items por producto, validamos el total acumulado
-- contra stock, y creamos un solo venta_detalle por producto con la suma.
-- ============================================================================

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
  v_producto RECORD;
  v_subtotal DECIMAL(12,2) := 0;
  v_numero_venta VARCHAR;
  v_item JSONB;
  v_items_agrupados JSONB;
BEGIN
  v_numero_venta := 'V-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  INSERT INTO ventas (numero_venta, cliente_nombre, usuario_id, metodo_pago)
  VALUES (v_numero_venta, p_cliente_nombre, p_usuario_id, p_metodo_pago)
  RETURNING id INTO v_venta_id;

  -- Agrupar items por producto y acumular cantidades
  -- Si el mismo producto aparece en multiples items, los sumamos.
  -- Tomamos la primera presentacion que veamos para el detalle.
  SELECT jsonb_agg(item) INTO v_items_agrupados
  FROM (
    SELECT
      (item->>'producto_id')::UUID AS producto_id,
      SUM(ROUND((item->>'cantidad')::DECIMAL)::INTEGER) AS cantidad_total,
      MAX(COALESCE(NULLIF(item->>'cantidad_presentacion', '')::DECIMAL(12,3), 0)) AS cantidad_presentacion_max,
      MAX(NULLIF(item->>'unidad_presentacion', '')) AS unidad_presentacion,
      COALESCE(MAX(NULLIF(item->>'factor_conversion', '')::DECIMAL(12,6)), 1) AS factor_conversion
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY (item->>'producto_id')::UUID
  ) AS item;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_agrupados)
  LOOP
    SELECT id, nombre, precio_venta, stock_actual INTO v_producto
    FROM productos
    WHERE id = (v_item->>'producto_id')::UUID AND activo = true
    FOR UPDATE;

    IF v_producto IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado o inactivo';
    END IF;

    IF (v_item->>'cantidad_total')::INTEGER <= 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para %', v_producto.nombre;
    END IF;

    IF v_producto.stock_actual < (v_item->>'cantidad_total')::INTEGER THEN
      RAISE EXCEPTION 'Stock insuficiente para %. Disponible: %', v_producto.nombre, v_producto.stock_actual;
    END IF;

    INSERT INTO venta_detalles (
      venta_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal,
      cantidad_presentacion, unidad_presentacion, factor_conversion
    ) VALUES (
      v_venta_id,
      v_producto.id,
      v_producto.nombre,
      (v_item->>'cantidad_total')::INTEGER,
      v_producto.precio_venta,
      v_producto.precio_venta * (v_item->>'cantidad_total')::INTEGER,
      NULLIF(v_item->>'cantidad_presentacion_max', '')::DECIMAL(12,3),
      NULLIF(v_item->>'unidad_presentacion', ''),
      (v_item->>'factor_conversion')::DECIMAL(12,6)
    );

    v_subtotal := v_subtotal + (v_producto.precio_venta * (v_item->>'cantidad_total')::INTEGER);

    PERFORM registrar_movimiento(
      v_producto.id,
      'salida',
      (v_item->>'cantidad_total')::INTEGER,
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
