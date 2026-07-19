-- ============================================================================
-- Fase B: Productos Tipo C — Insumos compartidos por tanda de rendimiento
-- ============================================================================
-- Un Producto Tipo C es un insumo que no se descuenta por porcion individual,
-- sino por tandas. Ej: aceite (500ml rinde 10 porciones de papas).
-- Al vender 1..9 porciones no se descuenta nada. Al vender la 10ma,
-- se descuentan los 500ml.
-- ============================================================================

-- 1. Campos de rendimiento en plato_ingredientes
ALTER TABLE plato_ingredientes ADD COLUMN IF NOT EXISTS rendimiento_por_tanda INTEGER DEFAULT 1;
ALTER TABLE plato_ingredientes ADD COLUMN IF NOT EXISTS cantidad_tanda NUMERIC(12,4) DEFAULT NULL;

-- CHECK: rendimiento >= 1 (1 = comportamiento normal, >1 = tipo C)
ALTER TABLE plato_ingredientes DROP CONSTRAINT IF EXISTS plato_ingredientes_rendimiento_check;
ALTER TABLE plato_ingredientes ADD CONSTRAINT plato_ingredientes_rendimiento_check CHECK (rendimiento_por_tanda >= 1);

-- 2. Tabla acumulador de tandas pendientes
-- Lleva la cuenta de cuantas porciones se han vendido de cada insumo Tipo C
-- desde la ultima tanda consumida.
CREATE TABLE IF NOT EXISTS insumo_tandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  ventas_acumuladas INTEGER DEFAULT 0,
  tandas_consumidas INTEGER DEFAULT 0,
  ultima_venta_id UUID REFERENCES ventas(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (producto_id)
);

ALTER TABLE insumo_tandas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow backend access" ON insumo_tandas FOR ALL USING (true) WITH CHECK (true);

-- 3. Funcion RPC: procesar tanda de insumo Tipo C
-- Llama desde el backend al procesar una venta con platos que usan Tipo C.
-- Incrementa el acumulador y, si se alcanza el rendimiento, descuenta stock.
CREATE OR REPLACE FUNCTION procesar_tanda_insumo(
  p_producto_id UUID,
  p_porciones_vendidas INTEGER,
  p_rendimiento_por_tanda INTEGER,
  p_cantidad_tanda NUMERIC,
  p_venta_id UUID DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_motivo VARCHAR DEFAULT 'Consumo por tanda'
) RETURNS NUMERIC AS $$
DECLARE
  v_tanda RECORD;
  v_tandas_a_descontar INTEGER;
  v_cantidad_a_descontar NUMERIC(12,4);
BEGIN
  -- Obtener o crear registro de tandas para este producto
  SELECT * INTO v_tanda FROM insumo_tandas WHERE producto_id = p_producto_id;
  IF NOT FOUND THEN
    INSERT INTO insumo_tandas (producto_id, ventas_acumuladas)
    VALUES (p_producto_id, 0)
    RETURNING * INTO v_tanda;
  END IF;

  -- Acumular porciones vendidas
  UPDATE insumo_tandas
  SET ventas_acumuladas = ventas_acumuladas + p_porciones_vendidas,
      ultima_venta_id = COALESCE(p_venta_id, ultima_venta_id),
      actualizado_en = NOW()
  WHERE producto_id = p_producto_id
  RETURNING ventas_acumuladas INTO v_tanda.ventas_acumuladas;

  -- Actualizar el acumulador en la variable local
  v_tanda.ventas_acumuladas := v_tanda.ventas_acumuladas + p_porciones_vendidas;

  -- Verificar si se alcanzo el rendimiento
  v_tandas_a_descontar := FLOOR(v_tanda.ventas_acumuladas / p_rendimiento_por_tanda);

  IF v_tandas_a_descontar > 0 THEN
    v_cantidad_a_descontar := v_tandas_a_descontar * p_cantidad_tanda;

    -- Descontar stock
    PERFORM registrar_movimiento(
      p_producto_id,
      'salida',
      v_cantidad_a_descontar,
      p_motivo || ' (' || v_tandas_a_descontar || ' tanda(s) x ' || p_cantidad_tanda || ')',
      p_usuario_id
    );

    -- Resetear acumulador (restar las tandas ya procesadas)
    UPDATE insumo_tandas
    SET ventas_acumuladas = ventas_acumuladas - (v_tandas_a_descontar * p_rendimiento_por_tanda),
        tandas_consumidas = tandas_consumidas + v_tandas_a_descontar,
        actualizado_en = NOW()
    WHERE producto_id = p_producto_id;

    RETURN v_cantidad_a_descontar;
  END IF;

  RETURN 0;
END;
$$ LANGUAGE plpgsql;
