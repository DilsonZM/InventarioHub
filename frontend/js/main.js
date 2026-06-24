// main.js
// Entry point modular de InventarioApp. Reemplaza al DOMContentLoaded de
// app.js (que se elimino en el Sub-paso 3.4). Orquesta: PWA, bootstrap
// del usuario, event bus, modal delegation, shell, permisos, router
// y la inicializacion de las vistas.

import { store } from './core/store.js';
import { registerSW } from './core/pwa.js';
import { initEvents } from './core/events.js';
import { initModalDelegation } from './components/modal.js';
import { showToast } from './components/toast.js';
import { initSidebar, initSidebarGroups } from './shell/sidebar.js';
import { initUser, initLogout, buildVisitorUser } from './shell/user.js';
import { setCurrentDate } from './shell/header.js';
import { initNavigation, navigate } from './core/router.js';
import { initCalendar } from './components/calendar.js';

// Carga estatica de las vistas. Cada modulo registra sus handlers en
// window (compatibilidad con onclick inline) y expone los init*/load*/render*
// que main.js invoca aqui.
import './views/dashboard.view.js';
import './views/inventory.view.js';
import './views/sales.view.js';
import './views/purchases.view.js';
import './views/movements.view.js';
import './views/dishes.view.js';
import './views/users.view.js';
import './views/config.view.js';
import './views/pos.view.js';

async function bootstrapUser() {
  if (window.API && API.isAuthenticated()) {
    try {
      const me = await API.auth.me();
      store.state.user = me.data;
      if (window.API.setUser) API.setUser(me.data);
    } catch (e) {}
    return;
  }
  try {
    const cfg = await API.config.get();
    if (cfg.data && cfg.data.modoPublico) {
      store.state.modoPublico = true;
      store.state.user = buildVisitorUser();
      console.log('[main] Modo publico activo, entrando como visitante');
    } else {
      console.log('[main] Modo privado, redirigiendo a login...');
      window.location.href = '/views/login.html';
    }
  } catch (e) {
    window.location.href = '/views/login.html';
  }
}

function callIfExists(name) {
  if (typeof window[name] === 'function') {
    try { window[name](); } catch (e) { console.warn('[main] init error', name, e); }
  }
}

async function bootstrap() {
  console.log('[main] Inicializando InventarioApp (modular)...');

  registerSW();
  await bootstrapUser();

  initEvents();
  initModalDelegation();

  initUser();
  initSidebar();
  initSidebarGroups();
  initLogout();
  setCurrentDate();

  if (typeof window.applyPermissionsToUI === 'function') {
    window.applyPermissionsToUI();
  }

  // Calendar picker (botones "Seleccionar rango" en filtros)
  initCalendar();

  // Inicializar las vistas (los initX se autoinvocan al cargar los modulos,
  // pero por seguridad los llamamos aca tambien)
  callIfExists('initDashboard');
  callIfExists('initInventory');
  callIfExists('initSales');
  callIfExists('initCompras');
  callIfExists('initMovimientos');
  callIfExists('initDishes');
  callIfExists('initUsers');
  callIfExists('initModals');
  callIfExists('loadPrinterConfigUI');

  initNavigation();

  var initialView = location.hash.slice(1) || 'dashboard';
  navigate(initialView);

  console.log('[main] Aplicacion inicializada correctamente');
}

document.addEventListener('DOMContentLoaded', bootstrap);

export { showToast };

if (typeof window !== 'undefined') {
  window.__appBootstrap = bootstrap;
}
