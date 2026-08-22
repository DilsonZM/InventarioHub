-- Agrega direccion_entrega y barrio_entrega a ventas para que los
-- domicilios (POS o web publica) tengan un campo estructurado y se
-- pueda mostrar en la factura y el detalle del pedido. Nullable,
-- no rompe datos existentes.

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS direccion_entrega TEXT,
  ADD COLUMN IF NOT EXISTS barrio_entrega TEXT;

COMMENT ON COLUMN public.ventas.direccion_entrega IS
  'Direccion completa del domicilio. Obligatoria cuando metodo_pago = domicilio.';
COMMENT ON COLUMN public.ventas.barrio_entrega IS
  'Barrio del domicilio (opcional).';

CREATE INDEX IF NOT EXISTS idx_ventas_domicilio
  ON public.ventas (metodo_pago)
  WHERE direccion_entrega IS NOT NULL;
