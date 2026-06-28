import { $, escapeHtml } from '../core/dom.js';
import { openModal, closeModal, showError, showConfirm } from '../components/modal.js';
import { applyPermissionsToUI } from '../core/permissions.js';
import { showToast } from '../components/toast.js';
import { PERM_LABELS, buildPermsObj, plantillaPorRolFrontend, renderPermsGrid, setPermsChecked, readPermsChecked, initPermsGridHandlers } from '../components/permissions-grid.js';
import { store } from '../core/store.js';

// users.view.js
// Vista extraida de app.js en el Sub-paso 3.4 (views).

function initUsers() {
  var newBtn = $('#newUserBtn');
  if (newBtn) newBtn.addEventListener('click', function () { openUserModal(); });
  var form = $('#userForm');
  if (form) form.addEventListener('submit', saveUser);
  var roleSel = $('#userRole');
  if (roleSel) roleSel.addEventListener('change', function () {
    var perms = plantillaPorRolFrontend(this.value);
    Object.keys(perms).forEach(function (k) {
      var cb = $('#perm_' + k);
      if (cb) cb.checked = perms[k];
    });
  });
  var allBtn = $('#permAllBtn');
  if (allBtn) allBtn.addEventListener('click', function () {
    $$('#permGrid input[type=checkbox]').forEach(function (cb) { cb.checked = true; });
  });
  var noneBtn = $('#permNoneBtn');
  if (noneBtn) noneBtn.addEventListener('click', function () {
    $$('#permGrid input[type=checkbox]').forEach(function (cb) { cb.checked = false; });
  });

  // Construir grid de permisos
  var grid = $('#permGrid');
  if (grid) {
    grid.innerHTML = Object.keys(PERM_LABELS).map(function (k) {
      return '<label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors">'
        + '<input type="checkbox" id="perm_' + k + '" data-perm="' + k + '" class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500">'
        + '<span>' + PERM_LABELS[k] + '</span>'
        + '</label>';
    }).join('');
  }

  // Config
  var saveConfigBtn = $('#saveConfigBtn');
  if (saveConfigBtn) saveConfigBtn.addEventListener('click', saveConfig);

  // Config Impresora
  var savePrinterBtn = $('#savePrinterConfigBtn');
  if (savePrinterBtn) savePrinterBtn.addEventListener('click', function () {
    var host = ($('#printerHost').value || '').trim() || '127.0.0.1';
    var port = parseInt($('#printerPort').value) || 9100;
    localStorage.setItem('config:impresora', JSON.stringify({ host: host, port: port }));
    showToast('Impresora guardada: ' + host + ':' + port, 'success');
  });

  var testPrinterBtn = $('#testPrinterBtn');
  if (testPrinterBtn) testPrinterBtn.addEventListener('click', async function () {
    var cfg = cargarConfigImpresora();
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

async function loadUsers() {
  if (!window.can('puedeGestionarUsuarios')) return;
  try {
    var showAll = $('#showAllUsers') ? $('#showAllUsers').checked : false;
    var params = showAll ? { todos: '1' } : {};
    var res = await API.users.list(params);
    var users = res.data || [];
    var tbody = $('#usersTable');
    var cards = $('#usersCards');
    var pendientes = users.filter(function (u) { return u.estadoAprobacion === 'pendiente'; }).length;
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-sm text-slate-400">No hay usuarios</td></tr>';
      cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">No hay usuarios</p>';
      return;
    }
    tbody.innerHTML = users.map(function (u) {
      var activeCount = Object.values(u.permisos).filter(Boolean).length;
      var pendiente = u.estadoAprobacion === 'pendiente';
      var rechazado = u.estadoAprobacion === 'rechazado';
      var inactivo = u.activo === false;
      var rowClass = pendiente ? ' bg-amber-100/30' : (inactivo ? ' bg-slate-100/50 opacity-60' : '');
      var actionsHtml = '';
      if (pendiente) {
        actionsHtml = '<button onclick="window.approveUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="p-1.5 text-brand-600 bg-brand-100 hover:bg-brand-100 rounded-lg transition-colors touch-target" title="Aprobar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></button>'
          + '<button onclick="window.rejectUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="p-1.5 text-red-600 bg-red-100 hover:bg-red-100 rounded-lg transition-colors touch-target" title="Rechazar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>';
      } else if (inactivo) {
        actionsHtml = '<button onclick="window.reactivateUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="p-1.5 text-green-600 bg-green-100 hover:bg-green-100 rounded-lg transition-colors touch-target" title="Reactivar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>';
      } else {
        actionsHtml = '<button onclick="window.editUser(\'' + u.id + '\')" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors touch-target" title="Editar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>'
          + '<button onclick="window.deleteUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors touch-target" title="Desactivar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg></button>';
      }
      return '<tr class="hover:bg-slate-50 transition-colors' + rowClass + '">'
        + '<td class="px-6 py-3"><div class="text-sm font-medium text-slate-800">' + escapeHtml(u.username) + '</div><div class="text-xs text-slate-400">' + escapeHtml(u.email || '') + '</div></td>'
        + '<td class="px-6 py-3 text-sm text-slate-600">' + escapeHtml(u.nombreCompleto || '-') + '</td>'
        + '<td class="px-6 py-3"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ' + (u.role === 'admin' ? 'bg-violet-100 text-violet-800' : 'bg-brand-100 text-brand-800') + '">' + u.role + '</span></td>'
        + '<td class="px-6 py-3 text-center"><span class="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">' + activeCount + '/13</span></td>'
        + '<td class="px-6 py-3">' + (inactivo ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">Inactivo</span>' : estadoBadge(u.estadoAprobacion)) + '</td>'
        + '<td class="px-6 py-3 text-right"><div class="flex items-center justify-end gap-1">' + actionsHtml + '</div></td>'
        + '</tr>';
    }).join('');
    cards.innerHTML = users.map(function (u) {
      var activeCount = Object.values(u.permisos).filter(Boolean).length;
      var pendiente = u.estadoAprobacion === 'pendiente';
      var actionsHtml = '';
      if (pendiente) {
        actionsHtml = '<div class="flex gap-2 pt-2">'
          + '<button onclick="window.approveUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="flex-1 p-2 text-brand-800 bg-brand-100 hover:bg-brand-100 rounded-lg text-sm font-medium touch-target flex items-center justify-center gap-1.5">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Aprobar</button>'
          + '<button onclick="window.rejectUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="flex-1 p-2 text-red-800 bg-red-100 hover:bg-red-100 rounded-lg text-sm font-medium touch-target flex items-center justify-center gap-1.5">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg> Rechazar</button>'
          + '</div>';
      } else {
        actionsHtml = '<div class="flex gap-1 pt-2 border-t border-slate-100">'
          + '<button onclick="window.editUser(\'' + u.id + '\')" class="flex-1 p-2 text-amber-600 bg-amber-100 rounded-lg text-sm font-medium touch-target">Editar</button>'
          + '<button onclick="window.deleteUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="flex-1 p-2 text-amber-600 bg-amber-100 rounded-lg text-sm font-medium touch-target">Desactivar</button>'
          + '</div>';
      }
      return '<div class="bg-white border ' + (pendiente ? 'border-amber-300' : 'border-slate-200') + ' rounded-xl p-4 space-y-2">'
        + '<div class="flex items-start justify-between"><div><p class="text-sm font-semibold text-slate-800">' + escapeHtml(u.username) + '</p><p class="text-xs text-slate-500">' + escapeHtml(u.email || '') + '</p></div>'
        + '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ' + (u.role === 'admin' ? 'bg-violet-100 text-violet-800' : 'bg-brand-100 text-brand-800') + '">' + u.role + '</span></div>'
        + '<p class="text-xs text-slate-500">' + escapeHtml(u.nombreCompleto || '-') + '</p>'
        + '<div class="flex items-center justify-between text-xs">'
        + '<span class="text-slate-500">Permisos: ' + activeCount + '/13</span>'
        + estadoBadge(u.estadoAprobacion)
        + '</div>'
        + actionsHtml
        + '</div>';
    }).join('');
  } catch (err) {
    showToast('Error al cargar usuarios: ' + err.message, 'error');
  }
}

async function saveUser(e) {
  e.preventDefault();
  var username = $('#userUsername').value.trim();
  var password = $('#userPassword').value;
  var nombreCompleto = $('#userNombreCompleto').value.trim();
  var email = $('#userEmail').value.trim();
  var role = $('#userRole').value;
  var perms = {};
  $$('#permGrid input[type=checkbox]').forEach(function (cb) {
    perms[cb.getAttribute('data-perm')] = cb.checked;
  });
  var permsSnake = buildPermsObj(perms);

  if (!state.editingUserId && !password) {
    showError('userFormError', 'La contrasena es requerida para nuevos usuarios');
    return;
  }
  if (password && password.length < 6) {
    showError('userFormError', 'La contrasena debe tener al menos 6 caracteres');
    return;
  }

  var payload = {
    username: username,
    nombreCompleto: nombreCompleto,
    email: email,
    role: role,
    permisos: permsSnake
  };
  if (password) payload.password = password;

  try {
    if (state.editingUserId) {
      await API.users.update(state.editingUserId, payload);
      showToast('Usuario actualizado', 'success');
    } else {
      payload.password = password;
      await API.users.create(payload);
      showToast('Usuario creado', 'success');
    }
    closeModal('userModal');
    $('#userUsername').disabled = false;
    state.editingUserId = null;
    loadUsers();
  } catch (err) {
    showError('userFormError', err.message);
  }
}



// Handlers expuestos en window (compatibilidad con onclick inline)
window.openUserModal = function () {
  $('#userModalTitle').textContent = 'Nuevo Usuario';
  $('#userForm').reset();
  $('#userFormError').classList.add('hidden');
  $('#userPassHint').textContent = '(requerido)';
  $('#userPassword').setAttribute('required', 'required');
  state.editingUserId = null;
  // Aplicar plantilla de vendedor por defecto
  var perms = plantillaPorRolFrontend('vendedor');
  Object.keys(perms).forEach(function (k) {
    var cb = $('#perm_' + k);
    if (cb) cb.checked = perms[k];
  });
  openModal('userModal');
}

window.editUser = async function (id) {
  try {
    var res = await API.users.list();
    var user = (res.data || []).find(function (u) { return u.id === id; });
    if (!user) return;
    state.editingUserId = id;
    $('#userModalTitle').textContent = 'Editar Usuario: ' + user.username;
    $('#userUsername').value = user.username;
    $('#userUsername').disabled = true;
    $('#userPassword').value = '';
    $('#userPassword').removeAttribute('required');
    $('#userPassHint').textContent = '(dejar vacio para no cambiar)';
    $('#userNombreCompleto').value = user.nombreCompleto || '';
    $('#userEmail').value = user.email || '';
    $('#userRole').value = user.role;
    Object.keys(user.permisos).forEach(function (k) {
      var cb = $('#perm_' + k);
      if (cb) cb.checked = user.permisos[k];
    });
    $('#userFormError').classList.add('hidden');
    openModal('userModal');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

window.deleteUser = function (id, username) {
  showConfirm({
    title: '¿Desactivar usuario?',
    message: '"' + username + '" sera desactivado. No podra iniciar sesion. Podes reactivarlo desde la vista de usuarios.',
    confirmText: 'Desactivar',
    variant: 'warning',
    icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>'
  }, async function () {
    try {
      await API.users.delete(id);
      showToast('Usuario desactivado', 'success');
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}

window.reactivateUser = function (id, username) {
  showConfirm({
    title: '¿Reactivar usuario?',
    message: '"' + username + '" podra iniciar sesion nuevamente.',
    confirmText: 'Reactivar',
    variant: 'info',
    icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>'
  }, async function () {
    try {
      await API.users.update(id, { activo: true });
      showToast('Usuario reactivado', 'success');
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}

window.approveUser = function (id, username) {
  showConfirm({
    title: '¿Aprobar usuario?',
    message: '"' + username + '" podra iniciar sesion como vendedor. Podes editar sus permisos luego desde el lapiz.',
    confirmText: 'Aprobar',
    variant: 'info',
    icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
  }, async function () {
    try {
      await API.users.approve(id, { role: 'vendedor' });
      showToast('Usuario aprobado', 'success');
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}

window.rejectUser = function (id, username) {
  showConfirm({
    title: '¿Rechazar usuario?',
    message: '"' + username + '" no podra iniciar sesion. Podes dejar un motivo opcional.',
    confirmText: 'Rechazar',
    variant: 'warning',
    icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
  }, async function () {
    try {
      await API.users.reject(id, { motivo: 'Rechazado por administrador' });
      showToast('Usuario rechazado', 'success');
      loadUsers();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}



// Compatibilidad con codigo heredado (window.*)
if (typeof window !== "undefined") {
  if (typeof initUsers === "function") window.initUsers = initUsers;
  if (typeof loadUsers === "function") window.loadUsers = loadUsers;
  if (typeof saveUser === "function") window.saveUser = saveUser;
  if (typeof editUser === "function") window.editUser = editUser;
  if (typeof deleteUser === "function") window.deleteUser = deleteUser;
  if (typeof reactivateUser === "function") window.reactivateUser = reactivateUser;
  if (typeof approveUser === "function") window.approveUser = approveUser;
  if (typeof rejectUser === "function") window.rejectUser = rejectUser;
  if (typeof openUserModal === "function") window.openUserModal = openUserModal;
}
