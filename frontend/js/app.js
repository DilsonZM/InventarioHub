// Esperar a que el DOM esté listo antes de ejecutar cualquier código
document.addEventListener('DOMContentLoaded', () => {
  console.log('[App] Inicializando InventarioApp...');

  // Verificar autenticación
  if (typeof API === 'undefined') {
    console.error('[App] API no está definida. Verifica que api.js se cargó correctamente.');
    return;
  }

  if (!API.isAuthenticated()) {
    console.log('[App] Usuario no autenticado, redirigiendo a login...');
    window.location.href = '/views/login.html';
    return;
  }

  // Verificar que Utils esté disponible
  if (typeof Utils === 'undefined') {
    console.error('[App] Utils no está definido. Verifica que utils.js se cargó correctamente.');
    return;
  }

  console.log('[App] Usuario autenticado, cargando aplicación...');

  const state = {
    products: [],
    sales: [],
    categories: [],
    saleItems: [],
    currentView: 'dashboard',
    user: API.getUser(),
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const formatCurrency = Utils.formatCurrency;
  const formatDate = Utils.formatDate;
  const formatDateShort = Utils.formatDateShort;
  const escapeHtml = Utils.escapeHtml;
  const debounce = Utils.debounce;

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
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

function openModal(id) { $(`#${id}`).classList.remove('hidden'); }
function closeModal(id) { $(`#${id}`).classList.add('hidden'); }

document.addEventListener('DOMContentLoaded', () => {
  initUser();
  initNavigation();
  initSidebar();
  initModals();
  initDashboard();
  initInventory();
  initSales();
  initLogout();
  setCurrentDate();
  navigate('dashboard');
});

function setCurrentDate() {
  const el = $('#currentDate');
  if (el) el.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function initUser() {
  const user = state.user;
  if (!user) return;
  $('#userName').textContent = user.username;
  $('#userRole').textContent = user.role === 'admin' ? 'Administrador' : 'Vendedor';
  $('#userInitial').textContent = user.username.charAt(0).toUpperCase();
}

function initLogout() {
  $('#logoutBtn').addEventListener('click', () => {
    API.clearAuth();
    window.location.href = '/views/login.html';
  });
}

function initSidebar() {
  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');
  $('#menuToggle').addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  });
}

function initNavigation() {
  window.addEventListener('hashchange', () => {
    const hash = location.hash.slice(1) || 'dashboard';
    navigate(hash);
  });
}

function navigate(view) {
  state.currentView = view;
  $$('.view-section').forEach(el => el.classList.add('hidden'));
  const target = $(`#view-${view}`);
  if (target) {
    target.classList.remove('hidden');
    target.style.animation = 'none';
    target.offsetHeight;
    target.style.animation = 'slideUp 0.4s ease-out forwards';
  }

  $$('.nav-link').forEach(link => {
    const isActive = link.dataset.nav === view;
    link.classList.toggle('bg-white/10', isActive);
    link.classList.toggle('text-white', isActive);
    link.classList.toggle('shadow-lg', isActive);
    link.classList.toggle('shadow-blue-500/10', isActive);
  });

  const titles = { dashboard: 'Dashboard', inventory: 'Inventario', sales: 'Ventas' };
  $('#pageTitle').textContent = titles[view] || 'InventarioApp';

  if (view === 'dashboard') loadDashboard();
  if (view === 'inventory') loadProducts();
  if (view === 'sales') loadSales();

  const sidebar = $('#sidebar');
  if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
    sidebar.classList.add('-translate-x-full');
    $('#sidebarOverlay').classList.add('hidden');
  }
}

let categoryChart = null;

async function initDashboard() {}

async function loadDashboard() {
  try {
    const [statsRes, productsRes, salesRes] = await Promise.all([
      API.stats(),
      API.products.list(),
      API.sales.list(),
    ]);

    const stats = statsRes.data;
    $('#stat-products').textContent = stats.totalProducts;
    $('#stat-revenue').textContent = formatCurrency(stats.todayRevenue);
    $('#stat-lowstock').textContent = stats.lowStockCount;
    $('#stat-value').textContent = formatCurrency(stats.inventoryValue);

    const lowStockProducts = productsRes.data.filter(p => p.stock <= p.minStock).sort((a, b) => (a.stock / a.minStock) - (b.stock / b.minStock));
    const lowStockList = $('#lowStockList');
    if (lowStockProducts.length === 0) {
      lowStockList.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">Todo el inventario tiene stock suficiente</p>';
    } else {
      lowStockList.innerHTML = lowStockProducts.map(p => {
        const pct = Math.min((p.stock / p.minStock) * 100, 100);
        const color = p.stock === 0 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-yellow-400';
        return `<div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-700 truncate">${p.name}</p>
            <p class="text-xs text-slate-500">${p.sku}</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}">${p.stock}/${p.minStock}</p>
            <div class="w-16 h-1.5 bg-slate-200 rounded-full mt-1"><div class="h-full ${color} rounded-full" style="width:${pct}%"></div></div>
          </div>
        </div>`;
      }).join('');
    }

    const recentSales = salesRes.data.slice(0, 5);
    const tbody = $('#recentSalesTable');
    const cards = $('#recentSalesCards');
    if (recentSales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-slate-400">Sin ventas registradas</td></tr>';
      cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">Sin ventas registradas</p>';
    } else {
      tbody.innerHTML = recentSales.map(s => `<tr class="hover:bg-slate-50 transition-colors">
        <td class="px-6 py-3 text-sm font-mono text-slate-600">#${s.id.slice(-6)}</td>
        <td class="px-6 py-3 text-sm text-slate-700">${s.items.length} producto(s)</td>
        <td class="px-6 py-3 text-sm font-semibold text-slate-800">${formatCurrency(s.total)}</td>
        <td class="px-6 py-3"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">${s.paymentMethod}</span></td>
        <td class="px-6 py-3 text-sm text-slate-500">${formatDate(s.createdAt)}</td>
      </tr>`).join('');

      cards.innerHTML = recentSales.map(s => `<div class="bg-slate-50 rounded-xl p-4 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-mono text-sm text-slate-500">#${s.id.slice(-6)}</span>
          <span class="text-lg font-bold text-slate-800">${formatCurrency(s.total)}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">${s.paymentMethod}</span>
          <span class="text-xs text-slate-400">${formatDate(s.createdAt)}</span>
        </div>
      </div>`).join('');
    }

    renderCategoryChart(salesRes.data, productsRes.data);
  } catch (err) {
    showToast('Error al cargar dashboard: ' + err.message, 'error');
  }
}

function renderCategoryChart(sales, products) {
  const catMap = {};
  sales.forEach(s => {
    s.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const cat = product ? product.category : 'Otros';
      catMap[cat] = (catMap[cat] || 0) + item.subtotal;
    });
  });

  const labels = Object.keys(catMap);
  const data = Object.values(catMap);
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

  const ctx = $('#categoryChart');
  if (categoryChart) categoryChart.destroy();

  if (labels.length === 0) {
    ctx.parentElement.innerHTML = '<p class="text-sm text-slate-400 text-center py-20">Sin datos de ventas</p>';
    return;
  }

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' } } } },
  });
}

