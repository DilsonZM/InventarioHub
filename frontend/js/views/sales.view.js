import { $, escapeHtml } from '../core/dom.js';
import { updateClearBtn, initFilters, applyMobileFilters } from '../components/filters.js';
import { openModal, closeModal, showError, markSaleDirty } from '../components/modal.js';
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
          pres = ' <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium ml-1">' + escapeHtml(i.unidadPresentacion) + '</span>';
        }
        return '<div class="text-sm text-slate-700 mb-0.5">' + escapeHtml(i.productName) + ' x' + (i.unidadPresentacion && i.factorConversion !== 1 ? i.cantidadPresentacion : i.quantity) + pres + '</div>';
      }).join('')
      + '</td>'
      + '<td class="px-6 py-4 text-sm font-semibold text-slate-800 text-right">' + s.items.reduce(function (sum, i) { return sum + i.quantity; }, 0) + ' unid.</td>'
      + '<td class="px-6 py-4"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800">' + escapeHtml(s.paymentMethod) + '</span></td>'
      + '<td class="px-6 py-4 text-sm text-slate-500">' + formatDate(s.createdAt) + '</td>'
      + '<td class="px-6 py-4 text-sm text-slate-600"><div class="flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' + escapeHtml(s.usuario_nombre || '') + '</div></td>'
      + '<td class="px-6 py-4 text-right">'
      + '<div class="flex items-center justify-end gap-1">'
      + '<button onclick="window.viewSale(\'' + s.id + '\')" class="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-100 rounded-lg transition-colors touch-target" title="Ver detalle">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>'
      + '</button>'
      + '<button onclick="window.showTicket(\'' + s.id + '\')" class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 hover:scale-110 rounded-lg transition-all active:scale-95 touch-target" title="Imprimir ticket">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>'
      + '</button>'
      + (window.can && window.can('puedeEditarSalidas') ?
        '<button onclick="window.editSale(\'' + s.id + '\')" class="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors touch-target" title="Editar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
        + '</button>' : '')
      + (window.can && window.can('puedeEliminarSalidas') ?
        '<button onclick="window.deleteSale(\'' + s.id + '\')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors touch-target" title="Eliminar">'
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
          presHtml = '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium ml-1">' + escapeHtml(i.unidadPresentacion) + '</span>';
        }
        return '<div class="flex justify-between text-sm">'
          + '<span class="text-slate-600">' + escapeHtml(i.productName) + ' x' + qty + presHtml + '</span>'
          + '</div>';
      }).join('')
      + '</div>'
      + '<div class="flex items-center justify-between pt-2 border-t border-slate-100">'
      + '<div class="flex items-center gap-2 flex-wrap">'
      + '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-800">' + escapeHtml(s.paymentMethod) + '</span>'
      + '<span class="text-xs text-slate-400">' + formatDate(s.createdAt) + '</span>'
      + '<span class="text-xs text-slate-500 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' + escapeHtml(s.usuario_nombre || '') + '</span>'
      + '</div>'
      + '<div class="flex items-center gap-1">'
      + '<button onclick="window.viewSale(\'' + s.id + '\')" class="p-2 text-brand-500 hover:bg-brand-100 rounded-lg transition-colors touch-target" title="Ver">'
      + '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>'
      + '</button>'
      + '<button onclick="window.showTicket(\'' + s.id + '\')" class="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 hover:scale-110 rounded-lg transition-all active:scale-95 touch-target" title="Imprimir">'
      + '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>'
      + '</button>'
      + (window.can && window.can('puedeEditarSalidas') ?
        '<button onclick="window.editSale(\'' + s.id + '\')" class="p-2 text-amber-500 hover:bg-amber-100 rounded-lg transition-colors touch-target" title="Editar">'
        + '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
        + '</button>' : '')
      + (window.can && window.can('puedeEliminarSalidas') ?
        '<button onclick="window.deleteSale(\'' + s.id + '\')" class="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors touch-target" title="Eliminar">'
        + '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
        + '</button>' : '')
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
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
    if (pmEl) pmEl.textContent = sale.paymentMethod;
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

window.deleteSale = async function (id) {
  if (!can('puedeEliminarSalidas')) {
    showToast('No tienes permiso para eliminar salidas', 'error');
    return;
  }
  if (!confirm('¿Eliminar esta salida? El stock se devolvera al inventario.')) return;
  try {
    await API.sales.delete(id);
    showToast('Salida eliminada y stock devuelto', 'success');
    loadSales();
  } catch (err) {
    showToast('Error: ' + (err.message || ''), 'error');
  }
};

window.editSale = async function (id) {
  if (!can('puedeEditarSalidas')) {
    showToast('No tienes permiso para editar salidas', 'error');
    return;
  }
  try {
    var res = await API.sales.get(id);
    var sale = res.data;
    state.editingSaleId = id;
    state.saleDishItems = [];
    state.saleItems = [];
    sale.items.forEach(function (it) {
      if (it.esPlato) {
        state.saleDishItems.push({
          plato_id: it.platoId,
          nombre: it.productName,
          cantidad: it.quantity,
          precioUnitario: it.unitPrice
        });
      } else if (it.productId) {
        state.saleItems.push({
          productId: it.productId,
          productName: it.productName,
          cantidadPresentacion: it.cantidadPresentacion || it.quantity,
          cantidadBase: it.quantity,
          unidadBase: 'unidad',
          unidadPresentacion: it.unidadPresentacion || null,
          unidadPresentacionLabel: it.unidadPresentacion || null,
          factorConversion: it.factorConversion || 1
        });
      }
    });
    var pmEl = $('#salePaymentMethod');
    if (pmEl) pmEl.value = sale.paymentMethod || '';
    var titleEl = document.querySelector('#saleModal h3');
    if (titleEl) titleEl.textContent = 'Editar Pedido #' + sale.id.slice(-6);
    openSaleModal();
  } catch (err) {
    showToast('Error al cargar salida: ' + err.message, 'error');
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
