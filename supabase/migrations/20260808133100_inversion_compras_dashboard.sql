-- Índices para filtrar inversión por fecha y producto.
CREATE INDEX IF NOT EXISTS idx_compras_fecha_compra
  ON public.compras (fecha_compra);

CREATE INDEX IF NOT EXISTS idx_compras_producto_fecha
  ON public.compras (producto_id, fecha_compra);

-- Agregado monetario usado por el Dashboard.
-- Es una función de lectura: no modifica stock ni costos.
CREATE OR REPLACE FUNCTION public.obtener_inversion_compras(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_producto_id UUID DEFAULT NULL
)
RETURNS TABLE (
  period_investment NUMERIC,
  period_purchase_count BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    COALESCE(SUM(c.valor_total), 0)::NUMERIC AS period_investment,
    COUNT(*)::BIGINT AS period_purchase_count
  FROM public.compras AS c
  WHERE (p_from IS NULL OR c.fecha_compra >= p_from)
    AND (p_to IS NULL OR c.fecha_compra <= p_to)
    AND (p_producto_id IS NULL OR c.producto_id = p_producto_id);
$$;

REVOKE ALL ON FUNCTION public.obtener_inversion_compras(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_inversion_compras(DATE, DATE, UUID) TO service_role;
