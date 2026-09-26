-- 20260926160945_limpieza_total_pedidos_reservas_movimientos.sql
-- Limpieza one-time: deja en cero pedidos (ventas), reservas y movimientos.
--   venta_detalles y reserva_items se eliminan en cascada.
--
-- NO toca stock (productos.stock_actual), compras, inventario_aperturas,
-- gastos, productos, platos, categorias, proveedores ni perfiles.

DELETE FROM ventas;
DELETE FROM reservas;
DELETE FROM movimientos_inventario;
