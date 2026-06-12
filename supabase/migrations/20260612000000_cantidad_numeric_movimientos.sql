-- Cambia movimientos_inventario.cantidad de INTEGER a NUMERIC para registrar cantidades < 1
DROP VIEW IF EXISTS vista_movimientos;
ALTER TABLE movimientos_inventario DROP CONSTRAINT IF EXISTS movimientos_inventario_cantidad_check;
ALTER TABLE movimientos_inventario ALTER COLUMN cantidad TYPE NUMERIC(12,4);
ALTER TABLE movimientos_inventario ADD CONSTRAINT movimientos_inventario_cantidad_check CHECK (cantidad >= 0);
CREATE OR REPLACE VIEW vista_movimientos AS
 SELECT m.id, m.creado_en AS fecha, m.tipo AS movimiento, p.nombre AS producto, p.sku AS codigo,
  m.cantidad,
  CASE WHEN m.tipo = 'entrada' THEN m.cantidad ELSE 0 END AS cantidad_entrada,
  CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END AS cantidad_salida,
  m.stock_nuevo AS cantidad_stock, m.motivo, u.username AS usuario
 FROM movimientos_inventario m
 LEFT JOIN productos p ON m.producto_id = p.id
 LEFT JOIN perfiles u ON m.usuario_id = u.id
 ORDER BY m.creado_en DESC;
DROP FUNCTION IF EXISTS registrar_movimiento(UUID, VARCHAR, NUMERIC, VARCHAR, UUID, UUID);
CREATE OR REPLACE FUNCTION registrar_movimiento(p_producto_id UUID, p_tipo VARCHAR, p_cantidad NUMERIC, p_motivo VARCHAR DEFAULT NULL, p_usuario_id UUID DEFAULT NULL, p_proveedor_id UUID DEFAULT NULL) RETURNS UUID AS $$
DECLARE
  v_movimiento_id UUID;
  v_stock_actual NUMERIC(12,4);
  v_stock_nuevo NUMERIC(12,4);
BEGIN
  SELECT stock_actual INTO v_stock_actual FROM productos WHERE id = p_producto_id;
  IF v_stock_actual IS NULL THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
  IF p_tipo = 'entrada' THEN v_stock_nuevo := v_stock_actual + p_cantidad;
  ELSIF p_tipo = 'salida' THEN v_stock_nuevo := v_stock_actual - p_cantidad;
    IF v_stock_nuevo < 0 THEN RAISE EXCEPTION 'Stock insuficiente. Disponible: %', ROUND(v_stock_actual, 2); END IF;
  ELSIF p_tipo = 'ajuste' THEN v_stock_nuevo := p_cantidad;
  ELSE RAISE EXCEPTION 'Tipo de movimiento invalido: %', p_tipo; END IF;
  INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, proveedor_id)
  VALUES (p_producto_id, p_tipo, p_cantidad, ROUND(v_stock_actual)::INTEGER, ROUND(v_stock_nuevo)::INTEGER, p_motivo, p_usuario_id, p_proveedor_id)
  RETURNING id INTO v_movimiento_id;
  UPDATE productos SET stock_actual = v_stock_nuevo WHERE id = p_producto_id;
  RETURN v_movimiento_id;
END;
$$ LANGUAGE plpgsql;
