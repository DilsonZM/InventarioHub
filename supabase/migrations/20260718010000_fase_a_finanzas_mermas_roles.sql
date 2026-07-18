-- ============================================================================
-- Fase A: Finanzas, observaciones, mermas y roles
-- ============================================================================
-- 1. Nuevas columnas en ventas para domicilio, propina, bono, forma de pago
-- 2. Nueva columna observacion en venta_detalles (por plato)
-- 3. movimientos_inventario.tipo acepta 'merma'
-- 4. perfiles.role acepta 'mesero' y 'caja'
-- 5. procesar_venta() actualizado: IVA incluido (no cobrar adicional),
--    nuevos parametros financieros, observaciones por item
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Nuevas columnas en ventas
-- ----------------------------------------------------------------------------
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS costo_domicilio NUMERIC DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS propina NUMERIC DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS bono_descuento NUMERIC DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS forma_pago VARCHAR;

-- CHECKs de no-negativos (idempotentes)
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_costo_domicilio_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_costo_domicilio_check CHECK (costo_domicilio >= 0);

ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_propina_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_propina_check CHECK (propina >= 0);

ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_bono_descuento_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_bono_descuento_check CHECK (bono_descuento >= 0);

-- ----------------------------------------------------------------------------
-- 2. Observacion por item en venta_detalles
-- ----------------------------------------------------------------------------
ALTER TABLE venta_detalles ADD COLUMN IF NOT EXISTS observacion TEXT;

-- ----------------------------------------------------------------------------
-- 3. movimientos_inventario.tipo acepta 'merma'
-- ----------------------------------------------------------------------------
ALTER TABLE movimientos_inventario DROP CONSTRAINT IF EXISTS movimientos_inventario_tipo_check;
ALTER TABLE movimientos_inventario ADD CONSTRAINT movimientos_inventario_tipo_check
  CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'merma'));

-- Actualizar registrar_movimiento para aceptar 'merma' (descuenta stock, no cuenta como venta)
DROP FUNCTION IF EXISTS registrar_movimiento(UUID, VARCHAR, NUMERIC, VARCHAR, UUID, UUID);
CREATE OR REPLACE FUNCTION registrar_movimiento(
  p_producto_id UUID,
  p_tipo VARCHAR,
  p_cantidad NUMERIC,
  p_motivo VARCHAR DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_proveedor_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_movimiento_id UUID;
  v_stock_actual NUMERIC(12,4);
  v_stock_nuevo NUMERIC(12,4);
BEGIN
  SELECT stock_actual INTO v_stock_actual FROM productos WHERE id = p_producto_id;
  IF v_stock_actual IS NULL THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;

  IF p_tipo = 'entrada' THEN
    v_stock_nuevo := v_stock_actual + p_cantidad;
  ELSIF p_tipo = 'salida' THEN
    v_stock_nuevo := v_stock_actual - p_cantidad;
    IF v_stock_nuevo < 0 THEN RAISE EXCEPTION 'Stock insuficiente. Disponible: %', ROUND(v_stock_actual, 2); END IF;
  ELSIF p_tipo = 'merma' THEN
    -- Merma: descuenta stock pero NO es una venta (perdida operativa)
    v_stock_nuevo := v_stock_actual - p_cantidad;
    IF v_stock_nuevo < 0 THEN RAISE EXCEPTION 'Stock insuficiente para merma. Disponible: %', ROUND(v_stock_actual, 2); END IF;
  ELSIF p_tipo = 'ajuste' THEN
    v_stock_nuevo := p_cantidad;
  ELSE
    RAISE EXCEPTION 'Tipo de movimiento invalido: %', p_tipo;
  END IF;

  INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, proveedor_id)
  VALUES (p_producto_id, p_tipo, p_cantidad, ROUND(v_stock_actual)::INTEGER, ROUND(v_stock_nuevo)::INTEGER, p_motivo, p_usuario_id, p_proveedor_id)
  RETURNING id INTO v_movimiento_id;

  UPDATE productos SET stock_actual = v_stock_nuevo WHERE id = p_producto_id;
  RETURN v_movimiento_id;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4. perfiles.role acepta 'mesero' y 'caja'
-- ----------------------------------------------------------------------------
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_role_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_role_check
  CHECK (role IN ('admin', 'vendedor', 'mesero', 'caja'));

