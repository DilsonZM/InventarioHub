// Estado global de la aplicacion
const state = {
  products: [],
  sales: [],
  categories: [],
  saleItems: [],
  currentView: 'dashboard',
  user: null,
  editingSaleId: null,
  editingCompraId: null,
  modoPublico: false,
  activeFilters: [],
  dishes: [],
  saleType: 'productos',
  saleDishItems: []
};

let categoryChart = null;

// Helper de permisos
window.can = function (perm) {
  if (!state.user || !state.user.permisos) return false;
  return !!state.user.permisos[perm];
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);



function showToast(message, type = 'success') {
  const toast = $('#toast');
  const msg = $('#toastMessage');
  const icon = $('#toastIcon');
  const colors = { success: 'bg-emerald-50 border-emerald-200 text-emerald-800', error: 'bg-red-50 border-red-200 text-red-800', info: 'bg-blue-50 border-blue-200 text-blue-800' };
  const icons = {
    success: '<svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
    error: '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
    info: '<svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>',
  };
  toast.firstElementChild.className = `flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border ${colors[type]}`;
  icon.innerHTML = icons[type];
  msg.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(function () { toast.classList.add('hidden'); }, 3500);
}

function openModal(id) {
  var sidebar = $('#sidebar');
  var overlay = $('#sidebarOverlay');
  if (sidebar && window.innerWidth < 1024 && !sidebar.classList.contains('-translate-x-full')) {
    sidebar.classList.add('-translate-x-full');
    if (overlay) overlay.classList.add('hidden');
  }
  $('#' + id).classList.remove('hidden');
}
function closeModal(id) { $('#' + id).classList.add('hidden'); }

function showError(id, msg) {
  var el = $('#' + id);
  el.classList.remove('hidden');
  el.querySelector('p').textContent = msg;
}

document.addEventListener('DOMContentLoaded', async function () {
  console.log('[App] Inicializando InventarioApp...');

  // Registrar Service Worker para PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      console.log('[PWA] Service Worker registrado:', reg.scope);
    }).catch(function (err) {
      console.warn('[PWA] No se pudo registrar SW:', err);
    });
  }

  if (typeof API === 'undefined') {
    console.error('[App] API no esta definida. Verifica que api.js se cargo correctamente.');
    return;
  }

  // Verificar modo publico (sin auth)
  if (!API.isAuthenticated()) {
    try {
      const cfg = await API.config.get();
      if (cfg.data && cfg.data.modoPublico) {
        state.modoPublico = true;
        state.user = {
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
        console.log('[App] Modo publico activo, entrando como visitante');
      } else {
        console.log('[App] Modo privado, redirigiendo a login...');
        window.location.href = '/views/login.html';
        return;
      }
    } catch (e) {
      window.location.href = '/views/login.html';
      return;
    }
  } else {
    state.user = API.getUser();
    // Refrescar permisos del servidor
    try {
      const me = await API.auth.me();
      state.user = me.data;
      API.setUser(state.user);
    } catch (e) {}
    console.log('[App] Usuario cargado:', state.user);
  }

  if (typeof Utils === 'undefined') {
    console.error('[App] Utils no esta definido. Verifica que utils.js se cargo correctamente.');
    return;
  }

  initUser();
  initNavigation();
  initSidebar();
  initSidebarGroups();
  initModals();
  initDateRangePicker();
  initDashboard();
  initInventory();
  initSales();
  initCompras();
  initMovimientos();
  initDishes();
  initUsers();

  // Modal de filtros mobile
  var applyBtn = $('#mobileFiltersApply');
  var clearBtnM = $('#mobileFiltersClear');
  if (applyBtn) applyBtn.addEventListener('click', function () {
    var view = applyBtn.getAttribute('data-view') || 'sales';
    applyMobileFilters(view);
  });
  if (clearBtnM) clearBtnM.addEventListener('click', function () {
    $('#mobileFiltersContent').querySelectorAll('input, select').forEach(function (el) { el.value = ''; });
  });

  // Click afuera del modal de filtros: aplica Y cierra
  var filtersOverlay = document.querySelector('[data-apply-filters-overlay]');
  if (filtersOverlay) {
    filtersOverlay.addEventListener('click', function () {
      var view = applyBtn ? (applyBtn.getAttribute('data-view') || 'sales') : 'sales';
      applyMobileFilters(view);
    });
  }

  // Permitir que el boton Aplicar sepa en que vista esta
  var openMobileBtns = document.querySelectorAll('[data-open-filters]');
  openMobileBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var v = btn.getAttribute('data-open-filters');
      if (applyBtn) applyBtn.setAttribute('data-view', v);
    });
  });
  initUsers();
  initLogout();
  applyPermissionsToUI();
  setCurrentDate();
  var initialView = location.hash.slice(1) || 'dashboard';
  navigate(initialView);

  console.log('[App] Aplicacion inicializada correctamente');
});

function applyPermissionsToUI() {
  // Sidebar: ocultar items que el usuario no puede ver
  var navItems = {
    'dashboard': 'puedeVerDashboard',
    'inventory': 'puedeVerInventario',
    'sales': 'puedeVerMovimientos',
    'entradas': 'puedeVerMovimientos',
    'movimientos': 'puedeVerMovimientos',
    'dishes': 'puedeVerInventario',
    'users': 'puedeGestionarUsuarios'
  };
  Object.keys(navItems).forEach(function (view) {
    var link = document.querySelector('a[data-nav="' + view + '"]');
    if (link) {
      var canSee = window.can(navItems[view]);
      link.style.display = canSee ? '' : 'none';
    }
  });

  // Botones: ocultar/mostrar segun permiso
  document.querySelectorAll('[data-requires-permission]').forEach(function (el) {
    var perm = el.getAttribute('data-requires-permission');
    el.style.display = window.can(perm) ? '' : 'none';
  });
}

function setCurrentDate() {
  var el = $('#currentDate');
  if (el) el.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: Utils.APP_TIMEZONE });
}

function initUser() {
  var user = state.user;
  if (!user) return;
  $('#userName').textContent = user.username === 'visitante' ? 'Visitante' : user.username;
  if (user.role === 'admin') $('#userRole').textContent = 'Administrador';
  else if (user.role === 'vendedor') $('#userRole').textContent = 'Vendedor';
  else if (user.role === 'visitante') $('#userRole').textContent = 'Modo lectura';
  else $('#userRole').textContent = user.role;
  $('#userInitial').textContent = (user.username || 'V').charAt(0).toUpperCase();
  // Visitante: ocultar logout, mostrar boton de login
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

function initLogout() {
  function doLogout() {
    API.clearAuth();
    window.location.href = '/views/login.html';
  }
  $('#logoutBtn').addEventListener('click', doLogout);
  var collapsedBtn = $('#logoutBtnCollapsed');
  if (collapsedBtn) collapsedBtn.addEventListener('click', doLogout);
}

function initSidebar() {
  var sidebar = $('#sidebar');
  var overlay = $('#sidebarOverlay');
  var body = document.body;
  var STORAGE_KEY = 'sidebar:collapsed';

  // Restaurar estado en desktop
  try {
    if (window.innerWidth >= 1024) {
      if (localStorage.getItem(STORAGE_KEY) === '1') {
        sidebar.classList.add('collapsed');
        body.classList.add('sidebar-collapsed');
        sidebar.style.setProperty('width', '5rem', 'important');
      } else {
        sidebar.classList.add('pinned');
      }
    }
  } catch (e) {}

  $('#menuToggle').addEventListener('click', function () {
    if (window.innerWidth < 1024) {
      sidebar.classList.toggle('-translate-x-full');
      overlay.classList.toggle('hidden');
    }
  });

  overlay.addEventListener('click', function () {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  });

  // Reset al cruzar breakpoint
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 1024) {
      sidebar.classList.remove('-translate-x-full');
      overlay.classList.add('hidden');
    } else {
      sidebar.classList.remove('collapsed');
      body.classList.remove('sidebar-collapsed');
      if (!sidebar.classList.contains('-translate-x-full')) {
        overlay.classList.remove('hidden');
      }
    }
  });

  // Configurar pin button
  var pinBtn = document.getElementById('sidebarPinBtn');
  if (pinBtn) {
    pinBtn.addEventListener('click', function () {
      var isPinned = sidebar.classList.contains('pinned');
      if (isPinned) {
        // Unpin: colapsar
        sidebar.classList.remove('pinned');
        sidebar.classList.add('collapsed');
        body.classList.add('sidebar-collapsed');
        sidebar.style.setProperty('width', '5rem', 'important');
        sidebar.style.removeProperty('width');
        sidebar.style.setProperty('width', '5rem', 'important');
        setTimeout(function () { sidebar.style.setProperty('width', '5rem', 'important'); }, 50);
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
      } else {
        // Pin: fijar expandido
        sidebar.classList.add('pinned');
        sidebar.classList.remove('collapsed');
        body.classList.remove('sidebar-collapsed');
        sidebar.style.removeProperty('width');
        try { localStorage.setItem(STORAGE_KEY, '0'); } catch (e) {}
      }
    });
  }

  // Hover expand (solo si no esta pinned)
  sidebar.addEventListener('mouseenter', function () {
    if (!sidebar.classList.contains('pinned') && sidebar.classList.contains('collapsed') && window.innerWidth >= 1024) {
      sidebar.style.setProperty('width', '18rem', 'important');
    }
  });
  sidebar.addEventListener('mouseleave', function () {
    if (!sidebar.classList.contains('pinned') && sidebar.classList.contains('collapsed') && window.innerWidth >= 1024) {
      sidebar.style.setProperty('width', '5rem', 'important');
    }
  });

}

function initSidebarGroups() {
  var groups = document.querySelectorAll('.sidebar-group');
  var STORAGE_KEY = 'sidebar:groups';

  // Restaurar estado
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) {}

  groups.forEach(function (group) {
    var groupName = group.dataset.group;
    var header = group.querySelector('.sidebar-group-header');
    var items = group.querySelector('.sidebar-group-items');
    if (!header || !items) return;

    // Restaurar expandido
    if (saved[groupName] !== false) {
      group.classList.add('expanded');
    }

    header.addEventListener('click', function () {
      var isExpanded = group.classList.toggle('expanded');
      saved[groupName] = isExpanded;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (e) {}
    });
  });

  // Auto-expandir grupo del link activo
  function expandActiveGroup() {
    var activeLink = document.querySelector('.nav-link.active');
    if (activeLink) {
      var group = activeLink.closest('.sidebar-group');
      if (group) {
        group.classList.add('expanded');
        var groupName = group.dataset.group;
        saved[groupName] = true;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (e) {}
      }
    }
  }

  expandActiveGroup();
  window.addEventListener('hashchange', function () {
    setTimeout(expandActiveGroup, 100);
  });
}

function initNavigation() {
  window.addEventListener('hashchange', function () {
    var hash = location.hash.slice(1) || 'dashboard';
    navigate(hash);
  });

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[data-nav]');
    if (!link) return;
    var targetView = link.dataset.nav;
    if (state.currentView === targetView) {
      e.preventDefault();
      navigate(targetView);
    }
  });
}

var dashboardAutoRefreshId = null;

function startDashboardAutoRefresh() {
  stopDashboardAutoRefresh();
  dashboardAutoRefreshId = setInterval(function () {
    if (state.currentView === 'dashboard') {
      loadDashboard();
    } else {
      stopDashboardAutoRefresh();
    }
  }, 30000);
}

function stopDashboardAutoRefresh() {
  if (dashboardAutoRefreshId !== null) {
    clearInterval(dashboardAutoRefreshId);
    dashboardAutoRefreshId = null;
  }
}

function navigate(view) {
  state.currentView = view;
  $$('.view-section').forEach(function (el) { el.classList.add('hidden'); });
  var target = $('#view-' + view);
  if (target) {
    target.classList.remove('hidden');
    target.style.animation = 'none';
    target.offsetHeight;
    target.style.animation = 'slideUp 0.4s ease-out forwards';
  }

  $$('.nav-link').forEach(function (link) {
    var isActive = link.dataset.nav === view;
    link.classList.toggle('active', isActive);
  });

  var titles = { dashboard: 'Dashboard', inventory: 'Inventario', sales: 'Pedidos', compras: 'Entradas', entradas: 'Entradas', movimientos: 'Movimientos', dishes: 'Platos', users: 'Usuarios', config: 'Configuracion' };
  $('#pageTitle').textContent = titles[view] || 'InventarioApp';

  if (view === 'dashboard') loadDashboard();
  if (view === 'inventory') loadProducts();
  if (view === 'sales') loadSales();
  if (view === 'compras' || view === 'entradas') loadCompras();
  if (view === 'movimientos') loadMovimientos();
  if (view === 'dishes') loadDishes();
  if (view === 'users') loadUsers();
  if (view === 'config') loadConfig();

  if (view === 'dashboard') startDashboardAutoRefresh();
  else stopDashboardAutoRefresh();

  var sidebar = $('#sidebar');
  if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
    sidebar.classList.add('-translate-x-full');
    $('#sidebarOverlay').classList.add('hidden');
  }
}

function initDashboard() {
  var ids = {
    view: 'dashboard',
    dateFrom: '#filterDateFromDash',
    dateTo: '#filterDateToDash',
    period: '#filterQuickPeriodDash',
    cocina: '#filterCocinaDash',
    product: '#filterProductDash',
    clear: '#clearFiltersBtnDash',
    extra: '#filterCocinaDash'
  };
  var loader = loadDashboard;
  $(ids.dateFrom).addEventListener('change', function () { $(ids.period).value = ''; updateClearBtn(ids); loader(); });
  $(ids.dateTo).addEventListener('change', function () { $(ids.period).value = ''; updateClearBtn(ids); loader(); });
  $(ids.period).addEventListener('change', function () { applyQuickPeriod(ids, loader); });
  $(ids.cocina).addEventListener('change', function () { updateClearBtn(ids); loader(); });
  $(ids.product).addEventListener('change', function () { updateClearBtn(ids); loader(); });
  $(ids.clear).addEventListener('click', function () { clearFilters(ids, loader); });

  // Mobile: boton Filtros y limpiar
  var openBtn = document.querySelector('[data-open-filters="dashboard"]');
  if (openBtn) openBtn.addEventListener('click', function () { openMobileFiltersModal('dashboard'); });
  var clearMobile = document.getElementById('clearFiltersBtnDashMobile');
  if (clearMobile) clearMobile.addEventListener('click', function () { clearFilters(ids, loader); });

  // Default periodo = Hoy
  if ($(ids.period) && !$(ids.period).value) {
    $(ids.period).value = 'today';
    applyQuickPeriod(ids, loader);
  }

  // Cargar opciones de productos
  populateProductFilter('#filterProductDash').then(updateClearBtn.bind(null, ids));
  updateClearBtn(ids);
}

async function populateProductFilter(selectId) {
  try {
    var res = await API.products.list();
    var sel = $(selectId);
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="">Todos los productos</option>'
      + (res.data || []).map(function (p) {
        return '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>';
      }).join('');
    if (current) sel.value = current;
  } catch (e) {}
}

function hasActiveFilters(ids) {
  return !!($(ids.dateFrom).value || $(ids.dateTo).value || $(ids.period).value
    || ($(ids.cocina) && $(ids.cocina).value) || ($(ids.product) && $(ids.product).value) || ($(ids.extra) && $(ids.extra).value));
}

function updateClearBtn(ids) {
  var btn = $(ids.clear);
  if (!btn) return;
  if (hasActiveFilters(ids)) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
  updateFilterChips(ids);
}

// Chips: muestra cada filtro activo como pill removible
function updateFilterChips(ids) {
  var view = ids.view;
  if (!view) return; // seguridad: sin view, no escribimos a ningun container
  var chipsContainer = document.querySelector('[data-chips="' + view + '"]');
  if (!chipsContainer) return;
  var chips = [];

  var dateFrom = $(ids.dateFrom) ? $(ids.dateFrom).value : '';
  var dateTo = $(ids.dateTo) ? $(ids.dateTo).value : '';
  if (dateFrom && dateTo) {
    chips.push({ label: 'Fechas: ' + dateFrom + ' - ' + dateTo, clear: function () { $(ids.dateFrom).value = ''; $(ids.dateTo).value = ''; } });
  } else if (dateFrom) {
    chips.push({ label: 'Desde: ' + dateFrom, clear: function () { $(ids.dateFrom).value = ''; } });
  } else if (dateTo) {
    chips.push({ label: 'Hasta: ' + dateTo, clear: function () { $(ids.dateTo).value = ''; } });
  }

  var period = $(ids.period) ? $(ids.period).value : '';
  if (period) {
    var periodLabels = { today: 'Hoy', week: 'Esta semana', month: 'Este mes', quarter: 'Este trimestre', year: 'Este ano' };
    chips.push({ label: 'Periodo: ' + (periodLabels[period] || period), clear: function () { $(ids.period).value = ''; } });
  }

  if ($(ids.cocina) && $(ids.cocina).value) {
    chips.push({ label: 'Cocina: ' + $(ids.cocina).value, clear: function () { $(ids.cocina).value = ''; } });
  }
  if ($(ids.product) && $(ids.product).value) {
    var pEl = $(ids.product);
    var pText = pEl.options[pEl.selectedIndex] ? pEl.options[pEl.selectedIndex].textContent : '';
    chips.push({ label: 'Producto: ' + pText, clear: function () { $(ids.product).value = ''; } });
  }
  if (ids.extra && $(ids.extra) && $(ids.extra).value) {
    var exEl = $(ids.extra);
    var exText = exEl.options[exEl.selectedIndex] ? exEl.options[exEl.selectedIndex].textContent : $(ids.extra).value;
    chips.push({ label: exText, clear: function () { $(ids.extra).value = ''; } });
  }

  // Badge en el boton mobile
  var countSpan = document.querySelector('[data-open-filters="' + view + '"] .mobile-filters-count');
  if (countSpan) {
    if (chips.length > 0) {
      countSpan.textContent = chips.length;
      countSpan.classList.remove('hidden');
    } else {
      countSpan.classList.add('hidden');
    }
  }

  chipsContainer.innerHTML = chips.map(function (chip, idx) {
    return '<button class="filter-chip inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors" data-chip-idx="' + idx + '">'
      + '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '<span>' + escapeHtml(chip.label) + '</span>'
      + '</button>';
  }).join('');

  // Click handlers
  chipsContainer.querySelectorAll('.filter-chip').forEach(function (btn, idx) {
    btn.addEventListener('click', function () {
      chips[idx].clear();
      // Actualizar chips y boton limpiar inmediatamente
      updateClearBtn(ids);
      // Disparar el loader segun la vista
      var loader = view === 'dashboard' ? loadDashboard :
                   view === 'sales' ? loadSales :
                   view === 'entradas' ? loadCompras :
                   view === 'movimientos' ? loadMovimientos : null;
      if (loader) loader();
    });
  });
}

