-- 20260926171630_rbac_roles.sql
-- RBAC: tabla roles + perfiles.role_id. Los usuarios heredan los permisos
-- de su rol; se elimina la asignacion manual por usuario (columnas viejas
-- quedan como respaldo pero ya no se usan).
--
-- Permisos por modulo/accion (strings "modulo.accion"):
--   dashboard.view
--   pos.use, pos.discount, pos.tip
--   orders.view, orders.edit, orders.delete, orders.status, orders.payment
--   products.view, products.create, products.edit, products.delete
--   purchases.view, purchases.create, purchases.edit, purchases.delete
--   movements.view, movements.merma
--   reservations.view, reservations.status, reservations.delete
--   finance.view, finance.gastos, history.view
--   users.manage, config.manage

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Roles base del sistema
INSERT INTO roles (id, name, description, permissions, is_system) VALUES
('admin', 'Administrador', 'Acceso total al sistema', '[
  "dashboard.view",
  "pos.use","pos.discount","pos.tip",
  "orders.view","orders.edit","orders.delete","orders.status","orders.payment",
  "products.view","products.create","products.edit","products.delete",
  "purchases.view","purchases.create","purchases.edit","purchases.delete",
  "movements.view","movements.merma",
  "reservations.view","reservations.status","reservations.delete",
  "finance.view","finance.gastos","history.view",
  "users.manage","config.manage"
]'::jsonb, true),
('vendedor', 'Vendedor / Mesero', 'POS, pedidos y reservas', '[
  "dashboard.view",
  "pos.use",
  "orders.view",
  "products.view",
  "reservations.view"
]'::jsonb, true),
('cocina', 'Cocina / Barra', 'Ver pedidos, cambiar estado y consultar stock', '[
  "orders.view",
  "orders.status",
  "products.view"
]'::jsonb, true),
('cajero', 'Cajero', 'POS, pagos y registro de gastos', '[
  "pos.use",
  "orders.view",
  "orders.status",
  "orders.payment",
  "products.view",
  "finance.gastos"
]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- Relacion usuario -> rol
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS role_id TEXT REFERENCES roles(id) ON DELETE RESTRICT;

-- Migrar usuarios existentes:
--   admin o quien gestiona usuarios -> Administrador
--   el resto -> Vendedor / Mesero
UPDATE perfiles SET role_id = CASE
  WHEN role = 'admin' OR puede_gestionar_usuarios = true THEN 'admin'
  ELSE 'vendedor'
END
WHERE role_id IS NULL;

-- Mantener el slug 'role' en sincronia (compatibilidad con JWT y UI)
UPDATE perfiles SET role = role_id WHERE role IS DISTINCT FROM role_id;

ALTER TABLE perfiles ALTER COLUMN role_id SET DEFAULT 'vendedor';
ALTER TABLE perfiles ALTER COLUMN role_id SET NOT NULL;

-- El slug 'role' ahora puede ser cualquier rol (admin, vendedor, cocina,
-- cajero o roles personalizados); el FK role_id es la fuente de verdad.
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_role_check;
