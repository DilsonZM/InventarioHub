// lib/permissions.js
// Catalogo central de permisos RBAC. Unica fuente de verdad para:
//   - la matriz de la vista "Roles y Permisos" (via GET /api/roles/catalogo)
//   - la validacion de permisos al crear/editar roles
//   - el chequeo de permisos del middleware (requirePermission)
//
// Los permisos son strings "modulo.accion". Los tipos 'view' | 'create' |
// 'edit' | 'delete' se muestran como columnas de la matriz; 'action' son
// acciones de negocio propias de cada modulo.

const CATALOG = [
  {
    id: 'dashboard', name: 'Dashboard', icon: '📊',
    permissions: [
      { key: 'dashboard.view', label: 'Ver dashboard', type: 'view' }
    ]
  },
  {
    id: 'pos', name: 'POS', icon: '🛒',
    permissions: [
      { key: 'pos.use', label: 'Usar POS (crear pedidos)', type: 'action' },
      { key: 'pos.discount', label: 'Aplicar descuentos', type: 'action' },
      { key: 'pos.tip', label: 'Editar propina', type: 'action' }
    ]
  },
  {
    id: 'orders', name: 'Pedidos', icon: '🧾',
    permissions: [
      { key: 'orders.view', label: 'Ver', type: 'view' },
      { key: 'orders.create', label: 'Crear', type: 'create' },
      { key: 'orders.edit', label: 'Editar', type: 'edit' },
      { key: 'orders.delete', label: 'Eliminar', type: 'delete' },
      { key: 'orders.status', label: 'Cambiar estado', type: 'action' },
      { key: 'orders.payment', label: 'Registrar pago', type: 'action' }
    ]
  },
  {
    id: 'products', name: 'Productos & Platos', icon: '📦',
    permissions: [
      { key: 'products.view', label: 'Ver', type: 'view' },
      { key: 'products.create', label: 'Crear', type: 'create' },
      { key: 'products.edit', label: 'Editar', type: 'edit' },
      { key: 'products.delete', label: 'Eliminar', type: 'delete' }
    ]
  },
  {
    id: 'purchases', name: 'Entradas (Compras)', icon: '🚚',
    permissions: [
      { key: 'purchases.view', label: 'Ver', type: 'view' },
      { key: 'purchases.create', label: 'Crear', type: 'create' },
      { key: 'purchases.edit', label: 'Editar', type: 'edit' },
      { key: 'purchases.delete', label: 'Eliminar', type: 'delete' }
    ]
  },
  {
    id: 'movements', name: 'Movimientos', icon: '🔄',
    permissions: [
      { key: 'movements.view', label: 'Ver', type: 'view' },
      { key: 'movements.merma', label: 'Registrar mermas', type: 'action' }
    ]
  },
  {
    id: 'reservations', name: 'Reservas', icon: '📅',
    permissions: [
      { key: 'reservations.view', label: 'Ver', type: 'view' },
      { key: 'reservations.status', label: 'Cambiar estado', type: 'action' },
      { key: 'reservations.delete', label: 'Eliminar', type: 'delete' }
    ]
  },
  {
    id: 'finance', name: 'Finanzas / Histórico', icon: '💰',
    permissions: [
      { key: 'finance.view', label: 'Ver finanzas', type: 'view' },
      { key: 'finance.gastos', label: 'Registrar gastos', type: 'action' },
      { key: 'history.view', label: 'Ver histórico', type: 'view' }
    ]
  },
  {
    id: 'admin', name: 'Usuarios & Config', icon: '⚙️',
    permissions: [
      { key: 'users.manage', label: 'Gestionar usuarios y roles', type: 'action' },
      { key: 'config.manage', label: 'Configuración', type: 'action' }
    ]
  }
];

const ALL_KEYS = CATALOG.reduce(function (acc, m) {
  m.permissions.forEach(function (p) { acc.push(p.key); });
  return acc;
}, []);

function isValidPermission(key) {
  return ALL_KEYS.indexOf(key) !== -1;
}

// Limpia una lista de permisos: solo claves validas, sin duplicados.
function sanitizePermissions(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach(function (k) {
    if (isValidPermission(k) && out.indexOf(k) === -1) out.push(k);
  });
  return out;
}

// Extrae el array de permisos de un rol (JSONB) de forma segura.
function rolePermissions(role) {
  if (!role || !Array.isArray(role.permissions)) return [];
  return role.permissions.filter(isValidPermission);
}

module.exports = { CATALOG, ALL_KEYS, isValidPermission, sanitizePermissions, rolePermissions };