async function initInventory() {
  try {
    const catRes = await API.products.categories();
    state.categories = catRes.data;
    populateCategoryFilters();
  } catch {}

  $('#searchProducts').addEventListener('input', debounce(() => loadProducts(), 300));
  $('#filterCategory').addEventListener('change', () => loadProducts());
  $('#addProductBtn').addEventListener('click', () => openProductModal());

  if (state.user && state.user.role !== 'admin') {
    $('#addProductBtn').classList.add('hidden');
  }
}

function populateCategoryFilters() {
  const options = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
  $('#filterCategory').innerHTML = '<option value="">Todas las categorías</option>' + options;
  $('#productCategory').innerHTML = '<option value="">Seleccionar</option>' + options;
}

async function loadProducts() {
  const search = $('#searchProducts').value.trim();
  const category = $('#filterCategory').value;
  const params = {};
  if (search) params.search = search;
  if (category) params.category = category;

  try {
    const res = await API.products.list(params);
    state.products = res.data;
    renderProductsTable();
  } catch (err) {
    showToast('Error al cargar productos', 'error');
  }
}

function renderProductsTable() {
  const tbody = $('#productsTable');
  const cards = $('#productsCards');

  if (state.products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-12 text-center"><p class="text-slate-400 text-sm">No se encontraron productos</p></td></tr>';
    cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">No se encontraron productos</p>';
    return;
  }

  const isAdmin = state.user && state.user.role === 'admin';

  const desktopRows = state.products.map(p => {
    const stockClass = p.stock === 0 ? 'text-red-600 bg-red-50' : p.stock <= p.minStock ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50';
    const statusBadge = p.stock === 0
      ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Agotado</span>'
      : p.stock <= p.minStock
        ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Stock bajo</span>'
        : '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Disponible</span>';

    return `<tr class="hover:bg-slate-50 transition-colors">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-800">${p.name}</p>
            <p class="text-xs text-slate-400 truncate max-w-[200px]">${p.description || ''}</p>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 text-sm font-mono text-slate-600">${p.sku}</td>
      <td class="px-6 py-4"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">${p.category}</span></td>
      <td class="px-6 py-4 text-sm font-semibold text-slate-800 text-right">${formatCurrency(p.price)}</td>
      <td class="px-6 py-4 text-center"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${stockClass}">${p.stock}</span></td>
      <td class="px-6 py-4 text-center">${statusBadge}</td>
      <td class="px-6 py-4 text-right">
        ${isAdmin ? `<div class="flex items-center justify-end gap-1">
          <button onclick="window.editProduct('${p.id}')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="window.deleteProduct('${p.id}')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>` : '<span class="text-xs text-slate-400">Solo lectura</span>'}
      </td>
    </tr>`;
  }).join('');

  tbody.innerHTML = desktopRows;

  const mobileCards = state.products.map(p => {
    const stockColor = p.stock === 0 ? 'text-red-600' : p.stock <= p.minStock ? 'text-amber-600' : 'text-emerald-600';
    return `<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
            <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          </div>
          <div>
            <p class="font-semibold text-slate-800">${p.name}</p>
            <p class="text-xs font-mono text-slate-400">${p.sku}</p>
          </div>
        </div>
        <span class="text-lg font-bold ${stockColor}">${p.stock}</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">${p.category}</span>
        <span class="text-sm font-semibold text-slate-800">${formatCurrency(p.price)}</span>
      </div>
      ${isAdmin ? `<div class="flex gap-2 pt-2 border-t border-slate-100">
        <button onclick="window.editProduct('${p.id}')" class="flex-1 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors touch-target">Editar</button>
        <button onclick="window.deleteProduct('${p.id}')" class="flex-1 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors touch-target">Eliminar</button>
      </div>` : ''}
    </div>`;
  }).join('');

  cards.innerHTML = mobileCards;
}

