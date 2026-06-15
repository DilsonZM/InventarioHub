ALTER TABLE compras DROP COLUMN IF EXISTS valor_total;
ALTER TABLE compras ALTER COLUMN cantidad TYPE numeric(12,4);
ALTER TABLE compras ADD COLUMN valor_total numeric GENERATED ALWAYS AS ((cantidad * valor_unitario)) STORED;
