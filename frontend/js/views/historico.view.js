// historico.view.js
// Vista de pedidos cerrados: Confirmada (paga), Cortesia y Cancelada.
// Es una vista de auditoria/consulta: por ahora es solo lectura
// (la edicion del historico queda para usuarios con permiso especifico).

import { $, escapeHtml, debounce } from '../core/dom.js';
import { showToast } from '../components/toast.js';
import { formatCurrency, formatDate } from '../utils.js';

var CLOSED_LABELS = { confirmada: 'Confirmada', cortesia: 'Cortesía', cancelada: 'Cancelada' };

var ICON_VIEW = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
var ICON_PRINT = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>';

function initHistorico() {
  var from = document.getElementById('histFilterDateFrom');
  var to = document.getElementById('histFilterDateTo');
  var estado = document.getElementById('histFilterEstado');
  var num = document.getElementById('histFilterNumVenta');
  var clear = document.getElementById('histClearFiltersBtn');

  if (from) from.addEventListener('change', loadHistorico);
  if (to) to.addEventListener('change', loadHistorico);
  if (estado) estado.addEventListener('change', loadHistorico);
  if (num) num.addEventListener('input', debounce(loadHistorico, 300));
  if (clear) {
    clear.addEventListener('click', function () {
      if (from) from.value = '';
      if (to) to.value = '';
      if (estado) estado.value = '';
      if (num) num.value = '';
      loadHistorico();
    });
  }
}

async function loadHistorico() {
  var params = { scope: 'historico' };
  var from = document.getElementById('histFilterDateFrom');
  var to = document.getElementById('histFilterDateTo');
  var estadoSel = document.getElementById('histFilterEstado');
  var num = document.getElementById('histFilterNumVenta');

  if (from && from.value) params.from = from.value;
  if (to && to.value) params.to = to.value;

  try {
    var res = await window.API.sales.list(params);
    var sales = res.data || [];

    // Filtros locales (estado exacto y # de pedido)
    if (estadoSel && estadoSel.value) {
      sales = sales.filter(function (s) { return (s.estadoCocina || '') === estadoSel.value; });
    }
    if (num && num.value.trim()) {
      var needle = num.value.trim().toLowerCase();
      sales = sales.filter(function (s) {
        return (s.numero_venta || '').toLowerCase().indexOf(needle) !== -1;
      });
    }

    renderHistorico(sales);
    updateHistoricoSummary(sales);
  } catch (err) {
    showToast('Error al cargar el histórico', 'error');
  }
}

function historicoDestino(s) {
  if (s.paymentMethod === 'domicilio') return '🛵 Domicilio';
  if (s.paymentMethod === 'recogido') return '🏠 Recoger';
  return s.mesaNombre || (s.mesaId ? 'Mesa ' + s.mesaId.slice(-4) : '—');
}

function historicoBadge(estado) {
  var styles = {
    confirmada: 'bg-emerald-100 text-emerald-800',
    cortesia: 'bg-amber-100 text-amber-800',
    cancelada: 'bg-rose-100 text-rose-800'
  };
  return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold '
    + (styles[estado] || 'bg-slate-100 text-slate-600') + '">'
    + (CLOSED_LABELS[estado] || estado) + '</span>';
}

function historicoItemsHtml(s, compact) {
  return s.items.map(function (i) {
    var qty = i.unidadPresentacion && i.factorConversion !== 1 ? i.cantidadPresentacion : i.quantity;
    var obs = i.observacion
      ? '<div class="text-[11px] text-amber-600' + (compact ? '' : ' mb-0.5') + '">&#128221; ' + escapeHtml(i.observacion) + '</div>'
      : '';
    return '<div class="text-sm ' + (compact ? 'text-slate-600' : 'text-slate-700 mb-0.5') + '">'
      + escapeHtml(i.productName) + ' x' + qty + '</div>' + obs;
  }).join('');
}

