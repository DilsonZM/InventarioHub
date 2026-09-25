-- 20260925180520_ventas_personas.sql
-- Cantidad de personas de una reserva de mesa. Se copia de la reserva al
-- crear el pedido para mostrarla en la vista de Pedidos y en el detalle.

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS personas INTEGER;
