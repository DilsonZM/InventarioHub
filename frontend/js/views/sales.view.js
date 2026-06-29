import { $, escapeHtml, debounce } from '../core/dom.js';
import { updateClearBtn, initFilters, applyMobileFilters } from '../components/filters.js';
import { openModal, closeModal, showError, markSaleDirty, closeModalWithGuard, showConfirm } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { formatCurrency, formatDate } from '../utils.js';
import { store } from '../core/store.js';
import { can } from '../core/permissions.js';

// sales.view.js
// Vista extraida de app.js en el Sub-paso 3.4 (views).

async function initSales() {
  var newOrderBtn = $('#newOrderBtn');
  if (newOrderBtn) newOrderBtn.addEventListener('click', function () { location.hash = '#pos'; });
  var newOrderBtnMobile = $('#newOrderBtnMobile');
  if (newOrderBtnMobile) newOrderBtnMobile.addEventListener('click', function () { location.hash = '#pos'; });

  // Cargar mesas + domicilio/recoger en el filtro ANTES de initFilters
  try {
    var mesas = await API.mesas.list();
    var sel = $('#filterMesa');
    if (sel && mesas.data) {
      sel.innerHTML = '<option value="">Todos los destinos</option>'
        + mesas.data.filter(function (m) { return m.activa; }).map(function (m) {
          return '<option value="' + m.id + '">' + escapeHtml(m.nombre) + '</option>';
        }).join('')
        + '<option disabled>──────────</option>'
        + '<option value="__domicilio__">🛵 Domicilio</option>'
        + '<option value="__recogido__">🏠 Recoger</option>';
    }
  } catch (e) { /* noop */ }

  initFilters('sales');
  var saleForm = $('#saleForm');
  if (saleForm) {
    saleForm.addEventListener('input', markSaleDirty);
    saleForm.addEventListener('change', markSaleDirty);
  }
  var addSaleItemBtn = $('#addSaleItem');
  if (addSaleItemBtn) addSaleItemBtn.addEventListener('click', markSaleDirty);
  var addDishBtn = $('#addDishSaleItem');
  if (addDishBtn) addDishBtn.addEventListener('click', addDishSaleItem);

  // Filtros # Pedido y Vendedor (no estan en initFilters, los wireamos aqui)
  var filterNumVenta = $('#filterNumVenta');
  if (filterNumVenta) {
    filterNumVenta.addEventListener('input', debounce(function () { loadSales(); }, 300));
  }
  var filterVendedor = $('#filterVendedor');
  if (filterVendedor) {
    filterVendedor.addEventListener('change', function () { loadSales(); });
  }

  // Boton colapsar/expandir isla de filtros (solo mobile) — estado persistido en localStorage
  var FILTERS_COLLAPSED_KEY = 'salesFiltersCollapsed';
  var toggleBar = document.getElementById('toggleSalesFiltersBar');
  var filtersIsland = document.getElementById('salesFiltersIsland');
  var toggleIcon = document.getElementById('toggleSalesFiltersIcon');
  function applyFiltersCollapsed(collapsed) {
    if (!filtersIsland) return;
    filtersIsland.classList.toggle('sales-filters-collapsed', collapsed);
    if (toggleIcon) toggleIcon.style.transform = collapsed ? 'rotate(180deg)' : 'rotate(0deg)';
    if (toggleBar) {
      toggleBar.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggleBar.title = collapsed ? 'Mostrar filtros' : 'Ocultar filtros';
    }
    try { localStorage.setItem(FILTERS_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (e) {}
  }
  if (toggleBar && filtersIsland) {
    // Restaurar estado previo
    var savedCollapsed = null;
    try { savedCollapsed = localStorage.getItem(FILTERS_COLLAPSED_KEY); } catch (e) {}
    applyFiltersCollapsed(savedCollapsed === '1');
    toggleBar.addEventListener('click', function (e) {
      e.preventDefault();
      var willCollapse = !filtersIsland.classList.contains('sales-filters-collapsed');
      applyFiltersCollapsed(willCollapse);
    });
  }

  // Buscador unificado con dropdown
  var searchInput = $('#saleSearch');
  var searchDropdown = $('#saleSearchDropdown');
  if (searchInput && searchDropdown) {
    searchInput.addEventListener('input', function () {
      var q = this.value.toLowerCase().trim();
      if (!q) { searchDropdown.classList.add('hidden'); return; }
      var html = '';
      // Buscar en platos
      var dishMatches = (window._dishOptions || []).filter(function (d) { return d.label.toLowerCase().includes(q); });
      if (dishMatches.length > 0) {
        html += '<div class=\"px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider\">Platos</div>';
        dishMatches.forEach(function (d) {
          html += '<div class=\"search-result flex items-center justify-between px-3 py-2.5 hover:bg-brand-100 cursor-pointer text-sm\" data-type=\"dish\" data-id=\"' + d.value + '\" data-price=\"' + d.price + '\"><span class=\"text-slate-700\">' + escapeHtml(d.label.split(' — ')[0]) + '</span><span class=\"text-xs text-slate-400\">' + d.label.split(' — ')[1] + '</span></div>';
        });
      }
      // Buscar en productos
      var prodMatches = (window._productOptions || []).filter(function (p) { return p.label.toLowerCase().includes(q); });
      if (prodMatches.length > 0) {
        html += '<div class=\"px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-t border-slate-100\">Productos</div>';
        prodMatches.forEach(function (p) {
          html += '<div class=\"search-result flex items-center justify-between px-3 py-2.5 hover:bg-brand-100 cursor-pointer text-sm\" data-type=\"product\" data-id=\"' + p.value + '\" data-unidad=\"' + p.unidad + '\"><span class=\"text-slate-700\">' + escapeHtml(p.label.split(' (Stock:')[0]) + '</span><span class=\"text-xs text-slate-400\">Stock: ' + p.stock + ' ' + p.unidad + '</span></div>';
        });
      }
      searchDropdown.innerHTML = html || '<div class=\"px-3 py-3 text-center text-sm text-slate-400\">Sin resultados</div>';
      searchDropdown.classList.remove('hidden');
    });
    // Click outside cierra dropdown
    document.addEventListener('click', function (e) {
      if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.add('hidden');
      }
    });
    // Click en resultado -> agrega al pedido
    searchDropdown.addEventListener('click', function (e) {
      var row = e.target.closest('.search-result');
      if (!row) return;
      var type = row.dataset.type;
      var qty = parseFloat($('#saleSearchQty').value) || 1;
      if (type === 'dish') {
        $('#saleDishSelect').value = row.dataset.id;
        $('#saleDishQuantity').value = qty;
        addDishSaleItem();
      } else if (type === 'product') {
        $('#saleProductSelect').value = row.dataset.id;
        $('#saleQuantity').value = qty;
        var evt = new Event('change', { bubbles: true });
        $('#saleProductSelect').dispatchEvent(evt);
        document.getElementById('addSaleItem').click();
      }
      searchDropdown.classList.add('hidden');
      searchInput.value = '';
    });
  }
}

async function loadSales() {
  var params = {};
  var from = $('#filterDateFrom').value;
  var to = $('#filterDateTo').value;
  var mesa = $('#filterMesa').value;
  var numVenta = $('#filterNumVenta') ? $('#filterNumVenta').value.trim() : '';
  // vendedor se filtra en el cliente (el backend no lo soporta)
  var vendedor = $('#filterVendedor') ? $('#filterVendedor').value : '';

  if (from) params.from = from;
  if (to) params.to = to;
  if (mesa === '__domicilio__') params.modo = 'domicilio';
  else if (mesa === '__recogido__') params.modo = 'recogido';
  else if (mesa) params.mesa = mesa;

  try {
    var res = await API.sales.list(params);
    var sales = res.data || [];

    // Filtros locales (# Pedido, Vendedor)
    if (numVenta) {
      var needle = numVenta.toLowerCase();
      sales = sales.filter(function (s) {
        return (s.numero_venta || '').toLowerCase().indexOf(needle) !== -1;
      });
    }
    if (vendedor) {
      sales = sales.filter(function (s) { return s.username === vendedor; });
    }

    state.sales = sales;
    populateVendedorFilter();
    renderSalesTable();
    updateSalesSummary();
  } catch (err) {
    showToast('Error al cargar salidas', 'error');
  }
}

// Poblar el select de vendedores con la lista unica de las ventas cargadas
function populateVendedorFilter() {
  var select = document.getElementById('filterVendedor');
  if (!select) return;
  var currentValue = select.value;
  var vendedores = {};
  state.sales.forEach(function (s) {
    var nombre = s.usuario_nombre || s.username || 'Desconocido';
    var username = s.username || nombre;
    if (!vendedores[username]) vendedores[username] = nombre;
  });
  var keys = Object.keys(vendedores).sort();
  var html = '<option value="">Todos los vendedores</option>';
  keys.forEach(function (u) {
    var selected = (u === currentValue) ? ' selected' : '';
    html += '<option value="' + escapeHtml(u) + '"' + selected + '>' + escapeHtml(vendedores[u]) + '</option>';
  });
  if (select.innerHTML !== html) select.innerHTML = html;
}

function renderSalesTable() {
  var tbody = $('#salesTable');
  var cards = $('#salesCards');

  if (state.sales.length === 0) {
    var emptySales = '<tr><td colspan="8" class="px-6 py-16 text-center">'
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
    var estado = s.estadoCocina || 'pendiente';
    var estadoBadge = {
      pendiente: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>Pendiente</span>',
      preparando: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03z"/></svg>Preparando</span>',
      listo: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>Listo</span>',
      entregado: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>Entregado</span>'
    }[estado] || estadoBadge.pendiente;

    // Boton de avance de estado
    var advanceBtn = '';
    if (estado === 'pendiente') {
      advanceBtn = '<button onclick="window.advanceOrderState(\'' + s.id + '\')" class="pedido-action-btn action-advance" title="Iniciar preparacion"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>';
    } else if (estado === 'preparando') {
      advanceBtn = '<button onclick="window.advanceOrderState(\'' + s.id + '\')" class="pedido-action-btn action-advance" title="Marcar como listo"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/></svg></button>';
    } else if (estado === 'listo') {
      advanceBtn = '<button onclick="window.advanceOrderState(\'' + s.id + '\')" class="pedido-action-btn action-advance" title="Entregar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg></button>';
    }

    var mesaName;
    if (s.paymentMethod === 'domicilio') {
      mesaName = '🛵 Domicilio';
    } else if (s.paymentMethod === 'recogido') {
      mesaName = '🏠 Recoger';
    } else {
      mesaName = s.mesaNombre || (s.mesaId ? 'Mesa ' + s.mesaId.slice(-4) : '—');
    }

    return '<tr class="sales-row-estado-' + estado + ' hover:bg-slate-50 transition-colors">'
      + '<td class="px-6 py-4 text-sm font-mono text-slate-600">' + escapeHtml(s.numero_venta || s.id.slice(-6)) + '</td>'
      + '<td class="px-6 py-4 text-sm text-slate-700">' + escapeHtml(mesaName) + '</td>'
      + '<td class="px-6 py-4">'
      + s.items.map(function (i) {
        var qty = i.unidadPresentacion && i.factorConversion !== 1 ? i.cantidadPresentacion : i.quantity;
        return '<div class="text-sm text-slate-700 mb-0.5">' + escapeHtml(i.productName) + ' x' + qty + '</div>';
      }).join('')
      + '</td>'
      + '<td class="px-6 py-4 text-sm font-semibold text-slate-800 text-right">' + Utils.formatCurrency(s.total) + '</td>'
      + '<td class="px-6 py-4 text-sm text-slate-700">' + escapeHtml(s.usuario_nombre || s.username || 'Desconocido') + '</td>'
      + '<td class="px-6 py-4 text-center">' + estadoBadge + '</td>'
      + '<td class="px-6 py-4 text-sm text-slate-500">' + formatDate(s.createdAt) + '</td>'
      + '<td class="px-6 py-4 text-right">'
      + '<div class="flex items-center justify-end gap-1.5">'
      + advanceBtn
      + '<button onclick="window.viewSale(\'' + s.id + '\')" class="pedido-action-btn action-view" title="Ver detalle">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>'
      + '</button>'
      + '<button onclick="window.showTicket(\'' + s.id + '\')" class="pedido-action-btn action-print" title="Imprimir ticket">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>'
      + '</button>'
      + (window.can && window.can('puedeEditarSalidas') ?
        '<button onclick="window.editSale(\'' + s.id + '\')" class="pedido-action-btn action-edit" title="Editar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
        + '</button>' : '')
      + (window.can && window.can('puedeEliminarSalidas') ?
        '<button onclick="window.deleteSale(\'' + s.id + '\')" class="pedido-action-btn action-delete" title="Eliminar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
        + '</button>' : '')
      + '</div>'
      + '</td>'
      + '</tr>';
  }).join('');

  cards.innerHTML = state.sales.map(function (s) {
    var estado = s.estadoCocina || 'pendiente';
    var estadoColors = {
      pendiente: 'bg-amber-100 text-amber-800',
      preparando: 'bg-orange-100 text-orange-800',
      listo: 'bg-green-100 text-green-800',
      entregado: 'bg-slate-100 text-slate-600'
    };
    var estadoLabel = { pendiente: 'Pendiente', preparando: 'Preparando', listo: 'Listo', entregado: 'Entregado' }[estado];

    var mesaName;
    if (s.paymentMethod === 'domicilio') {
      mesaName = '🛵 Domicilio';
    } else if (s.paymentMethod === 'recogido') {
      mesaName = '🏠 Recoger';
    } else {
      mesaName = s.mesaNombre || (s.mesaId ? 'Mesa ' + s.mesaId.slice(-4) : '—');
    }

    return '<div class="sales-card-estado-' + estado + ' bg-white border border-slate-200 rounded-xl p-4 space-y-3">'
      + '<div class="flex items-center justify-between">'
      + '<span class="font-mono text-sm text-slate-500">' + escapeHtml(s.numero_venta || ('#' + s.id.slice(-6))) + '</span>'
      + '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ' + estadoColors[estado] + '">' + estadoLabel + '</span>'
      + '</div>'
      + '<div class="space-y-1">'
      + s.items.map(function (i) {
        var qty = i.unidadPresentacion && i.factorConversion !== 1 ? i.cantidadPresentacion : i.quantity;
        return '<div class="text-sm text-slate-600">' + escapeHtml(i.productName) + ' x' + qty + '</div>';
      }).join('')
      + '</div>'
      + '<div class="flex items-center justify-between pt-2 border-t border-slate-100">'
      + '<div class="flex items-center gap-2 flex-wrap">'
      + '<span class="text-xs text-slate-400">' + formatDate(s.createdAt) + '</span>'
      + '<span class="text-xs text-slate-500">' + escapeHtml(mesaName) + '</span>'
      + '<span class="text-sm font-semibold text-slate-800">' + Utils.formatCurrency(s.total) + '</span>'
      + '</div>'
      + '<div class="flex items-center gap-1.5">'
      + (estado !== 'entregado'
        ? '<button onclick="window.advanceOrderState(\'' + s.id + '\')" class="pedido-action-btn action-advance" title="' + (estado === 'pendiente' ? 'Iniciar' : estado === 'preparando' ? 'Listo' : 'Entregar') + '">'
        + (estado === 'pendiente' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
         : estado === 'preparando' ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/></svg>'
         : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>')
        + '</button>' : '')
      + '<button onclick="window.viewSale(\'' + s.id + '\')" class="pedido-action-btn action-view" title="Ver">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>'
      + '</button>'
      + '<button onclick="window.showTicket(\'' + s.id + '\')" class="pedido-action-btn action-print" title="Imprimir">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>'
      + '</button>'
      + (window.can && window.can('puedeEditarSalidas') ?
        '<button onclick="window.editSale(\'' + s.id + '\')" class="pedido-action-btn action-edit" title="Editar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
        + '</button>' : '')
      + (window.can && window.can('puedeEliminarSalidas') ?
        '<button onclick="window.deleteSale(\'' + s.id + '\')" class="pedido-action-btn action-delete" title="Eliminar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
        + '</button>' : '')
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

function updateSalesSummary() {
  var sales = state.sales;
  var pendientes = sales.filter(function (s) { return (s.estadoCocina || 'pendiente') === 'pendiente'; }).length;
  var preparando = sales.filter(function (s) { return s.estadoCocina === 'preparando'; }).length;
  var listos = sales.filter(function (s) { return s.estadoCocina === 'listo'; }).length;
  var entregados = sales.filter(function (s) { return s.estadoCocina === 'entregado'; }).length;

  $('#summaryPendientes').textContent = pendientes;
  $('#summaryPreparando').textContent = preparando;
  $('#summaryListos').textContent = listos;
  $('#summaryEntregados').textContent = entregados;
}

async function openSaleModal() {
  var isEditing = !!state.editingSaleId;
  state.saleDirty = false;
  state._pendingOrder = null;
  state.saleType = 'productos'; // mantener para compatibilidad
  var submitBtn = document.querySelector('#saleForm button[type=\"submit\"]');
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Registrar Pedido'; }
  if (!isEditing) {
    state.saleItems = [];
    state.saleDishItems = [];
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

  // En edicion, auto-seleccionar el primer item (solo productos, no platos)
  if (isEditing && state.saleItems.length > 0) {
    var firstItem = state.saleItems[0];
    var sel = $('#saleProductSelect');
    if (sel && firstItem.productId) {
      // Verificar que el producto existe en las opciones antes de seleccionarlo
      var optExists = Array.from(sel.options).some(function (o) { return o.value === firstItem.productId; });
      if (optExists) {
        sel.value = firstItem.productId;
        sel.dispatchEvent(new Event('change'));
      }
    }
  }

  // Cargar opciones de platos al abrir siempre
  loadDishOptions();

  openModal('saleModal');
}

function setSaleType(type) {
  state.saleType = type;
  // Cargar opciones de platos al abrir modal
  if (type === 'platos') loadDishOptions();
}

async function loadDishOptions() {
  var sel = $('#saleDishSelect');
  if (!sel) return;
  try {
    var res = await API.dishes.list();
    var dishes = (res.data || []).filter(function (d) { return d.activo && d.disponible !== false; });
    window._dishOptions = dishes.map(function (d) {
      return { value: d.id, label: d.nombre + ' — ' + Utils.formatCurrency(d.precio_venta), price: d.precio_venta };
    });
    sel.innerHTML = '<option value="">Seleccionar plato o bebida</option>'
      + window._dishOptions.map(function (d) {
        return '<option value="' + d.value + '" data-price="' + d.price + '">' + d.label + '</option>';
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

  // Cachear para el buscador
  window._productOptions = state.allAvailableProducts.map(function (p) {
    var stockDisponible = (p.stock || 0) + (state.saleItems.find(function (i) { return i.productId === p.id; }) ? (state.saleItems.find(function (i) { return i.productId === p.id; }).cantidadBase || 0) : 0);
    return { value: p.id, label: p.name + ' (Stock: ' + stockDisponible + ' ' + (p.unidad || 'unidad') + ')', stock: stockDisponible, unidad: p.unidad || 'unidad', stockReal: p.stock || 0, stockReservado: 0 };
  });

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
  var totalAmount = 0;
  var html = '';

  refreshSaleProductOptions();

  // Dish items
  state.saleDishItems.forEach(function (item, idx) {
    var sub = item.precioUnitario * item.cantidad;
    totalAmount += sub;
    html += '<tr>'
      + '<td class=\"px-4 py-2\"><span class=\"text-sm text-slate-700 font-medium\">' + escapeHtml(item.nombre) + '</span> <span class=\"text-[10px] text-brand-600\">🍽️</span></td>'
      + '<td class=\"px-2 py-2\"><input type=\"number\" class=\"item-qty w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-brand-500/50\" value=\"' + item.cantidad + '\" min=\"1\" data-type=\"dish\" data-idx=\"' + idx + '\" onchange=\"window.updateSaleItemQty(this)\"></td>'
      + '<td class=\"px-2 py-2 text-center text-xs text-slate-400\">—</td>'
      + '<td class=\"px-2 py-2 text-right\"><button onclick=\"window.removeDishSaleItem(' + idx + ')\" class=\"p-1 text-slate-300 hover:text-red-500\">×</button></td>'
      + '</tr>';
  });

  // Product items
  state.saleItems.forEach(function (item, idx) {
    totalAmount += item.cantidadBase;
    var label = item.unidadPresentacion ? item.cantidadPresentacion + ' ' + item.unidadPresentacionLabel : item.cantidadBase + ' ' + item.unidadBase;
    var unidadOptions = '<select class=\"item-unit w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] text-center focus:outline-none focus:ring-2 focus:ring-brand-500/50 bg-white\" data-type=\"product\" data-idx=\"' + idx + '\" onchange=\"window.updateSaleItemUnit(this)\">'
      + '<option value=\"\">' + escapeHtml(item.unidadBase) + ' base</option>';
    var presList = window.getPresentaciones(item.unidadBase);
    presList.forEach(function (p) {
      if (p.value) unidadOptions += '<option value=\"' + p.value + '\" data-factor=\"' + p.factor + '\"' + (item.unidadPresentacion === p.value ? ' selected' : '') + '>' + escapeHtml(p.label) + '</option>';
    });
    unidadOptions += '</select>';
    var qtyVal = item.unidadPresentacion ? item.cantidadPresentacion : item.cantidadBase;
    html += '<tr>'
      + '<td class=\"px-4 py-2\"><span class=\"text-sm text-slate-700\">' + escapeHtml(item.productName) + '</span></td>'
      + '<td class=\"px-2 py-2\"><input type=\"number\" class=\"item-qty w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-brand-500/50\" value=\"' + qtyVal + '\" min=\"0.001\" step=\"0.001\" data-type=\"product\" data-idx=\"' + idx + '\" onchange=\"window.updateSaleItemQty(this)\"></td>'
      + '<td class=\"px-2 py-2\">' + unidadOptions + '</td>'
      + '<td class=\"px-2 py-2 text-right\"><button onclick=\"window.removeSaleItem(' + idx + ')\" class=\"p-1 text-slate-300 hover:text-red-500\">×</button></td>'
      + '</tr>';
  });

  if (!html) {
    tbody.innerHTML = '<tr><td colspan=\"4\" class=\"px-4 py-6 text-center text-sm text-slate-400\">Sin items agregados</td></tr>';
    if (cards) cards.innerHTML = '<p class=\"text-slate-400 text-sm text-center py-4\">Sin items agregados</p>';
    $('#saleTotal').textContent = '$0';
    return;
  }

  tbody.innerHTML = html;
  $('#saleTotal').textContent = Utils.formatCurrency(totalAmount);

  // Mobile cards
  if (cards) {
    var cardHtml = '';
    state.saleDishItems.forEach(function (item, idx) {
      cardHtml += '<div class=\"flex items-center justify-between bg-white border border-slate-100 rounded-xl p-3\"><div class=\"flex-1 min-w-0\"><p class=\"text-sm font-medium text-slate-700\">' + escapeHtml(item.nombre) + ' 🍽️</p><p class=\"text-xs text-slate-500\">x' + item.cantidad + ' · ' + Utils.formatCurrency(item.precioUnitario * item.cantidad) + '</p></div><button onclick=\"window.removeDishSaleItem(' + idx + ')\" class=\"p-2 text-slate-300 hover:text-red-500\">×</button></div>';
    });
    state.saleItems.forEach(function (item, idx) {
      var label = item.unidadPresentacion ? item.cantidadPresentacion + ' ' + item.unidadPresentacionLabel : item.cantidadBase + ' ' + item.unidadBase;
      cardHtml += '<div class=\"flex items-center justify-between bg-white border border-slate-100 rounded-xl p-3\"><div class=\"flex-1 min-w-0\"><p class=\"text-sm font-medium text-slate-700\">' + escapeHtml(item.productName) + '</p><p class=\"text-xs text-slate-500\">' + label + '</p></div><button onclick=\"window.removeSaleItem(' + idx + ')\" class=\"p-2 text-slate-300 hover:text-red-500\">×</button></div>';
    });
    cards.innerHTML = cardHtml;
  }
}



// Handlers expuestos en window (compatibilidad con onclick inline)
window.removeDishSaleItem = function (idx) {
  state.saleDishItems.splice(idx, 1);
  renderSaleItems();
}

window.removeSaleItem = function (idx) {
  state.saleItems.splice(idx, 1);
  renderSaleItems();
}

window.updateSaleItemQty = function (input) {
  var type = input.dataset.type;
  var idx = parseInt(input.dataset.idx);
  var val = parseFloat(input.value) || 0;
  if (val <= 0) { renderSaleItems(); return; }
  if (type === 'dish') {
    if (state.saleDishItems[idx]) state.saleDishItems[idx].cantidad = val;
  } else if (type === 'product') {
    if (state.saleItems[idx]) {
      var item = state.saleItems[idx];
      if (item.unidadPresentacion) {
        var factor = item.factorConversion || 1;
        item.cantidadPresentacion = val;
        item.cantidadBase = val * factor;
      } else {
        item.cantidadBase = val;
      }
    }
  }
  // Recalcular total sin re-renderizar todo
  var total = 0;
  state.saleDishItems.forEach(function (d) { total += d.precioUnitario * d.cantidad; });
  state.saleItems.forEach(function (p) { total += p.cantidadBase; });
  $('#saleTotal').textContent = Utils.formatCurrency(total);
  markSaleDirty();
}

window.updateSaleItemUnit = function (select) {
  var idx = parseInt(select.dataset.idx);
  var item = state.saleItems[idx];
  if (!item) return;
  var opt = select.options[select.selectedIndex];
  var factor = parseFloat(opt.dataset.factor) || 1;
  item.unidadPresentacion = select.value || null;
  item.unidadPresentacionLabel = select.value ? opt.textContent.split(' (')[0].toLowerCase() : null;
  item.factorConversion = factor;
  // Mantener cantidad base, recalcular presentacion
  if (select.value) {
    item.cantidadPresentacion = item.cantidadBase / factor;
  }
  renderSaleItems();
}


// ============================================
// Acciones sobre salidas (vista detalle / eliminar)
// Migradas a sales.view.js en el Sub-paso 3.5 (antes vivian en app.js
// y se reexportaban a window.*).
// ============================================
window.viewSale = async function (id) {
  try {
    var res = await API.sales.get(id);
    var sale = res.data;
    var total = sale.items.reduce(function (sum, i) { return sum + (i.subtotal || 0); }, 0);

    var detailEl = $('#detailSaleId');
    if (detailEl) detailEl.textContent = '#' + sale.id.slice(-6);
    var dateEl = $('#detailSaleDate');
    if (dateEl) dateEl.textContent = formatDate(sale.createdAt);
    var pmEl = $('#detailSalePayment');
    if (pmEl) {
      var label = sale.paymentMethod;
      if (label === 'domicilio') label = '🛵 Domicilio';
      else if (label === 'recogido') label = '🏠 Recoger';
      else if (sale.mesaNombre) label = sale.mesaNombre;
      else label = sale.paymentMethod || '—';
      pmEl.textContent = label;
    }
    var totalEl = $('#detailSaleTotal');
    if (totalEl) totalEl.textContent = formatCurrency(total);

    var itemsHtml = sale.items.map(function (item) {
      var badge = item.esPlato
        ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-brand-100 text-brand-800 text-[10px] font-medium ml-1">Plato</span>'
        : '';
      return '<div class="flex items-center justify-between px-4 py-3">'
        + '<div class="flex-1 min-w-w-0">'
        + '<p class="text-sm font-medium text-slate-800 truncate">' + escapeHtml(item.productName) + ' x' + item.quantity + badge + '</p>'
        + '<p class="text-xs text-slate-500">' + formatCurrency(item.unitPrice || 0) + ' c/u · ' + formatCurrency(item.subtotal || 0) + '</p>'
        + '</div>'
        + '<p class="text-sm font-semibold text-slate-800 ml-4">' + formatCurrency(item.subtotal || 0) + '</p>'
        + '</div>';
    }).join('');

    // Ingredientes consumidos (platos)
    var ingsHtml = '';
    if (sale.ingredientesConsumidos && sale.ingredientesConsumidos.length > 0) {
      ingsHtml = '<div class="border-t border-slate-100 px-4 py-3 bg-slate-50/50">'
        + '<p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ingredientes consumidos</p>'
        + sale.ingredientesConsumidos.map(function (ing) {
          return '<div class="flex items-center justify-between text-xs py-1">'
            + '<span class="text-slate-600">' + escapeHtml(ing.nombre) + ' <span class="text-slate-400">' + ing.cantidad + ' ' + (ing.unidad || '') + '</span></span>'
            + '<span class="text-slate-400 text-[10px]">' + escapeHtml(ing.por || '') + '</span>'
            + '</div>';
        }).join('')
        + '</div>';
    }

    var itemsEl = $('#detailSaleItems');
    if (itemsEl) itemsEl.innerHTML = itemsHtml + ingsHtml;
    openModal('saleDetailModal');
  } catch (err) {
    showToast('Error al cargar salida: ' + (err.message || ''), 'error');
  }
};

window.deleteSale = function (id) {
  if (!can('puedeEliminarSalidas')) {
    showToast('Sin permiso', 'error');
    return;
  }
  showConfirm({
    title: '¿Eliminar pedido?',
    message: 'El stock se devolverá al inventario. Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    variant: 'danger',
    icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
  }, async function () {
    try {
      await API.sales.delete(id);
      showToast('Pedido eliminado y stock devuelto', 'success');
      loadSales();
    } catch (err) {
      showToast('Error: ' + (err.message || ''), 'error');
    }
  });
};

window.editSale = function (id) {
  if (!can('puedeEditarSalidas')) {
    showToast('Sin permiso', 'error');
    return;
  }
  showConfirm({
    title: '¿Editar pedido?',
    message: 'Se abrirá en el punto de venta para modificar los productos, mesa y cantidades.',
    confirmText: 'Editar',
    variant: 'info',
    icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
  }, function () {
    store.set({ editingPOSOrderId: id });
    location.hash = '#pos';
  });
};

window.advanceOrderState = async function (id) {
  if (!can('puedeCrearSalidas')) {
    showToast('Sin permiso', 'error');
    return;
  }
  try {
    var sale = state.sales.find(function (s) { return s.id === id; });
    if (!sale) return;
    var actual = sale.estadoCocina || 'pendiente';
    var next = { pendiente: 'preparando', preparando: 'listo', listo: 'entregado' }[actual];
    if (!next) { showToast('El pedido ya fue entregado', 'info'); return; }

    await window.ServicesSales.advanceEstado(id, next);
    sale.estadoCocina = next;
    renderSalesTable();
    updateSalesSummary();
    var labels = { preparando: 'En preparacion', listo: 'Listo para servir', entregado: 'Entregado' };
    showToast(labels[next] || next, 'success');
  } catch (err) {
    showToast('Error: ' + (err.message || 'No se pudo avanzar estado'), 'error');
  }
};



// Compatibilidad con codigo heredado (window.*)
if (typeof window !== "undefined") {
  if (typeof initSales === "function") window.initSales = initSales;
  if (typeof loadSales === "function") window.loadSales = loadSales;
  if (typeof renderSalesTable === "function") window.renderSalesTable = renderSalesTable;
  if (typeof updateSalesSummary === "function") window.updateSalesSummary = updateSalesSummary;
  if (typeof openSaleModal === "function") window.openSaleModal = openSaleModal;
  if (typeof setSaleType === "function") window.setSaleType = setSaleType;
  if (typeof loadDishOptions === "function") window.loadDishOptions = loadDishOptions;
  if (typeof addDishSaleItem === "function") window.addDishSaleItem = addDishSaleItem;
  if (typeof updateSaleConversionPreview === "function") window.updateSaleConversionPreview = updateSaleConversionPreview;
  if (typeof refreshSaleProductOptions === "function") window.refreshSaleProductOptions = refreshSaleProductOptions;
  if (typeof renderSaleItems === "function") window.renderSaleItems = renderSaleItems;
  if (typeof removeDishSaleItem === "function") window.removeDishSaleItem = removeDishSaleItem;
  if (typeof removeSaleItem === "function") window.removeSaleItem = removeSaleItem;
  if (typeof updateSaleItemQty === "function") window.updateSaleItemQty = updateSaleItemQty;
  if (typeof updateSaleItemUnit === "function") window.updateSaleItemUnit = updateSaleItemUnit;
  // viewSale y deleteSale se exponen directamente en window.* dentro
  // del modulo para que el HTML dinamico (onclick="window.viewSale(...)")
  // pueda invocarlos.
}