// Modal de filtros para mobile
function openMobileFiltersModal(view) {
  var prefix = view === 'sales' ? '' : (view === 'entradas' ? 'Entradas' : (view === 'movimientos' ? 'Mov' : 'Dash'));
  var content = $('#mobileFiltersContent');
  if (!content) return;

  var dateFromId = '#filterDateFrom' + prefix;
  var dateToId = '#filterDateTo' + prefix;
  var periodId = '#filterQuickPeriod' + prefix;
  var productId = view === 'dashboard' ? '#filterProductDash' : (view === 'movimientos' ? '#filterProductSearchMov' : (view === 'entradas' ? '#filterProductSearchEntradas' : '#filterProductSearch'));
  var cocinaId = view === 'sales' ? '#filterCocina' : (view === 'dashboard' ? '#filterCocinaDash' : null);
  var tipoId = view === 'movimientos' ? '#filterTipoMov' : null;

  var html = '<div>'
    + '<label class=\"block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1\">Rango</label>'
    + '<div class=\"flex items-stretch border border-slate-200 rounded-lg overflow-hidden\">'
    + '<input type=\"date\" id=\"mfDateFrom\" data-view=\"' + view + '\" class=\"flex-1 min-w-0 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:bg-white border-0\">'
    + '<div class=\"w-px bg-slate-200\"></div>'
    + '<input type=\"date\" id=\"mfDateTo\" data-view=\"' + view + '\" class=\"flex-1 min-w-0 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:bg-white border-0\">'
    + '</div></div>';

  html += '<div>'
    + '<label class=\"block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 mt-3\">Periodo</label>'
    + '<select id=\"mfPeriod\" data-view=\"' + view + '\" class=\"w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white\">'
    + '<option value="">Sin periodo</option>'
    + '<option value="today">Hoy</option>'
    + '<option value="week">Esta semana</option>'
    + '<option value="month">Este mes</option>'
    + '<option value="quarter">Este trimestre</option>'
    + '<option value="year">Este ano</option>'
    + '</select></div>';
  setTimeout(function () { var el = $('#mfPeriod'); if (el && $(periodId)) el.value = $(periodId).value; }, 0);

  if (cocinaId && $(cocinaId)) {
    html += '<div class=\"mt-3\"><label class=\"block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1\">Cocina</label>'
      + '<select id=\"mfCocina\" data-view=\"' + view + '\" class=\"w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white\">'
      + '<option value="">Todas</option>'
      + '<option value="Cocina 1">Cocina 1</option><option value="Cocina 2">Cocina 2</option><option value="Cocina 3">Cocina 3</option><option value="Cocina 4">Cocina 4</option>'
      + '</select></div>';
    setTimeout(function () { var el = $('#mfCocina'); if (el && $(cocinaId)) el.value = $(cocinaId).value; }, 0);
  }

  if (tipoId && $(tipoId)) {
    html += '<div class=\"mt-3\"><label class=\"block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1\">Tipo</label>'
      + '<select id=\"mfTipo\" data-view=\"' + view + '\" class=\"w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white\">'
      + '<option value="">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option>'
      + '</select></div>';
    setTimeout(function () { var el = $('#mfTipo'); if (el && $(tipoId)) el.value = $(tipoId).value; }, 0);
  }

  if ($(productId)) {
    var isSelect = $(productId).tagName === 'SELECT';
    if (isSelect) {
      var opts = Array.from($(productId).options).map(function (o) {
        return '<option value="' + o.value + '"' + (o.selected ? ' selected' : '') + '>' + escapeHtml(o.textContent) + '</option>';
      }).join('');
      html += '<div class="mt-4"><label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Producto</label>'
        + '<select id="mfProduct" data-view="' + view + '" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white">'
        + '<option value="">Todos los productos</option>' + opts + '</select></div>';
    } else {
      html += '<div class="mt-4"><label class="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Buscar producto</label>'
        + '<input type="text" id="mfProduct" data-view="' + view + '" placeholder="Nombre o SKU" value="' + escapeHtml($(productId).value || '') + '" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white">'
        + '</div>';
    }
  }

  content.innerHTML = html;
  openModal('mobileFiltersModal');
}

function applyMobileFilters(view) {
  var prefix = view === 'sales' ? '' : (view === 'entradas' ? 'Entradas' : (view === 'movimientos' ? 'Mov' : 'Dash'));
  var dateFromId = '#filterDateFrom' + prefix;
  var dateToId = '#filterDateTo' + prefix;
  var periodId = '#filterQuickPeriod' + prefix;
  var productId = view === 'dashboard' ? '#filterProductDash' : (view === 'movimientos' ? '#filterProductSearchMov' : (view === 'entradas' ? '#filterProductSearchEntradas' : '#filterProductSearch'));
  var cocinaId = view === 'sales' ? '#filterCocina' : (view === 'dashboard' ? '#filterCocinaDash' : null);
  var tipoId = view === 'movimientos' ? '#filterTipoMov' : null;

  if ($(dateFromId) && $('#mfDateFrom')) $(dateFromId).value = $('#mfDateFrom').value;
  if ($(dateToId) && $('#mfDateTo')) $(dateToId).value = $('#mfDateTo').value;
  if ($(periodId) && $('#mfPeriod')) {
    $(periodId).value = $('#mfPeriod').value;
    if ($('#mfPeriod').value) applyQuickPeriod({
      dateFrom: dateFromId, dateTo: dateToId, period: periodId, product: productId, clear: '#clearFiltersBtn' + prefix, view: view
    }, function () { return; });
  }
  if (cocinaId && $(cocinaId) && $('#mfCocina')) $(cocinaId).value = $('#mfCocina').value;
  if (tipoId && $(tipoId) && $('#mfTipo')) $(tipoId).value = $('#mfTipo').value;
  if ($(productId) && $('#mfProduct')) $(productId).value = $('#mfProduct').value;

  closeModal('mobileFiltersModal');

  // Actualizar chips y boton limpiar inmediatamente
  var ids = {
    view: view,
    dateFrom: dateFromId,
    dateTo: dateToId,
    period: periodId,
    product: productId,
    clear: '#clearFiltersBtn' + prefix,
    extra: tipoId,
    cocina: cocinaId
  };
  updateClearBtn(ids);

  var loader = view === 'dashboard' ? loadDashboard :
               view === 'sales' ? loadSales :
               view === 'entradas' ? loadCompras :
               view === 'movimientos' ? loadMovimientos : null;
  if (loader) loader();
}

