// shell/user.js
// Identidad del usuario actual: nombre, rol, boton de logout, link de login
// para visitantes, y aplicacion de permisos al sidebar.
// Antes: initUser() e initLogout() en app.js.

import { $ } from '../core/dom.js';
import { store } from '../core/store.js';
import { applyPermissionsToUI } from '../core/permissions.js';

export function initUser() {
  var user = store.state.user;
  if (!user) return;
  var nameEl = $('#userName');
  var roleEl = $('#userRole');
  var initialEl = $('#userInitial');
  if (nameEl) nameEl.textContent = user.username === 'visitante' ? 'Visitante' : user.username;
  if (roleEl) {
    if (user.role === 'admin') roleEl.textContent = 'Administrador';
    else if (user.role === 'vendedor') roleEl.textContent = 'Vendedor';
    else if (user.role === 'visitante') roleEl.textContent = 'Modo lectura';
    else roleEl.textContent = user.role;
  }
  if (initialEl) initialEl.textContent = (user.username || 'V').charAt(0).toUpperCase();

  // Visitante: ocultar logout, mostrar link a login
  var logoutBtn = $('#logoutBtn');
  var loginLink = $('#loginLink');
  if (user.username === 'visitante') {
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (loginLink) loginLink.classList.remove('hidden');
  } else {
    if (logoutBtn) logoutBtn.style.display = '';
    if (loginLink) loginLink.classList.add('hidden');
  }
}

export function initLogout() {
  function doLogout() {
    if (window.API && API.clearAuth) API.clearAuth();
    window.location.href = '/views/login.html';
  }
  var logoutBtn = $('#logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
  var collapsedBtn = $('#logoutBtnCollapsed');
  if (collapsedBtn) collapsedBtn.addEventListener('click', doLogout);
}

// Construye el usuario "visitante" cuando el modo publico esta activo
// y no hay sesion. Antes: bloque del DOMContentLoaded en app.js.
export function buildVisitorUser() {
  return {
    username: 'visitante',
    role: 'visitante',
    permisos: {
      puedeVerDashboard: true,
      puedeVerInventario: true,
      puedeVerMovimientos: false,
      puedeCrearProductos: false,
      puedeEditarProductos: false,
      puedeEliminarProductos: false,
      puedeCrearSalidas: false,
      puedeEditarSalidas: false,
      puedeEliminarSalidas: false,
      puedeCrearEntradas: false,
      puedeEditarEntradas: false,
      puedeEliminarEntradas: false,
      puedeGestionarUsuarios: false
    }
  };
}

if (typeof window !== 'undefined') {
  window.initUser = initUser;
  window.initLogout = initLogout;
  window.buildVisitorUser = buildVisitorUser;
  // Aplica permisos al sidebar (lo llama app.js despues de tener user)
  window.applyPermissionsToUI = applyPermissionsToUI;
}
