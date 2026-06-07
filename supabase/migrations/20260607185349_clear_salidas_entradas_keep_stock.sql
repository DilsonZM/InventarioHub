-- Limpiar salidas y entradas, restaurar stock al inventario inicial

-- Borrar detalles de ventas
DELETE FROM venta_detalles;

-- Borrar ventas
DELETE FROM ventas;

-- Borrar compras
DELETE FROM compras;

-- Borrar todos los movimientos
DELETE FROM movimientos_inventario;

-- Restaurar stock_actual al nivel inicial
UPDATE productos SET stock_actual = CASE sku
  WHEN 'CAR-POL-001' THEN 15
  WHEN 'CAR-RES-001' THEN 8
  WHEN 'CAR-SAL-001' THEN 30
  WHEN 'CAR-TOC-001' THEN 10
  WHEN 'VER-PAP-001' THEN 50
  WHEN 'VER-TOM-001' THEN 12
  WHEN 'VER-CEB-001' THEN 18
  WHEN 'VER-LEC-001' THEN 10
  WHEN 'LAC-MOZ-001' THEN 6
  WHEN 'LAC-CRE-001' THEN 8
  WHEN 'LAC-HUE-001' THEN 15
  WHEN 'SAL-TOM-001' THEN 10
  WHEN 'SAL-MAY-001' THEN 8
  WHEN 'SAL-ROS-001' THEN 6
  WHEN 'HAR-PAN-001' THEN 200
  WHEN 'HAR-PER-001' THEN 150
  WHEN 'HAR-TRI-001' THEN 25
  WHEN 'SAL-ACE-001' THEN 20
  WHEN 'BEB-GAS-001' THEN 60
  WHEN 'BEB-JUG-001' THEN 25
  WHEN 'EMP-VAS-001' THEN 25
  WHEN 'EMP-CON-001' THEN 20
  WHEN 'EMP-SER-001' THEN 40
  ELSE stock_actual
END;
