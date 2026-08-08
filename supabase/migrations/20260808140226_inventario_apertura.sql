-- Apertura de inventario: capital inicial cargado al comenzar a usar el sistema.
CREATE TABLE IF NOT EXISTS public.inventario_aperturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  cantidad_inicial NUMERIC(12,4) NOT NULL CHECK (cantidad_inicial >= 0),
  costo_unitario NUMERIC(12,2) NOT NULL CHECK (costo_unitario >= 0),
  valor_inicial NUMERIC GENERATED ALWAYS AS (cantidad_inicial * costo_unitario) STORED,
  fecha_apertura DATE NOT NULL DEFAULT CURRENT_DATE,
  usuario_id UUID REFERENCES public.perfiles(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (producto_id)
);

ALTER TABLE public.inventario_aperturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow backend access" ON public.inventario_aperturas
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_inventario_aperturas_fecha
  ON public.inventario_aperturas (fecha_apertura);

-- Los productos existentes comienzan con una apertura basada en el stock
-- actualmente cargado. Los nuevos productos se registran desde products.js.
INSERT INTO public.inventario_aperturas (producto_id, cantidad_inicial, costo_unitario, fecha_apertura)
SELECT id, stock_actual, precio_compra, CURRENT_DATE
FROM public.productos
WHERE activo = true AND stock_actual > 0
ON CONFLICT (producto_id) DO NOTHING;

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
    WHERE (p_from IS NULL OR fecha_apertura >= p_from)
      AND (p_to IS NULL OR fecha_apertura <= p_to)
      AND (p_producto_id IS NULL OR producto_id = p_producto_id)
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
