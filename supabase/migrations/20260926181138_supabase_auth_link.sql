-- 20260926181138_supabase_auth_link.sql
-- Migracion a Supabase Auth: cada perfil se vincula a un usuario de
-- auth.users (auth_id). Las credenciales (contrasena) y los correos de
-- recuperacion los maneja Supabase Auth; el perfil mantiene rol/RBAC.
--
-- La migracion de usuarios existentes (crear auth.users conservando el
-- hash bcrypt actual) se corre con backend/scripts/migrate-auth-users.js

ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_auth_id ON perfiles(auth_id);
