-- 20260926174500_orders_create_permission.sql
-- Agrega el permiso "orders.create" (crear pedidos/comandas) a los roles
-- base que ya creaban pedidos por POS: Administrador y Vendedor / Mesero.

UPDATE roles
SET permissions = permissions || '["orders.create"]'::jsonb,
    actualizado_en = now()
WHERE id IN ('admin', 'vendedor')
  AND NOT (permissions @> '["orders.create"]'::jsonb);
