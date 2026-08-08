-- La apertura representa capital inicial, no una compra del período.
-- Siempre acompaña la inversión acumulada; solo las compras respetan from/to.
DROP FUNCTION IF EXISTS public.obtener_inversion_compras(DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION public.obtener_inversion_compras(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_producto_id UUID DEFAULT NULL
)
RETURNS TABLE (
  period_investment NUMERIC,
  period_purchase_count BIGINT,
  opening_investment NUMERIC,
  purchase_investment NUMERIC
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    COALESCE(opening.total, 0) + COALESCE(purchases.total, 0) AS period_investment,
    COALESCE(purchases.rows, 0)::BIGINT AS period_purchase_count,
    COALESCE(opening.total, 0)::NUMERIC AS opening_investment,
    COALESCE(purchases.total, 0)::NUMERIC AS purchase_investment
  FROM (
    SELECT COALESCE(SUM(valor_inicial), 0)::NUMERIC AS total
    FROM public.inventario_aperturas
    WHERE (p_producto_id IS NULL OR producto_id = p_producto_id)
  ) AS opening
  CROSS JOIN (
    SELECT
      COALESCE(SUM(valor_total), 0)::NUMERIC AS total,
      COUNT(*)::BIGINT AS rows
    FROM public.compras
    WHERE (p_from IS NULL OR fecha_compra >= p_from)
      AND (p_to IS NULL OR fecha_compra <= p_to)
      AND (p_producto_id IS NULL OR producto_id = p_producto_id)
  ) AS purchases;
$$;

REVOKE ALL ON FUNCTION public.obtener_inversion_compras(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_inversion_compras(DATE, DATE, UUID) TO service_role;