async function loadDashboard() {
  console.log('[Dashboard] Cargando datos del dashboard...');
  try {
    var fromDash = $('#filterDateFromDash').value;
    var toDash = $('#filterDateToDash').value;
    var cocinaDash = $('#filterCocinaDash').value;
    var productDash = $('#filterProductDash').value;
    var statsParams = {};
    var movParams = { limit: 10 };
    if (fromDash) { statsParams.from = fromDash; movParams.from = fromDash; }
    if (toDash) { statsParams.to = toDash; movParams.to = toDash; }
    if (cocinaDash) { statsParams.cocina = cocinaDash; }
    if (productDash) { movParams.productoId = productDash; }

    var results = await Promise.all([
      API.stats(statsParams),
      API.products.list(),
      API.reportes.movimientos(movParams),
    ]);
    var statsRes = results[0];
    var productsRes = results[1];
    var movsRes = results[2];

    console.log('[Dashboard] Stats recibidas:', statsRes);
    console.log('[Dashboard] Productos recibidos:', (productsRes && productsRes.data) ? productsRes.data.length : 0);
    console.log('[Dashboard] Movimientos recibidos:', (movsRes && movsRes.data) ? movsRes.data.length : 0);

    var stats = statsRes.data;
    $('#stat-products').textContent = stats.totalProducts;
    $('#stat-revenue').textContent = formatCurrency(stats.periodRevenue || 0);
    $('#stat-lowstock').textContent = stats.lowStockCount;
    $('#stat-value').textContent = formatCurrency(stats.inventoryValue);
    var revLabel = $('#stat-revenue-label');
    if (revLabel && stats.periodLabel) {
      revLabel.textContent = 'Salidas ' + stats.periodLabel.toLowerCase();
    }

    console.log('[Dashboard] Stats actualizadas en UI');

    var lowStockProducts = productsRes.data.filter(function (p) { return p.stock <= p.minStock; }).sort(function (a, b) { return (a.stock / a.minStock) - (b.stock / b.minStock); });
    var lowStockList = $('#lowStockList');
    console.log('[Dashboard] Productos con stock bajo:', lowStockProducts.length);

    if (lowStockProducts.length === 0) {
      lowStockList.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">Todo el inventario tiene stock suficiente</p>';
    } else {
      lowStockList.innerHTML = lowStockProducts.map(function (p) {
        var pct = Math.min((p.stock / p.minStock) * 100, 100);
        var color = p.stock === 0 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-yellow-400';
        return '<div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">'
          + '<div class="flex-1 min-w-0">'
          + '<p class="text-sm font-medium text-slate-700 truncate">' + escapeHtml(p.name) + '</p>'
          + '<p class="text-xs text-slate-500">' + escapeHtml(p.sku) + '</p>'
          + '</div>'
          + '<div class="text-right">'
          + '<p class="text-sm font-bold ' + (p.stock === 0 ? 'text-red-600' : 'text-amber-600') + '">' + p.stock + '/' + p.minStock + '</p>'
          + '<div class="w-16 h-1.5 bg-slate-200 rounded-full mt-1"><div class="h-full ' + color + ' rounded-full" style="width:' + pct + '%"></div></div>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    var recentMovs = (movsRes.data || []).slice(0, 5);
    var tbody = $('#recentSalesTable');
    var cards = $('#recentSalesCards');
    console.log('[Dashboard] Ultimos movimientos:', recentMovs.length);

    if (recentMovs.length === 0) {
      var emptyRecent = '<tr><td colspan="5" class="px-6 py-12 text-center">'
        + '<div class="flex flex-col items-center gap-2">'
        + '<div class="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">'
        + '<svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>'
        + '</div>'
        + '<p class="text-sm font-medium text-slate-600">Sin movimientos recientes</p>'
        + '<p class="text-xs text-slate-400">Aun no hay entradas ni salidas</p>'
        + '</div></td></tr>';
      tbody.innerHTML = emptyRecent;
      cards.innerHTML = '<div class="flex flex-col items-center gap-2 py-8">'
        + '<div class="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">'
        + '<svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>'
        + '</div>'
        + '<p class="text-sm font-medium text-slate-600">Sin movimientos recientes</p>'
        + '<p class="text-xs text-slate-400">Aun no hay entradas ni salidas</p>'
        + '</div>';
    } else {
      tbody.innerHTML = recentMovs.map(function (m) {
        var tipoBadge = m.movimiento === 'entrada'
          ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Entrada</span>'
          : '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Salida</span>';
        var cantText = m.movimiento === 'entrada' ? '+ ' + m.cantidad_entrada : '- ' + m.cantidad_salida;
        var cantColor = m.movimiento === 'entrada' ? 'text-emerald-600' : 'text-red-600';
        return '<tr class="hover:bg-slate-50 transition-colors">'
          + '<td class="px-6 py-3 text-sm font-mono text-slate-600">' + formatDateShort(m.fecha) + '</td>'
          + '<td class="px-6 py-3 text-sm text-slate-700">' + escapeHtml(m.producto) + '</td>'
          + '<td class="px-6 py-3">' + tipoBadge + '</td>'
          + '<td class="px-6 py-3 text-sm font-semibold ' + cantColor + '">' + cantText + '</td>'
          + '<td class="px-6 py-3 text-sm text-slate-500">Stock: ' + m.cantidad_stock + '</td>'
          + '</tr>';
      }).join('');

      cards.innerHTML = recentMovs.map(function (m) {
        var tipoBadge = m.movimiento === 'entrada'
          ? '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Entrada</span>'
          : '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">Salida</span>';
        var cantText = m.movimiento === 'entrada' ? '+ ' + m.cantidad_entrada : '- ' + m.cantidad_salida;
        var cantColor = m.movimiento === 'entrada' ? 'text-emerald-600' : 'text-red-600';
        return '<div class="bg-slate-50 rounded-xl p-4 space-y-2">'
          + '<div class="flex items-center justify-between">'
          + '<div class="flex items-center gap-2">' + tipoBadge + '<span class="text-sm font-medium">' + escapeHtml(m.producto) + '</span></div>'
          + '<span class="text-sm font-bold ' + cantColor + '">' + cantText + '</span>'
          + '</div>'
          + '<div class="flex items-center justify-between">'
          + '<span class="text-xs text-slate-400">' + formatDate(m.fecha) + '</span>'
          + '<span class="text-xs text-slate-500">Stock: ' + m.cantidad_stock + '</span>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    console.log('[Dashboard] Renderizando grafico de salidas...');
    renderCategoryChart(movsRes.data || [], productsRes.data);
    loadTopDishes();
    console.log('[Dashboard] Dashboard cargado correctamente');
  } catch (err) {
    console.error('[Dashboard] Error al cargar dashboard:', err);
    showToast('Error al cargar dashboard: ' + err.message, 'error');
  }
}

function renderCategoryChart(movimientos, products) {
  var prodMap = {};
  movimientos.forEach(function (m) {
    if (m.movimiento === 'salida' && m.cantidad_salida > 0) {
      prodMap[m.producto] = (prodMap[m.producto] || 0) + m.cantidad_salida;
    }
  });

  var labels = Object.keys(prodMap);
  var data = Object.values(prodMap);
  var colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

  var canvas = $('#categoryChart');
  if (!canvas) return;
  if (categoryChart) { categoryChart.destroy(); categoryChart = null; }

  var container = canvas.parentElement;
  if (!container) return;

  // Restaurar canvas si fue removido
  if (!document.getElementById('categoryChart')) {
    container.innerHTML = '<canvas id="categoryChart"></canvas>';
    canvas = $('#categoryChart');
  }

  if (labels.length === 0) {
    if (canvas) canvas.style.display = 'none';
    var empty = container.querySelector('.chart-empty');
    if (!empty) {
      var div = document.createElement('div');
      div.className = 'chart-empty flex flex-col items-center justify-center h-full py-12 text-center';
      div.innerHTML = '<div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">'
        + '<svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>'
        + '</div>'
        + '<p class="text-sm font-medium text-slate-600">Sin salidas registradas</p>'
        + '<p class="text-xs text-slate-400 mt-1">Aun no se han registrado salidas en el periodo</p>';
      container.appendChild(div);
    }
    return;
  }

  // Hay datos: ocultar empty state y mostrar canvas
  if (canvas) canvas.style.display = '';
  var existingEmpty = container.querySelector('.chart-empty');
  if (existingEmpty) existingEmpty.remove();

  categoryChart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' } } } },
  });
}

var UNIDADES_POR_CATEGORIA = {
  'Carnes y Aves': ['kg', 'lb', 'g', 'porcion'],
  'Verduras y Tuberculos': ['kg', 'lb', 'g', 'unidad'],
  'Lacteos y Huevos': ['kg', 'L', 'paquete', 'docena', 'g', 'mL'],
  'Salsas y Aderezos': ['L', 'mL', 'g', 'unidad', 'paquete'],
  'Harinas y Panes': ['kg', 'g', 'unidad', 'paquete', 'lb'],
  'Bebidas': ['L', 'mL', 'unidad', 'paquete', 'caja'],
  'Empaques y Desechables': ['paquete', 'unidad', 'caja']
};

var UNIDAD_LABELS = {
  unidad: 'Unidad', kg: 'Kilogramo (kg)', g: 'Gramo (g)', lb: 'Libra (lb)',
  L: 'Litro (L)', mL: 'Mililitro (mL)', porcion: 'Porción',
  paquete: 'Paquete', docena: 'Docena', caja: 'Caja'
};

function updateUnidadesByCategory() {
  var cat = $('#productCategory').value;
  var sel = $('#productUnidad');
  var hint = $('#productUnidadHint');
  var currentVal = sel.value;

  if (!cat) {
    hint.textContent = '';
    Array.from(sel.options).forEach(function (opt) {
      opt.hidden = false;
    });
    return;
  }

  var permitidas = UNIDADES_POR_CATEGORIA[cat] || [];
  hint.textContent = 'sugeridas: ' + permitidas.map(function (u) { return UNIDAD_LABELS[u] || u; }).slice(0, 3).join(', ');

  Array.from(sel.options).forEach(function (opt) {
    if (!opt.value) return;
    opt.hidden = permitidas.indexOf(opt.value) === -1;
  });

  if (currentVal && permitidas.indexOf(currentVal) !== -1) {
    sel.value = currentVal;
  } else if (permitidas.length > 0) {
    sel.value = '';
  }
}

async function initInventory() {
  try {
    var catRes = await API.products.categories();
    state.categories = catRes.data;
    populateCategoryFilters();
  } catch (e) {}

  $('#productCategory').addEventListener('change', updateUnidadesByCategory);

  $('#searchProducts').addEventListener('input', debounce(function () { loadProducts(); }, 300));
  $('#filterCategory').addEventListener('change', function () { loadProducts(); });
  $('#addProductBtn').addEventListener('click', function () { openProductModal(); });

  if (state.user && state.user.role !== 'admin') {
    $('#addProductBtn').classList.add('hidden');
  }
}

function populateCategoryFilters() {
  var options = state.categories.map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>'; }).join('');
  $('#filterCategory').innerHTML = '<option value="">Todas las categorias</option>' + options;
  $('#productCategory').innerHTML = '<option value="">Seleccionar</option>' + options;
}

async function loadTopDishes() {
  try {
    var token = API.getToken();
    var resp = await fetch('/api/stats/dishes', { headers: { 'Authorization': 'Bearer ' + token } });
    var res = await resp.json();
    if (!res.success || !res.data || res.data.length === 0) return;
    var section = $('#topDishesSection');
    if (section) section.classList.remove('hidden');
    var tbody = $('#topDishesTable');
    if (!tbody) return;
    tbody.innerHTML = res.data.map(function (d) {
      var margen = (d.precio_venta || 0) - (d.costo || 0);
      var margenColor = margen >= 0 ? 'text-emerald-600' : 'text-red-600';
      return '<tr>'
        + '<td class="py-2 font-medium text-slate-700">' + escapeHtml(d.nombre) + '</td>'
        + '<td class="py-2 text-center text-slate-600">' + d.cantidad + '</td>'
        + '<td class="py-2 text-right text-slate-700">' + Utils.formatCurrency(d.precio_venta * d.cantidad) + '</td>'
        + '<td class="py-2 text-right text-slate-500">' + Utils.formatCurrency(d.costo * d.cantidad) + '</td>'
        + '<td class="py-2 text-right font-medium ' + margenColor + '">' + Utils.formatCurrency(margen * d.cantidad) + '</td>'
        + '</tr>';
    }).join('');
  } catch (e) {}
}

async function loadProducts() {
  var search = $('#searchProducts').value.trim();
  var category = $('#filterCategory').value;
  var params = {};
  if (search) params.search = search;
  if (category) params.category = category;

  try {
    var res = await API.products.list(params);
    state.products = res.data;
    renderProductsTable();
  } catch (err) {
    showToast('Error al cargar productos', 'error');
  }
}

function renderProductsTable() {
  var tbody = $('#productsTable');
  var cards = $('#productsCards');

  if (state.products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-12 text-center"><p class="text-slate-400 text-sm">No se encontraron productos</p></td></tr>';
    cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">No se encontraron productos</p>';
    return;
  }

  var isAdmin = state.user && state.user.role === 'admin';

  var desktopRows = state.products.map(function (p) {
    var stockClass = p.stock === 0 ? 'text-red-600 bg-red-50' : p.stock <= p.minStock ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50';
    var statusBadge = p.stock === 0
      ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Agotado</span>'
      : p.stock <= p.minStock
        ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Stock bajo</span>'
        : '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Disponible</span>';

    return '<tr class="hover:bg-slate-50 transition-colors">'
      + '<td class="px-6 py-4">'
      + '<div class="flex items-center gap-3">'
      + '<div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">'
      + '<svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>'
      + '</div>'
      + '<div>'
      + '<p class="text-sm font-semibold text-slate-800">' + escapeHtml(p.name) + '</p>'
      + '<p class="text-xs text-slate-400 truncate max-w-[200px]">' + escapeHtml(p.description || '') + '</p>'
      + '</div>'
      + '</div>'
      + '</td>'
      + '<td class="px-6 py-4 text-sm font-mono text-slate-600">' + escapeHtml(p.sku) + '</td>'
      + '<td class="px-6 py-4"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">' + escapeHtml(p.category) + '</span></td>'
      + '<td class="px-6 py-4 text-sm font-semibold text-slate-800 text-right">' + formatCurrency(p.price) + '</td>'
      + '<td class="px-6 py-4 text-center"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ' + stockClass + '">' + p.stock + '</span></td>'
      + '<td class="px-6 py-4 text-center text-sm text-slate-500">' + p.minStock + '</td>'
      + '<td class="px-6 py-4 text-sm text-slate-600"><span class="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">' + escapeHtml(p.unidad || 'unidad') + '</span></td>'
      + '<td class="px-6 py-4 text-center">' + statusBadge + '</td>'
      + '<td class="px-6 py-4 text-right">'
      + (isAdmin ? '<div class="flex items-center justify-end gap-1">'
        + '<button onclick="window.editProduct(\'' + p.id + '\')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
        + '</button>'
        + '<button onclick="window.deleteProduct(\'' + p.id + '\')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
        + '</button>'
        + '</div>' : '<span class="text-xs text-slate-400">Solo lectura</span>')
      + '</td>'
      + '</tr>';
  }).join('');

  tbody.innerHTML = desktopRows;

  var mobileCards = state.products.map(function (p) {
    var stockColor = p.stock === 0 ? 'text-red-600' : p.stock <= p.minStock ? 'text-amber-600' : 'text-emerald-600';
    return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">'
      + '<div class="flex items-start justify-between">'
      + '<div class="flex items-center gap-3">'
      + '<div class="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">'
      + '<svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>'
      + '</div>'
      + '<div>'
      + '<p class="font-semibold text-slate-800">' + escapeHtml(p.name) + '</p>'
      + '<p class="text-xs font-mono text-slate-400">' + escapeHtml(p.sku) + '</p>'
      + '</div>'
      + '</div>'
      + '<span class="text-lg font-bold ' + stockColor + '">' + p.stock + '<span class="text-xs text-slate-400 font-normal ml-1">' + escapeHtml(p.unidad || 'unidad') + '</span></span>'
      + '</div>'
      + '<div class="flex items-center gap-2 flex-wrap">'
      + '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">' + escapeHtml(p.category) + '</span>'
      + '<span class="text-sm font-semibold text-slate-800">' + formatCurrency(p.price) + '</span>'
      + '</div>'
      + '<div class="text-xs text-slate-500">Stock min.: ' + p.minStock + ' ' + escapeHtml(p.unidad || 'unidad') + '</div>'
      + (isAdmin ? '<div class="flex gap-2 pt-2 border-t border-slate-100">'
        + '<button onclick="window.editProduct(\'' + p.id + '\')" class="flex-1 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors touch-target">Editar</button>'
        + '<button onclick="window.deleteProduct(\'' + p.id + '\')" class="flex-1 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors touch-target">Eliminar</button>'
        + '</div>' : '')
      + '</div>';
  }).join('');

  cards.innerHTML = mobileCards;
}

function openProductModal(product) {
  var form = $('#productForm');
  form.reset();
  $('#productId').value = '';
  $('#productModalTitle').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
  $('#productFormError').classList.add('hidden');
  updateUnidadesByCategory();

  if (product) {
    $('#productId').value = product.id;
    $('#productName').value = product.name;
    $('#productSku').value = product.sku;
    $('#productCategory').value = product.category;
    $('#productPrice').value = product.price;
    $('#productCost').value = product.cost;
    $('#productStock').value = product.stock;
    $('#productMinStock').value = product.minStock;
    $('#productUnidad').value = product.unidad || 'unidad';
    $('#productDescription').value = product.description || '';
  }
  openModal('productModal');
}

window.editProduct = async function (id) {
  try {
    var res = await API.products.get(id);
    openProductModal(res.data);
  } catch (err) {
    showToast('Error al cargar producto', 'error');
  }
};

window.deleteProduct = async function (id) {
  var product = state.products.find(function (p) { return p.id === id; });
  if (!product) return;
  if (!confirm('Eliminar "' + product.name + '"? Esta accion no se puede deshacer.')) return;

  try {
    await API.products.delete(id);
    showToast('Producto eliminado correctamente');
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

$('#productForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var id = $('#productId').value;
  var payload = {
    name: $('#productName').value.trim(),
    sku: $('#productSku').value.trim(),
    category: $('#productCategory').value,
    price: parseFloat($('#productPrice').value),
    cost: parseFloat($('#productCost').value),
    stock: parseInt($('#productStock').value),
    minStock: parseInt($('#productMinStock').value) || 0,
    unidad: $('#productUnidad').value,
    description: $('#productDescription').value.trim(),
  };

  if (!payload.name || !payload.sku || !payload.category || isNaN(payload.price) || isNaN(payload.cost) || isNaN(payload.stock) || !payload.unidad) {
    var errEl = $('#productFormError');
    errEl.classList.remove('hidden');
    errEl.querySelector('p').textContent = 'Completa todos los campos requeridos';
    return;
  }

  try {
    if (id) {
      await API.products.update(id, payload);
      showToast('Producto actualizado correctamente');
    } else {
      await API.products.create(payload);
      showToast('Producto creado correctamente');
    }
    closeModal('productModal');
    loadProducts();
  } catch (err) {
    var errEl2 = $('#productFormError');
    errEl2.classList.remove('hidden');
    errEl2.querySelector('p').textContent = err.message;
  }
});

async function initSales() {
  $('#newSaleBtn').addEventListener('click', function () { openSaleModal(); });
  // Botón Nuevo Pedido en header
  var newOrderBtn = $('#newOrderBtn');
  if (newOrderBtn) newOrderBtn.addEventListener('click', function () { location.hash = '#sales'; setTimeout(openSaleModal, 200); });
  var newOrderBtnMobile = $('#newOrderBtnMobile');
  if (newOrderBtnMobile) newOrderBtnMobile.addEventListener('click', function () { location.hash = '#sales'; setTimeout(openSaleModal, 200); });
  initFilters('sales');
  // Dirty tracking: cualquier cambio en el form marca el modal como sucio
  var saleForm = $('#saleForm');
  if (saleForm) {
    saleForm.addEventListener('input', markSaleDirty);
    saleForm.addEventListener('change', markSaleDirty);
  }
  var addSaleItemBtn = $('#addSaleItem');
  if (addSaleItemBtn) addSaleItemBtn.addEventListener('click', markSaleDirty);

  // Toggle tipo de venta
  var tipoProdBtn = $('#saleTypeProductos');
  var tipoPlatoBtn = $('#saleTypePlatos');
  if (tipoProdBtn) tipoProdBtn.addEventListener('click', function () { setSaleType('productos'); });
  if (tipoPlatoBtn) tipoPlatoBtn.addEventListener('click', function () { setSaleType('platos'); });

  // Add dish item button
  var addDishBtn = $('#addDishSaleItem');
  if (addDishBtn) addDishBtn.addEventListener('click', addDishSaleItem);
}

window.openSaleModal = openSaleModal;
window.openCompraModal = openCompraModal;
window.editSale = async function (id) {
  if (!window.can('puedeEditarSalidas')) {
    showToast('No tienes permiso para editar salidas', 'error');
    return;
  }
  try {
    var res = await API.sales.get(id);
    var sale = res.data;
    state.editingSaleId = id;
    state.saleItems = sale.items.map(function (it) {
      return {
        productId: it.productId,
        productName: it.productName,
        cantidadPresentacion: it.cantidadPresentacion || it.quantity,
        cantidadBase: it.quantity,
        unidadBase: 'unidad',
        unidadPresentacion: it.unidadPresentacion || null,
        unidadPresentacionLabel: it.unidadPresentacion || null,
        factorConversion: it.factorConversion || 1
      };
    });
    // Setear la cocina ANTES de abrir
    var pmEl = $('#salePaymentMethod');
    if (pmEl) pmEl.value = sale.paymentMethod || '';
    var titleEl = document.querySelector('#saleModal h3');
    if (titleEl) titleEl.textContent = 'Editar Pedido #' + sale.id.slice(-6);
    openSaleModal();
  } catch (err) {
    showToast('Error al cargar salida: ' + err.message, 'error');
  }
};

window.editCompra = async function (id) {
  if (!window.can('puedeEditarEntradas')) {
    showToast('No tienes permiso para editar entradas', 'error');
    return;
  }
  try {
    var res = await API.compras.get(id);
    var compra = res.data;
    state.editingCompraId = id;
    var titleEl = document.querySelector('#compraModal h3');
    if (titleEl) titleEl.textContent = 'Editar Entrada';
    // Setear valores
    $('#compraProducto').value = compra.producto_id;
    var opt = $('#compraProducto').options[$('#compraProducto').selectedIndex];
    var unidad = opt ? (opt.dataset.unidad || 'unidad') : 'unidad';
    var pres = window.getPresentaciones(unidad);
    $('#compraUnidadPresentacion').innerHTML = pres.map(function (p) {
      return '<option value="' + p.value + '" data-factor="' + p.factor + '">' + escapeHtml(p.label) + '</option>';
    }).join('');
    if (compra.unidad_presentacion) {
      $('#compraUnidadPresentacion').value = compra.unidad_presentacion;
    }
    $('#compraCantidad').value = compra.cantidad_presentacion || compra.cantidad;
    $('#compraValor').value = compra.valor_unitario;
    if (compra.fecha_compra) $('#compraFecha').value = compra.fecha_compra;
    updateCompraTotal();
    openModal('compraModal');
  } catch (err) {
    showToast('Error al cargar entrada: ' + err.message, 'error');
  }
};

window.deleteSale = async function (id) {
  if (!window.can('puedeEliminarSalidas')) {
    showToast('No tienes permiso para eliminar salidas', 'error');
    return;
  }
  if (!confirm('¿Eliminar esta salida? El stock se devolvera al inventario.')) return;
  try {
    await API.sales.delete(id);
    showToast('Salida eliminada y stock devuelto', 'success');
    loadSales();
    loadDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.deleteCompra = async function (id) {
  if (!window.can('puedeEliminarEntradas')) {
    showToast('No tienes permiso para eliminar entradas', 'error');
    return;
  }
  if (!confirm('¿Eliminar esta entrada? El stock se descontara del inventario.')) return;
  try {
    await API.compras.delete(id);
    showToast('Entrada eliminada y stock descontado', 'success');
    loadCompras();
    loadDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

function initFilters(view) {
  var prefix = view === 'sales' ? '' : (view === 'entradas' ? 'Entradas' : 'Mov');
  var ids = {
    view: view,
    dateFrom: '#filterDateFrom' + prefix,
    dateTo: '#filterDateTo' + prefix,
    period: '#filterQuickPeriod' + prefix,
    product: '#filterProductSearch' + prefix,
    clear: '#clearFiltersBtn' + prefix,
    extra: view === 'sales' ? '#filterCocina' : (view === 'movimientos' ? '#filterTipoMov' : null)
  };
  var loader = view === 'sales' ? loadSales : (view === 'entradas' ? loadCompras : loadMovimientos);

  $(ids.dateFrom).addEventListener('change', function () { $(ids.period).value = ''; updateClearBtn(ids); loader(); });
  $(ids.dateTo).addEventListener('change', function () { $(ids.period).value = ''; updateClearBtn(ids); loader(); });
  $(ids.period).addEventListener('change', function () { applyQuickPeriod(ids, loader); });
  if (ids.extra) {
    $(ids.extra).addEventListener('change', function () { updateClearBtn(ids); loader(); });
  }
  if ($(ids.product).tagName === 'INPUT') {
    $(ids.product).addEventListener('input', debounce(function () { updateClearBtn(ids); loader(); }, 350));
  }
  $(ids.clear).addEventListener('click', function () { clearFilters(ids, loader); });

  // Mobile: boton Filtros y limpiar
  var openBtn = document.querySelector('[data-open-filters="' + view + '"]');
  if (openBtn) openBtn.addEventListener('click', function () { openMobileFiltersModal(view); });
  var clearMobile = document.getElementById('clearFiltersBtn' + (view === 'sales' ? 'Mobile' : (view === 'entradas' ? 'EntradasMobile' : (view === 'movimientos' ? 'MovMobile' : 'DashMobile'))));
  if (clearMobile) clearMobile.addEventListener('click', function () { clearFilters(ids, loader); });

  // Mobile: boton "Nueva ..." (espejo del desktop)
  var newBtnMobileId = view === 'sales' ? 'newSaleBtnMobile' : (view === 'entradas' ? 'newCompraBtnMobile' : null);
  if (newBtnMobileId) {
    var newBtnMobile = document.getElementById(newBtnMobileId);
    if (newBtnMobile) {
      newBtnMobile.addEventListener('click', function () {
        if (view === 'sales') openSaleModal();
        else if (view === 'entradas') openCompraModal();
      });
    }
  }

  // Default periodo = Hoy (siempre visible el chip al cargar)
  if ($(ids.period) && !$(ids.period).value) {
    $(ids.period).value = 'today';
    applyQuickPeriod(ids, loader);
  }

  updateClearBtn(ids);
}

function applyQuickPeriod(ids, loader) {
  var period = $(ids.period).value;
  if (!period) return;
  // Usar la fecha/hora actual en la timezone de la app (UTC-5)
  var now = Utils.nowInAppTZ();
  var todayStr = Utils.todayInAppTZ();
  var today = new Date(todayStr + 'T00:00:00');
  var from, to;
  switch (period) {
    case 'today': from = today; to = now; break;
    case 'week': var dow = today.getDay(); from = new Date(today); from.setDate(today.getDate() - dow); to = now; break;
    case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); to = now; break;
    case 'quarter': var q = Math.floor(now.getMonth() / 3); from = new Date(now.getFullYear(), q * 3, 1); to = now; break;
    case 'year': from = new Date(now.getFullYear(), 0, 1); to = now; break;
  }
  if (from) $(ids.dateFrom).value = from.toISOString().split('T')[0];
  if (to) $(ids.dateTo).value = to.toISOString().split('T')[0];
  updateClearBtn(ids);
  loader();
}

function clearFilters(ids, loader) {
  $(ids.dateFrom).value = '';
  $(ids.dateTo).value = '';
  $(ids.period).value = '';
  if ($(ids.product)) $(ids.product).value = '';
  if (ids.extra) $(ids.extra).value = '';
  if (ids.cocina) $(ids.cocina).value = '';
  loader();
  updateClearBtn(ids);
}

async function loadSales() {
  var params = {};
  var from = $('#filterDateFrom').value;
  var to = $('#filterDateTo').value;
  var cocina = $('#filterCocina').value;
  var search = ($('#filterProductSearch').value || '').trim();

  if (from) params.from = from;
  if (to) params.to = to;
  if (cocina) params.cocina = cocina;
  if (search) params.search = search;

  try {
    var res = await API.sales.list(params);
    var sales = res.data || [];

    state.sales = sales;
    renderSalesTable();
    updateSalesSummary();
  } catch (err) {
    showToast('Error al cargar salidas', 'error');
  }
}

function updateSalesSummary() {
  var sales = state.sales;
  var count = sales.length;
  var totalQty = sales.reduce(function (sum, s) { return sum + s.items.reduce(function (iSum, i) { return iSum + i.quantity; }, 0); }, 0);
  var avg = count > 0 ? Math.round(totalQty / count) : 0;
  var distinctItems = sales.reduce(function (set, s) { s.items.forEach(function (i) { set.add(i.productId); }); return set; }, new Set()).size;

  $('#summaryCount').textContent = count;
  $('#summaryTotal').textContent = totalQty;
  $('#summaryAvg').textContent = avg;
  $('#summaryItems').textContent = distinctItems;
}

function renderSalesTable() {
  var tbody = $('#salesTable');
  var cards = $('#salesCards');

  if (state.sales.length === 0) {
    var emptySales = '<tr><td colspan="7" class="px-6 py-16 text-center">'
      + '<div class="flex flex-col items-center gap-3">'
      + '<div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">'
      + '<svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>'
      + '</div>'
      + '<p class="text-sm font-medium text-slate-600">No se encontraron salidas</p>'
      + '<p class="text-xs text-slate-400">Ajusta los filtros o registra una nueva salida</p>'
      + '</div></td></tr>';
    tbody.innerHTML = emptySales;
    var emptySalesMobile = '<div class="flex flex-col items-center gap-3 py-16">'
      + '<div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">'
      + '<svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>'
      + '</div>'
      + '<p class="text-sm font-medium text-slate-600">No se encontraron salidas</p>'
      + '<p class="text-xs text-slate-400">Ajusta los filtros o registra una nueva salida</p>'
      + '</div>';
    cards.innerHTML = emptySalesMobile;
    return;
  }

  tbody.innerHTML = state.sales.map(function (s) {
    return '<tr class="hover:bg-slate-50 transition-colors">'
      + '<td class="px-6 py-4 text-sm font-mono text-slate-600">#' + s.id.slice(-6) + '</td>'
      + '<td class="px-6 py-4">'
      + s.items.map(function (i) {
        var pres = '';
        if (i.unidadPresentacion && i.factorConversion && i.factorConversion !== 1) {
          pres = ' <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium ml-1">' + escapeHtml(i.unidadPresentacion) + '</span>';
        }
        return '<div class="text-sm text-slate-700 mb-0.5">' + escapeHtml(i.productName) + ' x' + (i.unidadPresentacion && i.factorConversion !== 1 ? i.cantidadPresentacion : i.quantity) + pres + '</div>';
      }).join('')
      + '</td>'
      + '<td class="px-6 py-4 text-sm font-semibold text-slate-800 text-right">' + s.items.reduce(function (sum, i) { return sum + i.quantity; }, 0) + ' unid.</td>'
      + '<td class="px-6 py-4"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">' + escapeHtml(s.paymentMethod) + '</span></td>'
      + '<td class="px-6 py-4 text-sm text-slate-500">' + formatDate(s.createdAt) + '</td>'
      + '<td class="px-6 py-4 text-sm text-slate-600"><div class="flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' + escapeHtml(s.usuario_nombre || '') + '</div></td>'
      + '<td class="px-6 py-4 text-right">'
      + '<div class="flex items-center justify-end gap-1">'
      + '<button onclick="window.viewSale(\'' + s.id + '\')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-target" title="Ver detalle">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>'
      + '</button>'
      + '<button onclick="window.showTicket(\'' + s.id + '\')" class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 hover:scale-110 rounded-lg transition-all active:scale-95 touch-target" title="Imprimir ticket">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>'
      + '</button>'
      + (window.can && window.can('puedeEditarSalidas') ?
        '<button onclick="window.editSale(\'' + s.id + '\')" class="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors touch-target" title="Editar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
        + '</button>' : '')
      + (window.can && window.can('puedeEliminarSalidas') ?
        '<button onclick="window.deleteSale(\'' + s.id + '\')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target" title="Eliminar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
        + '</button>' : '')
      + '</div>'
      + '</td>'
      + '</tr>';
  }).join('');

  cards.innerHTML = state.sales.map(function (s) {
    var totalBase = s.items.reduce(function (sum, i) { return sum + i.quantity; }, 0);
    return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">'
      + '<div class="flex items-center justify-between">'
      + '<span class="font-mono text-sm text-slate-500">#' + s.id.slice(-6) + '</span>'
      + '<span class="text-lg font-bold text-slate-800">' + totalBase + ' unid.</span>'
      + '</div>'
      + '<div class="space-y-1">'
      + s.items.map(function (i) {
        var qty = i.unidadPresentacion && i.factorConversion !== 1 ? i.cantidadPresentacion : i.quantity;
        var presHtml = '';
        if (i.unidadPresentacion && i.factorConversion !== 1) {
          presHtml = '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium ml-1">' + escapeHtml(i.unidadPresentacion) + '</span>';
        }
        return '<div class="flex justify-between text-sm">'
          + '<span class="text-slate-600">' + escapeHtml(i.productName) + ' x' + qty + presHtml + '</span>'
          + '</div>';
      }).join('')
      + '</div>'
      + '<div class="flex items-center justify-between pt-2 border-t border-slate-100">'
      + '<div class="flex items-center gap-2 flex-wrap">'
      + '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">' + escapeHtml(s.paymentMethod) + '</span>'
      + '<span class="text-xs text-slate-400">' + formatDate(s.createdAt) + '</span>'
      + '<span class="text-xs text-slate-500 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' + escapeHtml(s.usuario_nombre || '') + '</span>'
      + '</div>'
      + '<div class="flex items-center gap-1">'
      + '<button onclick="window.viewSale(\'' + s.id + '\')" class="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors touch-target" title="Ver">'
      + '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>'
      + '</button>'
      + '<button onclick="window.showTicket(\'' + s.id + '\')" class="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:scale-110 rounded-lg transition-all active:scale-95 touch-target" title="Imprimir">'
      + '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>'
      + '</button>'
      + (window.can && window.can('puedeEditarSalidas') ?
        '<button onclick="window.editSale(\'' + s.id + '\')" class="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors touch-target" title="Editar">'
        + '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
        + '</button>' : '')
      + (window.can && window.can('puedeEliminarSalidas') ?
        '<button onclick="window.deleteSale(\'' + s.id + '\')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors touch-target" title="Eliminar">'
        + '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
        + '</button>' : '')
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

window.viewSale = async function (id) {
  try {
    var res = await API.sales.get(id);
    var sale = res.data;

    $('#detailSaleId').textContent = '#' + sale.id.slice(-6);
    $('#detailSaleDate').textContent = formatDate(sale.createdAt);
    $('#detailSalePayment').textContent = sale.paymentMethod;
    $('#detailSaleTotal').textContent = Utils.formatCurrency(sale.total);

    var itemsHtml = sale.items.map(function (item) {
      var badge = item.esPlato
        ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium ml-1">Plato</span>'
        : '';
      return '<div class="flex items-center justify-between px-4 py-3">'
        + '<div class="flex-1 min-w-0">'
        + '<p class="text-sm font-medium text-slate-800 truncate">' + escapeHtml(item.productName) + ' x' + item.quantity + badge + '</p>'
        + '<p class="text-xs text-slate-500">' + Utils.formatCurrency(item.unitPrice || 0) + ' c/u · ' + Utils.formatCurrency(item.subtotal || 0) + '</p>'
        + '</div>'
        + '<p class="text-sm font-semibold text-slate-800 ml-4">' + Utils.formatCurrency(item.subtotal || 0) + '</p>'
        + '</div>';
    }).join('');

    // Ingredientes consumidos
    var ingsHtml = '';
    if (sale.ingredientesConsumidos && sale.ingredientesConsumidos.length > 0) {
      ingsHtml = '<div class="border-t border-slate-100 px-4 py-3 bg-slate-50/50">'
        + '<p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ingredientes consumidos</p>'
        + sale.ingredientesConsumidos.map(function (ing) {
          return '<div class="flex items-center justify-between text-xs py-1">'
            + '<span class="text-slate-600">' + escapeHtml(ing.nombre) + ' <span class="text-slate-400">' + ing.cantidad + ' ' + (ing.unidad || '') + '</span></span>'
            + '<span class="text-slate-400 text-[10px]">' + escapeHtml(ing.por) + '</span>'
            + '</div>';
        }).join('')
        + '</div>';
    }

    $('#detailSaleItems').innerHTML = itemsHtml + ingsHtml;
    openModal('saleDetailModal');
  } catch (err) {
    showToast('Error al cargar salida', 'error');
  }
};

function setSaleType(type) {
  state.saleType = type;
  var prodSection = $('#saleProductSection');
  var dishSection = $('#saleDishSection');
  var prodBtn = $('#saleTypeProductos');
  var platoBtn = $('#saleTypePlatos');
  var titleEl = document.querySelector('#saleModal h3');

  if (type === 'platos') {
    if (prodSection) prodSection.classList.add('hidden');
    if (dishSection) dishSection.classList.remove('hidden');
    if (prodBtn) { prodBtn.classList.remove('active-tab', 'bg-white', 'shadow-sm'); prodBtn.classList.add('text-slate-600'); }
    if (platoBtn) { platoBtn.classList.add('active-tab', 'bg-white', 'shadow-sm', 'text-slate-800'); platoBtn.classList.remove('text-slate-600'); }
    if (titleEl) titleEl.textContent = 'Nuevo Pedido';
    loadDishOptions();
  } else {
    if (prodSection) prodSection.classList.remove('hidden');
    if (dishSection) dishSection.classList.add('hidden');
    if (prodBtn) { prodBtn.classList.add('active-tab', 'bg-white', 'shadow-sm', 'text-slate-800'); prodBtn.classList.remove('text-slate-600'); }
    if (platoBtn) { platoBtn.classList.remove('active-tab', 'bg-white', 'shadow-sm'); platoBtn.classList.add('text-slate-600'); }
    if (titleEl) {
      if (state.editingSaleId) titleEl.textContent = 'Editar Pedido #' + state.editingSaleId.slice(-6);
      else titleEl.textContent = 'Nuevo Pedido';
    }
  }
}

window.confirmAction = function (title, message, iconSvg, btnText, callback) {
  $('#confirmActionTitle').textContent = title;
  $('#confirmActionMessage').textContent = message;
  if (iconSvg) {
    var iconContainer = $('#confirmActionIcon');
    iconContainer.innerHTML = iconSvg;
    iconContainer.className = iconContainer.className.replace(/bg-\w+-\d+/g, 'bg-rose-100');
  }
  $('#confirmActionOk').textContent = btnText || 'Confirmar';
  state._confirmCallback = callback;
  $('#confirmActionModal').classList.remove('hidden');
};

window.archiveDish = function (dishId, dishName) {
  if (!window.can('puedeEditarProductos')) { showToast('Sin permiso', 'error'); return; }
  window.confirmAction(
    '¿Archivar plato?',
    '"' + dishName + '" dejará de estar disponible para ventas. Podés reactivarlo cuando quieras.',
    '<svg class="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>',
    'Archivar',
    async function () {
      try {
        var res = await API.dishes.update(dishId, { activo: false });
        if (res.success) { showToast('Plato archivado', 'success'); loadDishes(); }
        else showToast(res.message || 'Error al archivar', 'error');
      } catch (err) { showToast('Error de conexion', 'error'); }
    }
  );
};

window.reactivateDish = async function (dishId, dishName) {
  if (!window.can('puedeEditarProductos')) { showToast('Sin permiso', 'error'); return; }
  try {
    var res = await API.dishes.update(dishId, { activo: true });
    if (res.success) { showToast('Plato reactivado', 'success'); loadDishes(); }
    else showToast(res.message || 'Error al reactivar', 'error');
  } catch (err) { showToast('Error de conexion', 'error'); }
};

async function loadDishOptions() {
  var sel = $('#saleDishSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar plato o bebida</option>';
  try {
    var res = await API.dishes.list();
    var dishes = (res.data || []).filter(function (d) {
      return d.activo && d.disponible !== false;
    });
    sel.innerHTML += dishes.map(function (d) {
      return '<option value="' + d.id + '" data-price="' + d.precio_venta + '">' + escapeHtml(d.nombre) + ' \u2014 ' + Utils.formatCurrency(d.precio_venta) + '</option>';
    }).join('');
    if (dishes.length === 0) {
      sel.innerHTML += '<option disabled>— Sin platos disponibles (stock insuficiente) —</option>';
    }
  } catch (e) {}
}

function addDishSaleItem() {
  var sel = $('#saleDishSelect');
  var qty = parseInt($('#saleDishQuantity').value) || 1;

  if (!sel.value) { showToast('Selecciona un plato o bebida', 'error'); return; }
  if (qty <= 0) { showToast('Cantidad invalida', 'error'); return; }

  var opt = sel.options[sel.selectedIndex];
  var price = parseFloat(opt.dataset.price) || 0;

  var existing = state.saleDishItems.find(function (i) { return i.plato_id === sel.value; });
  if (existing) {
    existing.cantidad = qty;
    existing.precioUnitario = price;
    showToast('Cantidad actualizada', 'success');
  } else {
    state.saleDishItems.push({
      plato_id: sel.value,
      nombre: opt.textContent.split(' \u2014 ')[0],
      cantidad: qty,
      precioUnitario: price
    });
    showToast('Plato agregado', 'success');
  }

  renderSaleItems();
  sel.value = '';
  $('#saleDishQuantity').value = 1;
}

async function openSaleModal() {
  var isEditing = !!state.editingSaleId;
  state.saleDirty = false;
  state._pendingOrder = null;
  var submitBtn = document.querySelector('#saleForm button[type=\"submit\"]');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Registrar Pedido'; }
  if (!isEditing) {
    state.saleItems = [];
    state.saleDishItems = [];
    setSaleType('platos');
  }
  if (!isEditing) {
    $('#saleForm').reset();
  }
  $('#saleQuantity').removeAttribute('max');
  $('#saleTotal').textContent = '0 unid.';
  $('#saleFormError').classList.add('hidden');
  $('#saleConversionPreview').classList.add('hidden');

  if (!isEditing) {
    var titleEl = document.querySelector('#saleModal h3');
    if (titleEl) titleEl.textContent = 'Nuevo Pedido';
  }
  renderSaleItems();

  try {
    var res = await API.products.list();
    state.allAvailableProducts = (res.data || []).filter(function (p) { return p.stock > 0; });
    // Si es edicion, incluir el producto original aunque su stock sea 0
    if (isEditing) {
      var editingProdIds = state.saleItems.map(function (i) { return i.productId; });
      var missing = (res.data || []).filter(function (p) {
        return editingProdIds.indexOf(p.id) !== -1 && p.stock <= 0;
      });
      state.allAvailableProducts = state.allAvailableProducts.concat(missing);
    }
    refreshSaleProductOptions();
  } catch (e) {
    state.allAvailableProducts = [];
  }

  // Resetear selector de presentacion
  var presSel = $('#saleUnidadPresentacion');
  if (presSel) presSel.innerHTML = '<option value="">Misma unidad base</option>';

  // En edicion, auto-seleccionar el primer item del state para que el usuario vea
  // su cantidad y el stock disponible, y poder cambiarla
  if (isEditing && state.saleItems.length > 0) {
    var firstItem = state.saleItems[0];
    var sel = $('#saleProductSelect');
    if (sel) {
      sel.value = firstItem.productId;
      // Disparar change manualmente para que se setee max y se actualice la UI
      sel.dispatchEvent(new Event('change'));
    }
  }

  openModal('saleModal');
}

$('#saleProductSelect').addEventListener('change', function () {
  var opt = this.options[this.selectedIndex];
  var stockDisponible = parseFloat(opt.dataset.stock) || 0;
  var unidad = opt.dataset.unidad || 'unidad';
  var presSel = $('#saleUnidadPresentacion');
  var qty = $('#saleQuantity');

  if (!this.value) {
    presSel.innerHTML = '<option value="">Misma unidad base</option>';
    qty.value = 1;
    qty.removeAttribute('max');
    $('#saleConversionPreview').classList.add('hidden');
    return;
  }

  // Defensa adicional: si el navegador permite seleccionar un option disabled
  if (opt.disabled) {
    showToast('Este producto ya esta en la salida. Para cambiar la cantidad, eliminalo primero.', 'error');
    this.value = '';
    presSel.innerHTML = '<option value="">Misma unidad base</option>';
    qty.value = 1;
    qty.removeAttribute('max');
    $('#saleConversionPreview').classList.add('hidden');
    return;
  }

  // Si es edicion y el producto esta en state, pre-poblar con su cantidad
  var existingItem = state.saleItems.find(function (i) { return i.productId === this.value; }.bind(this));
  if (existingItem) {
    var factorExist = existingItem.factorConversion || 1;
    qty.value = factorExist !== 1 ? existingItem.cantidadPresentacion : existingItem.cantidadBase;
    if (existingItem.unidadPresentacion && presSel) {
      // Cargar opciones de presentacion
      var presList = window.getPresentaciones(unidad);
      presSel.innerHTML = presList.map(function (p) {
        return '<option value="' + p.value + '" data-factor="' + p.factor + '" data-icon="' + p.icon + '">' + escapeHtml(p.label) + '</option>';
      }).join('');
      presSel.value = existingItem.unidadPresentacion || '';
    }
  } else {
    qty.value = 1;
  }

  // Maximo = stock disponible (ya incluye lo reservado si es edicion)
  if (stockDisponible > 0) {
    qty.max = stockDisponible;
  } else {
    qty.removeAttribute('max');
  }

  if (!existingItem) {
    var pres = window.getPresentaciones(unidad);
    presSel.innerHTML = pres.map(function (p) {
      return '<option value="' + p.value + '" data-factor="' + p.factor + '" data-icon="' + p.icon + '">' + escapeHtml(p.label) + '</option>';
    }).join('');
    presSel.value = '';
  }

  // Actualizar preview si hay presentacion
  if (presSel.value) {
    updateSaleConversionPreview();
  } else {
    $('#saleConversionPreview').classList.add('hidden');
  }
});

$('#saleUnidadPresentacion').addEventListener('change', function () {
  updateSaleConversionPreview();
});

$('#saleQuantity').addEventListener('input', function () {
  updateSaleConversionPreview();
});

function updateSaleConversionPreview() {
  var sel = $('#saleProductSelect');
  var presSel = $('#saleUnidadPresentacion');
  var opt = sel.options[sel.selectedIndex];
  var pOpt = presSel.options[presSel.selectedIndex];
  var preview = $('#saleConversionPreview');
  var text = $('#saleConversionText');

  if (!sel.value || !pOpt || !pOpt.value) {
    preview.classList.add('hidden');
    return;
  }

  var qty = parseFloat($('#saleQuantity').value);
  var factor = parseFloat(pOpt.dataset.factor) || 1;
  var label = pOpt.textContent;
  var unidadBase = opt.dataset.unidad || 'unidad';
  var baseQty = qty * factor;
  var baseLabel = unidadBase;

  if (factor === 1) {
    preview.classList.add('hidden');
    return;
  }

  text.textContent = qty + ' ' + label.split(' (')[0].toLowerCase() + ' = ' + baseQty.toFixed(2) + ' ' + baseLabel;
  preview.classList.remove('hidden');
}

$('#addSaleItem').addEventListener('click', function () {
  var sel = $('#saleProductSelect');
  var qtyPres = parseFloat($('#saleQuantity').value);
  var presSel = $('#saleUnidadPresentacion');
  var pOpt = presSel.options[presSel.selectedIndex];
  var opt = sel.options[sel.selectedIndex];

  if (!sel.value) { showToast('Selecciona un producto', 'error'); return; }
  if (!qtyPres || qtyPres <= 0) { showToast('Cantidad invalida', 'error'); return; }

  var alreadyAdded = state.saleItems.find(function (i) { return i.productId === sel.value; });
  var isEditing = !!state.editingSaleId;

  // En modo creacion, rechazar duplicados. En edicion, permitir reemplazar cantidad.
  if (alreadyAdded && !isEditing) {
    showToast('Este producto ya esta en la salida. Eliminalo de la lista para volver a agregarlo con otra cantidad.', 'error');
    return;
  }

  var stockDisponible = parseFloat(opt.dataset.stock) || 0;  // ya incluye lo reservado
  var stockReal = parseFloat(opt.dataset.stockReal) || 0;
  var stockReservado = parseFloat(opt.dataset.stockReservado) || 0;
  var factor = pOpt && pOpt.value ? (parseFloat(pOpt.dataset.factor) || 1) : 1;
  var cantidadBase = qtyPres * factor;

  if (cantidadBase > stockDisponible) {
    var msg = 'Stock disponible: ' + stockDisponible + ' ' + (opt.dataset.unidad || 'u') + '. Pediste: ' + cantidadBase.toFixed(2);
    if (stockReservado > 0) {
      msg += ' (ya tienes ' + stockReservado + ' en esta salida)';
    }
    showToast(msg, 'error');
    return;
  }

  var presValue = pOpt && pOpt.value ? pOpt.value : null;
  var presLabel = pOpt && pOpt.value ? pOpt.textContent.split(' (')[0].toLowerCase() : null;

  if (alreadyAdded && isEditing) {
    // Reemplazar la cantidad del item existente
    alreadyAdded.cantidadPresentacion = qtyPres;
    alreadyAdded.cantidadBase = cantidadBase;
    alreadyAdded.unidadPresentacion = presValue;
    alreadyAdded.unidadPresentacionLabel = presLabel;
    alreadyAdded.factorConversion = factor;
  } else {
    state.saleItems.push({
      productId: sel.value,
      productName: opt.textContent.split(' (')[0],
      cantidadPresentacion: qtyPres,
      cantidadBase: cantidadBase,
      unidadBase: opt.dataset.unidad || 'unidad',
      unidadPresentacion: presValue,
      unidadPresentacionLabel: presLabel,
      factorConversion: factor
    });
  }

  renderSaleItems();
  sel.value = '';
  presSel.value = '';
  $('#saleQuantity').value = 1;
  $('#saleConversionPreview').classList.add('hidden');
  if (alreadyAdded && isEditing) {
    showToast('Cantidad actualizada', 'success');
  } else {
    showToast('Producto agregado. Para cambiar la cantidad, eliminalo de la lista.', 'success');
  }
});

function refreshSaleProductOptions() {
  var sel = $('#saleProductSelect');
  if (!sel || !state.allAvailableProducts) return;
  var addedIds = state.saleItems.map(function (i) { return i.productId; });
  var currentValue = sel.value;
  var isEditing = !!state.editingSaleId;

  sel.innerHTML = '<option value="">Seleccionar producto</option>'
    + state.allAvailableProducts.map(function (p) {
        var addedItem = state.saleItems.find(function (i) { return i.productId === p.id; });
        var alreadyAdded = !!addedItem;
        // Stock "reservado" en la salida actual = cantidad ya en el item
        var stockReservado = alreadyAdded ? addedItem.cantidadBase : 0;
        // Stock disponible real = stock_actual + lo que ya esta descontado en esta salida
        var stockDisponible = (p.stock || 0) + stockReservado;
        var label = escapeHtml(p.name) + ' (Stock: ' + stockDisponible + ' ' + escapeHtml(p.unidad || 'unidad') + ')';
        if (alreadyAdded && !isEditing) label = label + ' \u2014 ya agregado';
        if (alreadyAdded && isEditing) label = label + ' \u2014 en esta salida';
        return '<option value="' + p.id + '"'
          + ' data-stock="' + stockDisponible + '"'
          + ' data-stock-real="' + (p.stock || 0) + '"'
          + ' data-stock-reservado="' + stockReservado + '"'
          + ' data-unidad="' + escapeHtml(p.unidad || 'unidad') + '"'
          + (alreadyAdded && !isEditing ? ' disabled' : '')
          + '>' + label + '</option>';
      }).join('');

  // Restaurar seleccion: solo si NO esta ya en state (en creacion) o siempre en edicion
  if (currentValue) {
    if (isEditing) {
      sel.value = currentValue;
    } else if (addedIds.indexOf(currentValue) === -1) {
      sel.value = currentValue;
    } else {
      sel.value = '';
    }
  } else {
    sel.value = '';
  }
}

function renderSaleItems() {
  var tbody = $('#saleItemsTable');
  var cards = $('#saleItemsCards');
  var isDishMode = state.saleType === 'platos';
  var items = isDishMode ? state.saleDishItems : state.saleItems;

  if (!isDishMode) refreshSaleProductOptions();

  if (items.length === 0) {
    var emptyMsg = isDishMode ? 'Sin platos agregados' : 'Sin productos agregados';
    tbody.innerHTML = '<tr><td colspan="' + (isDishMode ? 3 : 4) + '" class="px-4 py-6 text-center text-slate-400">' + emptyMsg + '</td></tr>';
    if (cards) cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">' + emptyMsg + '</p>';
    $('#saleTotal').textContent = '0';
    return;
  }

  if (isDishMode) {
    var total = 0;
    tbody.innerHTML = items.map(function (item, idx) {
      var sub = item.precioUnitario * item.cantidad;
      total += sub;
      return '<tr>'
        + '<td class="px-4 py-2"><span class="text-sm text-slate-700 font-medium">' + escapeHtml(item.nombre) + '</span></td>'
        + '<td class="px-4 py-2 text-center"><span class="text-sm text-slate-600">' + item.cantidad + '</span></td>'
        + '<td class="px-4 py-2 text-right">'
        + '<button onclick="window.removeDishSaleItem(' + idx + ')" class="p-1 text-red-400 hover:text-red-600 transition-colors touch-target">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
        + '</button>'
        + '</td>'
        + '</tr>';
    }).join('');
    $('#saleTotal').textContent = Utils.formatCurrency(total);

    if (cards) {
      cards.innerHTML = items.map(function (item, idx) {
        var sub = item.precioUnitario * item.cantidad;
        return '<div class="flex items-center justify-between bg-slate-50 rounded-xl p-3">'
          + '<div class="flex-1 min-w-0">'
          + '<p class="text-sm font-medium text-slate-700 truncate">' + escapeHtml(item.nombre) + '</p>'
          + '<p class="text-xs text-slate-500">' + item.cantidad + ' x ' + Utils.formatCurrency(item.precioUnitario) + ' = ' + Utils.formatCurrency(sub) + '</p>'
          + '</div>'
          + '<button onclick="window.removeDishSaleItem(' + idx + ')" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
          + '</button>'
          + '</div>';
      }).join('');
    }
    return;
  }

  // Product mode (existing)
  tbody.innerHTML = state.saleItems.map(function (item, idx) {
    var presHtml = '';
    if (item.unidadPresentacion && item.factorConversion !== 1) {
      presHtml = '<div class="text-[11px] text-slate-500">'
        + '= ' + item.cantidadBase.toFixed(item.factorConversion < 1 ? 3 : 1) + ' ' + escapeHtml(item.unidadBase)
        + '</div>';
    } else {
      presHtml = '<div class="text-[11px] text-slate-400">' + escapeHtml(item.unidadBase) + '</div>';
    }
    return '<tr>'
      + '<td class="px-4 py-2">'
      + '<div class="text-sm text-slate-700">' + escapeHtml(item.productName) + '</div>'
      + presHtml
      + '</td>'
      + '<td class="px-4 py-2 text-sm text-center font-medium text-slate-800">'
      + (item.unidadPresentacion ? item.cantidadPresentacion : item.cantidadBase)
      + '</td>'
      + '<td class="px-4 py-2 text-center">'
      + (item.unidadPresentacion
          ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[11px] font-medium">' + escapeHtml(item.unidadPresentacionLabel) + '</span>'
          : '<span class="text-xs text-slate-500">' + escapeHtml(item.unidadBase) + '</span>')
      + '</td>'
      + '<td class="px-4 py-2 text-right">'
      + '<button onclick="window.removeSaleItem(' + idx + ')" class="p-1 text-red-400 hover:text-red-600 transition-colors touch-target">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '</button>'
      + '</td>'
      + '</tr>';
  }).join('');

  cards.innerHTML = state.saleItems.map(function (item, idx) {
    var qty = item.unidadPresentacion ? item.cantidadPresentacion : item.cantidadBase;
    var presLabel = item.unidadPresentacion ? item.unidadPresentacionLabel : item.unidadBase;
    var equivHtml = '';
    if (item.unidadPresentacion && item.factorConversion !== 1) {
      equivHtml = '<p class="text-[11px] text-amber-600 font-medium">= ' + item.cantidadBase.toFixed(item.factorConversion < 1 ? 3 : 1) + ' ' + escapeHtml(item.unidadBase) + '</p>';
    }
    return '<div class="flex items-center justify-between bg-slate-50 rounded-xl p-3">'
      + '<div class="flex-1 min-w-0">'
      + '<p class="text-sm font-medium text-slate-700 truncate">' + escapeHtml(item.productName) + '</p>'
      + '<p class="text-xs text-slate-500">' + qty + ' ' + escapeHtml(presLabel) + '</p>'
      + equivHtml
      + '</div>'
      + '<button onclick="window.removeSaleItem(' + idx + ')" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '</button>'
      + '</div>';
  }).join('');

  var totalBase = state.saleItems.reduce(function (sum, i) { return sum + i.cantidadBase; }, 0);
  var totalPres = state.saleItems.reduce(function (sum, i) { return sum + (i.unidadPresentacion ? i.cantidadPresentacion : 0); }, 0);
  var summary = totalBase.toFixed(totalBase < 1 ? 3 : 1) + ' ' + (state.saleItems[0] ? state.saleItems[0].unidadBase : 'u');
  if (totalPres > 0) summary = totalPres + ' pres. / ' + summary;
  $('#saleTotal').textContent = summary;
}

window.removeSaleItem = function (idx) {
  state.saleItems.splice(idx, 1);
  renderSaleItems();
};

window.removeDishSaleItem = function (idx) {
  state.saleDishItems.splice(idx, 1);
  renderSaleItems();
};

$('#saleForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var submitBtn = this.querySelector('button[type="submit"]');
  var paymentMethod = $('#salePaymentMethod').value;
  var isDishMode = state.saleType === 'platos';

  if (!isDishMode && state.saleItems.length === 0) {
    showError('saleFormError', 'Agrega al menos un producto');
    return;
  }
  if (isDishMode && state.saleDishItems.length === 0) {
    showError('saleFormError', 'Agrega al menos un plato o bebida');
    return;
  }
  if (!paymentMethod) {
    showError('saleFormError', 'Selecciona una cocina');
    return;
  }

  // Prevenir doble clic
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Preparando...'; }

  // Mostrar preview
  var items = isDishMode ? state.saleDishItems : state.saleItems;
  var total = 0;

  var previewHtml = items.map(function (item) {
    var sub = isDishMode ? (item.precioUnitario * item.cantidad) : item.cantidadBase;
    total += sub;
    var label = isDishMode
      ? '<span class="text-[11px] text-slate-500">' + Utils.formatCurrency(item.precioUnitario) + ' c/u</span>'
      : '<span class="text-[11px] text-slate-500">' + (item.unidadPresentacion ? item.cantidadPresentacion + ' ' + item.unidadPresentacionLabel : item.cantidadBase + ' ' + item.unidadBase) + '</span>';
    return '<div class="flex items-center justify-between py-2 border-b border-slate-50 text-sm">'
      + '<div><span class="text-slate-700 font-medium">' + escapeHtml(item.productName || item.nombre) + ' x' + (isDishMode ? item.cantidad : item.cantidadBase) + '</span><br>' + label + '</div>'
      + '<span class="text-slate-800 font-semibold">' + Utils.formatCurrency(sub) + '</span>'
      + '</div>';
  }).join('');

  $('#previewItems').innerHTML = previewHtml;
  $('#previewTotal').textContent = Utils.formatCurrency(total);
  $('#previewCocina').textContent = paymentMethod;

  // Guardar payload para confirmar
  state._pendingOrder = { isDishMode: isDishMode, paymentMethod: paymentMethod, total: total, submitBtn: submitBtn };

  openModal('orderPreviewModal');
});

// Confirmar pedido desde preview
document.addEventListener('click', function (e) {
  if (e.target.closest('[data-close-preview]')) {
    $('#orderPreviewModal').classList.add('hidden');
    var btn = (state._pendingOrder || {}).submitBtn;
    if (btn) { btn.disabled = false; btn.textContent = 'Registrar Pedido'; }
    state._pendingOrder = null;
  }
});
document.getElementById('confirmOrderBtn').addEventListener('click', async function () {
  var pending = state._pendingOrder;
  if (!pending) return;
  $('#orderPreviewModal').classList.add('hidden');
  var btn = pending.submitBtn;
  if (btn) { btn.textContent = 'Confirmando...'; }

  var isDishMode = pending.isDishMode;
  var paymentMethod = pending.paymentMethod;

  var payload;
  if (isDishMode) {
    payload = { platos: state.saleDishItems, paymentMethod: paymentMethod, estado: 'completada' };
  } else {
    payload = {
      items: state.saleItems.map(function (i) {
        return { productId: i.productId, quantity: i.cantidadBase, cantidadPresentacion: i.unidadPresentacion ? i.cantidadPresentacion : null, unidadPresentacion: i.unidadPresentacion || null, factorConversion: i.factorConversion || 1 };
      }),
      paymentMethod: paymentMethod,
    };
  }

  try {
    if (state.editingSaleId) {
      await API.sales.update(state.editingSaleId, payload);
      showToast('Pedido actualizado correctamente');
      state.editingSaleId = null;
    } else {
      var createRes = await API.sales.create(payload);
      if (createRes.success) {
        showToast('Pedido registrado correctamente');
        closeModal('saleModal');
        state.saleDirty = false;
        state._pendingOrder = null;
        $('#orderPreviewModal').classList.add('hidden');
        loadSales();
        if (isDishMode) loadDashboard();
        // Render ticket directo de la respuesta (sin fetch extra)
        renderTicketFromData(createRes.data);
        return;
      } else {
        showToast(createRes.message || 'Error al registrar', 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Registrar Pedido'; }
        return;
      }
    }
    closeModal('saleModal');
    state.saleDirty = false;
    state._pendingOrder = null;
    $('#orderPreviewModal').classList.add('hidden');
    loadSales();
    if (isDishMode) loadDashboard();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Registrar Pedido'; }
    showToast(err.message || 'Error al registrar', 'error');
  }
});

window.showTicket = async function (saleId) {
  try {
    var res = await API.sales.get(saleId);
    var s = res.data;

    $('#ticketNumber').textContent = s.numero_venta;
    $('#ticketCocina').textContent = s.paymentMethod;
    $('#ticketFecha').textContent = Utils.formatDate(s.createdAt);

    var itemsHtml = s.items.map(function (item) {
      var badge = item.esPlato ? ' <span class=\"text-[9px] text-emerald-600\">🍽️</span>' : '';
      return '<div class=\"flex items-center justify-between text-sm\">'
        + '<span class=\"text-slate-700 font-mono\">' + escapeHtml(item.productName) + ' x' + item.quantity + badge + '</span>'
        + '<span class=\"text-slate-600 font-mono\">' + Utils.formatCurrency(item.subtotal || (item.unitPrice * item.quantity)) + '</span>'
        + '</div>';
    }).join('');
    $('#ticketItems').innerHTML = itemsHtml;
    $('#ticketTotal').textContent = Utils.formatCurrency(s.total);

    openModal('ticketModal');
  } catch (e) {
    console.error('showTicket error:', e);
  }
};

document.addEventListener('click', function (e) {
  if (e.target.closest('[data-close-ticket]')) {
    $('#ticketModal').classList.add('hidden');
  }
  if (e.target.closest('#printTicketBtn')) {
    window.print();
  }
});

function renderTicketFromData(sale) {
  if (!sale) return;
  $('#ticketNumber').textContent = (sale.numero_venta || '');
  $('#ticketCocina').textContent = (sale.paymentMethod || '');
  $('#ticketFecha').textContent = Utils.formatDate(sale.createdAt);
  $('#ticketTotal').textContent = Utils.formatCurrency(sale.total);
  $('#ticketBarcode').textContent = '*' + (sale.numero_venta || '') + '*';

  var items = sale.items || [];
  $('#ticketItems').innerHTML = items.map(function (item) {
    var sub = item.subtotal || ((item.unitPrice || 0) * (item.quantity || 0));
    return '<div class=\"flex items-center justify-between text-sm\">'
      + '<span class=\"text-slate-700\">' + escapeHtml(item.productName) + ' x' + item.quantity + '</span>'
      + '<span class=\"text-slate-700 font-mono\">' + Utils.formatCurrency(sub) + '</span>'
      + '</div>';
  }).join('');

  openModal('ticketModal');
}

function initDateRangePicker() {
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (target.tagName === 'INPUT' && target.type === 'date') {
      e.preventDefault();
      var view = target.dataset.view || '';
      var prefix = '';
      if (target.id && target.id.includes('Dash')) prefix = 'Dash';
      else if (target.id && target.id.includes('Entradas')) prefix = 'Entradas';
      else if (target.id && target.id.includes('Mov')) prefix = 'Mov';
      var fromId = '#filterDateFrom' + prefix;
      var toId = '#filterDateTo' + prefix;
      var periodId = '#filterQuickPeriod' + prefix;
      var loader = function () {
        if (view === 'dashboard') loadDashboard();
        else if (view === 'sales') loadSales();
        else if (view === 'entradas') loadCompras();
        else if (view === 'movimientos') loadMovimientos();
      };
      window.openDateRange(view, fromId, toId, periodId, loader);
    }
  });
}

function closeModalWithGuard(modalId) {
  var isDirty = false;
  if (modalId === 'saleModal' && state.saleDirty) isDirty = true;
  if (modalId === 'compraModal' && state.compraDirty) isDirty = true;

  if (isDirty) {
    state._pendingCloseModal = modalId;
    $('#confirmDiscardModal').classList.remove('hidden');
  } else {
    $('#' + modalId).classList.add('hidden');
  }
}

function markSaleDirty() { state.saleDirty = true; }
function markCompraDirty() { state.compraDirty = true; }

// ============================================================================
// Calendario unificado de rango de fechas
// ============================================================================
var calendarState = { monthOffset: 0, start: null, end: null, picking: 'start', view: '', fromId: '', toId: '', periodId: '', callback: null };

window.openDateRange = function (view, fromId, toId, periodId, callback) {
  calendarState.view = view;
  calendarState.fromId = fromId;
  calendarState.toId = toId;
  calendarState.periodId = periodId;
  calendarState.callback = callback;
  calendarState.start = null;
  calendarState.end = null;
  calendarState.picking = 'start';
  calendarState.monthOffset = 0;
  renderCalendar();
  $('#calRangeText').textContent = 'Toca una fecha de inicio';
  openModal('dateRangeModal');
};

function renderCalendar() {
  var today = new Date();
  var base = new Date(today.getFullYear(), today.getMonth() + calendarState.monthOffset, 1);
  var m1 = base.getMonth();
  var y1 = base.getFullYear();
  var m2 = m1 + 1;
  var y2 = y1;
  if (m2 > 11) { m2 = 0; y2++; }
  var months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  $('#calMonth1').textContent = months[m1] + ' ' + y1;
  $('#calMonth2').textContent = months[m2] + ' ' + y2;
  renderCalGrid('calGrid1', y1, m1, today);
  renderCalGrid('calGrid2', y2, m2, today);
}

function renderCalGrid(gridId, year, month, today) {
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var firstDow = new Date(year, month, 0).getDate(); // days in prev month
  var startDow = new Date(year, month, 1).getDay();
  var html = '';
  // Empty cells for previous month
  for (var d = startDow - 1; d >= 0; d--) {
    var dayNum = firstDow - d;
    html += '<div class=\"cal-day other-month\">' + dayNum + '</div>';
  }
  // Current month days
  for (var i = 1; i <= daysInMonth; i++) {
    var cls = 'cal-day';
    var dateStr = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(i).padStart(2,'0');
    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === i) cls += ' today';
    if (calendarState.start === dateStr) cls += ' range-start';
    if (calendarState.end === dateStr) cls += ' range-end';
    if (calendarState.start && calendarState.end && dateStr > calendarState.start && dateStr < calendarState.end) cls += ' in-range';
    html += '<div class=\"' + cls + '\" onclick=\"window.pickDate(\'' + dateStr + '\')\">' + i + '</div>';
  }
  // Next month empty cells to fill row
  var remaining = 7 - ((startDow + daysInMonth) % 7);
  if (remaining < 7) {
    for (var j = 1; j <= remaining; j++) {
      html += '<div class=\"cal-day other-month\">' + j + '</div>';
    }
  }
  $('#' + gridId).innerHTML = html;
}

window.pickDate = function (dateStr) {
  if (calendarState.picking === 'start') {
    calendarState.start = dateStr;
    calendarState.end = null;
    calendarState.picking = 'end';
    $('#calRangeText').textContent = 'Desde: ' + dateStr + ' — Toca fecha final';
  } else {
    if (dateStr < calendarState.start) {
      calendarState.end = calendarState.start;
      calendarState.start = dateStr;
    } else {
      calendarState.end = dateStr;
    }
    calendarState.picking = 'done';
    $('#calRangeText').textContent = calendarState.start + ' → ' + calendarState.end;
  }
  renderCalendar();
};

// Calendar navigation
document.addEventListener('click', function (e) {
  var nav = e.target.closest('[data-cal-nav]');
  if (nav) {
    calendarState.monthOffset += nav.dataset.calNav === 'next' ? 1 : -1;
    renderCalendar();
  }
});

// Calendar presets
document.addEventListener('click', function (e) {
  var preset = e.target.closest('[data-preset]');
  if (!preset) return;
  var p = preset.dataset.preset;
  var today = new Date();
  var tzToday = Utils.todayInAppTZ();
  if (p === 'today') {
    calendarState.start = tzToday; calendarState.end = tzToday; calendarState.picking = 'done';
  } else if (p === 'week') {
    var dow = today.getDay();
    var start = new Date(today); start.setDate(today.getDate() - dow);
    calendarState.start = start.toISOString().split('T')[0];
    var end = new Date(start); end.setDate(start.getDate() + 6);
    calendarState.end = end.toISOString().split('T')[0];
    calendarState.picking = 'done';
  } else if (p === 'month') {
    var first = new Date(today.getFullYear(), today.getMonth(), 1);
    calendarState.start = first.toISOString().split('T')[0];
    var last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    calendarState.end = last.toISOString().split('T')[0];
    calendarState.picking = 'done';
  } else if (p === 'clear') {
    calendarState.start = null; calendarState.end = null; calendarState.picking = 'start';
    $('#calRangeText').textContent = 'Toca una fecha de inicio';
  }
  if (calendarState.picking === 'done') {
    $('#calRangeText').textContent = calendarState.start + ' → ' + calendarState.end;
  }
  renderCalendar();
});

// Apply date range
document.getElementById('applyDateRange').addEventListener('click', function () {
  if (!calendarState.start || !calendarState.end) { showToast('Selecciona un rango de fechas', 'error'); return; }
  var from = calendarState.start;
  var to = calendarState.end;
  if (calendarState.fromId) {
    var fromEl = $(calendarState.fromId); if (fromEl) fromEl.value = from;
  }
  if (calendarState.toId) {
    var toEl = $(calendarState.toId); if (toEl) toEl.value = to;
  }
  if (calendarState.periodId) {
    var pEl = $(calendarState.periodId); if (pEl) pEl.value = '';
  }
  $('#dateRangeModal').classList.add('hidden');
  if (calendarState.callback) calendarState.callback();
});

// Close calendar
document.addEventListener('click', function (e) {
  if (e.target.closest('[data-close-calendar]')) {
    $('#dateRangeModal').classList.add('hidden');
  }
});

function initModals() {
  // Confirm discard: click afuera o "Seguir editando" cierra el confirm
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-confirm-cancel]')) {
      $('#confirmDiscardModal').classList.add('hidden');
    }
  });
  document.getElementById('confirmDiscardOk').addEventListener('click', function () {
    var pendingModal = state._pendingCloseModal;
    $('#confirmDiscardModal').classList.add('hidden');
    if (pendingModal) {
      // Reset dirty flag antes de cerrar
      if (pendingModal === 'saleModal') state.saleDirty = false;
      if (pendingModal === 'compraModal') state.compraDirty = false;
      $('#' + pendingModal).classList.add('hidden');
      state._pendingCloseModal = null;
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close-modal]')) {
      var target = e.target.closest('[data-close-modal]');
      var modal = target.closest('.fixed.z-50');
      if (!modal) modal = target.parentElement && target.parentElement.closest('.fixed.z-50');
      if (modal) closeModalWithGuard(modal.id);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      $$('.fixed.z-50').forEach(function (m) {
        if (m.id === 'sidebar' || m.id === 'sidebarOverlay') return;
        m.classList.add('hidden');
      });
    }
  });

  // Confirm action modal
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-confirm-action-cancel]')) {
      $('#confirmActionModal').classList.add('hidden');
    }
  });
  document.getElementById('confirmActionOk').addEventListener('click', function () {
    $('#confirmActionModal').classList.add('hidden');
    if (state._confirmCallback) {
      var cb = state._confirmCallback;
      state._confirmCallback = null;
      cb();
    }
  });
}

