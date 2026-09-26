-- 20260926174942_superadmin_role.sql
-- Rol Super Admin: acceso total protegido.
--   - Solo su titular (DilsonZM) puede editar su cuenta y su contraseña.
--   - Nadie puede archivarlo ni eliminarlo.
--   - El rol es de sistema: no se elimina ni renombra; solo su titular
--     puede editar sus permisos.

INSERT INTO roles (id, name, description, permissions, is_system)
SELECT
  'superadmin',
  'Super Admin',
  'Acceso total protegido. Solo el titular puede editar su cuenta.',
  permissions,
  true
FROM roles
WHERE id = 'admin'
ON CONFLICT (id) DO NOTHING;

-- Asignar el rol al titular
UPDATE perfiles
SET role_id = 'superadmin', role = 'superadmin'
WHERE username = 'DilsonZM';
