# InventarioHub

Sistema de gestión de inventario y ventas desarrollado con Node.js, Express y Vanilla JavaScript.

## Estado Actual

> ⚠️ **EN DESARROLLO** - La aplicación actualmente no muestra información en el dashboard. Se está trabajando en resolver problemas de integración con Supabase.

## Tecnologías

- **Backend**: Node.js + Express
- **Base de datos**: Supabase (PostgreSQL)
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Autenticación**: JWT
- **Deploy**: Vercel

## Características

- ✅ Autenticación de usuarios (admin/vendedor)
- ✅ Base de datos Supabase configurada
- ✅ Schema SQL con 7 tablas
- ✅ Datos semilla (10 productos, 3 usuarios, 5 categorías)
- ⚠️ Dashboard sin mostrar datos (en progreso)
- ⚠️ Menú lateral no funcional (en progreso)

## Estructura del Proyecto

```
inventory-app/
├── backend/
│   ├── routes/          # Rutas API (auth, products, sales)
│   ├── middleware/      # Middleware de autenticación
│   ├── lib/            # Cliente Supabase
│   └── server.js       # Servidor Express
├── frontend/
│   ├── js/             # JavaScript (api.js, app.js, utils.js)
│   ├── views/          # Páginas HTML (login)
│   └── index.html      # SPA principal
├── supabase/
│   └── schema.sql      # Schema de base de datos
└── docs/               # Documentación
```

## Base de Datos

### Tablas
- `perfiles` - Usuarios del sistema
- `categorias` - Categorías de productos
- `productos` - Catálogo de productos
- `proveedores` - Proveedores
- `movimientos_inventario` - Entradas/salidas de stock
- `ventas` - Cabecera de ventas
- `venta_detalles` - Items de venta

### Funciones
- `registrar_movimiento()` - Registra movimientos y actualiza stock
- `procesar_venta()` - Procesa ventas completas con múltiples items

### Datos Semilla
- 3 usuarios (admin, vendedor1, vendedor2)
- 5 categorías
- 3 proveedores
- 10 productos de ejemplo
- 3 movimientos de inventario

## Credenciales de Prueba

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | admin123 | Administrador |
| vendedor1 | admin123 | Vendedor |

## Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/DilsonZM/InventarioHub.git
cd InventarioHub

# Instalar dependencias
cd backend
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# Iniciar servidor
npm start
```

## Variables de Entorno

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
JWT_SECRET=tu-clave-secreta
PORT=3000
```

## Links

- **GitHub**: https://github.com/DilsonZM/InventarioHub
- **Producción**: https://inventory-app-one-azure.vercel.app
- **Supabase**: https://supabase.com/dashboard/project/zosuleqcmhwoivbjurew

## Issues Conocidos

1. **Dashboard no muestra datos**: Las APIs funcionan correctamente pero el frontend no renderiza la información
2. **Menú lateral no funcional**: Los enlaces de navegación no responden
3. **Problema de scope**: Variables globales y alcance de funciones en proceso de refactorización

## Próximos Pasos

- [ ] Debuggear carga de datos en dashboard
- [ ] Arreglar navegación del menú lateral
- [ ] Validar integración completa frontend-backend
- [ ] Testing de flujo completo de ventas
- [ ] Optimización de rendimiento

## Licencia

MIT

---

**Nota**: Este proyecto está en desarrollo activo. Algunas funcionalidades pueden no estar completas.
