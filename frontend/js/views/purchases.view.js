import { $, escapeHtml } from '../core/dom.js';
import { updateClearBtn, initFilters } from '../components/filters.js';
import { openModal, closeModal, showError, markCompraDirty } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { formatCurrency } from '../utils.js';
import { store } from '../core/store.js';

// purchases.view.js
// Vista extraida de app.js en el Sub-paso 3.4 (views).

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
      var cantHtml = c.cantidad + ' <span class=\"text-xs text-slate-400\">' + escapeHtml(c.producto_unidad || 'unid') + '</span>';
      if (c.cantidad_presentacion && c.factor_conversion && c.factor_conversion !== 1) {
        cantHtml = c.cantidad_presentacion + ' <span class=\"inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium\">' + escapeHtml(c.unidad_presentacion || '') + '</span>'
          + ' <span class=\"text-xs text-slate-400\">= ' + c.cantidad + ' ' + escapeHtml(c.producto_unidad || 'unid') + '</span>';
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
          '<button onclick="window.editCompra(\'' + c.id + '\')" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors touch-target" title="Editar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
          + '</button>' : '')
        + (window.can && window.can('puedeEliminarEntradas') ?
          '<button onclick="window.deleteCompra(\'' + c.id + '\')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors touch-target" title="Eliminar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
          + '</button>' : '')
        + '</div>'
        + '</td>'
        + '</tr>';
    }).join('');

    cards.innerHTML = compras.map(function (c) {
      var cantHtml = c.cantidad + ' ' + escapeHtml(c.producto_unidad || 'unid');
      if (c.cantidad_presentacion && c.factor_conversion && c.factor_conversion !== 1) {
        cantHtml = c.cantidad_presentacion + ' ' + escapeHtml(c.unidad_presentacion || '') + ' = ' + c.cantidad + ' ' + escapeHtml(c.producto_unidad || 'unid');
      }
      var actionsHtml = '<div class="flex items-center gap-1">'
        + (window.can && window.can('puedeEditarEntradas') ?
          '<button onclick="window.editCompra(\'' + c.id + '\')" class="p-1.5 text-amber-500 hover:bg-amber-100 rounded-lg transition-colors touch-target" title="Editar">'
          + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
          + '</button>' : '')
        + (window.can && window.can('puedeEliminarEntradas') ?
          '<button onclick="window.deleteCompra(\'' + c.id + '\')" class="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors touch-target" title="Eliminar">'
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



// Handlers expuestos en window (compatibilidad con onclick inline)
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
}

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
}


// Handler del submit del formulario de compra
async function saveCompra(e) {
  e.preventDefault();
  var id = state.editingCompraId;
  var presentacion = $('#compraUnidadPresentacion').value || null;
  var cantidad = parseFloat($('#compraCantidad').value) || 0;
  var factor = 1;
  if (presentacion) {
    var opt = $('#compraUnidadPresentacion').options[$('#compraUnidadPresentacion').selectedIndex];
    factor = parseFloat(opt.dataset.factor) || 1;
  }
  var valorUnitario = parseFloat($('#compraValor').value) || 0;
  var payload = {
    fecha: $('#compraFecha').value || null,
    producto_id: $('#compraProducto').value,
    cantidad: cantidad,
    cantidad_presentacion: presentacion ? cantidad : null,
    unidad_presentacion: presentacion,
    factor_conversion: factor,
    valor_unitario: valorUnitario
  };
  var btn = $('#compraForm button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Registrando...'; }
  try {
    if (id) {
      await window.ServicesPurchases.update(id, payload);
      window.showToast('Entrada actualizada correctamente');
    } else {
      await window.ServicesPurchases.create(payload);
      window.showToast('Entrada registrada correctamente');
    }
    window.closeModal('compraModal');
    window.loadCompras();
  } catch (err) {
    window.showError('compraFormError', err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Registrar Entrada'; }
  }
}

if (typeof document !== 'undefined') {
  var compraForm = document.getElementById('compraForm');
  if (compraForm) compraForm.addEventListener('submit', saveCompra);
}


// Compatibilidad con codigo heredado (window.*)
if (typeof window !== "undefined") {
  if (typeof initCompras === "function") window.initCompras = initCompras;
  if (typeof loadCompras === "function") window.loadCompras = loadCompras;
  if (typeof openCompraModal === "function") window.openCompraModal = openCompraModal;
  if (typeof updateCompraConversionPreview === "function") window.updateCompraConversionPreview = updateCompraConversionPreview;
  if (typeof updateCompraTotal === "function") window.updateCompraTotal = updateCompraTotal;
  if (typeof saveCompra === "function") window.saveCompra = saveCompra;
  if (typeof editCompra === "function") window.editCompra = editCompra;
  if (typeof deleteCompra === "function") window.deleteCompra = deleteCompra;
}
