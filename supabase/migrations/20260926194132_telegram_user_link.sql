-- 20260926194132_telegram_user_link.sql
-- RBAC en Telegram: vincula cada usuario de Telegram con un perfil de la
-- app (que tiene rol y permisos). El bot resuelve permisos por este ID.
--
-- El usuario obtiene su ID con el comando /id en Telegram y el admin lo
-- carga desde Usuarios y Roles.

ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_telegram_user_id
  ON perfiles(telegram_user_id)
  WHERE telegram_user_id IS NOT NULL;
