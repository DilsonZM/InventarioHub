// Estado global de la aplicacion
const state = {
  products: [],
  sales: [],
  categories: [],
  saleItems: [],
  currentView: 'dashboard',
  user: null,
};

let categoryChart = null;

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

function openModal(id) { $('#' + id).classList.remove('hidden'); }
function closeModal(id) { $('#' + id).classList.add('hidden'); }

function showError(id, msg) {
  var el = $('#' + id);
  el.classList.remove('hidden');
  el.querySelector('p').textContent = msg;
}

document.addEventListener('DOMContentLoaded', function () {
  console.log('[App] Inicializando InventarioApp...');

  if (typeof API === 'undefined') {
    console.error('[App] API no esta definida. Verifica que api.js se cargo correctamente.');
    return;
  }

  if (!API.isAuthenticated()) {
    console.log('[App] Usuario no autenticado, redirigiendo a login...');
    window.location.href = '/views/login.html';
    return;
  }

  if (typeof Utils === 'undefined') {
    console.error('[App] Utils no esta definido. Verifica que utils.js se cargo correctamente.');
    return;
  }

  console.log('[App] Usuario autenticado, cargando aplicacion...');

  state.user = API.getUser();
  console.log('[App] Usuario cargado:', state.user);

  initUser();
  initNavigation();
  initSidebar();
  initModals();
  initDashboard();
  initInventory();
  initSales();
  initCompras();
  initLogout();
  setCurrentDate();
  var initialView = location.hash.slice(1) || 'dashboard';
  navigate(initialView);

  console.log('[App] Aplicacion inicializada correctamente');
});

