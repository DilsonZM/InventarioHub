-- ============================================
-- InventarioApp - Supabase Schema
-- ============================================

-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: users
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: categories
-- ============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: products
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(50) UNIQUE NOT NULL,
  category_id UUID REFERENCES categories(id),
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: sales
-- ============================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  total DECIMAL(12, 2) NOT NULL CHECK (total >= 0),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABLA: sale_items
-- ============================================
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(200) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0)
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- ============================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCIÓN: registrar venta (resta stock automáticamente)
-- ============================================
CREATE OR REPLACE FUNCTION process_sale(
  p_user_id UUID,
  p_items JSONB,
  p_payment_method VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_product RECORD;
  v_total DECIMAL(12, 2) := 0;
BEGIN
  -- Crear la venta
  INSERT INTO sales (user_id, total, payment_method)
  VALUES (p_user_id, 0, p_payment_method)
  RETURNING id INTO v_sale_id;

  -- Procesar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Obtener producto y verificar stock
    SELECT id, name, price, stock INTO v_product
    FROM products
    WHERE id = (v_item->>'productId')::UUID AND active = true
    FOR UPDATE;

    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado o inactivo';
    END IF;

    IF v_product.stock < (v_item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION 'Stock insuficiente para %', v_product.name;
    END IF;

    -- Insertar item de venta
    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
    VALUES (
      v_sale_id,
      v_product.id,
      v_product.name,
      (v_item->>'quantity')::INTEGER,
      v_product.price,
      v_product.price * (v_item->>'quantity')::INTEGER
    );

    -- Restar stock
    UPDATE products
    SET stock = stock - (v_item->>'quantity')::INTEGER
    WHERE id = v_product.id;

    -- Acumular total
    v_total := v_total + (v_product.price * (v_item->>'quantity')::INTEGER);
  END LOOP;

  -- Actualizar total de la venta
  UPDATE sales SET total = v_total WHERE id = v_sale_id;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Usuario admin (password: admin123)
INSERT INTO users (username, password_hash, role) VALUES
('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin'),
('vendedor1', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'vendedor');

-- Categorías
INSERT INTO categories (name) VALUES
('Electrónica'),
('Accesorios'),
('Oficina'),
('Redes'),
('Almacenamiento');

-- Productos de ejemplo
INSERT INTO products (name, sku, category_id, price, cost, stock, min_stock, description) VALUES
('Laptop HP 15', 'LAP-HP-001', (SELECT id FROM categories WHERE name = 'Electrónica'), 899.99, 650.00, 25, 5, 'Laptop HP 15.6 pulgadas, 8GB RAM, 256GB SSD'),
('Mouse Inalámbrico Logitech', 'MOU-LOG-001', (SELECT id FROM categories WHERE name = 'Accesorios'), 29.99, 15.00, 150, 20, 'Mouse inalámbrico ergonómico'),
('Teclado Mecánico RGB', 'TEC-MEC-001', (SELECT id FROM categories WHERE name = 'Accesorios'), 79.99, 45.00, 3, 10, 'Teclado mecánico con switches Cherry MX'),
('Monitor Samsung 27"', 'MON-SAM-001', (SELECT id FROM categories WHERE name = 'Electrónica'), 349.99, 220.00, 12, 3, 'Monitor 27 pulgadas 4K IPS'),
('Cable HDMI 2m', 'CAB-HDM-001', (SELECT id FROM categories WHERE name = 'Accesorios'), 12.99, 4.50, 200, 30, 'Cable HDMI 2.1 alta velocidad 2 metros'),
('Webcam HD 1080p', 'WEB-HD-001', (SELECT id FROM categories WHERE name = 'Accesorios'), 59.99, 30.00, 8, 5, 'Webcam Full HD con micrófono integrado'),
('Disco Duro Externo 1TB', 'HDD-EXT-001', (SELECT id FROM categories WHERE name = 'Almacenamiento'), 69.99, 40.00, 2, 5, 'Disco duro externo USB 3.0 1TB'),
('Router WiFi 6', 'ROU-WF6-001', (SELECT id FROM categories WHERE name = 'Redes'), 129.99, 75.00, 15, 3, 'Router WiFi 6 doble banda AX1800');

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir todo (ajustar según necesidades)
CREATE POLICY "Allow all for authenticated" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON products FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON sales FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON sale_items FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON categories FOR ALL USING (true);