// ============================================
// Entradas
// ============================================

function initCompras() {
  $('#newCompraBtn').addEventListener('click', function () { openCompraModal(); });
  initFilters('entradas');
  // Dirty tracking
  var compraForm = $('#compraForm');
  if (compraForm) {
    compraForm.addEventListener('input', markCompraDirty);
    compraForm.addEventListener('change', markCompraDirty);
  }
}

async function openCompraModal() {
  var isEditing = !!state.editingCompraId;
  state.compraDirty = false; // reset al abrir
  if (!isEditing) {
    $('#compraForm').reset();
    state.editingCompraId = null;
    var titleEl = document.querySelector('#compraModal h3');
    if (titleEl) titleEl.textContent = 'Nueva Entrada';
  }
  $('#compraFecha').value = Utils.todayInAppTZ();
  $('#compraCantidad').value = 1;
  if ($('#compraTotal')) $('#compraTotal').textContent = '$0.00';
  $('#compraFormError').classList.add('hidden');
  $('#compraConversionPreview').classList.add('hidden');

  try {
    var res = await API.products.list();
    var all = res.data || [];
    $('#compraProducto').innerHTML = '<option value="">Seleccionar producto</option>' +
      all.map(function (p) {
        return '<option value="' + p.id + '" data-unidad="' + escapeHtml(p.unidad || 'unidad') + '">'
          + escapeHtml(p.name) + ' (' + escapeHtml(p.sku) + ' - ' + escapeHtml(p.unidad || 'unidad') + ')'
          + '</option>';
      }).join('');
  } catch (e) {}

  $('#compraUnidadPresentacion').innerHTML = '<option value="">Misma unidad base</option>';

  openModal('compraModal');
}