function setCurrentDate() {
  var el = $('#currentDate');
  if (el) el.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function initUser() {
  var user = state.user;
  if (!user) return;
  $('#userName').textContent = user.username;
  $('#userRole').textContent = user.role === 'admin' ? 'Administrador' : 'Vendedor';
  $('#userInitial').textContent = user.username.charAt(0).toUpperCase();
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

  // Restaurar estado colapsado en desktop
  try {
    if (window.innerWidth >= 1024 && localStorage.getItem(STORAGE_KEY) === '1') {
      sidebar.classList.add('collapsed');
      body.classList.add('sidebar-collapsed');
    }
  } catch (e) {}

  $('#menuToggle').addEventListener('click', function () {
    if (window.innerWidth < 1024) {
      // Mobile: drawer behaviour
      sidebar.classList.toggle('-translate-x-full');
      overlay.classList.toggle('hidden');
    } else {
      // Desktop: colapsar/expandir
      var willCollapse = !sidebar.classList.contains('collapsed');
      sidebar.classList.toggle('collapsed', willCollapse);
      body.classList.toggle('sidebar-collapsed', willCollapse);
      try {
        localStorage.setItem(STORAGE_KEY, willCollapse ? '1' : '0');
      } catch (e) {}
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
      // En móvil, si el sidebar no tiene la clase translate-x-full, mostrarlo
      if (!sidebar.classList.contains('-translate-x-full')) {
        overlay.classList.remove('hidden');
      }
    }
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

  var titles = { dashboard: 'Dashboard', inventory: 'Inventario', sales: 'Salidas', compras: 'Entradas', entradas: 'Entradas', movimientos: 'Movimientos', indicadores: 'Indicadores' };
  $('#pageTitle').textContent = titles[view] || 'InventarioApp';

  if (view === 'dashboard') loadDashboard();
  if (view === 'inventory') loadProducts();
  if (view === 'sales') loadSales();
  if (view === 'compras' || view === 'entradas') loadCompras();
  if (view === 'movimientos') loadMovimientos();
  if (view === 'indicadores') loadIndicadores();

  if (view === 'dashboard') startDashboardAutoRefresh();
  else stopDashboardAutoRefresh();

  var sidebar = $('#sidebar');
  if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
    sidebar.classList.add('-translate-x-full');
    $('#sidebarOverlay').classList.add('hidden');
  }
}

async function initDashboard() {}

async function loadDashboard() {
  console.log('[Dashboard] Cargando datos del dashboard...');
  try {
    var results = await Promise.all([
      API.stats(),
      API.products.list(),
      API.reportes.movimientos({ limit: 10 }),
    ]);
    var statsRes = results[0];
    var productsRes = results[1];
    var movsRes = results[2];

    console.log('[Dashboard] Stats recibidas:', statsRes);
    console.log('[Dashboard] Productos recibidos:', (productsRes && productsRes.data) ? productsRes.data.length : 0);
    console.log('[Dashboard] Movimientos recibidos:', (movsRes && movsRes.data) ? movsRes.data.length : 0);

    var stats = statsRes.data;
    $('#stat-products').textContent = stats.totalProducts;
    $('#stat-revenue').textContent = formatCurrency(stats.todayRevenue);
    $('#stat-lowstock').textContent = stats.lowStockCount;
    $('#stat-value').textContent = formatCurrency(stats.inventoryValue);

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
      tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">Sin movimientos registrados</td></tr>';
      cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">Sin movimientos registrados</p>';
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

  var ctx = $('#categoryChart');
  if (categoryChart) categoryChart.destroy();

  if (labels.length === 0) {
    ctx.parentElement.innerHTML = '<p class="text-sm text-slate-400 text-center py-20">Sin datos de salidas</p>';
    return;
  }

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' } } } },
  });
}

async function initInventory() {
  try {
    var catRes = await API.products.categories();
    state.categories = catRes.data;
    populateCategoryFilters();
  } catch (e) {}

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
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-12 text-center"><p class="text-slate-400 text-sm">No se encontraron productos</p></td></tr>';
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
      + '<span class="text-lg font-bold ' + stockColor + '">' + p.stock + '</span>'
      + '</div>'
      + '<div class="flex items-center gap-2 flex-wrap">'
      + '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">' + escapeHtml(p.category) + '</span>'
      + '<span class="text-sm font-semibold text-slate-800">' + formatCurrency(p.price) + '</span>'
      + '</div>'
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
    unidad: $('#productUnidad').value || 'unidad',
    description: $('#productDescription').value.trim(),
  };

  if (!payload.name || !payload.sku || !payload.category || isNaN(payload.price) || isNaN(payload.cost) || isNaN(payload.stock)) {
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
  $('#filterDateFrom').addEventListener('change', function () { $('#filterQuickPeriod').value = ''; loadSales(); });
  $('#filterDateTo').addEventListener('change', function () { $('#filterQuickPeriod').value = ''; loadSales(); });
  $('#filterPaymentMethod').addEventListener('change', function () { loadSales(); });
  $('#filterQuickPeriod').addEventListener('change', handleQuickPeriod);
  $('#clearFiltersBtn').addEventListener('click', clearSalesFilters);
}

function handleQuickPeriod() {
  var period = $('#filterQuickPeriod').value;
  if (!period) return;

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var from, to;

  switch (period) {
    case 'today':
      from = today;
      to = now;
      break;
    case 'week':
      var dayOfWeek = today.getDay();
      from = new Date(today);
      from.setDate(today.getDate() - dayOfWeek);
      to = now;
      break;
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
      break;
    case 'quarter':
      var quarter = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), quarter * 3, 1);
      to = now;
      break;
    case 'year':
      from = new Date(now.getFullYear(), 0, 1);
      to = now;
      break;
  }

  $('#filterDateFrom').value = from.toISOString().split('T')[0];
  $('#filterDateTo').value = to.toISOString().split('T')[0];
  loadSales();
}

function clearSalesFilters() {
  $('#filterDateFrom').value = '';
  $('#filterDateTo').value = '';
  $('#filterPaymentMethod').value = '';
  $('#filterQuickPeriod').value = '';
  loadSales();
}

