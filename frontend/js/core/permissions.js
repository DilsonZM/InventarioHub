// core/permissions.js
// RBAC: el usuario hereda los permisos de su rol (array de strings
// "modulo.accion" que entrega el backend en user.permissions).
// `can` y `applyPermissionsToUI` se exponen en window para compatibilidad
// con los onclick inline y con el resto de modulos.

import { $ } from './dom.js';
import { store } from './store.js';

export function can(perm) {
  if (!store.state.user) return false;
  var perms = store.state.user.permissions;
  if (!Array.isArray(perms)) return false;
  return perms.indexOf(perm) !== -1;
}

export function canAny(list) {
  if (!Array.isArray(list)) return false;
  return list.some(function (p) { return can(p); });
}

// Vista -> permisos que la habilitan (basta con uno)
const VIEW_PERMISSIONS = {
  dashboard: ['dashboard.view'],
  inventory: ['products.view'],
  sales: ['orders.view'],
  entradas: ['purchases.view'],
  movimientos: ['movements.view'],
  users: ['users.manage'],
  config: ['config.manage'],
  dishes: ['products.view'],
  pos: ['pos.use'],
  reservas: ['reservations.view'],
  historico: ['history.view'],
  finanzas: ['finance.view', 'finance.gastos']
};

export function canAccessView(view) {
  var perms = VIEW_PERMISSIONS[view];
  if (!perms) return true;
  return perms.some(function (p) { return can(p); });
}

// Aplica permisos al sidebar y a cualquier [data-requires-permission]
// (o [data-requires-any] con lista separada por comas).
export function applyPermissionsToUI() {
  Object.keys(VIEW_PERMISSIONS).forEach(function (view) {
    var link = document.querySelector('a[data-nav="' + view + '"]');
    if (link) {
      link.style.display = canAccessView(view) ? '' : 'none';
    }
  });

  document.querySelectorAll('[data-requires-permission]').forEach(function (el) {
    var perm = el.getAttribute('data-requires-permission');
    el.style.display = can(perm) ? '' : 'none';
  });

  document.querySelectorAll('[data-requires-any]').forEach(function (el) {
    var keys = String(el.getAttribute('data-requires-any') || '').split(',').map(function (s) { return s.trim(); });
    el.style.display = keys.some(function (p) { return can(p); }) ? '' : 'none';
  });

  // Ocultar grupos del sidebar que quedaron sin links visibles
  document.querySelectorAll('.sidebar-group').forEach(function (group) {
    var links = Array.from(group.querySelectorAll('a[data-nav]'));
    if (links.length === 0) return;
    var anyVisible = links.some(function (l) { return l.style.display !== 'none'; });
    group.style.display = anyVisible ? '' : 'none';
  });
}

if (typeof window !== 'undefined') {
  window.can = can;
  window.canAny = canAny;
  window.canAccessView = canAccessView;
  window.applyPermissionsToUI = applyPermissionsToUI;
}
