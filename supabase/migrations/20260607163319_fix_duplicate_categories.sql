-- Fix duplicate categories: "Electronica" (sin tilde) es duplicado de "Electrónica" (con tilde)
-- Reasignar productos de "Electronica" → "Electrónica", luego eliminar "Electronica"

DO $$
DECLARE
  cat_bueno UUID;
  cat_malo UUID;
BEGIN
  SELECT id INTO cat_bueno FROM categorias WHERE nombre = 'Electrónica' LIMIT 1;
  SELECT id INTO cat_malo FROM categorias WHERE nombre = 'Electronica' LIMIT 1;

  IF cat_bueno IS NOT NULL AND cat_malo IS NOT NULL THEN
    -- Reasignar productos
    UPDATE productos SET categoria_id = cat_bueno WHERE categoria_id = cat_malo;
    -- Eliminar categoria duplicada
    DELETE FROM categorias WHERE id = cat_malo;
  END IF;
END;
$$;