async function loadSales() {
  var params = {};
  var from = $('#filterDateFrom').value;
  var to = $('#filterDateTo').value;
  var paymentMethod = $('#filterPaymentMethod').value;

  if (from) params.from = from;
  if (to) params.to = to;

  try {
    var res = await API.sales.list(params);
    var sales = res.data;

    if (paymentMethod) {
      sales = sales.filter(function (s) { return s.paymentMethod === paymentMethod; });
    }

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
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center"><p class="text-slate-400 text-sm">No se encontraron salidas</p></td></tr>';
    cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">No se encontraron salidas</p>';
    return;
  }

  tbody.innerHTML = state.sales.map(function (s) {
    return '<tr class="hover:bg-slate-50 transition-colors">'
      + '<td class="px-6 py-4 text-sm font-mono text-slate-600">#' + s.id.slice(-6) + '</td>'
      + '<td class="px-6 py-4">'
      + '<div class="text-sm text-slate-700">' + escapeHtml(s.items.map(function (i) { return i.productName + ' x' + i.quantity; }).join(', ')) + '</div>'
      + '</td>'
      + '<td class="px-6 py-4 text-sm font-semibold text-slate-800 text-right">' + s.items.reduce(function (sum, i) { return sum + i.quantity; }, 0) + ' unid.</td>'
      + '<td class="px-6 py-4"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">' + escapeHtml(s.paymentMethod) + '</span></td>'
      + '<td class="px-6 py-4 text-sm text-slate-500">' + formatDate(s.createdAt) + '</td>'
      + '<td class="px-6 py-4 text-right">'
      + '<button onclick="window.viewSale(\'' + s.id + '\')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-target" title="Ver detalle">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>'
      + '</button>'
      + '</td>'
      + '</tr>';
  }).join('');

  cards.innerHTML = state.sales.map(function (s) {
    return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">'
      + '<div class="flex items-center justify-between">'
      + '<span class="font-mono text-sm text-slate-500">#' + s.id.slice(-6) + '</span>'
      + '<span class="text-lg font-bold text-slate-800">' + s.items.reduce(function (sum, i) { return sum + i.quantity; }, 0) + ' unid.</span>'
      + '</div>'
      + '<div class="space-y-1">'
      + s.items.map(function (i) {
        return '<div class="flex justify-between text-sm">'
          + '<span class="text-slate-600">' + escapeHtml(i.productName) + ' x' + i.quantity + '</span>'
          + '</div>';
      }).join('')
      + '</div>'
      + '<div class="flex items-center justify-between pt-2 border-t border-slate-100">'
      + '<div class="flex items-center gap-2">'
      + '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">' + escapeHtml(s.paymentMethod) + '</span>'
      + '<span class="text-xs text-slate-400">' + formatDate(s.createdAt) + '</span>'
      + '</div>'
      + '<button onclick="window.viewSale(\'' + s.id + '\')" class="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors touch-target">'
      + '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>'
      + '</button>'
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
    $('#detailSaleTotal').textContent = sale.items.reduce(function (s, i) { return s + i.quantity; }, 0) + ' unid.';

    var itemsHtml = sale.items.map(function (item) {
      return '<div class="flex items-center justify-between px-4 py-3">'
        + '<div class="flex-1 min-w-0">'
        + '<p class="text-sm font-medium text-slate-800 truncate">' + escapeHtml(item.productName) + '</p>'
        + '<p class="text-xs text-slate-500">Cantidad: ' + item.quantity + '</p>'
        + '</div>'
        + '<p class="text-sm font-semibold text-slate-800 ml-4">' + item.quantity + ' unid.</p>'
        + '</div>';
    }).join('');

    $('#detailSaleItems').innerHTML = itemsHtml;
    openModal('saleDetailModal');
  } catch (err) {
    showToast('Error al cargar salida', 'error');
  }
};

async function openSaleModal() {
  state.saleItems = [];
  $('#saleForm').reset();
  $('#saleQuantity').removeAttribute('max');
  $('#saleTotal').textContent = '0 unid.';
  $('#saleFormError').classList.add('hidden');
  renderSaleItems();

  try {
    var res = await API.products.list();
    var available = res.data.filter(function (p) { return p.stock > 0; });
    var sel = $('#saleProductSelect');
    sel.innerHTML = '<option value="">Seleccionar producto</option>'
      + available.map(function (p) { return '<option value="' + p.id + '" data-stock="' + p.stock + '" data-unidad="' + escapeHtml(p.unidad || 'unidad') + '">' + escapeHtml(p.name) + ' (Stock: ' + p.stock + ' ' + escapeHtml(p.unidad || 'unidad') + ')</option>'; }).join('');
  } catch (e) {}

  openModal('saleModal');
}

$('#saleProductSelect').addEventListener('change', function () {
  var opt = this.options[this.selectedIndex];
  var stock = parseInt(opt.dataset.stock) || 0;
  var qty = $('#saleQuantity');
  qty.value = 1;
  if (stock > 0) {
    qty.max = stock;
  } else {
    qty.removeAttribute('max');
  }
});

$('#addSaleItem').addEventListener('click', function () {
  var sel = $('#saleProductSelect');
  var qty = parseInt($('#saleQuantity').value);
  var opt = sel.options[sel.selectedIndex];

  if (!sel.value) { showToast('Selecciona un producto', 'error'); return; }
  if (!qty || qty <= 0) { showToast('Cantidad invalida', 'error'); return; }

  var stock = parseInt(opt.dataset.stock);
  if (qty > stock) { showToast('Stock disponible: ' + stock, 'error'); return; }

  var existing = state.saleItems.find(function (i) { return i.productId === sel.value; });
  if (existing) {
    if (existing.quantity + qty > stock) { showToast('Stock maximo: ' + stock, 'error'); return; }
    existing.quantity += qty;
  } else {
    state.saleItems.push({
      productId: sel.value,
      productName: opt.textContent.split(' (')[0],
      quantity: qty,
      unidad: opt.dataset.unidad || 'unidad'
    });
  }

  renderSaleItems();
  sel.value = '';
  $('#saleQuantity').value = 1;
});

function renderSaleItems() {
  var tbody = $('#saleItemsTable');
  var cards = $('#saleItemsCards');

  if (state.saleItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">Sin productos agregados</td></tr>';
    cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">Sin productos agregados</p>';
    $('#saleTotal').textContent = '$0.00';
    return;
  }

  tbody.innerHTML = state.saleItems.map(function (item, idx) {
    return '<tr>'
      + '<td class="px-4 py-2 text-sm text-slate-700">' + escapeHtml(item.productName) + '</td>'
      + '<td class="px-4 py-2 text-sm text-center">' + item.quantity + '</td>'
      + '<td class="px-4 py-2 text-sm text-center text-slate-500">' + escapeHtml(item.unidad || 'unidad') + '</td>'
      + '<td class="px-4 py-2 text-right">'
      + '<button onclick="window.removeSaleItem(' + idx + ')" class="p-1 text-red-400 hover:text-red-600 transition-colors touch-target">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '</button>'
      + '</td>'
      + '</tr>';
  }).join('');

  cards.innerHTML = state.saleItems.map(function (item, idx) {
    return '<div class="flex items-center justify-between bg-slate-50 rounded-xl p-3">'
      + '<div class="flex-1 min-w-0">'
      + '<p class="text-sm font-medium text-slate-700 truncate">' + escapeHtml(item.productName) + '</p>'
      + '<p class="text-xs text-slate-500">' + item.quantity + ' ' + escapeHtml(item.unidad || 'unidad') + '</p>'
      + '</div>'
      + '<button onclick="window.removeSaleItem(' + idx + ')" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '</button>'
      + '</div>';
  }).join('');

  var totalItems = state.saleItems.reduce(function (sum, i) { return sum + i.quantity; }, 0);
  $('#saleTotal').textContent = totalItems + ' unid.';
}

window.removeSaleItem = function (idx) {
  state.saleItems.splice(idx, 1);
  renderSaleItems();
};

$('#saleForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var paymentMethod = $('#salePaymentMethod').value;

  if (state.saleItems.length === 0) {
    showError('saleFormError', 'Agrega al menos un producto');
    return;
  }
  if (!paymentMethod) {
    showError('saleFormError', 'Selecciona una cocina');
    return;
  }

  try {
    await API.sales.create({
      items: state.saleItems.map(function (i) { return { productId: i.productId, quantity: i.quantity }; }),
      paymentMethod: paymentMethod,
    });
    closeModal('saleModal');
    showToast('Salida registrada correctamente');
    loadSales();
    loadDashboard();
  } catch (err) {
    showError('saleFormError', err.message);
  }
});