function openProductModal(product = null) {
  const form = $('#productForm');
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
    $('#productDescription').value = product.description || '';
  }
  openModal('productModal');
}

window.editProduct = async (id) => {
  try {
    const res = await API.products.get(id);
    openProductModal(res.data);
  } catch (err) {
    showToast('Error al cargar producto', 'error');
  }
};

window.deleteProduct = async (id) => {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;

  try {
    await API.products.delete(id);
    showToast('Producto eliminado correctamente');
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

$('#productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#productId').value;
  const payload = {
    name: $('#productName').value.trim(),
    sku: $('#productSku').value.trim(),
    category: $('#productCategory').value,
    price: parseFloat($('#productPrice').value),
    cost: parseFloat($('#productCost').value),
    stock: parseInt($('#productStock').value),
    minStock: parseInt($('#productMinStock').value) || 0,
    description: $('#productDescription').value.trim(),
  };

  if (!payload.name || !payload.sku || !payload.category || isNaN(payload.price) || isNaN(payload.cost) || isNaN(payload.stock)) {
    const errEl = $('#productFormError');
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
    const errEl = $('#productFormError');
    errEl.classList.remove('hidden');
    errEl.querySelector('p').textContent = err.message;
  }
});

async function initSales() {
  $('#newSaleBtn').addEventListener('click', () => openSaleModal());
  $('#filterDateFrom').addEventListener('change', () => { $('#filterQuickPeriod').value = ''; loadSales(); });
  $('#filterDateTo').addEventListener('change', () => { $('#filterQuickPeriod').value = ''; loadSales(); });
  $('#filterPaymentMethod').addEventListener('change', () => loadSales());
  $('#filterQuickPeriod').addEventListener('change', handleQuickPeriod);
  $('#clearFiltersBtn').addEventListener('click', clearSalesFilters);
}

