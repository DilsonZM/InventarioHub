// shell/user.js
// Identidad del usuario actual: nombre, rol, boton de logout, link de login
// para visitantes, y aplicacion de permisos al sidebar.
// Antes: initUser() e initLogout() en app.js.

import { $ } from '../core/dom.js';
import { store } from '../core/store.js';
import { applyPermissionsToUI } from '../core/permissions.js';
import { showConfirm } from '../components/modal.js';

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

function doLogout() {
  showConfirm({
    title: '¿Cerrar sesion?',
    message: '¿Estas seguro que deseas salir?',
    confirmText: 'Salir',
    variant: 'warning',
    icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>'
  }, function () {
    showAuthLoading(['Cerrando sesion...', 'Vuelve pronto!'], function () {
      if (window.API && API.clearAuth) API.clearAuth();
      window.location.href = '/views/login.html';
    });
  });
}

export function initLogout() {
  var logoutBtn = $('#logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
  var collapsedBtn = $('#logoutBtnCollapsed');
  if (collapsedBtn) collapsedBtn.addEventListener('click', doLogout);
}

// Loading animado para flujos de auth (login/logout).
// Muestra un overlay con titulo dinamico que cambia entre steps[s] con
// delay de 1.2s entre cada uno. Al terminar ejecuta callback.
export function showAuthLoading(steps, callback) {
  if (typeof Swal === 'undefined') { callback(); return; }
  var s = 0;
  Swal.fire({
    title: steps[0],
    html: '<div class="pos-loading"><div class="pos-loading-ring"></div><div class="pos-loading-dots"><span></span><span></span><span></span></div></div>',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    backdrop: 'rgba(15, 23, 42, 0.55)',
    customClass: { popup: 'pos-loading-popup', title: 'pos-loading-title' },
    didOpen: function () {
      function next() {
        s++;
        if (s >= steps.length) {
          setTimeout(function () { Swal.close(); if (callback) callback(); }, 400);
          return;
        }
        var titleEl = document.querySelector('.swal2-title');
        if (titleEl) {
          titleEl.style.opacity = '0';
          titleEl.style.transition = 'opacity 0.3s ease';
          setTimeout(function () {
            titleEl.textContent = steps[s];
            titleEl.style.opacity = '1';
          }, 300);
        }
        setTimeout(next, 1200);
      }
      setTimeout(next, 1200);
    }
  });
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
