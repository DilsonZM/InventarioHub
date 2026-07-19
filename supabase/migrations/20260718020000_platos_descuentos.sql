-- ============================================================================
-- Descuentos temporales en platos
-- ============================================================================
-- Permite programar un descuento porcentual por plato con rango de fechas.
-- El precio efectivo se calcula dinamicamente: si la fecha actual esta dentro
-- del rango [desde, hasta], se aplica el descuento; si no, precio normal.
-- ============================================================================

ALTER TABLE platos ADD COLUMN IF NOT EXISTS descuento_pct NUMERIC DEFAULT 0;
ALTER TABLE platos ADD COLUMN IF NOT EXISTS descuento_desde DATE;
ALTER TABLE platos ADD COLUMN IF NOT EXISTS descuento_hasta DATE;

-- CHECKs
ALTER TABLE platos DROP CONSTRAINT IF EXISTS platos_descuento_pct_check;
ALTER TABLE platos ADD CONSTRAINT platos_descuento_pct_check
  CHECK (descuento_pct >= 0 AND descuento_pct <= 100);

-- Funcion: devuelve el precio efectivo de un plato (con descuento si aplica)
CREATE OR REPLACE FUNCTION precio_efectivo_plato(p_plato_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_precio NUMERIC;
  v_descuento NUMERIC;
  v_desde DATE;
  v_hasta DATE;
BEGIN
  SELECT precio_venta, COALESCE(descuento_pct, 0), descuento_desde, descuento_hasta
  INTO v_precio, v_descuento, v_desde, v_hasta
  FROM platos WHERE id = p_plato_id;

  IF v_precio IS NULL THEN RETURN 0; END IF;
  IF v_descuento <= 0 THEN RETURN v_precio; END IF;

  -- Verificar si hoy esta dentro del rango de descuento
  IF (v_desde IS NULL OR CURRENT_DATE >= v_desde)
     AND (v_hasta IS NULL OR CURRENT_DATE <= v_hasta) THEN
    RETURN ROUND(v_precio * (1 - v_descuento / 100), 0);
  END IF;

  RETURN v_precio;
END;
$$ LANGUAGE plpgsql STABLE;
