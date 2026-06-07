-- Cambiar metodo_pago de restringido (efectivo/tarjeta/transferencia) a texto libre para cocina
ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_metodo_pago_check;
ALTER TABLE ventas ADD CONSTRAINT ventas_metodo_pago_check CHECK (metodo_pago IS NOT NULL AND length(metodo_pago) > 0);
