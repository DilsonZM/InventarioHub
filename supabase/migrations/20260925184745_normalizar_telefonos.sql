-- 20260925184745_normalizar_telefonos.sql
-- Normaliza los telefonos existentes al formato +57XXXXXXXXXX.
-- Regla: celular colombiano de 10 digitos que empieza por 3.
-- Si el telefono no cumple la regla se deja tal cual (se revisa manual).

UPDATE usuarios_publicos
SET telefono = CASE
  WHEN length(regexp_replace(telefono, '\D', '', 'g')) = 12
       AND left(regexp_replace(telefono, '\D', '', 'g'), 2) = '57'
    THEN '+' || regexp_replace(telefono, '\D', '', 'g')
  WHEN length(regexp_replace(telefono, '\D', '', 'g')) = 10
       AND left(regexp_replace(telefono, '\D', '', 'g'), 1) = '3'
    THEN '+57' || regexp_replace(telefono, '\D', '', 'g')
  ELSE telefono
END
WHERE telefono IS NOT NULL;

UPDATE reservas
SET telefono = CASE
  WHEN length(regexp_replace(telefono, '\D', '', 'g')) = 12
       AND left(regexp_replace(telefono, '\D', '', 'g'), 2) = '57'
    THEN '+' || regexp_replace(telefono, '\D', '', 'g')
  WHEN length(regexp_replace(telefono, '\D', '', 'g')) = 10
       AND left(regexp_replace(telefono, '\D', '', 'g'), 1) = '3'
    THEN '+57' || regexp_replace(telefono, '\D', '', 'g')
  ELSE telefono
END
WHERE telefono IS NOT NULL;
