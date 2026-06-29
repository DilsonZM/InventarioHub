-- ============================================
-- Reservas: items del menu (carrito)
-- ============================================
-- Una reserva puede incluir platos/bebidas del menu (carrito). Cada
-- item se guarda en reserva_items con su plato, cantidad y precio.
-- El subtotal de platos se persiste en reservas.subtotal_platos para
-- reportes rapidos sin join.
-- ============================================

-- 1. Campos nuevos en reservas
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS subtotal_platos NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS email VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_reservas_email ON reservas(email);

-- 2. Tabla reserva_items (lineas del pedido de la reserva)
CREATE TABLE IF NOT EXISTS reserva_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id UUID NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  plato_id UUID NOT NULL REFERENCES platos(id) ON DELETE RESTRICT,
  plato_nombre VARCHAR(150) NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0 AND cantidad <= 50),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  notas TEXT,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE reserva_items ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reserva_items' AND policyname = 'Allow backend access'
  ) THEN
    CREATE POLICY "Allow backend access" ON reserva_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_reserva_items_reserva ON reserva_items(reserva_id);
CREATE INDEX IF NOT EXISTS idx_reserva_items_plato ON reserva_items(plato_id);

-- 3. Email opcional en usuarios_publicos
ALTER TABLE usuarios_publicos ADD COLUMN IF NOT EXISTS email VARCHAR(150);