$('#compraProducto').addEventListener('change', function () {
  var opt = this.options[this.selectedIndex];
  if (!this.value) {
    $('#compraUnidadPresentacion').innerHTML = '<option value="">Misma unidad base</option>';
    $('#compraConversionPreview').classList.add('hidden');
    return;
  }
  var unidad = opt.dataset.unidad || 'unidad';
  var pres = window.getPresentaciones(unidad);
  $('#compraUnidadPresentacion').innerHTML = pres.map(function (p) {
    return '<option value="' + p.value + '" data-factor="' + p.factor + '">' + escapeHtml(p.label) + '</option>';
  }).join('');
  updateCompraConversionPreview();
});

$('#compraUnidadPresentacion').addEventListener('change', updateCompraConversionPreview);
$('#compraCantidad').addEventListener('input', function () { updateCompraConversionPreview(); updateCompraTotal(); });
$('#compraValor').addEventListener('input', updateCompraTotal);

function updateCompraConversionPreview() {
  var sel = $('#compraProducto');
  var presSel = $('#compraUnidadPresentacion');
  var pOpt = presSel.options[presSel.selectedIndex];
  var preview = $('#compraConversionPreview');
  var text = $('#compraConversionText');

  if (!sel.value || !pOpt || !pOpt.value) {
    preview.classList.add('hidden');
    return;
  }

  var opt = sel.options[sel.selectedIndex];
  var qty = parseFloat($('#compraCantidad').value) || 0;
  var factor = parseFloat(pOpt.dataset.factor) || 1;
  var baseQty = qty * factor;
  var baseLabel = opt.dataset.unidad || 'unidad';

  if (factor === 1) {
    preview.classList.add('hidden');
    return;
  }

  text.textContent = qty + ' ' + pOpt.textContent.split(' (')[0].toLowerCase() + ' = ' + baseQty.toFixed(2) + ' ' + baseLabel;
  preview.classList.remove('hidden');
}

