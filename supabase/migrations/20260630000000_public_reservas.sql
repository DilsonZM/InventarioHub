-- ============================================
-- Vista publica: menu digital + reservas
-- ============================================
-- Anade categoria a platos para agrupar visualmente (entradas / platos /
-- bebidas / postres) y crea la tabla reservas para que clientes finales
-- puedan solicitar una mesa desde el menu publico.
-- ============================================

-- 1. Campo categoria en platos (idempotente)
ALTER TABLE platos ADD COLUMN IF NOT EXISTS categoria VARCHAR(40);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platos_categoria_check'
  ) THEN
    ALTER TABLE platos
      ADD CONSTRAINT platos_categoria_check
      CHECK (categoria IS NULL OR categoria IN ('entradas','platos','bebidas','postres'));
  END IF;
END$$;

-- 2. Backfill: asignar categoria segun el tipo donde este NULL
UPDATE platos SET categoria = 'bebidas' WHERE tipo = 'bebida'  AND categoria IS NULL;
UPDATE platos SET categoria = 'platos' WHERE tipo = 'plato'   AND categoria IS NULL;

-- 3. Tabla de reservas
CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  personas INTEGER NOT NULL CHECK (personas > 0 AND personas <= 20),
  notas TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','confirmada','cancelada','completada')),
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reservas' AND policyname = 'Allow backend access'
  ) THEN
    CREATE POLICY "Allow backend access" ON reservas FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_reservas_fecha  ON reservas(fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas(estado);
CREATE INDEX IF NOT EXISTS idx_platos_categoria ON platos(categoria);
