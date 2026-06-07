-- Transformar inventario de tecnologia a materia prima para comidas rapidas

-- Limpiar datos viejos que dependen de productos
DELETE FROM movimientos_inventario;
DELETE FROM venta_detalles;
DELETE FROM ventas;
DELETE FROM compras;

-- Eliminar productos viejos
DELETE FROM productos;

-- Eliminar categorias viejas
DELETE FROM categorias;

-- Eliminar proveedores viejos
DELETE FROM proveedores;

-- Nuevas categorias de alimentos
INSERT INTO categorias (nombre, descripcion) VALUES
('Carnes y Aves', 'Pollo, res, cerdo, pescado y embutidos'),
('Verduras y Tuberculos', 'Papas, tomates, cebollas, lechugas y hortalizas'),
('Lacteos y Huevos', 'Quesos, leche, mantequilla y huevos'),
('Salsas y Aderezos', 'Salsas, mayonesa, mostaza y condimentos'),
('Harinas y Panes', 'Harinas, panes para hamburguesa y perros'),
('Bebidas', 'Gaseosas, jugos y agua'),
('Empaques y Desechables', 'Vasos, platos, servilletas y empaques')
ON CONFLICT (nombre) DO NOTHING;

-- Nuevos proveedores de alimentos
INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, ciudad) VALUES
('DistriCarnes La Finca', 'Pedro Ramirez', '+57 310 111 2233', 'pedidos@districarnes.com', 'Cra 80 #45-23', 'Medellin'),
('Fruver del Campo S.A.S', 'Maria Ochoa', '+57 315 444 5566', 'ventas@fruvercampo.com', 'Central Mayorista', 'Medellin'),
('Lacteos El Buen Pastor', 'Carlos Mejia', '+57 300 777 8899', 'info@lacteospastor.com', 'Cl 30 #65-12', 'Medellin'),
('DistriSalsas y Condimentos', 'Laura Torres', '+57 320 222 3344', 'pedidos@distrisalsas.com', 'Av 65 #30-15', 'Bello')
ON CONFLICT DO NOTHING;

-- Nuevos productos: materia prima para comidas rapidas
INSERT INTO productos (nombre, descripcion, sku, codigo_barras, precio_compra, precio_venta, stock_actual, stock_minimo, categoria_id, proveedor_id, unidad_medida)
SELECT
  p.nombre, p.descripcion, p.sku, p.codigo_barras,
  p.precio_compra, p.precio_venta, p.stock_actual, p.stock_minimo,
  (SELECT id FROM categorias WHERE nombre = p.categoria LIMIT 1),
  (SELECT id FROM proveedores WHERE nombre = p.proveedor LIMIT 1),
  p.unidad_medida