function updateCompraTotal() {
  var presSel = $('#compraUnidadPresentacion');
  var pOpt = presSel.options[presSel.selectedIndex];
  var factor = pOpt && pOpt.value ? (parseFloat(pOpt.dataset.factor) || 1) : 1;
  var cant = (parseFloat($('#compraCantidad').value) || 0) * factor;
  var val = parseFloat($('#compraValor').value) || 0;
  $('#compraTotal').textContent = formatCurrency(cant * val);
}

$('#compraForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var producto_id = $('#compraProducto').value;
  var cantPres = parseFloat($('#compraCantidad').value);
  var presSel = $('#compraUnidadPresentacion');
  var pOpt = presSel.options[presSel.selectedIndex];
  var factor = pOpt && pOpt.value ? (parseFloat(pOpt.dataset.factor) || 1) : 1;
  var cantidad = cantPres * factor;
  var unidadPres = pOpt && pOpt.value ? pOpt.value : null;
  var valor = parseFloat($('#compraValor').value);
  var fecha = $('#compraFecha').value;

  if (!producto_id || !cantPres || cantPres <= 0 || !valor || valor <= 0) {
    showError('compraFormError', 'Completa todos los campos requeridos');
    return;
  }

  var payload = {
    producto_id: producto_id,
    cantidad: cantidad,
    valor_unitario: valor,
    fecha_compra: fecha || undefined,
    cantidad_presentacion: unidadPres ? cantPres : null,
    unidad_presentacion: unidadPres,
    factor_conversion: factor
  };

  try {
    if (state.editingCompraId) {
      await API.compras.update(state.editingCompraId, payload);
      showToast('Entrada actualizada correctamente');
      state.editingCompraId = null;
    } else {
      await API.compras.create(payload);
      showToast('Entrada registrada correctamente');
    }
    closeModal('compraModal');
    state.compraDirty = false;
    loadCompras();
    loadDashboard();
  } catch (err) {
    showError('compraFormError', err.message);
  }
});

