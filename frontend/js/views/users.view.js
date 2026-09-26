// views/users.view.js
// Modulo Usuarios y Roles (RBAC):
//   - Tab "Usuarios": datos de perfil + rol asignado (sin permisos individuales)
//   - Tab "Roles y Permisos": lista de roles + matriz de permisos por modulo
// Los permisos de un rol impactan a todos sus usuarios al guardar.

import { $, escapeHtml } from '../core/dom.js';
import { openModal, closeModal, showError, showConfirm } from '../components/modal.js';
import { applyPermissionsToUI, can } from '../core/permissions.js';
import { showToast } from '../components/toast.js';
import { store } from '../core/store.js';

var ui = {
  users: [],
  roles: [],
  catalog: [],
  editingUserId: null,
  editingRoleId: null,
  selectedRoleId: null,
  draftPermissions: [],
  dirty: false,
  roleSearch: '',
  tab: 'users'
};

var ROLE_BADGE = {
  admin: 'bg-violet-100 text-violet-800',
  vendedor: 'bg-brand-100 text-brand-800',
  cocina: 'bg-amber-100 text-amber-800',
  cajero: 'bg-sky-100 text-sky-800'
};

function roleBadge(roleId, roleName) {
  var cls = ROLE_BADGE[roleId] || 'bg-slate-200 text-slate-700';
  return '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ' + cls + '">' + escapeHtml(roleName || roleId || '-') + '</span>';
}

function estadoBadge(u) {
  if (u.estadoAprobacion === 'pendiente') {
    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Pendiente</span>';
  }
  if (u.estadoAprobacion === 'rechazado') {
    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Rechazado</span>';
  }
  if (u.activo === false) {
    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-slate-400 border border-slate-200">Archivado</span>';
  }
  return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Activo</span>';
}

var ICON_EDIT = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>';
var ICON_ARCHIVE = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>';
var ICON_TRASH = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
var ICON_REACTIVATE = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';
var ICON_APPROVE = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
var ICON_REJECT = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';

function initUsers() {
  // Tabs
  var tabUsers = $('#usersTabUsers');
  var tabRoles = $('#usersTabRoles');
  if (tabUsers) tabUsers.addEventListener('click', function () { switchTab('users'); });
  if (tabRoles) tabRoles.addEventListener('click', function () { switchTab('roles'); });
  switchTab('users');

  // Usuarios
  var newBtn = $('#newUserBtn');
  if (newBtn) newBtn.addEventListener('click', function () { openUserModal(); });
  var form = $('#userForm');
  if (form) form.addEventListener('submit', saveUser);

  // Roles
  var newRoleBtn = $('#newRoleBtn');
  if (newRoleBtn) newRoleBtn.addEventListener('click', function () { openRoleModal(); });
  var roleForm = $('#roleForm');
  if (roleForm) roleForm.addEventListener('submit', saveRole);
  var search = $('#roleSearchInput');
  if (search) search.addEventListener('input', function () { ui.roleSearch = this.value.trim().toLowerCase(); renderRolesList(); });
  var editRoleBtn = $('#editRoleBtn');
  if (editRoleBtn) editRoleBtn.addEventListener('click', function () {
    var role = findRole(ui.selectedRoleId);
    if (role) openRoleModal(role);
  });
  var deleteRoleBtn = $('#deleteRoleBtn');
  if (deleteRoleBtn) deleteRoleBtn.addEventListener('click', function () { deleteRole(ui.selectedRoleId); });
  var savePermsBtn = $('#saveRolePermsBtn');
  if (savePermsBtn) savePermsBtn.addEventListener('click', saveRolePermissions);
  var matrix = $('#roleMatrix');
  if (matrix) {
    matrix.addEventListener('change', function (e) {
      var cb = e.target.closest && e.target.closest('input.role-perm');
      if (!cb) return;
      togglePermission(cb.getAttribute('data-perm'), cb.checked);
    });
  }
  var rolesList = $('#rolesList');
  if (rolesList) {
    rolesList.addEventListener('click', function (e) {
      var item = e.target.closest && e.target.closest('[data-role-id]');
      if (item) selectRole(item.getAttribute('data-role-id'));
    });
  }

  // Config (vive en este modulo historico)
  var saveConfigBtn = $('#saveConfigBtn');
  if (saveConfigBtn) saveConfigBtn.addEventListener('click', function () {
    if (typeof window.saveConfig === 'function') window.saveConfig();
  });

  var savePrinterBtn = $('#savePrinterConfigBtn');
  if (savePrinterBtn) savePrinterBtn.addEventListener('click', function () {
    var host = ($('#printerHost').value || '').trim() || '127.0.0.1';
    var port = parseInt($('#printerPort').value) || 9100;
    localStorage.setItem('config:impresora', JSON.stringify({ host: host, port: port }));
    showToast('Impresora guardada: ' + host + ':' + port, 'success');
  });

  var testPrinterBtn = $('#testPrinterBtn');
  if (testPrinterBtn) testPrinterBtn.addEventListener('click', async function () {
    var cfg = (typeof window.cargarConfigImpresora === 'function')
      ? window.cargarConfigImpresora()
      : { host: '127.0.0.1', port: 9100 };
    try {
      if (!qz.websocket.isActive()) await qz.websocket.connect();
      var config = qz.configs.create({ host: cfg.host, port: cfg.port });
      var data = ['\x1B\x40', 'Corner House - Prueba OK\n', '\x0A\x0A', '\x1D\x56\x00'];
      await qz.print(config, data);
      showToast('Conexion exitosa con ' + cfg.host + ':' + cfg.port, 'success');
    } catch (err) {
      showToast('Error: ' + (err.message || 'No se pudo conectar'), 'error');
    }
  });
}

