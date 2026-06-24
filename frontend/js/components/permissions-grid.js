// components/permissions-grid.js
// Rejilla de checkboxes de permisos (formulario de crear/editar usuario).
// Antes: la construccion del grid estaba inline en initUsers() de app.js.
// Aqui la extraemos como funcion pura, reutilizable y testeable.

import { $ } from '../core/dom.js';

// PERM_LABELS en camelCase (consistente con app.js, que es el formato
// que el backend espera en perfil.usuario.permisos). NO se importa
// desde core/permissions.js porque ahi esta en snake_case.
export const PERM_LABELS = {
  puedeCrearProductos: 'Crear productos',
  puedeEditarProductos: 'Editar productos',
  puedeEliminarProductos: 'Eliminar productos',
  puedeCrearSalidas: 'Crear salidas',
  puedeEditarSalidas: 'Editar salidas',
  puedeEliminarSalidas: 'Eliminar salidas',
  puedeCrearEntradas: 'Crear entradas',
  puedeEditarEntradas: 'Editar entradas',
  puedeEliminarEntradas: 'Eliminar entradas',
  puedeGestionarUsuarios: 'Gestionar usuarios',
  puedeVerInventario: 'Ver inventario',
  puedeVerMovimientos: 'Ver movimientos',
  puedeVerDashboard: 'Ver dashboard'
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
      puedeCrearProductos: true, puedeEditarProductos: true, puedeEliminarProductos: true,
      puedeCrearSalidas: true, puedeEditarSalidas: true, puedeEliminarSalidas: true,
      puedeCrearEntradas: true, puedeEditarEntradas: true, puedeEliminarEntradas: true,
      puedeGestionarUsuarios: true,
      puedeVerInventario: true, puedeVerMovimientos: true, puedeVerDashboard: true
    });
  }
  return buildPermsObj({
    puedeCrearProductos: false, puedeEditarProductos: false, puedeEliminarProductos: false,
    puedeCrearSalidas: true,  puedeEditarSalidas: false, puedeEliminarSalidas: false,
    puedeCrearEntradas: false, puedeEditarEntradas: false, puedeEliminarEntradas: false,
    puedeGestionarUsuarios: false,
    puedeVerInventario: true, puedeVerMovimientos: true, puedeVerDashboard: true
  });
}

// Renderiza el grid de checkboxes dentro del contenedor #permGrid.
export function renderPermsGrid() {
  var grid = $('#permGrid');
  if (!grid) return;
  grid.innerHTML = Object.keys(PERM_LABELS).map(function (k) {
    return '<label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors">'
      + '<input type="checkbox" id="perm_' + k + '" data-perm="' + k + '" class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500">'
      + '<span>' + PERM_LABELS[k] + '</span>'
      + '</label>';
  }).join('');
}

// Marca todos los checkboxes segun un objeto de permisos.
export function setPermsChecked(perms) {
  Object.keys(PERM_LABELS).forEach(function (k) {
    var cb = $('#perm_' + k);
    if (cb) cb.checked = !!perms[k];
  });
}

// Lee los checkboxes y devuelve un objeto de permisos.
export function readPermsChecked() {
  var out = {};
  Object.keys(PERM_LABELS).forEach(function (k) {
    var cb = $('#perm_' + k);
    out[k] = !!(cb && cb.checked);
  });
  return out;
}

// Conecta los handlers de los botones "Todos" y "Ninguno" del grid.
export function initPermsGridHandlers() {
  var allBtn = $('#permAllBtn');
  if (allBtn) allBtn.addEventListener('click', function () {
    var boxes = document.querySelectorAll('#permGrid input[type=checkbox]');
    boxes.forEach(function (cb) { cb.checked = true; });
  });
  var noneBtn = $('#permNoneBtn');
  if (noneBtn) noneBtn.addEventListener('click', function () {
    var boxes = document.querySelectorAll('#permGrid input[type=checkbox]');
    boxes.forEach(function (cb) { cb.checked = false; });
  });
}

// Compatibilidad con el codigo heredado
if (typeof window !== 'undefined') {
  window.PERM_LABELS = PERM_LABELS;
  window.buildPermsObj = buildPermsObj;
  window.plantillaPorRolFrontend = plantillaPorRolFrontend;
  window.renderPermsGrid = renderPermsGrid;
  window.setPermsChecked = setPermsChecked;
  window.readPermsChecked = readPermsChecked;
  window.initPermsGridHandlers = initPermsGridHandlers;
}