FROM (VALUES
  ('Pechuga de Pollo', 'Pechuga de pollo fresca, fileteada para sandwiches', 'CAR-POL-001', '7702001001234', 12000.00, 18000.00, 15, 3, 'Carnes y Aves', 'DistriCarnes La Finca', 'kg'),
  ('Carne de Res Molida', 'Carne molida 80/20 para hamburguesas', 'CAR-RES-001', '7702001001235', 18000.00, 26000.00, 8, 2, 'Carnes y Aves', 'DistriCarnes La Finca', 'kg'),
  ('Salchicha Frankfurt', 'Salchicha tipo frankfurt para perros calientes', 'CAR-SAL-001', '7702001001236', 9500.00, 15000.00, 30, 8, 'Carnes y Aves', 'DistriCarnes La Finca', 'paquete'),
  ('Tocineta Ahumada', 'Tocineta ahumada en tiras para hamburguesas', 'CAR-TOC-001', '7702001001237', 11000.00, 17000.00, 10, 3, 'Carnes y Aves', 'DistriCarnes La Finca', 'lb'),
  ('Papa Amarilla', 'Papa amarilla lavada tipo suprema para freir', 'VER-PAP-001', '7702001002234', 2500.00, 4500.00, 50, 10, 'Verduras y Tuberculos', 'Fruver del Campo S.A.S', 'kg'),
  ('Tomate Chonto', 'Tomate chonto maduro para ensaladas y salsas', 'VER-TOM-001', '7702001002235', 3500.00, 6000.00, 12, 3, 'Verduras y Tuberculos', 'Fruver del Campo S.A.S', 'kg'),
  ('Cebolla Cabezona', 'Cebolla cabezona blanca fresca', 'VER-CEB-001', '7702001002236', 2800.00, 5000.00, 18, 4, 'Verduras y Tuberculos', 'Fruver del Campo S.A.S', 'kg'),
  ('Lechuga Batavia', 'Lechuga batavia fresca para ensaladas', 'VER-LEC-001', '7702001002237', 2000.00, 4000.00, 10, 3, 'Verduras y Tuberculos', 'Fruver del Campo S.A.S', 'unidad'),
  ('Queso Mozzarella', 'Queso mozzarella rallado para hamburguesas y perros', 'LAC-MOZ-001', '7702001003234', 15000.00, 22000.00, 6, 2, 'Lacteos y Huevos', 'Lacteos El Buen Pastor', 'kg'),
  ('Queso Doble Crema', 'Queso doble crema en tajadas para hamburguesas', 'LAC-CRE-001', '7702001003235', 13000.00, 20000.00, 8, 2, 'Lacteos y Huevos', 'Lacteos El Buen Pastor', 'paquete'),
  ('Huevos AA', 'Huevos tipo AA frescos', 'LAC-HUE-001', '7702001003236', 8500.00, 12000.00, 15, 3, 'Lacteos y Huevos', 'Lacteos El Buen Pastor', 'docena'),
  ('Salsa de Tomate', 'Salsa de tomate tipo ketchup para perros y hamburguesas', 'SAL-TOM-001', '7702001004234', 6000.00, 9500.00, 10, 2, 'Salsas y Aderezos', 'DistriSalsas y Condimentos', 'L'),
  ('Mayonesa', 'Mayonesa comercial para comidas rapidas', 'SAL-MAY-001', '7702001004235', 7000.00, 11000.00, 8, 2, 'Salsas y Aderezos', 'DistriSalsas y Condimentos', 'L'),
  ('Salsa Rosada', 'Salsa rosada preparada para ensaladas', 'SAL-ROS-001', '7702001004236', 5500.00, 9000.00, 6, 2, 'Salsas y Aderezos', 'DistriSalsas y Condimentos', 'L'),
  ('Pan Hamburguesa', 'Pan tipo brioche para hamburguesa', 'HAR-PAN-001', '7702001005234', 800.00, 1500.00, 200, 40, 'Harinas y Panes', 'Lacteos El Buen Pastor', 'unidad'),
  ('Pan Perro Caliente', 'Pan alargado para perro caliente', 'HAR-PER-001', '7702001005235', 600.00, 1200.00, 150, 30, 'Harinas y Panes', 'Lacteos El Buen Pastor', 'unidad'),
  ('Harina de Trigo', 'Harina de trigo todo uso para empanizados', 'HAR-TRI-001', '7702001005236', 2200.00, 4000.00, 25, 5, 'Harinas y Panes', 'Fruver del Campo S.A.S', 'kg'),
  ('Aceite Vegetal', 'Aceite vegetal para fritura profunda', 'SAL-ACE-001', '7702001006234', 8000.00, 12000.00, 20, 5, 'Salsas y Aderezos', 'DistriSalsas y Condimentos', 'L'),
  ('Gaseosa 1.5L', 'Gaseosa sabor cola 1.5 litros', 'BEB-GAS-001', '7702001007234', 3200.00, 5500.00, 60, 12, 'Bebidas', 'DistriSalsas y Condimentos', 'unidad'),
  ('Jugo Natural 1L', 'Jugo de fruta natural 1 litro', 'BEB-JUG-001', '7702001007235', 4000.00, 7000.00, 25, 5, 'Bebidas', 'Fruver del Campo S.A.S', 'unidad'),
  ('Vaso Desechable 12oz', 'Vasos desechables 12 onzas paquete x50', 'EMP-VAS-001', '7702001008234', 6500.00, 10000.00, 25, 5, 'Empaques y Desechables', 'DistriSalsas y Condimentos', 'paquete'),
  ('Contenedor Almuerzo', 'Contenedores desechables 3 divisiones paquete x25', 'EMP-CON-001', '7702001008235', 8500.00, 14000.00, 20, 5, 'Empaques y Desechables', 'DistriSalsas y Condimentos', 'paquete'),
  ('Servilletas', 'Servilletas de papel paquete x100', 'EMP-SER-001', '7702001008236', 3500.00, 6000.00, 40, 10, 'Empaques y Desechables', 'DistriSalsas y Condimentos', 'paquete')
) AS p(nombre, descripcion, sku, codigo_barras, precio_compra, precio_venta, stock_actual, stock_minimo, categoria, proveedor, unidad_medida)
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE sku = p.sku);

-- Registrar movimientos de entrada inicial
INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id)
SELECT
  p.id, 'entrada', p.stock_actual, 0, p.stock_actual,
  'Inventario inicial',
  (SELECT id FROM perfiles WHERE username = 'admin')
FROM productos p
WHERE NOT EXISTS (SELECT 1 FROM movimientos_inventario WHERE producto_id = p.id);