async function loadCompras() {
  try {
    var params = {};
    var from = $('#filterDateFromEntradas').value;
    var to = $('#filterDateToEntradas').value;
    var search = ($('#filterProductSearchEntradas').value || '').trim();
    if (from) params.from = from;
    if (to) params.to = to;
    if (search) params.search = search;

    var res = await API.compras.list(params);
    var compras = res.data || [];
    var tbody = $('#comprasTable');
    var cards = $('#comprasCards');

    if (compras.length === 0) {
      var emptyComprasHtml = '<tr><td colspan="7" class="px-6 py-16 text-center">'
        + '<div class="flex flex-col items-center gap-3">'
        + '<div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">'
        + '<svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>'
        + '</div>'
        + '<p class="text-sm font-medium text-slate-600">No hay entradas registradas</p>'
        + '<p class="text-xs text-slate-400">Ajusta los filtros o registra una nueva entrada</p>'
        + '</div></td></tr>';
      tbody.innerHTML = emptyComprasHtml;
      cards.innerHTML = '<div class="flex flex-col items-center gap-3 py-16">'
        + '<div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">'
        + '<svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>'
        + '</div>'
        + '<p class="text-sm font-medium text-slate-600">No hay entradas registradas</p>'
        + '<p class="text-xs text-slate-400">Ajusta los filtros o registra una nueva entrada</p>'
        + '</div>';
      return;
    }

    tbody.innerHTML = compras.map(function (c) {
      var cantHtml = c.cantidad;
      if (c.cantidad_presentacion && c.factor_conversion && c.factor_conversion !== 1) {
        cantHtml = c.cantidad_presentacion + ' <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">' + escapeHtml(c.unidad_presentacion || '') + '</span>'
          + ' <span class="text-xs text-slate-400">= ' + c.cantidad + '</span>';
      }
      return '<tr class="hover:bg-slate-50 transition-colors">'
        + '<td class="px-6 py-3 text-sm text-slate-600">' + (c.fecha_compra || '') + '</td>'
        + '<td class="px-6 py-3 text-sm text-slate-700">' + escapeHtml(c.producto_nombre) + ' <span class="text-xs text-slate-400">' + escapeHtml(c.producto_sku) + '</span></td>'
        + '<td class="px-6 py-3 text-sm text-center">' + cantHtml + '</td>'
        + '<td class="px-6 py-3 text-sm text-right">' + formatCurrency(c.valor_unitario) + '</td>'
        + '<td class="px-6 py-3 text-sm font-semibold text-right">' + formatCurrency(c.valor_total) + '</td>'
        + '<td class="px-6 py-3 text-sm text-slate-600">' + escapeHtml(c.usuario_nombre || '') + '</td>'
        + '<td class="px-6 py-3 text-right">'
        + '<div class="flex items-center justify-end gap-1">'
        + (window.can && window.can('puedeEditarEntradas') ?
          '<button onclick="window.editCompra(\'' + c.id + '\')" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors touch-target" title="Editar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
          + '</button>' : '')
        + (window.can && window.can('puedeEliminarEntradas') ?
          '<button onclick="window.deleteCompra(\'' + c.id + '\')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target" title="Eliminar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
          + '</button>' : '')
        + '</div>'
        + '</td>'
        + '</tr>';
    }).join('');

    cards.innerHTML = compras.map(function (c) {
      var cantHtml = c.cantidad + ' unid';
      if (c.cantidad_presentacion && c.factor_conversion && c.factor_conversion !== 1) {
        cantHtml = c.cantidad_presentacion + ' ' + escapeHtml(c.unidad_presentacion || '') + ' = ' + c.cantidad + ' base';
      }
      var actionsHtml = '<div class="flex items-center gap-1">'
        + (window.can && window.can('puedeEditarEntradas') ?
          '<button onclick="window.editCompra(\'' + c.id + '\')" class="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors touch-target" title="Editar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
          + '</button>' : '')
        + (window.can && window.can('puedeEliminarEntradas') ?
          '<button onclick="window.deleteCompra(\'' + c.id + '\')" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors touch-target" title="Eliminar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
          + '</button>' : '')
        + '</div>';
      return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-2">'
        + '<div class="flex justify-between"><span class="text-xs text-slate-500">' + (c.fecha_compra || '') + '</span><span class="text-lg font-bold">' + formatCurrency(c.valor_total) + '</span></div>'
        + '<p class="text-sm font-medium">' + escapeHtml(c.producto_nombre) + '</p>'
        + '<div class="flex gap-3 text-xs text-slate-500"><span>' + cantHtml + '</span><span>' + formatCurrency(c.valor_unitario) + ' c/u</span></div>'
        + '<div class="flex items-center justify-between">'
        + '<div class="flex items-center gap-1.5 text-xs text-slate-500"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' + escapeHtml(c.usuario_nombre || '') + '</div>'
        + actionsHtml
        + '</div>'
        + '</div>';
    }).join('');
  } catch (err) {
    showToast('Error al cargar entradas', 'error');
  }
}

// ============================================
// Movimientos
// ============================================

async function loadMovimientos() {
  try {
    var params = {};
    var from = $('#filterDateFromMov').value;
    var to = $('#filterDateToMov').value;
    var tipo = $('#filterTipoMov').value;
    var search = ($('#filterProductSearchMov').value || '').trim();
    if (from) params.from = from;
    if (to) params.to = to;
    if (tipo) params.tipo = tipo;
    if (search) params.search = search;

    var res = await API.reportes.movimientos(params);
    var movs = res.data || [];
    var tbody = $('#movimientosTable');
    var cards = $('#movimientosCards');

    if (movs.length === 0) {
      var emptyMovsHtml = '<tr><td colspan="8" class="px-6 py-16 text-center">'
        + '<div class="flex flex-col items-center gap-3">'
        + '<div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">'
        + '<svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>'
        + '</div>'
        + '<p class="text-sm font-medium text-slate-600">No hay movimientos registrados</p>'
        + '<p class="text-xs text-slate-400">Ajusta los filtros o registra una entrada o salida</p>'
        + '</div></td></tr>';
      tbody.innerHTML = emptyMovsHtml;
      cards.innerHTML = '<div class="flex flex-col items-center gap-3 py-16">'
        + '<div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">'
        + '<svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>'
        + '</div>'
        + '<p class="text-sm font-medium text-slate-600">No hay movimientos registrados</p>'
        + '<p class="text-xs text-slate-400">Ajusta los filtros o registra una entrada o salida</p>'
        + '</div>';
      return;
    }

    tbody.innerHTML = movs.map(function (m) {
      var tipoBadge = m.movimiento === 'entrada' ? '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Entrada</span>'
        : m.movimiento === 'salida' ? '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Salida</span>'
        : '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Ajuste</span>';
      return '<tr class="hover:bg-slate-50 transition-colors">'
        + '<td class="px-6 py-3 text-sm text-slate-600">' + formatDate(m.fecha) + '</td>'
        + '<td class="px-6 py-3">' + tipoBadge + '</td>'
        + '<td class="px-6 py-3 text-sm text-slate-700">' + escapeHtml(m.producto) + '</td>'
        + '<td class="px-6 py-3 text-sm font-mono text-center text-slate-500">' + escapeHtml(m.codigo) + '</td>'
        + '<td class="px-6 py-3 text-sm text-center text-emerald-600 font-medium">' + (m.cantidad_entrada || '-') + '</td>'
        + '<td class="px-6 py-3 text-sm text-center text-red-600 font-medium">' + (m.cantidad_salida || '-') + '</td>'
        + '<td class="px-6 py-3 text-sm text-center font-semibold">' + m.cantidad_stock + '</td>'
        + '<td class="px-6 py-3 text-sm text-slate-600"><div class="flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' + escapeHtml(m.usuario_nombre || '') + '</div></td>'
        + '</tr>';
    }).join('');

    cards.innerHTML = movs.map(function (m) {
      return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-2">'
        + '<div class="flex justify-between"><span class="text-xs text-slate-500">' + formatDate(m.fecha) + '</span>'
        + (m.movimiento === 'entrada' ? '<span class="text-emerald-600 text-sm font-bold">+ ' + m.cantidad_entrada + '</span>' : m.movimiento === 'salida' ? '<span class="text-red-600 text-sm font-bold">- ' + m.cantidad_salida + '</span>' : '<span class="text-amber-600 text-sm font-bold">Ajuste</span>')
        + '</div>'
        + '<p class="text-sm font-medium">' + escapeHtml(m.producto) + '</p>'
        + '<div class="flex justify-between text-xs text-slate-500"><span>' + escapeHtml(m.codigo) + '</span><span>Stock: ' + m.cantidad_stock + '</span></div>'
        + '<div class="flex items-center gap-1.5 text-xs text-slate-500"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' + escapeHtml(m.usuario_nombre || '') + '</div>'
        + '</div>';
    }).join('');
  } catch (err) {
    showToast('Error al cargar movimientos', 'error');
  }
}

function initMovimientos() {
  initFilters('movimientos');
}

// ============================================
// Usuarios
// ============================================

var PERM_LABELS = {
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

function buildPermsObj(perms) {
  return {
    puede_crear_productos: !!perms.puedeCrearProductos,
    puede_editar_productos: !!perms.puedeEditarProductos,
    puede_eliminar_productos: !!perms.puedeEliminarProductos,
    puede_crear_salidas: !!perms.puedeCrearSalidas,
    puede_editar_salidas: !!perms.puedeEditarSalidas,
    puede_eliminar_salidas: !!perms.puedeEliminarSalidas,
    puede_crear_entradas: !!perms.puedeCrearEntradas,
    puede_editar_entradas: !!perms.puedeEditarEntradas,
    puede_eliminar_entradas: !!perms.puedeEliminarEntradas,
    puede_gestionar_usuarios: !!perms.puedeGestionarUsuarios,
    puede_ver_inventario: !!perms.puedeVerInventario,
    puede_ver_movimientos: !!perms.puedeVerMovimientos,
    puede_ver_dashboard: !!perms.puedeVerDashboard
  };
}

function plantillaPorRolFrontend(role) {
  if (role === 'admin') {
    return {
      puedeCrearProductos: true, puedeEditarProductos: true, puedeEliminarProductos: true,
      puedeCrearSalidas: true, puedeEditarSalidas: true, puedeEliminarSalidas: true,
      puedeCrearEntradas: true, puedeEditarEntradas: true, puedeEliminarEntradas: true,
      puedeGestionarUsuarios: true, puedeVerInventario: true, puedeVerMovimientos: true, puedeVerDashboard: true
    };
  }
  return {
    puedeCrearSalidas: true, puedeEditarSalidas: false, puedeEliminarSalidas: false,
    puedeCrearEntradas: false, puedeEditarEntradas: false, puedeEliminarEntradas: false,
    puedeGestionarUsuarios: false, puedeVerInventario: true, puedeVerMovimientos: true, puedeVerDashboard: true
  };
}

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
        + '<input type="checkbox" id="perm_' + k + '" data-perm="' + k + '" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">'
        + '<span>' + PERM_LABELS[k] + '</span>'
        + '</label>';
    }).join('');
  }

  // Config
  var saveConfigBtn = $('#saveConfigBtn');
  if (saveConfigBtn) saveConfigBtn.addEventListener('click', saveConfig);
}

// ============================================================================
// PLATOS (DISHES) — CRUD, receta con ingredientes del inventario
// ============================================================================

function initDishes() {
  var addBtn = $('#addDishBtn');
  if (addBtn) addBtn.addEventListener('click', function () { openDishModal(); });

  var form = $('#dishForm');
  if (form) form.addEventListener('submit', saveDish);

  var search = $('#searchDishes');
  if (search) search.addEventListener('input', Utils.debounce(loadDishes, 300));

  var typeFilter = $('#filterDishType');
  if (typeFilter) typeFilter.addEventListener('change', loadDishes);
}

async function loadDishes() {
  try {
    var search = ($('#searchDishes') ? $('#searchDishes').value : '').trim();
    var tipo = $('#filterDishType') ? $('#filterDishType').value : '';
    var params = {};
    if (tipo) params.tipo = tipo;

    var res = await API.dishes.list(params);
    var dishes = res.data || [];

    if (search) {
      var s = search.toLowerCase();
      dishes = dishes.filter(function (d) { return d.nombre.toLowerCase().includes(s); });
    }

    state.dishes = dishes;
    renderDishesTable();
  } catch (err) {
    console.error('loadDishes error:', err);
  }
}

function renderDishesTable() {
  var tbody = $('#dishesTable');
  var cards = $('#dishesCards');
  var all = state.dishes;
  var activos = all.filter(function (d) { return d.activo; });
  var archivados = all.filter(function (d) { return !d.activo; });

  // === ACTIVOS ===
  if (!activos.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-16 text-center"><div class="flex flex-col items-center gap-3"><div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center"><svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></div><p class="text-sm font-medium text-slate-600">No se encontraron platos</p><p class="text-xs text-slate-400">Ajustá los filtros o creá un nuevo plato</p></div></td></tr>';
    if (cards) cards.innerHTML = '<div class="text-center py-12"><div class="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></div><p class="text-sm font-medium text-slate-600">No se encontraron platos</p><p class="text-xs text-slate-400">Ajustá los filtros o creá un nuevo plato</p></div>';
  } else {
    tbody.innerHTML = activos.map(function (d) { return renderDishRow(d, true); }).join('');
    if (cards) cards.innerHTML = activos.map(function (d) { return renderDishCard(d, true); }).join('');
  }

  // === ARCHIVADOS ===
  var archSection = $('#dishesArchivedSection');
  var archTable = $('#dishesArchivedTable');
  var archCards = $('#dishesArchivedCards');
  var archCount = $('#dishesArchivedCount');
  var archLabel = $('#dishesArchivedLabel');
  var archContent = $('#dishesArchivedContent');
  var archChevron = $('#archivedChevron');

  if (archivados.length > 0) {
    if (archSection) archSection.classList.remove('hidden');
    if (archCount) archCount.textContent = ' (' + archivados.length + ')';
    if (archLabel) archLabel.textContent = 'Platos archivados (' + archivados.length + ')';
    if (archTable) archTable.innerHTML = archivados.map(function (d) { return renderDishRow(d, false); }).join('');
    if (archCards) archCards.innerHTML = archivados.map(function (d) { return renderDishCard(d, false); }).join('');
    // Siempre colapsados por defecto
    if (archContent) { archContent.style.maxHeight = '0'; }
    if (archChevron) { archChevron.style.transform = ''; }
  } else {
    if (archSection) archSection.classList.add('hidden');
  }
}

// Toggle seccion archivados
var toggleArchivedBtn = document.getElementById('toggleArchivedBtn');
if (toggleArchivedBtn) {
  toggleArchivedBtn.addEventListener('click', function () {
    var content = $('#dishesArchivedContent');
    var chevron = $('#archivedChevron');
    if (!content || !chevron) return;
    var isOpen = content.style.maxHeight !== '0px' && content.style.maxHeight !== '0';
    if (isOpen) {
      content.style.maxHeight = '0';
      chevron.style.transform = '';
    } else {
      content.style.maxHeight = content.scrollHeight + 'px';
      chevron.style.transform = 'rotate(180deg)';
    }
  });
}

function renderDishRow(d, isActive) {
  var badge = d.tipo === 'bebida'
    ? '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700">Bebida</span>'
    : '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Plato</span>';

  var ingsHtml = '';
  if (d.ingredientes && d.ingredientes.length > 0) {
    ingsHtml = '<div class="text-[11px] text-slate-400 mt-0.5 space-y-0.5">'
      + d.ingredientes.map(function (ing) {
        return '<div>· ' + escapeHtml(ing.nombre) + ' ' + ing.cantidad + ing.unidad + (ing.costo > 0 ? ' <span class="text-slate-500">' + Utils.formatCurrency(ing.costo) + '</span>' : '') + '</div>';
      }).join('')
      + '</div>';
  }

  var actions;
  if (isActive) {
    actions = '<button onclick="window.editDish(\'' + d.id + '\')" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-target" title="Editar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>'
      + '<button onclick="window.archiveDish(\'' + d.id + '\', \'' + escapeHtml(d.nombre) + '\')" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors touch-target" title="Archivar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg></button>';
  } else {
    actions = '<button onclick="window.reactivateDish(\'' + d.id + '\', \'' + escapeHtml(d.nombre) + '\')" class="px-2.5 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors touch-target" title="Reactivar">Reactivar</button>';
  }

  return '<tr class="hover:bg-slate-50 transition-colors">'
    + '<td class="px-6 py-3"><span class="text-sm font-semibold text-slate-800">' + escapeHtml(d.nombre) + '</span>' + ingsHtml + '</td>'
    + '<td class="px-6 py-3">' + badge + '</td>'
    + '<td class="px-6 py-3 text-center"><span class="text-sm text-slate-600">' + (d.num_ingredientes || 0) + '</span></td>'
    + '<td class="px-6 py-3 text-right"><span class="text-sm font-semibold text-slate-800">' + Utils.formatCurrency(d.precio_venta) + '</span></td>'
    + '<td class="px-6 py-3 text-right"><span class="text-sm ' + ((d.costo || 0) > 0 ? 'text-slate-600' : 'text-slate-400') + '">' + ((d.costo || 0) > 0 ? Utils.formatCurrency(d.costo) : '—') + '</span></td>'
    + '<td class="px-6 py-3 text-center">' + (isActive ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Activo</span>' : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Archivado</span>') + '</td>'
    + '<td class="px-6 py-3 text-right"><div class="flex items-center justify-end gap-1">' + actions + '</div></td>'
    + '</tr>';
}

