# API Contract - Inventario App

## Base URL: http://localhost:3000/api

## Autenticación
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | /auth/login | Login (username, password) | No |
| GET | /auth/me | Verificar sesión | Sí |

## Productos
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /products | Listar (?category, ?search, ?lowStock) | Sí |
| GET | /products/:id | Detalle producto | Sí |
| POST | /products | Crear producto | Sí |
| PUT | /products/:id | Actualizar producto | Sí |
| DELETE | /products/:id | Eliminar (soft) | Sí |
| GET | /products/categories/list | Lista categorías | Sí |

## Ventas
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /sales | Listar ventas (?from, ?to) | Sí |
| GET | /sales/:id | Detalle venta | Sí |
| POST | /sales | Registrar venta | Sí |

## Stats
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | /stats | Dashboard stats | Sí |

## Modelos de Datos

### Product
```json
{
  "id": "string",
  "name": "string",
  "sku": "string (unique)",
  "category": "string",
  "price": "number",
  "cost": "number",
  "stock": "number",
  "minStock": "number",
  "description": "string",
  "active": "boolean",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

### Sale
```json
{
  "id": "string",
  "items": [{
    "productId": "string",
    "productName": "string",
    "quantity": "number",
    "unitPrice": "number",
    "subtotal": "number"
  }],
  "total": "number",
  "paymentMethod": "string (efectivo|tarjeta|transferencia)",
  "userId": "string",
  "createdAt": "ISO date"
}
```

### Respuesta API
```json
{
  "success": "boolean",
  "data": "object|array",
  "message": "string (solo en error)",
  "errors": "object (solo en validación)"
}
```
