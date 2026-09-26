-- 20260926155742_limpieza_antes_21ago2026.sql
-- Limpieza one-time: elimina la data transaccional anterior al 21/08/2026
-- (hora Bogota, UTC-5 → corte en UTC '2026-08-21 05:00:00+00').
--
--   movimientos_inventario, compras, ventas (+detalles en cascada),
--   reservas (+items en cascada) e insumo_tandas.
--
-- NO toca inventario_aperturas (stock inicial de productos), productos,
-- platos, categorias, proveedores ni perfiles.

DELETE FROM movimientos_inventario WHERE creado_en < '2026-08-21 05:00:00+00';
DELETE FROM compras WHERE fecha_compra < '2026-08-21';
DELETE FROM ventas WHERE creado_en < '2026-08-21 05:00:00+00';
DELETE FROM reservas WHERE fecha < '2026-08-21';
DELETE FROM insumo_tandas WHERE creado_en < '2026-08-21 05:00:00+00';
