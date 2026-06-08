# InventarioHub

Sistema de gestión de inventario y salidas de materia prima para restaurantes de comida rápida, con control de stock atómico, registro por cocina, y autenticación basada en roles.

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
- **Autenticación**: JWT con bcrypt, roles `admin` / `vendedor`
- **Deploy**: Vercel con `@vercel/node`

## Características

### Inventario
- CRUD completo de productos con búsqueda, filtro por categoría, filtro por unidad y paginación
- Soft-delete de productos (`activo = false`)
- Vista de stock bajo con alerta visual
- Selector inteligente de unidad (cambia opciones según categoría)
- Validación de stock máximo en salidas

### Salidas (Ventas)
- Registro de salidas con selección de cocina y productos
- Procesamiento atómico vía `procesar_venta()` RPC: valida stock, descuenta, registra movimiento
- Modal elegante para detalle de venta (no `alert`)
- Filtros estandarizados: rango de fechas + periodo rápido + producto + cocina

### Entradas (Compras)
- Registro de entradas a inventario con proveedor
- Procesamiento atómico vía `registrar_movimiento()` RPC
- Filtros estandarizados: rango de fechas + periodo rápido + producto

### Movimientos
- Auditoría completa: entradas, salidas, ajustes
- Filtros estandarizados: rango de fechas + periodo rápido + producto + tipo
- Columna "Usuario" muestra el `nombre_completo` de quien registró el movimiento

### Dashboard
- Estadísticas en tiempo real (productos, salidas, stock bajo, valor de inventario)
- Auto-refresh cada 30s
- Barra de filtros: rango de fechas + periodo rápido (aplica a stats y movimientos recientes)
- Gráfico de distribución de salidas por categoría (Chart.js doughnut)

### UX/UI
- Tema claro/oscuro con toggle persistente (localStorage + detección del sistema)
- Animaciones de login (fade/scale), dashboard (staggered fade-in)
- Diseño responsive mobile-first: tablas en desktop, cards en móvil
- Sidebar colapsable en móvil/tablet
- Tipografía fluida (`clamp()`), unidades dinámicas (`dvh`)
- Soporte para `prefers-reduced-motion`
- Date inputs con estilo minimalista custom (oculta chrome nativo del navegador)
- Filtros de fecha en formato "cápsula" (dos inputs visualmente conectados)
- `formatCurrency` inteligente: omite `.00` en valores enteros

## Base de Datos

### Tablas
| Tabla | Propósito |
|-------|-----------|
| `perfiles` | Usuarios (bcrypt `password_hash`, `nombre_completo`, roles) |
| `categorias` | Categorías de productos |
| `proveedores` | Proveedores |
| `productos` | Productos con stock, precios, SKU, unidad de medida |
| `movimientos_inventario` | Auditoría de entradas/salidas/ajustes |
| `ventas` | Cabecera de salidas (con campo `metodo_pago` usado para "cocina") |
| `venta_detalles` | Items por salida |

### Funciones RPC
- `registrar_movimiento()` — Registra movimiento y actualiza stock
- `procesar_venta()` — Salida atómica con validación de stock y cálculo de impuestos

### Vistas
- `vista_productos_completo` — Productos con categoría y proveedor
- `vista_stock_bajo` — Productos bajo stock mínimo
- `vista_ventas_resumen` — Ventas con vendedor y cantidad de items

### Datos Semilla
- 2 usuarios (admin, vendedor1)
- 5 categorías
- 4 proveedores
- 23 productos de materia prima para comida rápida (aceites, carnes, vegetales, lácteos, abarrotes)

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
│   ├── routes/           # auth.js, products.js, sales.js, compras.js, reportes.js
│   ├── middleware/       # auth.js (JWT + adminOnly)
│   ├── lib/              # supabase.js (cliente)
│   └── server.js         # Express (API + static files)
├── frontend/
│   ├── js/               # api.js, app.js, utils.js, theme.js
│   ├── views/            # login.html
│   └── index.html        # SPA principal
├── supabase/migrations/  # Migraciones aplicadas
├── .agents/skills/       # Skills de agentes
└── docs/
    ├── API_CONTRACT.md
    ├── CHANGELOG.md
    ├── SUPABASE_SETUP.md
    └── cotizacion/       # Propuesta comercial (MD, HTML, PDF)
```

## Propuesta Comercial

Plantilla de cotización para presentar el sistema a clientes (tiendas de comida rápida).

```
docs/cotizacion/
├── propuesta.md          # Fuente en Markdown
├── propuesta.html        # Plantilla visual (con CSS para impresión)
├── propuesta.pdf         # PDF generado listo para enviar
└── generate_pdf.py       # Regenera el PDF desde el HTML
```

### Paquetes incluidos en la propuesta

| Paquete | Precio | Soporte bugs | Highlights |
|---|---|---|---|
| 🥉 Inicial | $500.000 (único) | 3 meses | Web app, 5 usuarios, dominio .com, capacitación 2h |
| 🥈 Profesional | $1.200.000 (único) | 12 meses | + 3 reportes personalizados, alertas, auditoría avanzada, capacitación presencial |
| 🥇 Premium | $2.500.000 (único) | 24/7 | + multi-sucursal, app móvil, facturación DIAN |

**Mantenimiento mensual** (a partir del año 2): $150.000/mes o $1.440.000/año (20% off).
**Módulos nuevos** (futuro): desde $400.000.

### Regenerar el PDF

```bash
pip install weasyprint --break-system-packages
python3 docs/cotizacion/generate_pdf.py
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
| GET | `/api/products/suppliers/list` | JWT | Proveedores |
| GET | `/api/products/low-stock` | JWT | Stock bajo |
| POST | `/api/products` | Admin | Crear producto |
| PUT | `/api/products/:id` | Admin | Actualizar producto |
| DELETE | `/api/products/:id` | Admin | Soft-delete producto |
| GET | `/api/sales` | JWT | Listar salidas (paginado, filtros: `from`, `to`, `cocina`, `search`) |
| GET | `/api/sales/:id` | JWT | Salida por ID con detalles |
| POST | `/api/sales` | JWT | Crear salida (atómico vía RPC) |
| GET | `/api/compras` | JWT | Listar entradas (filtros: `from`, `to`, `search`) |
| POST | `/api/compras` | Admin | Crear entrada |
| GET | `/api/reportes/movimientos` | JWT | Listar movimientos (filtros: `from`, `to`, `tipo`, `search`) |
| GET | `/api/stats` | JWT | Estadísticas dashboard (filtros: `from`, `to`) |
| GET | `/api/health` | No | Health check |

## Licencia

MIT
