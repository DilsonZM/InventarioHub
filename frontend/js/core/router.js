// core/router.js
// Navegacion por hash. Reemplaza a `navigate()` y `initNavigation()` de app.js.
// Mantiene compatibilidad: las views (aun en app.js) leen `state.currentView`
// y registran `init*` por vista. Aqui se sigue disparando `loadDashboard`,
// `loadProducts`, `loadSales`, etc. (funciones globales provistas por app.js
// hasta que se migren a views/*.view.js en sub-pasos siguientes).

import { $ } from './dom.js';
import { store } from './store.js';

const TITLES = {
  dashboard: 'Dashboard',
  inventory: 'Inventario',
  dishes: 'Platos y Bebidas',
  pos: 'POS',
  sales: 'Pedidos',
  entradas: 'Entradas',
  movimientos: 'Movimientos',
  users: 'Usuarios',
  config: 'Configuracion'
};

// Mapa de vistas a los loaders disponibles en window (app.js expone
// loadDashboard, loadProducts, etc. hasta migrarlos a views/).
const LOADERS = {
  dashboard: 'loadDashboard',
  inventory: 'loadProducts',
  sales: 'loadSales',
  entradas: 'loadCompras',
  movimientos: 'loadMovimientos',
  dishes: 'loadDishes',
  users: 'loadUsers',
  config: 'loadConfig',
  pos: 'loadPOS'
};

export function navigate(view) {
  store.set({ currentView: view });

  document.querySelectorAll('.view-section').forEach(function (el) {
    el.classList.add('hidden');
  });
  var target = document.getElementById('view-' + view);
  if (target) {
    target.classList.remove('hidden');
    // Re-trigger de la animacion de entrada
    target.style.animation = 'none';
    void target.offsetHeight; // reflow
    target.style.animation = 'slideUp 0.4s ease-out forwards';
  }

  // Marca el link activo en el sidebar
  document.querySelectorAll('.nav-link').forEach(function (link) {
    var isActive = link.dataset.nav === view;
    link.classList.toggle('active', isActive);
  });

  // Actualiza el titulo
  var pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.textContent = TITLES[view] || 'InventarioApp';

  // Carga datos via loader expuesto en window (temporal durante migracion)
  var loaderName = LOADERS[view];
  if (loaderName && typeof window[loaderName] === 'function') {
    try { window[loaderName](); }
    catch (err) { console.error('[router] loader error for', view, err); }
  }

  // Auto-refresh del dashboard (30s). Solo se activa en vista dashboard.
  if (view === 'dashboard' && typeof window.startDashboardAutoRefresh === 'function') {
    window.startDashboardAutoRefresh();
  } else if (typeof window.stopDashboardAutoRefresh === 'function') {
    window.stopDashboardAutoRefresh();
  }

  // En mobile, cerrar el sidebar despues de navegar
  var sidebar = document.getElementById('sidebar');
  if (sidebar && window.innerWidth < 1024 && !sidebar.classList.contains('-translate-x-full')) {
    sidebar.classList.add('-translate-x-full');
    var overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.add('hidden');
  }
}

export function initNavigation() {
  window.addEventListener('hashchange', function () {
    var hash = location.hash.slice(1) || 'dashboard';
    navigate(hash);
  });

  // Click en nav-links: si ya estamos en esa vista, evitar el cambio
  // (porque hashchange no se dispara si el hash no cambia).
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[data-nav]');
    if (!link) return;
    var targetView = link.dataset.nav;
    if (store.state.currentView === targetView) {
      e.preventDefault();
      navigate(targetView);
    }
  });
}

if (typeof window !== 'undefined') {
  window.navigate = navigate;
}
