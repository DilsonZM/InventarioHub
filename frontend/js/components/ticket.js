// components/ticket.js
// Renderizado del ticket de venta/impresion y helpers asociados.
// Antes: renderTicketFromData() en app.js.

import { $ } from '../core/dom.js';
import { openModal } from './modal.js';
import { store } from '../core/store.js';
import { escapeHtml } from '../core/dom.js';

export function renderTicketFromData(sale, includeTip) {
  if (!sale) return;
  $('#ticketNumber').textContent = (sale.numero_venta || '');
  $('#ticketCocina').textContent = (sale.paymentMethod || '');
  $('#ticketFecha').textContent = window.Utils.formatDate(sale.createdAt);
  $('#ticketBarcode').textContent = '*' + (sale.numero_venta || '') + '*';

  var items = sale.items || [];
  var subtotal = 0;
  $('#ticketItems').innerHTML = items.map(function (item) {
    var sub = item.subtotal || ((item.unitPrice || 0) * (item.quantity || 0));
    subtotal += sub;
    return '<div class="flex items-center justify-between text-[13px]">'
      + '<span class="text-slate-700">' + escapeHtml(item.productName) + ' x' + item.quantity + '</span>'
      + '<span class="text-slate-700 font-mono">' + window.Utils.formatCurrency(sub) + '</span>'
      + '</div>';
  }).join('');

  var tip = includeTip !== false ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
  var totalConPropina = subtotal + tip;

  $('#ticketSubtotal').textContent = window.Utils.formatCurrency(subtotal);
  var tipRow = document.querySelector('#ticketTip') && document.querySelector('#ticketTip').parentElement;
  if (tipRow) tipRow.style.display = tip > 0 ? '' : 'none';
  $('#ticketTip').textContent = window.Utils.formatCurrency(tip);
  $('#ticketTotal').textContent = window.Utils.formatCurrency(totalConPropina);

  openModal('ticketModal');
  store.state._lastTicketSale = sale;
  if (typeof window !== 'undefined') window._lastTicketSale = sale;

  // Ajustar visibilidad de los botones del modal segun printer_kind
  if (typeof window.configureTicketButtons === 'function') {
    setTimeout(window.configureTicketButtons, 0);
  }
}

// Compatibilidad
if (typeof window !== 'undefined') {
  window.renderTicketFromData = renderTicketFromData;
}
