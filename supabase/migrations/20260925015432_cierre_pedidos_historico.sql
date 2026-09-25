-- 20260925015432_cierre_pedidos_historico.sql
-- Flujo de cierre de pedidos: separacion estricta entre pedidos activos
-- (estado_cocina: pendiente/preparando/listo/entregado) e historico
-- (estado_cocina: confirmada/cortesia/cancelada).
--
-- Columnas de auditoria del cierre:
--   motivo_cierre: comentario obligatorio al cancelar (y opcional en otros cierres)
--   cerrado_en:    fecha/hora del cierre
--   cerrado_por:   usuario que cerro el pedido

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS motivo_cierre TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cerrado_en TIMESTAMPTZ;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cerrado_por UUID REFERENCES perfiles(id) ON DELETE SET NULL;

-- Indice para separar rapidamente activos de historico
CREATE INDEX IF NOT EXISTS idx_ventas_estado_cocina ON ventas(estado_cocina);

-- Permitir los nuevos estados financieros y de cocina (cierre)
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_estado_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_estado_check
  CHECK (estado IN ('completada', 'anulada', 'pendiente', 'cortesia', 'cancelada'));

ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_estado_cocina_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_estado_cocina_check
  CHECK (estado_cocina IN ('pendiente', 'preparando', 'listo', 'entregado', 'confirmada', 'cortesia', 'cancelada'));