-- ----------------------------------------------------------------------------
-- 5. procesar_venta() actualizado: IVA incluido, nuevos parametros
-- ----------------------------------------------------------------------------
-- CAMBIO CRITICO: antes calculaba impuesto = subtotal * 0.19, total = subtotal * 1.19.
-- Ahora los precios YA incluyen IVA, por lo que:
--   subtotal = suma de (precio_venta * cantidad)  [precio con IVA incluido]
--   impuesto = subtotal * 19 / 119  [porcion de IVA ya contenida, informativo]
--   total = subtotal + costo_domicilio - bono_descuento + propina
-- No se cobra IVA adicional sobre domicilio/propina/bono.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS procesar_venta(JSONB, VARCHAR, UUID, VARCHAR);
CREATE OR REPLACE FUNCTION procesar_venta(
  p_items JSONB,
  p_metodo_pago VARCHAR,
  p_usuario_id UUID DEFAULT NULL,
  p_cliente_nombre VARCHAR DEFAULT NULL,
  p_costo_domicilio NUMERIC DEFAULT 0,
  p_propina NUMERIC DEFAULT 0,
  p_bono_descuento NUMERIC DEFAULT 0,
  p_forma_pago VARCHAR DEFAULT NULL,
  p_mesa_id UUID DEFAULT NULL,
  p_estado_cocina VARCHAR DEFAULT 'pendiente'
)
RETURNS UUID AS $$
DECLARE
  v_venta_id UUID;
  v_producto RECORD;
  v_subtotal DECIMAL(12,2) := 0;
  v_impuesto DECIMAL(12,2) := 0;
  v_total DECIMAL(12,2) := 0;
  v_numero_venta VARCHAR;
  v_item JSONB;
  v_items_agrupados JSONB;
BEGIN
  v_numero_venta := 'V-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  INSERT INTO ventas (
    numero_venta, cliente_nombre, usuario_id, metodo_pago,
    costo_domicilio, propina, bono_descuento, forma_pago,
    mesa_id, estado_cocina
  ) VALUES (
    v_numero_venta, p_cliente_nombre, p_usuario_id, p_metodo_pago,
    COALESCE(p_costo_domicilio, 0), COALESCE(p_propina, 0), COALESCE(p_bono_descuento, 0), p_forma_pago,
    p_mesa_id, COALESCE(p_estado_cocina, 'pendiente')
  )
  RETURNING id INTO v_venta_id;

  -- Agrupar items por producto y acumular cantidades
  -- Preserva observacion del primer item de cada grupo
  SELECT jsonb_agg(item) INTO v_items_agrupados
  FROM (
    SELECT
      (item->>'producto_id')::UUID AS producto_id,
      SUM(ROUND((item->>'cantidad')::DECIMAL)::INTEGER) AS cantidad_total,
      MAX(COALESCE(NULLIF(item->>'cantidad_presentacion', '')::DECIMAL(12,3), 0)) AS cantidad_presentacion_max,
      MAX(NULLIF(item->>'unidad_presentacion', '')) AS unidad_presentacion,
      COALESCE(MAX(NULLIF(item->>'factor_conversion', '')::DECIMAL(12,6)), 1) AS factor_conversion,
      MAX(NULLIF(item->>'observacion', '')) AS observacion,
      MAX(NULLIF(item->>'plato_id', '')::UUID::TEXT) AS plato_id,
      BOOL_OR(COALESCE((item->>'es_plato')::BOOLEAN, false)) AS es_plato
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
      cantidad_presentacion, unidad_presentacion, factor_conversion,
      observacion, plato_id, es_plato
    ) VALUES (
      v_venta_id,
      v_producto.id,
      v_producto.nombre,
      (v_item->>'cantidad_total')::INTEGER,
      v_producto.precio_venta,
      v_producto.precio_venta * (v_item->>'cantidad_total')::INTEGER,
      NULLIF(v_item->>'cantidad_presentacion_max', '')::DECIMAL(12,3),
      NULLIF(v_item->>'unidad_presentacion', ''),
      (v_item->>'factor_conversion')::DECIMAL(12,6),
      NULLIF(v_item->>'observacion', ''),
      NULLIF(v_item->>'plato_id', '')::UUID,
      COALESCE((v_item->>'es_plato')::BOOLEAN, false)
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

  -- IVA incluido: impuesto = porcion de IVA ya contenida en el subtotal (informativo)
  -- total = subtotal (con IVA incluido) + domicilio - bono + propina
  v_impuesto := ROUND(v_subtotal * 19 / 119, 2);
  v_total := v_subtotal + COALESCE(p_costo_domicilio, 0) - COALESCE(p_bono_descuento, 0) + COALESCE(p_propina, 0);

  UPDATE ventas
  SET subtotal = v_subtotal, impuesto = v_impuesto, total = v_total
  WHERE id = v_venta_id;

  RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;
