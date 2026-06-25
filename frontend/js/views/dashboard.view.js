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

  initVentasGroupButtons();

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
    animateKPI('#stat-products', stats.totalProducts);
    animateKPI('#stat-revenue', stats.periodRevenue || 0, true);
    animateKPI('#stat-lowstock', stats.lowStockCount);
    animateKPI('#stat-value', stats.inventoryValue, true);
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
        var isCritical = p.stock === 0 || pct < 50;
        var badgeLabel = isCritical ? 'Stock Critico' : 'Stock Bajo';
        return '<div class="flex items-center gap-2 bg-transparent rounded-lg py-1.5">'
          // Punto rojo pulsante
          + '<span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0"></span>'
          // Info principal: nombre + SKU (ancho fijo para alinear barras)
          + '<div class="w-44 shrink-0 min-w-0">'
          + '<p class="text-gray-900 dark:text-white text-sm font-semibold truncate">' + escapeHtml(p.name) + '</p>'
          + '<p class="text-gray-500 text-[10px] font-mono truncate">' + escapeHtml(p.sku) + '</p>'
          + '</div>'
          // Barra fina inline, mas larga (w-16), arrancan todas al mismo sitio
          + '<div class="w-16 h-1 bg-gray-200 rounded-full overflow-hidden shrink-0">'
          + '<div class="h-full bg-red-400 rounded-full transition-all" style="width:' + pct + '%"></div>'
          + '</div>'
          // Cantidad
          + '<span class="text-red-500 text-xs font-bold shrink-0 w-10 text-right">' + p.stock + '/' + p.minStock + '</span>'
          // Badge
          + '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-100 text-red-600 shrink-0">' + badgeLabel + '</span>'
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
          ? '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 movimiento-badge">Entrada</span>'
          : '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 movimiento-badge">Salida</span>';
        var cantText = m.movimiento === 'entrada' ? '+ ' + m.cantidad_entrada : '- ' + m.cantidad_salida;
        var cantColor = m.movimiento === 'entrada' ? 'text-green-600' : 'text-red-600';
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
          ? '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 movimiento-badge">Entrada</span>'
          : '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 movimiento-badge">Salida</span>';
        var cantText = m.movimiento === 'entrada' ? '+ ' + m.cantidad_entrada : '- ' + m.cantidad_salida;
        var cantColor = m.movimiento === 'entrada' ? 'text-green-600' : 'text-red-600';
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
    loadVentasMargen('dia');
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
      var margenColor = margen >= 0 ? 'text-brand-600' : 'text-red-600';
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



async function loadVentasMargen(groupBy) {
  try {
    var from = $('#filterDateFromDash').value;
    var to = $('#filterDateToDash').value;
    var cocina = $('#filterCocinaDash').value;
    var params = { groupBy: groupBy || 'dia' };
    if (from) params.from = from;
    if (to) params.to = to;
    if (cocina) params.cocina = cocina;

    var res = await API.ventasPeriodo(params);
    if (res.success && res.data) {
      renderVentasMargenChart(res.data);
    }
  } catch (e) {
    console.error('[Dashboard] Error ventas margen:', e);
  }
}

function renderVentasMargenChart(data) {
  var canvas = document.getElementById('ventasMargenChart');
  if (!canvas) return;

  window.destroyChart('ventasMargen');

  if (!data || data.length === 0) return;

  var labels = data.map(function (d) { return d.label; });
  var ventasData = data.map(function (d) { return d.total_ventas; });
  var costosData = data.map(function (d) { return d.total_costo; });

  if (typeof Chart === 'undefined') return;

  var ctx = canvas.getContext('2d');

  var instance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Ventas',
          data: ventasData,
          backgroundColor: '#E8572A',
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.75,
        },
        {
          label: 'Costos',
          data: costosData,
          backgroundColor: '#2d2d2d',
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.75,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeInOutQuart' },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 10,
            boxHeight: 10,
            color: '#64748b',
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: '#1c1b19',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: function (ctx) {
              var v = ctx.raw;
              var label = ctx.dataset.label;
              return ' ' + label + ': ' + new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
            },
            footer: function (tooltipItems) {
              var idx = tooltipItems[0].dataIndex;
              var d = data[idx];
              if (d && d.margen_pct !== undefined) {
                return 'Margen: ' + d.margen_pct.toFixed(1) + '%';
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#797876', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
          border: { display: false },
          ticks: {
            color: '#797876',
            font: { size: 10 },
            callback: function (v) { return v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v; }
          }
        }
      }
    }
  });

  window.setChart('ventasMargen', instance);
}

function animateKPI(kpiId, targetValue, isCurrency) {
  var el = $(kpiId);
  if (!el) return;
  var start = 0;
  var end = parseInt(targetValue) || 0;
  if (isCurrency) end = parseFloat(targetValue) || 0;
  var duration = 800;
  var startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = start + (end - start) * eased;

    if (isCurrency) {
      el.textContent = formatCurrency(current);
    } else {
      el.textContent = Math.round(current);
    }

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function initVentasGroupButtons() {
  var btns = document.querySelectorAll('.ventas-group-btn');
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      btns.forEach(function (b) {
        b.classList.remove('bg-brand-600', 'text-white', 'shadow-sm');
        b.classList.add('bg-slate-100', 'text-slate-600');
      });
      this.classList.add('bg-brand-600', 'text-white', 'shadow-sm');
      this.classList.remove('bg-slate-100', 'text-slate-600');
      loadVentasMargen(this.dataset.group);
    });
  });
}


// Compatibilidad con codigo heredado (window.*)
if (typeof window !== "undefined") {
  if (typeof initDashboard === "function") window.initDashboard = initDashboard;
  if (typeof loadDashboard === "function") window.loadDashboard = loadDashboard;
  if (typeof loadTopDishes === "function") window.loadTopDishes = loadTopDishes;
  if (typeof populateProductFilter === "function") window.populateProductFilter = populateProductFilter;
  if (typeof renderCategoryChart === "function") window.renderCategoryChart = renderCategoryChart;
}
