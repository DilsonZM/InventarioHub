-- ============================================================================
-- Sistema de permisos granulares
-- ============================================================================
-- Cada perfil tiene 13 flags booleanos que determinan exactamente
-- que puede hacer. El campo "role" preexistente se mantiene como
-- una "plantilla" usada solo al crear el usuario (despues los
-- permisos son independientes).
-- ============================================================================

ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS puede_crear_productos BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS puede_editar_productos BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS puede_eliminar_productos BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS puede_crear_salidas BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS puede_editar_salidas BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS puede_eliminar_salidas BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS puede_crear_entradas BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS puede_editar_entradas BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS puede_eliminar_entradas BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS puede_gestionar_usuarios BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS puede_ver_inventario BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS puede_ver_movimientos BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS puede_ver_dashboard BOOLEAN DEFAULT TRUE;

-- Tabla de configuracion de la app (singleton)
CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  modo_publico BOOLEAN DEFAULT FALSE,
  titulo_publico VARCHAR(120) DEFAULT 'InventarioHub',
  actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO app_config (id, modo_publico) VALUES (1, FALSE) ON CONFLICT (id) DO NOTHING;

-- Seed: aplicar permisos a usuarios existentes segun su rol
-- admin: TODO
-- vendedor: solo ventas (crear, ver) y ver
UPDATE perfiles SET
  puede_crear_productos = TRUE,
  puede_editar_productos = TRUE,
  puede_eliminar_productos = TRUE,
  puede_crear_salidas = TRUE,
  puede_editar_salidas = TRUE,
  puede_eliminar_salidas = TRUE,
  puede_crear_entradas = TRUE,
  puede_editar_entradas = TRUE,
  puede_eliminar_entradas = TRUE,
  puede_gestionar_usuarios = TRUE,
  puede_ver_inventario = TRUE,
  puede_ver_movimientos = TRUE,
  puede_ver_dashboard = TRUE
WHERE role = 'admin';

UPDATE perfiles SET
  puede_crear_salidas = TRUE,
  puede_editar_salidas = FALSE,
  puede_eliminar_salidas = FALSE,
  puede_crear_entradas = FALSE,
  puede_editar_entradas = FALSE,
  puede_eliminar_entradas = FALSE,
  puede_gestionar_usuarios = FALSE,
  puede_ver_inventario = TRUE,
  puede_ver_movimientos = TRUE,
  puede_ver_dashboard = TRUE
WHERE role = 'vendedor' AND username != 'admin';

-- RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow backend access" ON app_config FOR ALL USING (true) WITH CHECK (true);
