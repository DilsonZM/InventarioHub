-- 20260918180658_fix_rls_deny_anon_access.sql
-- Fix de seguridad critico.
--
-- Contexto: todas las tablas tenian una politica "Allow backend access" con
-- rol {public}, cmd ALL, qual TRUE y with_check TRUE. Eso daba acceso total
-- (lectura/escritura/borrado) al rol anon, incluida la tabla perfiles con
-- hashes de contrasenas. Ademas, todas las funciones RPC otorgaban EXECUTE
-- a anon/authenticated (procesar_venta, registrar_movimiento, etc.).
--
-- Arquitectura actual: el frontend NO usa supabase-js; todo el acceso pasa
-- por el backend Express con la service_role key, que hace bypass de RLS.
-- Por lo tanto, el acceso anonimo no es necesario y debe quedar en cero.
--
-- Resultado: RLS habilitado sin politicas => anon/authenticated sin acceso.
-- El backend (service_role) sigue funcionando igual.

-- 1) Eliminar las politicas permisivas de todas las tablas/vistas del schema public
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname
           FROM pg_policies
           WHERE schemaname = 'public' AND policyname = 'Allow backend access'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 2) Revocar EXECUTE de funciones publicas a PUBLIC/anon/authenticated.
--    Solo service_role (backend) y postgres (admin) conservan acceso.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