function switchTab(tab) {
  ui.tab = tab;
  var isUsers = tab === 'users';
  var panelUsers = $('#usersPanelUsers');
  var panelRoles = $('#usersPanelRoles');
  if (panelUsers) panelUsers.classList.toggle('hidden', !isUsers);
  if (panelRoles) panelRoles.classList.toggle('hidden', isUsers);

  var tabUsers = $('#usersTabUsers');
  var tabRoles = $('#usersTabRoles');
  var active = 'border-brand-600 text-brand-700';
  var inactive = 'border-transparent text-slate-500 hover:text-slate-700';
  if (tabUsers) tabUsers.className = 'users-tab px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ' + (isUsers ? active : inactive);
  if (tabRoles) tabRoles.className = 'users-tab px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ' + (!isUsers ? active : inactive);

  if (isUsers) loadUsers();
  else loadRoles();
}

// ============================================================
// Usuarios
// ============================================================

async function loadUsers() {
  if (!can('users.manage')) return;
  try {
    var res = await API.users.list({ todos: '1' });
    ui.users = res.data || [];
    if (ui.roles.length === 0) {
      try {
        var rolesRes = await API.roles.list();
        ui.roles = rolesRes.data || [];
      } catch (e) { /* la lista de roles es opcional para renderizar */ }
    }
    renderUsers();
  } catch (err) {
    showToast('Error al cargar usuarios: ' + err.message, 'error');
  }
}

function renderUsers() {
  var tbody = $('#usersTable');
  var cards = $('#usersCards');
  var users = ui.users || [];
  if (!tbody || !cards) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">No hay usuarios</td></tr>';
    cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">No hay usuarios</p>';
    return;
  }

  tbody.innerHTML = users.map(function (u) {
    return '<tr class="hover:bg-slate-50 transition-colors' + (u.activo === false ? ' opacity-60' : '') + '">'
      + '<td class="px-6 py-3"><div class="text-sm font-medium text-slate-800">' + escapeHtml(u.username) + '</div><div class="text-xs text-slate-400">' + escapeHtml(u.email || '') + '</div></td>'
      + '<td class="px-6 py-3 text-sm text-slate-600">' + escapeHtml(u.nombreCompleto || '-') + '</td>'
      + '<td class="px-6 py-3">' + roleBadge(u.roleId || u.role, u.roleName) + '</td>'
      + '<td class="px-6 py-3">' + estadoBadge(u) + '</td>'
      + '<td class="px-6 py-3 text-right"><div class="flex items-center justify-end gap-1">' + userActions(u, false) + '</div></td>'
      + '</tr>';
  }).join('');

  cards.innerHTML = users.map(function (u) {
    return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-2' + (u.activo === false ? ' opacity-60' : '') + '">'
      + '<div class="flex items-start justify-between gap-2">'
      + '<div class="min-w-0"><p class="text-sm font-semibold text-slate-800">' + escapeHtml(u.username) + '</p>'
      + '<p class="text-xs text-slate-500 truncate">' + escapeHtml(u.email || '') + '</p></div>'
      + roleBadge(u.roleId || u.role, u.roleName)
      + '</div>'
      + '<p class="text-xs text-slate-500">' + escapeHtml(u.nombreCompleto || '-') + '</p>'
      + '<div class="flex items-center justify-between">' + estadoBadge(u) + '</div>'
      + '<div class="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">' + userActions(u, true) + '</div>'
      + '</div>';
  }).join('');
}

