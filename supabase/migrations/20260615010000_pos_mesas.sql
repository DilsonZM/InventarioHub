-- Tabla de mesas
CREATE TABLE IF NOT EXISTS mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre varchar NOT NULL,
  activa boolean DEFAULT true,
  creado_en timestamptz DEFAULT now()
);

ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow backend access" ON mesas FOR ALL USING (true) WITH CHECK (true);

-- Seed 10 mesas
INSERT INTO mesas (nombre) VALUES
  ('Mesa 1'), ('Mesa 2'), ('Mesa 3'), ('Mesa 4'), ('Mesa 5'),
  ('Mesa 6'), ('Mesa 7'), ('Mesa 8'), ('Mesa 9'), ('Mesa 10');

-- Imagenes para platos
ALTER TABLE platos ADD COLUMN IF NOT EXISTS imagen_url text;

-- Relacion venta -> mesa
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS mesa_id uuid REFERENCES mesas(id);
