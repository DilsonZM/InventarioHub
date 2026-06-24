import { $, escapeHtml } from '../core/dom.js';
import { updateClearBtn, initFilters } from '../components/filters.js';
import { formatDate } from '../utils.js';
import { store } from '../core/store.js';

// movements.view.js
// Vista extraida de app.js en el Sub-paso 3.4 (views).

function initMovimientos() {
  initFilters('movimientos');
}

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
      var tipoBadge = m.movimiento === 'entrada' ? '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 movimiento-badge">Entrada</span>'
        : m.movimiento === 'salida' ? '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 movimiento-badge">Salida</span>'
        : '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 movimiento-badge">Ajuste</span>';
      var unidad = m.unidad || '';
      return '<tr class="hover:bg-slate-50 transition-colors">'
        + '<td class="px-6 py-3 text-sm text-slate-600">' + formatDate(m.fecha) + '</td>'
        + '<td class="px-6 py-3">' + tipoBadge + '</td>'
        + '<td class="px-6 py-3 text-sm text-slate-700">' + escapeHtml(m.producto) + '</td>'
        + '<td class="px-6 py-3 text-sm font-mono text-center text-slate-500">' + escapeHtml(m.codigo) + '</td>'
        + '<td class="px-6 py-3 text-sm text-center text-brand-600 font-medium">' + (m.cantidad_entrada ? m.cantidad_entrada + ' <span class=\"text-xs text-slate-400\">' + escapeHtml(unidad) + '</span>' : '-') + '</td>'
        + '<td class="px-6 py-3 text-sm text-center text-red-600 font-medium">' + (m.cantidad_salida ? m.cantidad_salida + ' <span class=\"text-xs text-slate-400\">' + escapeHtml(unidad) + '</span>' : '-') + '</td>'
        + '<td class="px-6 py-3 text-sm text-center font-semibold">' + (m.cantidad_stock != null ? m.cantidad_stock + ' <span class=\"text-xs text-slate-400\">' + escapeHtml(unidad) + '</span>' : '-') + '</td>'
        + '<td class="px-6 py-3 text-sm text-slate-600"><div class="flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' + escapeHtml(m.usuario_nombre || '') + '</div></td>'
        + '</tr>';
    }).join('');

    cards.innerHTML = movs.map(function (m) {
      var unidad = m.unidad || '';
      return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-2">'
        + '<div class="flex justify-between"><span class="text-xs text-slate-500">' + formatDate(m.fecha) + '</span>'
        + (m.movimiento === 'entrada' ? '<span class="text-green-600 text-sm font-bold">+ ' + m.cantidad_entrada + ' ' + escapeHtml(unidad) + '</span>' : m.movimiento === 'salida' ? '<span class="text-red-600 text-sm font-bold">- ' + m.cantidad_salida + ' ' + escapeHtml(unidad) + '</span>' : '<span class="text-amber-600 text-sm font-bold">Ajuste</span>')
        + '</div>'
        + '<p class="text-sm font-medium">' + escapeHtml(m.producto) + '</p>'
        + '<div class="flex justify-between text-xs text-slate-500"><span>' + escapeHtml(m.codigo) + '</span><span>Stock: ' + (m.cantidad_stock != null ? m.cantidad_stock + ' ' + escapeHtml(unidad) : '-') + '</span></div>'
        + '<div class="flex items-center gap-1.5 text-xs text-slate-500"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>' + escapeHtml(m.usuario_nombre || '') + '</div>'
        + '</div>';
    }).join('');
  } catch (err) {
    showToast('Error al cargar movimientos', 'error');
  }
}



// Compatibilidad con codigo heredado (window.*)
if (typeof window !== "undefined") {
  if (typeof initMovimientos === "function") window.initMovimientos = initMovimientos;
  if (typeof loadMovimientos === "function") window.loadMovimientos = loadMovimientos;
}
