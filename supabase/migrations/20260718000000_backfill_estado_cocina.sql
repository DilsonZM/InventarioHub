-- ============================================
-- Backfill: estado_cocina en ventas
-- ============================================
-- La columna estado_cocina fue anadida manualmente a la DB de produccion
-- pero no estaba en version control. Esta migracion la registra
-- oficialmente. Es idempotente (IF NOT EXISTS) para no fallar si ya existe.
-- ============================================

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado_cocina VARCHAR DEFAULT 'pendiente';

-- Asegurar el CHECK constraint (dropar si existe uno distinto, recrear)
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_estado_cocina_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_estado_cocina_check
  CHECK (estado_cocina IN ('pendiente', 'preparando', 'listo', 'entregado'));

-- Indice para queries de cocina (pendiente, preparando, etc.)
CREATE INDEX IF NOT EXISTS idx_ventas_estado_cocina ON ventas(estado_cocina);
