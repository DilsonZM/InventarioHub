# InventarioHub

Sistema de gestión de inventario y ventas con control de stock, procesamiento atómico de ventas, y autenticación basada en roles.

**[InventarioHub en Producción](https://inventory-app-one-azure.vercel.app)**

## Tecnologías

![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?logo=chartdotjs&logoColor=white)

- **Backend**: Node.js + Express
- **Base de datos**: Supabase (PostgreSQL) — 7 tablas, 2 funciones RPC, 3 vistas
- **Frontend**: Vanilla JavaScript (SPA con hash routing) + Tailwind CSS + Chart.js
- **Autenticación**: JWT con bcrypt, roles admin/vendedor
- **Deploy**: Vercel con `@vercel/node`

## Características

- Dashboard con estadísticas en tiempo real (productos, ventas del día, stock bajo, valor de inventario)
- CRUD completo de productos con búsqueda, filtro por categoría y paginación
- Registro de ventas con procesamiento atómico (validación de stock, decremento, registro de movimientos)
- Filtros de ventas por fecha, método de pago y períodos rápidos (hoy/semana/mes/trimestre/año)
- Gráfico de distribución de ventas por categoría (Chart.js doughnut)
- Tema claro/oscuro con toggle persistente (localStorage + detección del sistema)
- Diseño responsive: tablas en desktop, cards en móvil
- Sidebar colapsable en móvil/tablet
- Soft-delete de productos (activo=false)

## Base de Datos

### Tablas
| Tabla | Propósito |
|-------|-----------|
| `perfiles` | Usuarios (bcrypt password_hash, roles admin/vendedor) |
| `categorias` | Categorías de productos |
| `proveedores` | Proveedores |
| `productos` | Productos con stock, precios, SKU |
| `movimientos_inventario` | Auditoría de entradas/salidas/ajustes |
| `ventas` | Cabecera de ventas |
| `venta_detalles` | Items por venta |

### Funciones RPC
- `registrar_movimiento()` — Registra movimiento y actualiza stock
- `procesar_venta()` — Venta atómica con validación de stock y cálculo de impuestos (19%)

### Vistas
- `vista_productos_completo` — Productos con categoría y proveedor
- `vista_stock_bajo` — Productos bajo stock mínimo
- `vista_ventas_resumen` — Ventas con vendedor y cantidad de items

### Datos Semilla
- 3 usuarios (admin, vendedor1, vendedor2)
- 5 categorías
- 3 proveedores
- 10 productos de ejemplo

## Demo

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `admin` | `admin123` | Administrador |
| `vendedor1` | `admin123` | Vendedor |

## Instalación Local

```bash
git clone https://github.com/DilsonZM/InventarioHub.git
cd InventarioHub/backend
npm install
cp .env.example .env
# Editar .env con credenciales de Supabase
npm start        # http://localhost:3000
npm run dev      # modo watch (Node 18+)
```

## Variables de Entorno

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
JWT_SECRET=tu-clave-secreta
PORT=3000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173  # opcional
```

## Estructura

```
InventarioHub/
├── backend/
│   ├── routes/           # auth.js, products.js, sales.js
│   ├── middleware/       # auth.js (JWT + adminOnly)
│   ├── lib/              # supabase.js (cliente)
│   └── server.js         # Express (API + static files)
├── frontend/
│   ├── js/               # api.js, app.js, utils.js, theme.js
│   ├── views/            # login.html
│   └── index.html        # SPA principal
├── supabase/migrations/  # Migraciones aplicadas
├── .agents/skills/       # Skills de agentes
└── docs/                 # API contract, changelog, setup
```

## Links

- **Producción**: [inventory-app-one-azure.vercel.app](https://inventory-app-one-azure.vercel.app)
- **GitHub**: [DilsonZM/InventarioHub](https://github.com/DilsonZM/InventarioHub)
- **Supabase Dashboard**: [Project zosuleqcmhwoivbjurew](https://supabase.com/dashboard/project/zosuleqcmhwoivbjurew)
- **Vercel Dashboard**: [dilson-zm-s-projects/inventory-app](https://vercel.com/dilson-zm-s-projects/inventory-app)

## API Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/register` | No | Registro |
| GET | `/api/auth/me` | JWT | Usuario actual |
| GET | `/api/products` | JWT | Listar productos (paginado) |
| GET | `/api/products/:id` | JWT | Producto por ID |
| GET | `/api/products/categories/list` | JWT | Categorías |
| GET | `/api/products/low-stock` | JWT | Stock bajo |
| POST | `/api/products` | Admin | Crear producto |
| PUT | `/api/products/:id` | Admin | Actualizar producto |
| DELETE | `/api/products/:id` | Admin | Soft-delete producto |
| GET | `/api/sales` | JWT | Listar ventas (paginado) |
| GET | `/api/sales/:id` | JWT | Venta por ID |
| POST | `/api/sales` | JWT | Crear venta |
| GET | `/api/stats` | JWT | Estadísticas dashboard |
| GET | `/api/health` | No | Health check |

## Licencia

MIT
