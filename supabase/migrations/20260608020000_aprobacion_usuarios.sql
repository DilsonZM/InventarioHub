-- ============================================================================
-- Sistema de aprobacion de usuarios
-- ============================================================================
-- Nuevos registros quedan en estado 'pendiente'. Solo el admin puede
-- aprobarlos desde el panel de usuarios. Hasta que sean aprobados:
-- - No pueden iniciar sesion (login rechaza)
-- - No se eliminan (soft-delete con activo=false)
-- ============================================================================

ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS estado_aprobacion VARCHAR(20) DEFAULT 'aprobado',
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT,
  ADD COLUMN IF NOT EXISTS solicitado_en TIMESTAMP WITH TIME ZONE;

-- Los usuarios existentes quedan como aprobados por default
UPDATE perfiles SET estado_aprobacion = 'aprobado' WHERE estado_aprobacion IS NULL;

-- Constraint check
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_estado_aprobacion_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_estado_aprobacion_check
  CHECK (estado_aprobacion IN ('pendiente', 'aprobado', 'rechazado'));
