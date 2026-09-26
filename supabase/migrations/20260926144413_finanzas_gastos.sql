-- 20260926144413_finanzas_gastos.sql
-- Modulo Finanzas: gastos operativos + permiso granular.
--
--   gastos: gastos operativos del negocio (arriendo, servicios, nomina, etc.)
--   perfiles.puede_ver_finanzas: acceso al modulo de finanzas

CREATE TABLE IF NOT EXISTS gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria TEXT NOT NULL DEFAULT 'otros',
  descripcion TEXT,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  usuario_id UUID REFERENCES perfiles(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);

-- Permiso granular para el modulo de finanzas
ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS puede_ver_finanzas BOOLEAN DEFAULT false;

-- El admin siempre tiene acceso
UPDATE perfiles SET puede_ver_finanzas = true WHERE role = 'admin';
