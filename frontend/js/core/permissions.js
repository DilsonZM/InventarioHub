// core/permissions.js
// Gestion de permisos por usuario y por visitante (modo publico).
// Antes: `window.can` y `applyPermissionsToUI` vivian en app.js.
// `applyPermissionsToUI` requiere el DOM ya renderizado, asi que se
// llama desde shell/user.js en el momento adecuado.

import { $ } from './dom.js';
import { store } from './store.js';

export function can(perm) {
  if (!store.state.user || !store.state.user.permisos) return false;
  return !!store.state.user.permisos[perm];
}

// Plantillas de permisos por rol, identicas a las que ya existian
// en app.js (se usan al crear usuarios desde el modulo de Users).
export const PERM_LABELS = {
  puede_crear_productos: 'Crear productos',
  puede_editar_productos: 'Editar productos',
  puede_eliminar_productos: 'Eliminar productos',
  puede_crear_salidas: 'Crear ventas',
  puede_editar_salidas: 'Editar ventas',
  puede_eliminar_salidas: 'Eliminar ventas',
  puede_crear_entradas: 'Crear entradas (compras)',
  puede_editar_entradas: 'Editar entradas',
  puede_eliminar_entradas: 'Eliminar entradas',
  puede_gestionar_usuarios: 'Gestionar usuarios',
  puede_ver_inventario: 'Ver inventario',
  puede_ver_movimientos: 'Ver movimientos',
  puede_ver_dashboard: 'Ver dashboard'
};

export function buildPermsObj(perms) {
  var out = {};
  Object.keys(PERM_LABELS).forEach(function (k) {
    out[k] = !!(perms && perms[k]);
  });
  return out;
}

export function plantillaPorRolFrontend(role) {
  if (role === 'admin') {
    return buildPermsObj({
      puede_crear_productos: true, puede_editar_productos: true, puede_eliminar_productos: true,
      puede_crear_salidas: true, puede_editar_salidas: true, puede_eliminar_salidas: true,
      puede_crear_entradas: true, puede_editar_entradas: true, puede_eliminar_entradas: true,
      puede_gestionar_usuarios: true,
      puede_ver_inventario: true, puede_ver_movimientos: true, puede_ver_dashboard: true
    });
  }
  return buildPermsObj({
    puede_crear_productos: false, puede_editar_productos: false, puede_eliminar_productos: false,
    puede_crear_salidas: true,  puede_editar_salidas: false, puede_eliminar_salidas: false,
    puede_crear_entradas: false, puede_editar_entradas: false, puede_eliminar_entradas: false,
    puede_gestionar_usuarios: false,
    puede_ver_inventario: true, puede_ver_movimientos: true, puede_ver_dashboard: true
  });
}

// Aplica permisos al sidebar y a cualquier [data-requires-permission].
// Se invoca una vez despues de tener `state.user` cargado.
export function applyPermissionsToUI() {
  var navItems = {
    dashboard: 'puedeVerDashboard',
    inventory: 'puedeVerInventario',
    sales: 'puedeVerMovimientos',
    entradas: 'puedeVerMovimientos',
    movimientos: 'puedeVerMovimientos',
    users: 'puedeGestionarUsuarios',
    config: 'puedeGestionarUsuarios',
    dishes: 'puedeVerInventario',
    pos: 'puedeVerMovimientos'
  };
  Object.keys(navItems).forEach(function (view) {
    var link = document.querySelector('a[data-nav="' + view + '"]');
    if (link) {
      var canSee = can(navItems[view]);
      link.style.display = canSee ? '' : 'none';
    }
  });
  document.querySelectorAll('[data-requires-permission]').forEach(function (el) {
    var perm = el.getAttribute('data-requires-permission');
    el.style.display = can(perm) ? '' : 'none';
  });
}

// Compatibilidad con el codigo heredado
if (typeof window !== 'undefined') {
  window.can = can;
  window.PERM_LABELS = PERM_LABELS;
  window.buildPermsObj = buildPermsObj;
  window.plantillaPorRolFrontend = plantillaPorRolFrontend;
  window.applyPermissionsToUI = applyPermissionsToUI;
}