function userActions(u, mobile) {
  var btn = 'p-1.5 rounded-lg transition-colors touch-target ';
  if (u.estadoAprobacion === 'pendiente') {
    return '<button onclick="window.approveUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="' + btn + 'text-brand-600 bg-brand-100 hover:bg-brand-200" title="Aprobar">' + ICON_APPROVE + '</button>'
      + '<button onclick="window.rejectUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="' + btn + 'text-red-600 bg-red-100 hover:bg-red-200" title="Rechazar">' + ICON_REJECT + '</button>';
  }
  if (u.activo === false) {
    return '<button onclick="window.reactivateUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="' + btn + 'text-slate-400 hover:text-green-600 hover:bg-green-50" title="Reactivar">' + ICON_REACTIVATE + '</button>'
      + '<button onclick="window.deleteUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="' + btn + 'text-rose-500 hover:text-rose-700 hover:bg-rose-50" title="Eliminar permanentemente">' + ICON_TRASH + '</button>';
  }
  return '<button onclick="window.editUser(\'' + u.id + '\')" class="' + btn + 'text-slate-400 hover:text-amber-600 hover:bg-amber-100" title="Editar">' + ICON_EDIT + '</button>'
    + '<button onclick="window.archiveUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="' + btn + 'text-slate-400 hover:text-amber-600 hover:bg-amber-100" title="Archivar">' + ICON_ARCHIVE + '</button>';
}

function fillRoleSelect(selectedId) {
  var sel = $('#userRole');
  if (!sel) return;
  if (ui.roles.length === 0) {
    sel.innerHTML = '<option value="vendedor">Vendedor / Mesero</option><option value="admin">Administrador</option>';
  } else {
    sel.innerHTML = ui.roles.map(function (r) {
      return '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(r.name) + (r.isSystem ? '' : '') + '</option>';
    }).join('');
  }
  if (selectedId) sel.value = selectedId;
}

function openUserModal(user) {
  var isEdit = !!user;
  $('#userModalTitle').textContent = isEdit ? 'Editar Usuario: ' + user.username : 'Nuevo Usuario';
  $('#userForm').reset();
  $('#userFormError').classList.add('hidden');
  $('#userPassHint').textContent = isEdit ? '(dejar vacío para no cambiar)' : '(requerido)';
  if (isEdit) $('#userPassword').removeAttribute('required');
  else $('#userPassword').setAttribute('required', 'required');

  ui.editingUserId = isEdit ? user.id : null;
  $('#userUsername').value = isEdit ? user.username : '';
  $('#userUsername').disabled = isEdit;
  $('#userNombreCompleto').value = isEdit ? (user.nombreCompleto || '') : '';
  $('#userEmail').value = isEdit ? (user.email || '') : '';
  fillRoleSelect(isEdit ? (user.roleId || user.role) : 'vendedor');
  $('#userEstado').value = (isEdit && user.activo === false) ? 'archivado' : 'activo';
  openModal('userModal');
}

async function saveUser(e) {
  e.preventDefault();
  var password = $('#userPassword').value;
  var payload = {
    username: $('#userUsername').value.trim(),
    nombreCompleto: $('#userNombreCompleto').value.trim(),
    email: $('#userEmail').value.trim(),
    roleId: $('#userRole').value,
    activo: $('#userEstado').value === 'activo'
  };
  if (!ui.editingUserId && !password) {
    showError('userFormError', 'La contraseña es requerida para nuevos usuarios');
    return;
  }
  if (password && password.length < 6) {
    showError('userFormError', 'La contraseña debe tener al menos 6 caracteres');
    return;
  }
  if (password) payload.password = password;

  try {
    if (ui.editingUserId) {
      await API.users.update(ui.editingUserId, payload);
      showToast('Usuario actualizado', 'success');
      if (store.state.user && store.state.user.id === ui.editingUserId) {
        var me = await API.auth.me();
        store.state.user = me.data;
        applyPermissionsToUI();
      }
    } else {
      var created = await API.users.create(payload);
      if (!payload.activo && created && created.data) {
        await API.users.update(created.data.id, { activo: false });
      }
      showToast('Usuario creado', 'success');
    }
    closeModal('userModal');
    ui.editingUserId = null;
    loadUsers();
  } catch (err) {
    showError('userFormError', err.message);
  }
}