function renderDishCard(d, isActive) {
  return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3' + (isActive ? '' : ' opacity-75') + '">'
    + '<div class="flex items-start justify-between gap-2">'
    + '<div class="min-w-0 flex-1">'
    + '<p class="font-semibold text-slate-800 truncate">' + escapeHtml(d.nombre) + '</p>'
    + (d.ingredientes && d.ingredientes.length > 0 ? '<div class="text-[11px] text-slate-400 mt-0.5 space-y-0.5">' + d.ingredientes.map(function(ing) { return '<div>· ' + escapeHtml(ing.nombre) + ' ' + ing.cantidad + ing.unidad + (ing.costo > 0 ? ' — ' + Utils.formatCurrency(ing.costo) : '') + '</div>'; }).join('') + '</div>' : '')
    + '<p class="text-xs text-slate-500 mt-0.5">' + (d.tipo === 'bebida' ? 'Bebida' : 'Plato') + ' · Venta: ' + Utils.formatCurrency(d.precio_venta) + ((d.costo || 0) > 0 ? ' · Costo: ' + Utils.formatCurrency(d.costo) : '') + '</p>'
    + '</div>'
    + '<span class="shrink-0 text-xs px-2 py-0.5 rounded-full ' + (isActive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50') + '">' + (isActive ? 'Activo' : 'Archivado') + '</span>'
    + '</div>'
    + '<div class="flex items-center justify-end gap-1">'
    + (isActive
      ? '<button onclick="window.editDish(\'' + d.id + '\')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-target"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button><button onclick="window.archiveDish(\'' + d.id + '\', \'' + escapeHtml(d.nombre) + '\')" class="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors touch-target"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg></button>'
      : '<button onclick="window.reactivateDish(\'' + d.id + '\', \'' + escapeHtml(d.nombre) + '\')" class="px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors touch-target">Reactivar</button>')
    + '</div>'
    + '</div>';
}

async function openDishModal(dishId) {
  var isEdit = !!dishId;
  var title = $('#dishModalTitle');
  title.textContent = isEdit ? 'Editar Plato' : 'Nuevo Plato';
  $('#dishId').value = isEdit ? dishId : '';
  $('#dishName').value = '';
  $('#dishDescription').value = '';
  $('#dishType').value = '';
  $('#dishPrice').value = '0';
  $('#dishIngredients').innerHTML = '<p id="noIngredientsMsg" class="text-sm text-slate-400 text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">Sin ingredientes. Agregá productos del inventario para armar la receta.</p>';
  $('#dishFormError').classList.add('hidden');

  // Cargar productos para los selectores de ingredientes
  window._dishProducts = [];
  try {
    var res = await API.products.list();
    window._dishProducts = res.data || [];
  } catch (e) {
    window._dishProducts = [];
  }

  if (isEdit) {
    try {
      var res = await API.dishes.get(dishId);
      var d = res.data;
      $('#dishName').value = d.nombre || '';
      $('#dishDescription').value = d.descripcion || '';
      $('#dishType').value = d.tipo || '';
      $('#dishPrice').value = d.precio_venta || 0;
      if (d.ingredientes && d.ingredientes.length > 0) {
        renderIngredientList(d.ingredientes);
      }
    } catch (e) {
      showToast('Error al cargar plato', 'error');
      return;
    }
  }

  // Bindear el boton de agregar ingrediente
  var addIngBtn = $('#addIngredientBtn');
  if (addIngBtn) {
    addIngBtn.onclick = function () { openIngredientSelector(); };
  }

  openModal('dishModal');
}

function openIngredientSelector(productoIdPreset, cantidadPreset, unidadPreset, editIndex) {
  var html = '<div class="dish-ingredient-row bg-slate-50 border border-slate-100 rounded-xl">'
    + '<div class="flex items-end gap-3 p-3">'
    + '<div class="flex-1 min-w-0">'
    + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Producto</label>'
    + '<select class="ing-product w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all">'
    + '<option value="">Seleccionar producto</option>'
    + (window._dishProducts || []).map(function (p) {
      var stockInfo = ' (' + (p.stock || 0) + ' ' + (p.unidad || 'unid') + ')';
      return '<option value="' + p.id + '" data-unidad="' + (p.unidad || '') + '"' + (productoIdPreset === p.id ? ' selected' : '') + '>' + escapeHtml(p.name) + stockInfo + '</option>';
    }).join('')
    + '</select>'
    + '</div>'
    + '<div class="w-24 shrink-0">'
    + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Cantidad</label>'
    + '<input type="number" class="ing-qty w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" placeholder="1" min="0.001" step="0.001" value="' + (cantidadPreset || '') + '">'
    + '</div>'
    + '<div class="w-28 shrink-0">'
    + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Unidad</label>'
    + '<select class="ing-unit w-full px-2 py-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all">'
    + '<option value="">--</option>'
    + '</select>'
    + '</div>'
    + '<div class="shrink-0 pb-0.5">'
    + '<button type="button" class="ing-remove p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors touch-target" title="Quitar ingrediente">'
    + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
    + '</button>'
    + '</div>'
    + '</div>'
    + '</div>';

  if (editIndex !== undefined) {
    var existingRow = document.querySelector('#ingredientRow_' + editIndex);
    if (existingRow) existingRow.outerHTML = html.replace('ingredientRowNew', 'ingredientRow_' + editIndex);
  } else {
    var container = $('#dishIngredients');
    var noMsg = $('#noIngredientsMsg');
    if (noMsg) noMsg.remove();
    var temp = document.createElement('div');
    temp.innerHTML = html;
    container.appendChild(temp.firstElementChild);
    var idx = container.querySelectorAll('.dish-ingredient-row').length - 1;
    container.lastElementChild.id = 'ingredientRow_' + idx;
  }

  bindIngredientEvents();
}

function bindIngredientEvents() {
  var rows = document.querySelectorAll('#dishIngredients .dish-ingredient-row');
  rows.forEach(function (row) {
    var removeBtn = row.querySelector('.ing-remove');
    if (removeBtn && !removeBtn._bound) {
      removeBtn._bound = true;
      removeBtn.addEventListener('click', function () {
        row.remove();
        var remaining = document.querySelectorAll('#dishIngredients .dish-ingredient-row');
        if (remaining.length === 0) {
          $('#dishIngredients').innerHTML = '<p id="noIngredientsMsg" class="text-sm text-slate-400 text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">Sin ingredientes. Agregá productos del inventario para armar la receta.</p>';
        }
      });
    }

    // Producto → llenar unidades
    var prodSelect = row.querySelector('.ing-product');
    var unitSelect = row.querySelector('.ing-unit');
    if (prodSelect && unitSelect && !prodSelect._unitBound) {
      prodSelect._unitBound = true;
      prodSelect.addEventListener('change', function () {
        var opt = this.options[this.selectedIndex];
        var unidad = opt ? opt.getAttribute('data-unidad') || '' : '';
        var pres = window.getPresentaciones(unidad);
        unitSelect.innerHTML = pres.map(function (p) {
          return '<option value="' + p.value + '"' + (p.factor === 1 ? ' selected' : '') + '>' + escapeHtml(p.label) + '</option>';
        }).join('');
      });
      // Disparar cambio inicial si ya hay producto seleccionado
      if (prodSelect.value) {
        prodSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
}

function renderIngredientList(ingredientes) {
  var container = $('#dishIngredients');
  container.innerHTML = '';
  ingredientes.forEach(function (ing, i) {
    var row = document.createElement('div');
    row.innerHTML = '<div class="dish-ingredient-row bg-slate-50 border border-slate-100 rounded-xl" id="ingredientRow_' + i + '">'
      + '<div class="flex items-end gap-3 p-3">'
      + '<div class="flex-1 min-w-0">'
      + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Producto</label>'
      + '<select class="ing-product w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all">'
      + '<option value="">Seleccionar producto</option>'
      + (window._dishProducts || []).map(function (pr) {
        var info = ' (' + (pr.stock || 0) + ' ' + (pr.unidad || 'unid') + ')';
        return '<option value="' + pr.id + '" data-unidad="' + (pr.unidad || '') + '"' + (ing.producto_id === pr.id ? ' selected' : '') + '>' + escapeHtml(pr.name) + info + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div class="w-24 shrink-0">'
      + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Cantidad</label>'
      + '<input type="number" class="ing-qty w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" placeholder="1" min="0.001" step="0.001" value="' + ing.cantidad + '">'
      + '</div>'
      + '<div class="w-28 shrink-0">'
      + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Unidad</label>'
      + '<select class="ing-unit w-full px-2 py-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all">'
      + '<option value="">--</option>'
      + '</select>'
      + '</div>'
      + '<div class="shrink-0 pb-0.5">'
      + '<button type="button" class="ing-remove p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors touch-target" title="Quitar ingrediente">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '</button>'
      + '</div>'
      + '</div>'
      + '</div>';
    container.appendChild(row.firstElementChild);
  });
  bindIngredientEvents();
  // Pre-seleccionar unidad guardada
  ingredientes.forEach(function (ing, idx) {
    var row = document.getElementById('ingredientRow_' + idx);
    if (row && ing.unidad) {
      var unitSel = row.querySelector('.ing-unit');
      if (unitSel) {
        setTimeout(function () {
          for (var o = 0; o < unitSel.options.length; o++) {
            if (unitSel.options[o].value === ing.unidad) {
              unitSel.value = ing.unidad;
              break;
            }
          }
        }, 50);
      }
    }
  });
}

async function saveDish(e) {
  e.preventDefault();
  var id = $('#dishId').value;
  var isEdit = !!id;
  var errorEl = $('#dishFormError');

  var nombre = ($('#dishName').value || '').trim();
  var tipo = $('#dishType').value;
  var precio = parseFloat($('#dishPrice').value) || 0;

  if (!nombre) {
    errorEl.querySelector('p').textContent = 'El nombre es obligatorio';
    errorEl.classList.remove('hidden');
    return;
  }
  if (!tipo) {
    errorEl.querySelector('p').textContent = 'Seleccioná el tipo (plato o bebida)';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');

  // Recolectar ingredientes
  var ingredients = [];
  var rows = document.querySelectorAll('#dishIngredients .dish-ingredient-row');
  rows.forEach(function (row) {
    var prodSelect = row.querySelector('.ing-product');
    var qtyInput = row.querySelector('.ing-qty');
    var unitInput = row.querySelector('.ing-unit');
    if (prodSelect && prodSelect.value && qtyInput && parseFloat(qtyInput.value) > 0) {
      ingredients.push({
        producto_id: prodSelect.value,
        cantidad: parseFloat(qtyInput.value),
        unidad: (unitInput ? unitInput.value : '').trim() || 'g'
      });
    }
  });

  var payload = {
    nombre: nombre,
    descripcion: ($('#dishDescription').value || '').trim(),
    tipo: tipo,
    precio_venta: precio,
    ingredientes: ingredients
  };

  try {
    var res;
    if (isEdit) {
      res = await API.dishes.update(id, payload);
    } else {
      res = await API.dishes.create(payload);
    }
    if (res.success) {
      showToast(isEdit ? 'Plato actualizado' : 'Plato creado', 'success');
      closeModal('dishModal');
      loadDishes();
    } else {
      errorEl.querySelector('p').textContent = res.message || 'Error al guardar';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('saveDish error:', err);
    errorEl.querySelector('p').textContent = 'Error de conexion';
    errorEl.classList.remove('hidden');
  }
}

window.editDish = async function (dishId) {
  await openDishModal(dishId);
};

window.deleteDish = async function (dishId, dishName) {
  if (!confirm('¿Desactivar "' + dishName + '"? Dejará de estar disponible.')) return;
  try {
    var res = await API.dishes.delete(dishId);
    if (res.success) {
      showToast('Plato desactivado', 'success');
      loadDishes();
    } else {
      showToast(res.message || 'Error al desactivar', 'error');
    }
  } catch (err) {
    showToast('Error de conexion', 'error');
  }
};

function estadoBadge(estado) {
  if (estado === 'pendiente') return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">'
    + '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/></svg>'
    + 'Pendiente</span>';
  if (estado === 'rechazado') return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">'
    + '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/></svg>'
    + 'Rechazado</span>';
  return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">'
    + '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>'
    + 'Aprobado</span>';
}

async function loadUsers() {
  if (!window.can('puedeGestionarUsuarios')) return;
  try {
    var res = await API.users.list();
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
      return '<tr class="hover:bg-slate-50 transition-colors' + (pendiente ? ' bg-amber-50/30' : '') + '">'
        + '<td class="px-6 py-3"><div class="text-sm font-medium text-slate-800">' + escapeHtml(u.username) + '</div><div class="text-xs text-slate-400">' + escapeHtml(u.email || '') + '</div></td>'
        + '<td class="px-6 py-3 text-sm text-slate-600">' + escapeHtml(u.nombreCompleto || '-') + '</td>'
        + '<td class="px-6 py-3"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ' + (u.role === 'admin' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700') + '">' + u.role + '</span></td>'
        + '<td class="px-6 py-3 text-center"><span class="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">' + activeCount + '/13</span></td>'
        + '<td class="px-6 py-3">' + estadoBadge(u.estadoAprobacion) + '</td>'
        + '<td class="px-6 py-3 text-right">'
        + '<div class="flex items-center justify-end gap-1">'
        + (pendiente ? '<button onclick="window.approveUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors touch-target" title="Aprobar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></button>'
          + '<button onclick="window.rejectUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors touch-target" title="Rechazar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>' : '')
        + '<button onclick="window.editUser(\'' + u.id + '\')" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors touch-target" title="Editar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>'
        + '<button onclick="window.deleteUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target" title="Eliminar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>'
        + '</div></td>'
        + '</tr>';
    }).join('');
    cards.innerHTML = users.map(function (u) {
      var activeCount = Object.values(u.permisos).filter(Boolean).length;
      var pendiente = u.estadoAprobacion === 'pendiente';
      var actionsHtml = '';
      if (pendiente) {
        actionsHtml = '<div class="flex gap-2 pt-2">'
          + '<button onclick="window.approveUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="flex-1 p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-sm font-medium touch-target flex items-center justify-center gap-1.5">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Aprobar</button>'
          + '<button onclick="window.rejectUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="flex-1 p-2 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium touch-target flex items-center justify-center gap-1.5">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg> Rechazar</button>'
          + '</div>';
      } else {
        actionsHtml = '<div class="flex gap-1 pt-2 border-t border-slate-100">'
          + '<button onclick="window.editUser(\'' + u.id + '\')" class="flex-1 p-2 text-amber-600 bg-amber-50 rounded-lg text-sm font-medium touch-target">Editar</button>'
          + '<button onclick="window.deleteUser(\'' + u.id + '\', \'' + escapeHtml(u.username) + '\')" class="flex-1 p-2 text-red-600 bg-red-50 rounded-lg text-sm font-medium touch-target">Eliminar</button>'
          + '</div>';
      }
      return '<div class="bg-white border ' + (pendiente ? 'border-amber-300' : 'border-slate-200') + ' rounded-xl p-4 space-y-2">'
        + '<div class="flex items-start justify-between"><div><p class="text-sm font-semibold text-slate-800">' + escapeHtml(u.username) + '</p><p class="text-xs text-slate-500">' + escapeHtml(u.email || '') + '</p></div>'
        + '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ' + (u.role === 'admin' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700') + '">' + u.role + '</span></div>'
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
};

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
};

window.deleteUser = async function (id, username) {
  if (!confirm('¿Desactivar al usuario "' + username + '"?')) return;
  try {
    await API.users.delete(id);
    showToast('Usuario desactivado', 'success');
    loadUsers();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.approveUser = async function (id, username) {
  // Si el admin quiere cambiar el rol antes de aprobar, abrir el modal de edicion
  if (!confirm('¿Aprobar al usuario "' + username + '"? Luego podras editar sus permisos desde el boton lapiz.')) return;
  try {
    await API.users.approve(id, { role: 'vendedor' });
    showToast('Usuario aprobado. Edita sus permisos si necesitas.', 'success');
    loadUsers();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.rejectUser = async function (id, username) {
  var motivo = prompt('Motivo del rechazo (opcional):', '');
  if (motivo === null) return;
  try {
    await API.users.reject(id, { motivo: motivo || 'Sin motivo especificado' });
    showToast('Usuario rechazado', 'success');
    loadUsers();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

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

async function loadConfig() {
  if (!window.can('puedeGestionarUsuarios')) return;
  try {
    var res = await API.config.get();
    $('#modoPublicoCheck').checked = !!res.data.modoPublico;
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function saveConfig() {
  var modoPublico = $('#modoPublicoCheck').checked;
  try {
    await API.config.update({ modoPublico: modoPublico });
    showToast('Configuracion guardada. ' + (modoPublico ? 'Los visitantes ya pueden entrar.' : 'Acceso publico deshabilitado.'), 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ============================================
// Indicadores removido: stock_minimo ahora en vista Inventario
