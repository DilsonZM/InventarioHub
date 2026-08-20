ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS tipo_pedido VARCHAR(20) NOT NULL DEFAULT 'mesa',
  ADD COLUMN IF NOT EXISTS direccion_entrega TEXT,
  ADD COLUMN IF NOT EXISTS barrio_entrega VARCHAR(120),
  ADD COLUMN IF NOT EXISTS costo_domicilio NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.reservas
  ALTER COLUMN personas DROP NOT NULL;

ALTER TABLE public.reservas DROP CONSTRAINT IF EXISTS reservas_tipo_pedido_check;
ALTER TABLE public.reservas ADD CONSTRAINT reservas_tipo_pedido_check
  CHECK (tipo_pedido IN ('mesa', 'domicilio'));

ALTER TABLE public.reservas DROP CONSTRAINT IF EXISTS reservas_costo_domicilio_check;
ALTER TABLE public.reservas ADD CONSTRAINT reservas_costo_domicilio_check
  CHECK (costo_domicilio >= 0);

CREATE INDEX IF NOT EXISTS idx_reservas_tipo_fecha
  ON public.reservas (tipo_pedido, fecha, hora);
