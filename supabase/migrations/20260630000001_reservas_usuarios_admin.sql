-- ============================================
-- Reservas: usuarios publicos + gestion admin
-- ============================================
-- Crea la tabla usuarios_publicos para que clientes finales se registren
-- con nombre + WhatsApp (sin email/password), y vincule cada reserva a
-- un usuario para poder consultar su historial.
-- ============================================

-- 1. Tabla de usuarios publicos (clientes finales)
CREATE TABLE IF NOT EXISTS usuarios_publicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(30) UNIQUE NOT NULL,
  total_visitas INTEGER NOT NULL DEFAULT 0,
  ultima_visita TIMESTAMP WITH TIME ZONE,
  notas TEXT,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE usuarios_publicos ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usuarios_publicos' AND policyname = 'Allow backend access'
  ) THEN
    CREATE POLICY "Allow backend access" ON usuarios_publicos FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_usuarios_publicos_telefono ON usuarios_publicos(telefono);

-- 2. Vincular reservas con usuarios_publicos
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios_publicos(id) ON DELETE SET NULL;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS created_by_user BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_reservas_usuario ON reservas(usuario_id);

-- 3. Funcion util: upsert usuario por telefono (devuelve id)
CREATE OR REPLACE FUNCTION upsert_usuario_publico(p_nombre VARCHAR, p_telefono VARCHAR)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM usuarios_publicos WHERE telefono = p_telefono LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO usuarios_publicos (nombre, telefono) VALUES (p_nombre, p_telefono)
      RETURNING id INTO v_id;
  ELSE
    -- Actualizar nombre solo si viene con contenido
    IF p_nombre IS NOT NULL AND length(trim(p_nombre)) > 0 THEN
      UPDATE usuarios_publicos SET nombre = p_nombre, actualizado_en = NOW() WHERE id = v_id;
    END IF;
  END IF;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger para contar visitas y actualizar ultima_visita
CREATE OR REPLACE FUNCTION trg_reserva_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.usuario_id IS NOT NULL THEN
    UPDATE usuarios_publicos
      SET total_visitas = total_visitas + 1,
          ultima_visita = NOW()
      WHERE id = NEW.usuario_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reservas_after_insert') THEN
    CREATE TRIGGER trg_reservas_after_insert
      AFTER INSERT ON reservas
      FOR EACH ROW EXECUTE FUNCTION trg_reserva_after_insert();
  END IF;
END$$;