function renderHistorico(sales) {
  var tbody = document.getElementById('historicoTable');
  var cards = document.getElementById('historicoCards');
  if (!tbody || !cards) return;

  if (sales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-16 text-center text-sm text-slate-400">No hay pedidos cerrados con esos filtros</td></tr>';
    cards.innerHTML = '<p class="text-center text-sm text-slate-400 py-10">No hay pedidos cerrados con esos filtros</p>';
    return;
  }

  tbody.innerHTML = sales.map(function (s) {
    var estado = s.estadoCocina || '';
    return '<tr class="hover:bg-slate-50 transition-colors">'
      + '<td class="px-6 py-4 text-sm font-mono text-slate-600">' + escapeHtml(s.numero_venta || s.id.slice(-6)) + '</td>'
      + '<td class="px-6 py-4 text-sm text-slate-700">' + escapeHtml(historicoDestino(s)) + '</td>'
      + '<td class="px-6 py-4">' + historicoItemsHtml(s, false) + '</td>'
      + '<td class="px-6 py-4 text-sm font-semibold text-slate-800 text-right">' + Utils.formatCurrency(s.total) + '</td>'
      + '<td class="px-6 py-4 text-sm text-slate-700">' + escapeHtml(s.usuario_nombre || s.username || 'Desconocido') + '</td>'
      + '<td class="px-6 py-4 text-center">' + historicoBadge(estado) + '</td>'
      + '<td class="px-6 py-4 text-xs text-slate-500 max-w-[180px]">' + (s.motivoCierre ? escapeHtml(s.motivoCierre) : '—') + '</td>'
      + '<td class="px-6 py-4 text-sm text-slate-500">' + (s.cerradoEn ? formatDate(s.cerradoEn) : formatDate(s.createdAt)) + '</td>'
      + '<td class="px-6 py-4 text-right">'
      + '<div class="flex items-center justify-end gap-1.5">'
      + '<button onclick="window.viewSale(\'' + s.id + '\')" class="pedido-action-btn action-view" title="Ver detalle">' + ICON_VIEW + '</button>'
      + '<button onclick="window.showTicket(\'' + s.id + '\')" class="pedido-action-btn action-print" title="Imprimir ticket">' + ICON_PRINT + '</button>'
      + '</div>'
      + '</td>'
      + '</tr>';
  }).join('');

  cards.innerHTML = sales.map(function (s) {
    var estado = s.estadoCocina || '';
    return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">'
      + '<div class="flex items-center justify-between">'
      + '<span class="font-mono text-sm text-slate-500">' + escapeHtml(s.numero_venta || ('#' + s.id.slice(-6))) + '</span>'
      + historicoBadge(estado)
      + '</div>'
      + '<div class="space-y-1">' + historicoItemsHtml(s, true) + '</div>'
      + (s.motivoCierre ? '<p class="text-[11px] text-rose-600">Motivo: ' + escapeHtml(s.motivoCierre) + '</p>' : '')
      + '<div class="flex items-center justify-between pt-2 border-t border-slate-100">'
      + '<div class="flex items-center gap-2 flex-wrap">'
      + '<span class="text-xs text-slate-400">' + (s.cerradoEn ? formatDate(s.cerradoEn) : formatDate(s.createdAt)) + '</span>'
      + '<span class="text-xs text-slate-500">' + escapeHtml(historicoDestino(s)) + '</span>'
      + '<span class="text-sm font-semibold text-slate-800">' + Utils.formatCurrency(s.total) + '</span>'
      + '</div>'
      + '<div class="flex items-center gap-1.5">'
      + '<button onclick="window.viewSale(\'' + s.id + '\')" class="pedido-action-btn action-view" title="Ver">' + ICON_VIEW + '</button>'
      + '<button onclick="window.showTicket(\'' + s.id + '\')" class="pedido-action-btn action-print" title="Imprimir">' + ICON_PRINT + '</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

function updateHistoricoSummary(sales) {
  var conf = 0, cort = 0, canc = 0, facturado = 0;
  sales.forEach(function (s) {
    var estado = s.estadoCocina || '';
    if (estado === 'confirmada') { conf++; facturado += parseFloat(s.total) || 0; }
    else if (estado === 'cortesia') { cort++; }
    else if (estado === 'cancelada') { canc++; }
  });
  var elConf = document.getElementById('histSummaryConfirmadas');
  var elCort = document.getElementById('histSummaryCortesias');
  var elCanc = document.getElementById('histSummaryCanceladas');
  var elFact = document.getElementById('histSummaryFacturado');
  if (elConf) elConf.textContent = conf;
  if (elCort) elCort.textContent = cort;
  if (elCanc) elCanc.textContent = canc;
  if (elFact) elFact.textContent = formatCurrency(facturado);
}

if (typeof window !== 'undefined') {
  window.initHistorico = initHistorico;
  window.loadHistorico = loadHistorico;
}