function initModals() {
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close-modal]')) {
      var modal = e.target.closest('.fixed');
      if (modal) modal.classList.add('hidden');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      $$('.fixed.z-50').forEach(function (m) { m.classList.add('hidden'); });
    }
  });
}

// ============================================
// Entradas
// ============================================

function initCompras() {
  $('#newCompraBtn').addEventListener('click', function () { openCompraModal(); });
}

async function openCompraModal() {
  $('#compraForm').reset();
  $('#compraFecha').value = new Date().toISOString().split('T')[0];
  $('#compraTotal').textContent = '$0.00';
  $('#compraFormError').classList.add('hidden');

  try {
    var res = await API.products.list();
    var all = res.data || [];
    $('#compraProducto').innerHTML = '<option value="">Seleccionar producto</option>' +
      all.map(function (p) { return '<option value="' + p.id + '">' + escapeHtml(p.name) + ' (' + escapeHtml(p.sku) + ')</option>'; }).join('');
  } catch (e) {}

  openModal('compraModal');
}

$('#compraCantidad').addEventListener('input', updateCompraTotal);
$('#compraValor').addEventListener('input', updateCompraTotal);

function updateCompraTotal() {
  var cant = parseFloat($('#compraCantidad').value) || 0;
  var val = parseFloat($('#compraValor').value) || 0;
  $('#compraTotal').textContent = formatCurrency(cant * val);
}

