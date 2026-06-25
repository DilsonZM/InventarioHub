import { $, escapeHtml } from '../core/dom.js';
import { renderCategoryChart } from '../components/chart.js';
import { updateClearBtn, applyQuickPeriod, openMobileFiltersModal } from '../components/filters.js';
import { showToast } from '../components/toast.js';
import { formatCurrency, formatDate, formatDateShort } from '../utils.js';

// dashboard.view.js
// Vista extraida de app.js en el Sub-paso 3.4 (views).

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

async function loadDashboard() {
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
      lowStockList.innerHTML = '<p class="text-sm text-slate-400 dark:text-gray-500 text-center py-8">Todo el inventario tiene stock suficiente</p>';
    } else {
      lowStockList.innerHTML = lowStockProducts.map(function (p) {
        var pct = Math.min((p.stock / p.minStock) * 100, 100);
        var isCritical = p.stock === 0 || pct < 50;
        var badgeLabel = isCritical ? 'Stock Critico' : 'Stock Bajo';
        return '<div class="flex items-center gap-3 bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 rounded-2xl p-6 shadow-sm mb-3">'
          // Punto de alerta verde pulsante al lado del nombre
          + '<div class="flex-1 min-w-0">'
          + '<div class="flex items-center gap-2">'
          + '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>'
          + '<p class="text-gray-900 dark:text-white font-bold truncate">' + escapeHtml(p.name) + '</p>'
          + '</div>'
          + '<p class="text-gray-500 dark:text-gray-400 text-xs font-mono mt-0.5">' + escapeHtml(p.sku) + '</p>'
          // Barra de progreso verde
          + '<div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">'
          + '<div class="h-full bg-emerald-600 rounded-full transition-all" style="width:' + pct + '%"></div>'
          + '</div>'
          + '</div>'
          + '<div class="text-right shrink-0 flex flex-col items-end gap-1.5">'
          + '<p class="text-emerald-700 dark:text-emerald-400 font-bold">' + p.stock + '/' + p.minStock + '</p>'
          // Badge "Stock Critico" estilo 'Completed' de la referencia
          + '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">'
          + badgeLabel
          + '</span>'
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
        + '<div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">'
        + '<svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>'
        + '</div>'
        + '<p class="text-sm font-medium text-slate-600">Sin movimientos recientes</p>'
        + '<p class="text-xs text-slate-400">Aun no hay entradas ni salidas</p>'
        + '</div></td></tr>';
      tbody.innerHTML = emptyRecent;
      cards.innerHTML = '<div class="flex flex-col items-center gap-2 py-8">'
        + '<div class="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">'
        + '<svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>'
        + '</div>'
        + '<p class="text-sm font-medium text-slate-600">Sin movimientos recientes</p>'
        + '<p class="text-xs text-slate-400">Aun no hay entradas ni salidas</p>'
        + '</div>';
    } else {
      tbody.innerHTML = recentMovs.map(function (m) {
        var tipoBadge = m.movimiento === 'entrada'
          ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 movimiento-badge">Entrada</span>'
          : '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 movimiento-badge">Salida</span>';
        var cantText = m.movimiento === 'entrada' ? '+ ' + m.cantidad_entrada : '- ' + m.cantidad_salida;
        var cantColor = m.movimiento === 'entrada' ? 'text-green-600' : 'text-red-600';
        return '<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">'
          + '<td class="px-6 py-3 text-sm font-mono text-slate-600 dark:text-gray-400">' + formatDateShort(m.fecha) + '</td>'
          + '<td class="px-6 py-3 text-sm text-slate-700 dark:text-gray-200">' + escapeHtml(m.producto) + '</td>'
          + '<td class="px-6 py-3">' + tipoBadge + '</td>'
          + '<td class="px-6 py-3 text-sm font-semibold ' + cantColor + '">' + cantText + '</td>'
          + '<td class="px-6 py-3 text-sm text-slate-500 dark:text-gray-500">Stock: ' + m.cantidad_stock + '</td>'
          + '</tr>';
      }).join('');

      cards.innerHTML = recentMovs.map(function (m) {
        var tipoBadge = m.movimiento === 'entrada'
          ? '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 movimiento-badge">Entrada</span>'
          : '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 movimiento-badge">Salida</span>';
        var cantText = m.movimiento === 'entrada' ? '+ ' + m.cantidad_entrada : '- ' + m.cantidad_salida;
        var cantColor = m.movimiento === 'entrada' ? 'text-green-600' : 'text-red-600';
        return '<div class="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4 space-y-2">'
          + '<div class="flex items-center justify-between">'
          + '<div class="flex items-center gap-2">' + tipoBadge + '<span class="text-sm font-medium text-slate-700 dark:text-gray-200">' + escapeHtml(m.producto) + '</span></div>'
          + '<span class="text-sm font-bold ' + cantColor + '">' + cantText + '</span>'
          + '</div>'
          + '<div class="flex items-center justify-between">'
          + '<span class="text-xs text-slate-400 dark:text-gray-500">' + formatDate(m.fecha) + '</span>'
          + '<span class="text-xs text-slate-500 dark:text-gray-500">Stock: ' + m.cantidad_stock + '</span>'
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
      var margenColor = margen >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600';
      return '<tr>'
        + '<td class="py-2 font-medium text-slate-700 dark:text-gray-200">' + escapeHtml(d.nombre) + '</td>'
        + '<td class="py-2 text-center text-slate-600 dark:text-gray-400">' + d.cantidad + '</td>'
        + '<td class="py-2 text-right text-slate-700 dark:text-gray-200">' + Utils.formatCurrency(d.precio_venta * d.cantidad) + '</td>'
        + '<td class="py-2 text-right text-slate-500 dark:text-gray-400">' + Utils.formatCurrency(d.costo * d.cantidad) + '</td>'
        + '<td class="py-2 text-right font-medium ' + margenColor + '">' + Utils.formatCurrency(margen * d.cantidad) + '</td>'
        + '</tr>';
    }).join('');
  } catch (e) {}
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



// Compatibilidad con codigo heredado (window.*)
if (typeof window !== "undefined") {
  if (typeof initDashboard === "function") window.initDashboard = initDashboard;
  if (typeof loadDashboard === "function") window.loadDashboard = loadDashboard;
  if (typeof loadTopDishes === "function") window.loadTopDishes = loadTopDishes;
  if (typeof populateProductFilter === "function") window.populateProductFilter = populateProductFilter;
  if (typeof renderCategoryChart === "function") window.renderCategoryChart = renderCategoryChart;
}