function handleQuickPeriod() {
  const period = $('#filterQuickPeriod').value;
  if (!period) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from, to;

  switch (period) {
    case 'today':
      from = today;
      to = now;
      break;
    case 'week':
      const dayOfWeek = today.getDay();
      from = new Date(today);
      from.setDate(today.getDate() - dayOfWeek);
      to = now;
      break;
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
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
  const params = {};
  const from = $('#filterDateFrom').value;
  const to = $('#filterDateTo').value;
  const paymentMethod = $('#filterPaymentMethod').value;

  if (from) params.from = from;
  if (to) params.to = to;

  try {
    const res = await API.sales.list(params);
    let sales = res.data;

    if (paymentMethod) {
      sales = sales.filter(s => s.paymentMethod === paymentMethod);
    }

    state.sales = sales;
    renderSalesTable();
    updateSalesSummary();
  } catch (err) {
    showToast('Error al cargar ventas', 'error');
  }
}

function updateSalesSummary() {
  const sales = state.sales;
  const count = sales.length;
  const total = sales.reduce((sum, s) => sum + s.total, 0);
  const avg = count > 0 ? total / count : 0;
  const items = sales.reduce((sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.quantity, 0), 0);

  $('#summaryCount').textContent = count;
  $('#summaryTotal').textContent = formatCurrency(total);
  $('#summaryAvg').textContent = formatCurrency(avg);
  $('#summaryItems').textContent = items;
}

function renderSalesTable() {
  const tbody = $('#salesTable');
  const cards = $('#salesCards');

  if (state.sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center"><p class="text-slate-400 text-sm">No se encontraron ventas</p></td></tr>';
    cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">No se encontraron ventas</p>';
    return;
  }

  tbody.innerHTML = state.sales.map(s => `<tr class="hover:bg-slate-50 transition-colors">
    <td class="px-6 py-4 text-sm font-mono text-slate-600">#${s.id.slice(-6)}</td>
    <td class="px-6 py-4">
      <div class="text-sm text-slate-700">${s.items.map(i => `${i.productName} x${i.quantity}`).join(', ')}</div>
    </td>
    <td class="px-6 py-4 text-sm font-bold text-slate-800 text-right">${formatCurrency(s.total)}</td>
    <td class="px-6 py-4"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize">${s.paymentMethod}</span></td>
    <td class="px-6 py-4 text-sm text-slate-500">${formatDate(s.createdAt)}</td>
    <td class="px-6 py-4 text-right">
      <button onclick="window.viewSale('${s.id}')" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-target" title="Ver detalle">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      </button>
    </td>
  </tr>`).join('');

  cards.innerHTML = state.sales.map(s => `<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
    <div class="flex items-center justify-between">
      <span class="font-mono text-sm text-slate-500">#${s.id.slice(-6)}</span>
      <span class="text-lg font-bold text-slate-800">${formatCurrency(s.total)}</span>
    </div>
    <div class="space-y-1">
      ${s.items.map(i => `<div class="flex justify-between text-sm">
        <span class="text-slate-600">${i.productName} x${i.quantity}</span>
        <span class="text-slate-500">${formatCurrency(i.subtotal)}</span>
      </div>`).join('')}
    </div>
    <div class="flex items-center justify-between pt-2 border-t border-slate-100">
      <div class="flex items-center gap-2">
        <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize">${s.paymentMethod}</span>
        <span class="text-xs text-slate-400">${formatDate(s.createdAt)}</span>
      </div>
      <button onclick="window.viewSale('${s.id}')" class="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors touch-target">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      </button>
    </div>
  </div>`).join('');
}

window.viewSale = async (id) => {
  try {
    const res = await API.sales.get(id);
    const sale = res.data;

    $('#detailSaleId').textContent = `#${sale.id.slice(-6)}`;
    $('#detailSaleDate').textContent = formatDate(sale.createdAt);
    $('#detailSalePayment').textContent = sale.paymentMethod;
    $('#detailSaleTotal').textContent = formatCurrency(sale.total);

    const itemsHtml = sale.items.map(item => `
      <div class="flex items-center justify-between px-4 py-3">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-slate-800 truncate">${item.productName}</p>
          <p class="text-xs text-slate-500">${item.quantity} x ${formatCurrency(item.unitPrice)}</p>
        </div>
        <p class="text-sm font-semibold text-slate-800 ml-4">${formatCurrency(item.subtotal)}</p>
      </div>
    `).join('');

    $('#detailSaleItems').innerHTML = itemsHtml;
    openModal('saleDetailModal');
  } catch (err) {
    showToast('Error al cargar venta', 'error');
  }
};

async function openSaleModal() {
  state.saleItems = [];
  $('#saleForm').reset();
  $('#saleTotal').textContent = '$0.00';
  $('#saleFormError').classList.add('hidden');
  renderSaleItems();

  try {
    const res = await API.products.list();
    const available = res.data.filter(p => p.stock > 0);
    const sel = $('#saleProductSelect');
    sel.innerHTML = '<option value="">Seleccionar producto</option>' +
      available.map(p => `<option value="${p.id}" data-stock="${p.stock}" data-price="${p.price}">${p.name} (Stock: ${p.stock}) - ${formatCurrency(p.price)}</option>`).join('');
  } catch {}

  openModal('saleModal');
}

$('#addSaleItem').addEventListener('click', () => {
  const sel = $('#saleProductSelect');
  const qty = parseInt($('#saleQuantity').value);
  const opt = sel.options[sel.selectedIndex];

  if (!sel.value) { showToast('Selecciona un producto', 'error'); return; }
  if (!qty || qty <= 0) { showToast('Cantidad inválida', 'error'); return; }

  const stock = parseInt(opt.dataset.stock);
  if (qty > stock) { showToast(`Stock disponible: ${stock}`, 'error'); return; }

  const existing = state.saleItems.find(i => i.productId === sel.value);
  if (existing) {
    if (existing.quantity + qty > stock) { showToast(`Stock máximo: ${stock}`, 'error'); return; }
    existing.quantity += qty;
    existing.subtotal = existing.quantity * existing.unitPrice;
  } else {
    state.saleItems.push({
      productId: sel.value,
      productName: opt.textContent.split(' (')[0],
      quantity: qty,
      unitPrice: parseFloat(opt.dataset.price),
      subtotal: qty * parseFloat(opt.dataset.price),
    });
  }

  renderSaleItems();
  sel.value = '';
  $('#saleQuantity').value = 1;
});

function renderSaleItems() {
  const tbody = $('#saleItemsTable');
  const cards = $('#saleItemsCards');

  if (state.saleItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">Sin productos agregados</td></tr>';
    cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">Sin productos agregados</p>';
    $('#saleTotal').textContent = '$0.00';
    return;
  }

  tbody.innerHTML = state.saleItems.map((item, idx) => `<tr>
    <td class="px-4 py-2 text-sm text-slate-700">${item.productName}</td>
    <td class="px-4 py-2 text-sm text-center">${item.quantity}</td>
    <td class="px-4 py-2 text-sm text-right">${formatCurrency(item.unitPrice)}</td>
    <td class="px-4 py-2 text-sm text-right font-medium">${formatCurrency(item.subtotal)}</td>
    <td class="px-4 py-2 text-right">
      <button onclick="window.removeSaleItem(${idx})" class="p-1 text-red-400 hover:text-red-600 transition-colors touch-target">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </td>
  </tr>`).join('');

  cards.innerHTML = state.saleItems.map((item, idx) => `<div class="flex items-center justify-between bg-slate-50 rounded-xl p-3">
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-slate-700 truncate">${item.productName}</p>
      <p class="text-xs text-slate-500">${item.quantity} x ${formatCurrency(item.unitPrice)}</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-sm font-semibold text-slate-800">${formatCurrency(item.subtotal)}</span>
      <button onclick="window.removeSaleItem(${idx})" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors touch-target">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  </div>`).join('');

  const total = state.saleItems.reduce((sum, i) => sum + i.subtotal, 0);
  $('#saleTotal').textContent = formatCurrency(total);
}

window.removeSaleItem = (idx) => {
  state.saleItems.splice(idx, 1);
  renderSaleItems();
};

$('#saleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const paymentMethod = $('#salePaymentMethod').value;

  if (state.saleItems.length === 0) {
    showError('saleFormError', 'Agrega al menos un producto');
    return;
  }
  if (!paymentMethod) {
    showError('saleFormError', 'Selecciona un método de pago');
    return;
  }

  try {
    await API.sales.create({
      items: state.saleItems.map(i => ({ productId: i.productId, quantity: i.quantity })),
      paymentMethod,
    });
    closeModal('saleModal');
    showToast('Venta registrada correctamente');
    loadSales();
    if (state.currentView === 'dashboard') loadDashboard();
  } catch (err) {
    showError('saleFormError', err.message);
  }
});

function initModals() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-modal]')) {
      const modal = e.target.closest('.fixed');
      if (modal) modal.classList.add('hidden');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.fixed.z-50').forEach(m => m.classList.add('hidden'));
    }
  });
}

function showError(id, msg) {
  const el = $(`#${id}`);
  el.classList.remove('hidden');
  el.querySelector('p').textContent = msg;
}

  console.log('[App] Aplicación inicializada correctamente');
}); // Fin de DOMContentLoaded