// ============================================================
// Roles y permisos
// ============================================================

function findRole(id) {
  return (ui.roles || []).find(function (r) { return r.id === id; });
}

async function loadRoles() {
  if (!can('users.manage')) return;
  try {
    var tasks = [API.roles.list()];
    if (ui.catalog.length === 0) tasks.push(API.roles.catalogo());
    var res = await Promise.all(tasks);
    ui.roles = res[0].data || [];
    if (res[1]) ui.catalog = res[1].data || [];
    renderRolesList();
    if (ui.selectedRoleId && findRole(ui.selectedRoleId)) {
      selectRole(ui.selectedRoleId);
    } else if (ui.roles.length > 0 && !ui.selectedRoleId) {
      selectRole(ui.roles[0].id);
    }
  } catch (err) {
    showToast('Error al cargar roles: ' + err.message, 'error');
  }
}

function renderRolesList() {
  var wrap = $('#rolesList');
  if (!wrap) return;
  var roles = (ui.roles || []).filter(function (r) {
    if (!ui.roleSearch) return true;
    return (r.name || '').toLowerCase().indexOf(ui.roleSearch) !== -1 ||
           (r.description || '').toLowerCase().indexOf(ui.roleSearch) !== -1;
  });
  if (roles.length === 0) {
    wrap.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Sin resultados</p>';
    return;
  }
  wrap.innerHTML = roles.map(function (r) {
    var selected = r.id === ui.selectedRoleId;
    return '<button type="button" data-role-id="' + escapeHtml(r.id) + '" class="w-full text-left p-3 rounded-xl border transition-colors ' +
      (selected ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/30' : 'border-slate-200 bg-white hover:bg-slate-50') + '">'
      + '<div class="flex items-center justify-between gap-2">'
      + '<span class="text-sm font-semibold text-slate-800 truncate">' + escapeHtml(r.name) + '</span>'
      + (r.isSystem ? '<span class="shrink-0 text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">SISTEMA</span>' : '')
      + '</div>'
      + (r.description ? '<p class="text-[11px] text-slate-400 mt-0.5 truncate">' + escapeHtml(r.description) + '</p>' : '')
      + '<p class="text-[11px] text-slate-500 mt-1">' + (r.userCount || 0) + (r.userCount === 1 ? ' usuario' : ' usuarios') + ' · ' + (r.permissions || []).length + ' permisos</p>'
      + '</button>';
  }).join('');
}

function selectRole(id) {
  var role = findRole(id);
  if (!role) return;
  ui.selectedRoleId = id;
  ui.draftPermissions = (role.permissions || []).slice();
  ui.dirty = false;
  renderRolesList();
  renderMatrix();
}

function renderMatrix() {
  var role = findRole(ui.selectedRoleId);
  var empty = $('#roleMatrixEmpty');
  var wrap = $('#roleMatrixWrap');
  if (!role) {
    if (empty) empty.classList.remove('hidden');
    if (wrap) wrap.classList.add('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  if (wrap) wrap.classList.remove('hidden');

  $('#roleMatrixTitle').innerHTML = escapeHtml(role.name) + (role.isSystem ? ' <span class="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded align-middle">SISTEMA</span>' : '');
  $('#roleMatrixDesc').textContent = role.description || 'Sin descripción';
  $('#roleMatrixUsers').textContent = (role.userCount || 0) + (role.userCount === 1 ? ' usuario con este rol' : ' usuarios con este rol') + ' — los cambios impactan de inmediato al guardar.';
  // Roles de sistema: no se renombran ni se eliminan (solo sus permisos)
  var delBtn = $('#deleteRoleBtn');
  if (delBtn) delBtn.style.display = role.isSystem ? 'none' : '';
  var editBtn = $('#editRoleBtn');
  if (editBtn) {
    editBtn.style.display = role.isSystem ? 'none' : '';
    editBtn.title = role.isSystem ? 'Los roles de sistema no se pueden renombrar' : '';
  }

  var cols = [
    { type: 'view', label: 'Ver' },
    { type: 'create', label: 'Crear' },
    { type: 'edit', label: 'Editar' },
    { type: 'delete', label: 'Eliminar' }
  ];
  var html = '<table class="w-full text-sm min-w-[640px]">'
    + '<thead class="bg-slate-100"><tr class="text-left text-xs font-medium text-slate-500 uppercase tracking-wider">'
    + '<th class="px-5 py-3">Módulo</th>'
    + cols.map(function (c) { return '<th class="px-3 py-3 text-center">' + c.label + '</th>'; }).join('')
    + '<th class="px-5 py-3">Acciones</th></tr></thead><tbody class="divide-y divide-slate-100">';

  ui.catalog.forEach(function (mod) {
    var byType = {};
    var actions = [];
    mod.permissions.forEach(function (p) {
      if (p.type === 'action') actions.push(p);
      else byType[p.type] = p;
    });
    html += '<tr class="hover:bg-slate-50/60 transition-colors">'
      + '<td class="px-5 py-3 whitespace-nowrap"><span class="text-sm font-semibold text-slate-700">' + (mod.icon || '') + ' ' + escapeHtml(mod.name) + '</span></td>'
      + cols.map(function (c) {
        var p = byType[c.type];
        if (!p) return '<td class="px-3 py-3 text-center text-slate-300">—</td>';
        return '<td class="px-3 py-3 text-center">' + checkbox(p.key) + '</td>';
      }).join('')
      + '<td class="px-5 py-3">' + (actions.length
        ? '<div class="flex flex-wrap gap-1.5">' + actions.map(function (p) { return chip(p); }).join('') + '</div>'
        : '<span class="text-slate-300">—</span>') + '</td>'
      + '</tr>';
  });
  html += '</tbody></table>';

  $('#roleMatrix').innerHTML = html;
  updateSaveState();
}

function checkbox(key) {
  var checked = ui.draftPermissions.indexOf(key) !== -1;
  return '<label class="inline-flex items-center justify-center cursor-pointer p-1">'
    + '<input type="checkbox" class="role-perm w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" data-perm="' + key + '"' + (checked ? ' checked' : '') + '>'
    + '</label>';
}

function chip(p) {
  var checked = ui.draftPermissions.indexOf(p.key) !== -1;
  return '<label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors ' +
    (checked ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50') + '">'
    + '<input type="checkbox" class="role-perm w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" data-perm="' + p.key + '"' + (checked ? ' checked' : '') + '>'
    + '<span>' + escapeHtml(p.label) + '</span></label>';
}

function togglePermission(key, checked) {
  var idx = ui.draftPermissions.indexOf(key);
  if (checked && idx === -1) ui.draftPermissions.push(key);
  if (!checked && idx !== -1) ui.draftPermissions.splice(idx, 1);
  ui.dirty = true;
  // Repintar chips para reflejar el estado visual
  renderMatrix();
}

function updateSaveState() {
  var btn = $('#saveRolePermsBtn');
  if (btn) btn.disabled = !ui.dirty;
}

async function saveRolePermissions() {
  var role = findRole(ui.selectedRoleId);
  if (!role || !ui.dirty) return;
  try {
    var res = await API.roles.update(role.id, { permissions: ui.draftPermissions });
    showToast('Permisos actualizados para el rol ' + role.name, 'success');
    role.permissions = (res.data && res.data.permissions) || ui.draftPermissions.slice();
    ui.dirty = false;
    updateSaveState();
    renderRolesList();
    renderMatrix();
    // Si el rol editado es el del usuario actual, refrescar permisos en vivo
    if (store.state.user && store.state.user.roleId === role.id) {
      store.state.user.permissions = role.permissions.slice();
      applyPermissionsToUI();
    }
  } catch (err) {
    showToast('Error al guardar: ' + err.message, 'error');
  }
}

function openRoleModal(role) {
  var isEdit = !!role;
  ui.editingRoleId = isEdit ? role.id : null;
  $('#roleModalTitle').textContent = isEdit ? 'Editar Rol' : 'Nuevo Rol';
  $('#roleForm').reset();
  $('#roleFormError').classList.add('hidden');
  $('#roleId').value = isEdit ? role.id : '';
  $('#roleName').value = isEdit ? role.name : '';
  $('#roleDescription').value = isEdit ? (role.description || '') : '';
  openModal('roleModal');
}

async function saveRole(e) {
  e.preventDefault();
  var payload = {
    name: $('#roleName').value.trim(),
    description: $('#roleDescription').value.trim()
  };
  try {
    if (ui.editingRoleId) {
      var res = await API.roles.update(ui.editingRoleId, payload);
      showToast('Rol actualizado', 'success');
      var idx = ui.roles.findIndex(function (r) { return r.id === ui.editingRoleId; });
      if (idx !== -1) ui.roles[idx] = Object.assign({}, ui.roles[idx], res.data);
      closeModal('roleModal');
      renderRolesList();
      if (ui.selectedRoleId === ui.editingRoleId) renderMatrix();
    } else {
      var created = await API.roles.create(payload);
      showToast('Rol creado: configurá sus permisos', 'success');
      closeModal('roleModal');
      await loadRoles();
      selectRole(created.data.id);
    }
  } catch (err) {
    showError('roleFormError', err.message);
  }
}

function deleteRole(id) {
  var role = findRole(id);
  if (!role) return;
  showConfirm({
    title: '¿Eliminar rol?',
    message: '"' + role.name + '" se eliminará. Solo es posible si no tiene usuarios activos.',
    confirmText: 'Eliminar',
    variant: 'danger',
    icon: ICON_TRASH
  }, async function () {
    try {
      await API.roles.delete(id);
      showToast('Rol eliminado', 'success');
      ui.selectedRoleId = null;
      ui.draftPermissions = [];
      ui.dirty = false;
      await loadRoles();
      renderMatrix();
    } catch (err) {
      showToast(err.message || 'No se pudo eliminar el rol', 'error');
    }
  });
}

// ============================================================
// Handlers expuestos en window (onclick inline)
// ============================================================

window.openUserModal = function () { openUserModal(); };

window.editUser = function (id) {
  var user = (ui.users || []).find(function (u) { return u.id === id; });
  if (user) openUserModal(user);
};

window.archiveUser = function (id, username) {
  if (!can('users.manage')) { showToast('Sin permiso', 'error'); return; }
  showConfirm({
    title: '¿Archivar usuario?',
    message: '"' + username + '" no podrá iniciar sesión. Podés reactivarlo cuando quieras.',
    confirmText: 'Archivar',
    variant: 'warning',
    icon: ICON_ARCHIVE
  }, async function () {
    try {
      await API.users.delete(id);
      showToast('Usuario archivado', 'success');
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
};

window.deleteUser = function (id, username) {
  if (!can('users.manage')) { showToast('Sin permiso', 'error'); return; }
  showConfirm({
    title: '¿Eliminar usuario permanentemente?',
    message: '"' + username + '" se borrará del sistema. El historial de ventas y movimientos se conserva sin vínculo. Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    variant: 'danger',
    icon: ICON_TRASH
  }, async function () {
    try {
      await API.users.deletePermanent(id);
      showToast('Usuario eliminado', 'success');
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
};

window.reactivateUser = function (id, username) {
  showConfirm({
    title: '¿Reactivar usuario?',
    message: '"' + username + '" podrá iniciar sesión nuevamente.',
    confirmText: 'Reactivar',
    variant: 'info',
    icon: ICON_REACTIVATE
  }, async function () {
    try {
      await API.users.update(id, { activo: true });
      showToast('Usuario reactivado', 'success');
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
};

window.approveUser = function (id, username) {
  showConfirm({
    title: '¿Aprobar usuario?',
    message: '"' + username + '" podrá iniciar sesión con el rol Vendedor / Mesero. Luego podés cambiarle el rol desde el lápiz.',
    confirmText: 'Aprobar',
    variant: 'info',
    icon: ICON_APPROVE
  }, async function () {
    try {
      await API.users.approve(id, { roleId: 'vendedor' });
      showToast('Usuario aprobado', 'success');
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
};

window.rejectUser = function (id, username) {
  showConfirm({
    title: '¿Rechazar usuario?',
    message: '"' + username + '" no podrá iniciar sesión.',
    confirmText: 'Rechazar',
    variant: 'warning',
    icon: ICON_REJECT
  }, async function () {
    try {
      await API.users.reject(id, { motivo: 'Rechazado por administrador' });
      showToast('Usuario rechazado', 'success');
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
};

// Compatibilidad con codigo heredado (window.*)
if (typeof window !== 'undefined') {
  window.initUsers = initUsers;
  window.loadUsers = loadUsers;
  window.loadRoles = loadRoles;
}
