# Configuración de Supabase para InventarioApp

## Paso 1: Crear proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión o crea una cuenta
3. Click en "New Project"
4. Configura:
   - **Name**: `inventoriohub` (o el nombre que prefieras)
   - **Database Password**: Genera una contraseña segura y guárdala
   - **Region**: Selecciona la más cercana a ti
5. Click en "Create new project"
6. Espera 2-3 minutos mientras se crea el proyecto

## Paso 2: Obtener credenciales

Una vez creado el proyecto:

1. Ve a **Settings** → **API**
2. Copia:
   - **Project URL** (ejemplo: `https://abcdefg.supabase.co`)
   - **service_role key** (la clave secreta, NO la anon key)

## Paso 3: Ejecutar el schema SQL

1. Ve a **SQL Editor** en el menú lateral
2. Click en "New query"
3. Copia TODO el contenido de `supabase/schema.sql`
4. Pégalo en el editor
5. Click en "Run" (o Ctrl+Enter)
6. Verifica que no haya errores

Esto creará:
- Tablas: `users`, `categories`, `products`, `sales`, `sale_items`
- Índices para optimización
- Función `process_sale` para registrar ventas
- Datos iniciales (admin/admin123, productos de ejemplo)

## Paso 4: Configurar variables de entorno

### Para desarrollo local:

Crea un archivo `backend/.env`:

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=cambia-esto-por-una-clave-segura
PORT=3000
```

### Para Vercel:

1. Ve a tu proyecto en Vercel
2. **Settings** → **Environment Variables**
3. Agrega:
   - `SUPABASE_URL` = tu URL de Supabase
   - `SUPABASE_SERVICE_KEY` = tu service_role key
   - `JWT_SECRET` = una clave segura
4. Click en "Save"
5. Redeploy el proyecto

## Paso 5: Verificar la instalación

### Test local:

```bash
cd backend
npm install
npm start
```

Abre http://localhost:3000 y prueba:
- Login: `admin` / `admin123`
- Deberías ver los productos de ejemplo

### Test en producción:

Ve a tu URL de Vercel y prueba el login.

## Estructura de la base de datos

```
users
├── id (UUID)
├── username (VARCHAR)
├── password_hash (VARCHAR)
├── role (admin/vendedor)
└── created_at

categories
├── id (UUID)
└── name (VARCHAR)

products
├── id (UUID)
├── name (VARCHAR)
├── sku (VARCHAR, único)
├── category_id (FK → categories)
├── price (DECIMAL)
├── cost (DECIMAL)
├── stock (INTEGER)
├── min_stock (INTEGER)
├── description (TEXT)
├── active (BOOLEAN)
├── created_at
└── updated_at

sales
├── id (UUID)
├── user_id (FK → users)
├── total (DECIMAL)
├── payment_method (efectivo/tarjeta/transferencia)
└── created_at

sale_items
├── id (UUID)
├── sale_id (FK → sales)
├── product_id (FK → products)
├── product_name (VARCHAR)
├── quantity (INTEGER)
├── unit_price (DECIMAL)
└── subtotal (DECIMAL)
```

## Usuarios por defecto

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Administrador |
| vendedor1 | admin123 | Vendedor |

## Troubleshooting

### Error: "relation does not exist"
- Ejecutaste el schema.sql en Supabase?

### Error: "Invalid API key"
- Verifica que `SUPABASE_SERVICE_KEY` sea la service_role key, NO la anon key

### Error: "Stock insuficiente"
- Es correcto, el producto no tiene suficiente stock
- Verifica el stock en la tabla products

### No veo datos en el dashboard
- Verifica que el schema.sql se ejecutó correctamente
- Revisa la tabla products en Supabase → Table Editor

### Error 401 en login
- Verifica que el usuario existe en la tabla users
- El password debe estar hasheado con SHA-256

## Seguridad

⚠️ **IMPORTANTE**: 
- NUNCA subas el archivo `.env` a Git
- Usa solo `SUPABASE_SERVICE_KEY` en el backend (nunca en el frontend)
- Considera implementar Row Level Security (RLS) para producción
- Cambia la contraseña de admin después del primer login

## Soporte

- Documentación Supabase: https://supabase.com/docs
- Dashboard Supabase: https://app.supabase.com