$('#compraForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var producto_id = $('#compraProducto').value;
  var cantidad = parseInt($('#compraCantidad').value);
  var valor = parseFloat($('#compraValor').value);
  var fecha = $('#compraFecha').value;

  if (!producto_id || !cantidad || cantidad <= 0 || !valor || valor <= 0) {
    showError('compraFormError', 'Completa todos los campos requeridos');
    return;
  }

  try {
    await API.compras.create({ producto_id: producto_id, cantidad: cantidad, valor_unitario: valor, fecha_compra: fecha || undefined });
    closeModal('compraModal');
    showToast('Entrada registrada correctamente');
    loadCompras();
    loadDashboard();
  } catch (err) {
    showError('compraFormError', err.message);
  }
});

async function loadCompras() {
  try {
    var res = await API.compras.list();
    var compras = res.data || [];
    var tbody = $('#comprasTable');
    var cards = $('#comprasCards');

    if (compras.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">Sin entradas registradas</td></tr>';
      cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">Sin entradas registradas</p>';
      return;
    }

    tbody.innerHTML = compras.map(function (c) {
      return '<tr class="hover:bg-slate-50 transition-colors">'
        + '<td class="px-6 py-3 text-sm text-slate-600">' + (c.fecha_compra || '') + '</td>'
        + '<td class="px-6 py-3 text-sm text-slate-700">' + escapeHtml(c.producto_nombre) + ' <span class="text-xs text-slate-400">' + escapeHtml(c.producto_sku) + '</span></td>'
        + '<td class="px-6 py-3 text-sm text-center">' + c.cantidad + '</td>'
        + '<td class="px-6 py-3 text-sm text-right">' + formatCurrency(c.valor_unitario) + '</td>'
        + '<td class="px-6 py-3 text-sm font-semibold text-right">' + formatCurrency(c.valor_total) + '</td>'
        + '</tr>';
    }).join('');

    cards.innerHTML = compras.map(function (c) {
      return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-2">'
        + '<div class="flex justify-between"><span class="text-xs text-slate-500">' + (c.fecha_compra || '') + '</span><span class="text-lg font-bold">' + formatCurrency(c.valor_total) + '</span></div>'
        + '<p class="text-sm font-medium">' + escapeHtml(c.producto_nombre) + '</p>'
        + '<div class="flex gap-3 text-xs text-slate-500"><span>' + c.cantidad + ' unid</span><span>' + formatCurrency(c.valor_unitario) + ' c/u</span></div>'
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
    var res = await API.reportes.movimientos();
    var movs = res.data || [];
    var tbody = $('#movimientosTable');
    var cards = $('#movimientosCards');

    if (movs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-sm text-slate-400">Sin movimientos registrados</td></tr>';
      cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">Sin movimientos registrados</p>';
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
        + '</tr>';
    }).join('');

    cards.innerHTML = movs.map(function (m) {
      return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-2">'
        + '<div class="flex justify-between"><span class="text-xs text-slate-500">' + formatDate(m.fecha) + '</span>'
        + (m.movimiento === 'entrada' ? '<span class="text-emerald-600 text-sm font-bold">+ ' + m.cantidad_entrada + '</span>' : m.movimiento === 'salida' ? '<span class="text-red-600 text-sm font-bold">- ' + m.cantidad_salida + '</span>' : '<span class="text-amber-600 text-sm font-bold">Ajuste</span>')
        + '</div>'
        + '<p class="text-sm font-medium">' + escapeHtml(m.producto) + '</p>'
        + '<div class="flex justify-between text-xs text-slate-500"><span>' + escapeHtml(m.codigo) + '</span><span>Stock: ' + m.cantidad_stock + '</span></div>'
        + '</div>';
    }).join('');
  } catch (err) {
    showToast('Error al cargar movimientos', 'error');
  }
}

// ============================================
// Indicadores
// ============================================

async function loadIndicadores() {
  try {
    var res = await API.reportes.indicadores();
    var inds = res.data || [];
    var tbody = $('#indicadoresTable');
    var cards = $('#indicadoresCards');

    if (inds.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">Sin productos registrados</td></tr>';
      cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">Sin productos registrados</p>';
      return;
    }

    tbody.innerHTML = inds.map(function (i) {
      var estadoBadge = i.estado === 'OK'
        ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">OK</span>'
        : i.estado === 'Agotado'
          ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Agotado</span>'
          : i.estado === 'Comprar'
            ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Comprar</span>'
            : '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Por comprar</span>';
      var stockColor = i.stock_actual === 0 ? 'text-red-600' : i.stock_actual <= i.stock_minimo ? 'text-amber-600' : 'text-emerald-600';
      return '<tr class="hover:bg-slate-50 transition-colors">'
        + '<td class="px-6 py-3 text-sm font-medium text-slate-700">' + escapeHtml(i.producto) + '</td>'
        + '<td class="px-6 py-3 text-sm text-center font-bold ' + stockColor + '">' + i.stock_actual + '</td>'
        + '<td class="px-6 py-3 text-sm text-center text-slate-500">' + i.stock_minimo + '</td>'
        + '<td class="px-6 py-3 text-sm text-slate-500">' + escapeHtml(i.unidad_medida) + '</td>'
        + '<td class="px-6 py-3">' + estadoBadge + '</td>'
        + '</tr>';
    }).join('');

    cards.innerHTML = inds.map(function (i) {
      var estadoColor = i.estado === 'OK' ? 'border-emerald-200' : 'border-red-200';
      var stockColor = i.stock_actual === 0 ? 'text-red-600' : i.stock_actual <= i.stock_minimo ? 'text-amber-600' : 'text-emerald-600';
      return '<div class="bg-white border ' + estadoColor + ' rounded-xl p-4 space-y-2">'
        + '<div class="flex justify-between items-start">'
        + '<div><p class="font-semibold text-slate-800">' + escapeHtml(i.producto) + '</p><p class="text-xs text-slate-400">' + escapeHtml(i.unidad_medida) + '</p></div>'
        + '<span class="text-lg font-bold ' + stockColor + '">' + i.stock_actual + '</span>'
        + '</div>'
        + '<div class="flex justify-between items-center"><span class="text-xs text-slate-500">Minimo: ' + i.stock_minimo + '</span>'
        + (i.estado === 'OK' ? '<span class="text-xs font-medium text-emerald-600">OK</span>' : i.estado === 'Agotado' ? '<span class="text-xs font-medium text-red-600">Agotado</span>' : '<span class="text-xs font-medium text-red-600">Comprar</span>')
        + '</div></div>';
    }).join('');
  } catch (err) {
    showToast('Error al cargar indicadores', 'error');
  }
}
