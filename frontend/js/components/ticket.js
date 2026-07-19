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

  $('#ticketSubtotal').textContent = window.Utils.formatCurrency(subtotal);

  // Rellenar campos de pago con datos reales de la venta
  var formaEl = document.getElementById('ticketFormaPago');
  var propEl = document.getElementById('ticketPropina');
  var bonoEl = document.getElementById('ticketBono');
  if (formaEl) formaEl.value = sale.formaPago || sale.forma_pago || '';
  if (propEl) propEl.value = sale.propina || '';
  if (bonoEl) bonoEl.value = sale.bonoDescuento || sale.bono_descuento || '';

  // Guardar referencia de la venta para el boton guardar
  store.state._lastTicketSale = sale;
  if (typeof window !== 'undefined') window._lastTicketSale = sale;
  // Guardar subtotal para recalculo
  if (typeof window !== 'undefined') window._ticketSubtotal = subtotal;

  // Recalcular total con los valores actuales
  updateTicketTotal();

  // Mostrar boton guardar solo si la venta ya esta persistida (tiene numero_venta)
  var saveBtn = document.getElementById('ticketSavePaymentBtn');
  if (saveBtn) {
    if (sale.id && sale.numero_venta && window.can && window.can('puedeEditarSalidas')) {
      saveBtn.classList.remove('hidden');
    } else {
      saveBtn.classList.add('hidden');
    }
  }

  // Wire inputs para recalcular total en vivo
  ['ticketPropina', 'ticketBono'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.removeEventListener('input', updateTicketTotal);
      el.addEventListener('input', updateTicketTotal);
    }
  });

  openModal('ticketModal');

  // Ajustar visibilidad de los botones del modal segun printer_kind
  if (typeof window.configureTicketButtons === 'function') {
    setTimeout(window.configureTicketButtons, 0);
  }
}

function updateTicketTotal() {
  var subtotal = window._ticketSubtotal || 0;
  var bono = parseFloat((document.getElementById('ticketBono') || {}).value) || 0;
  var propina = parseFloat((document.getElementById('ticketPropina') || {}).value) || 0;
  var total = subtotal - bono + propina;
  var totalEl = document.getElementById('ticketTotal');
  if (totalEl) totalEl.textContent = window.Utils.formatCurrency(total);
}

// Guardar ajustes de pago desde el ticket
window.ticketSavePayment = async function () {
  var sale = window._lastTicketSale;
  if (!sale || !sale.id) { window.showToast && window.showToast('No hay pedido activo', 'error'); return; }

  var formaPago = (document.getElementById('ticketFormaPago') || {}).value || null;
  var propina = parseFloat((document.getElementById('ticketPropina') || {}).value) || 0;
  var bono = parseFloat((document.getElementById('ticketBono') || {}).value) || 0;

  try {
    var API = window.API;
    var res = await API.sales.updatePayment(sale.id, { formaPago: formaPago, propina: propina, bonoDescuento: bono });
    if (res.success) {
      // Actualizar la venta en memoria para que impresion use datos nuevos
      if (window._lastTicketSale) {
        window._lastTicketSale.formaPago = res.data.formaPago;
        window._lastTicketSale.propina = res.data.propina;
        window._lastTicketSale.bonoDescuento = res.data.bonoDescuento;
        window._lastTicketSale.total = res.data.total;
      }
      // Refrescar el detalle de salida SOLO si ya esta abierto (no abrirlo)
      var detailEl = document.getElementById('saleDetailModal');
      if (detailEl && !detailEl.classList.contains('hidden') && typeof window.viewSale === 'function') {
        window.viewSale(sale.id);
      }
      window.showToast && window.showToast('Pago actualizado', 'success');
    } else {
      window.showToast && window.showToast(res.message || 'Error', 'error');
    }
  } catch (err) {
    window.showToast && window.showToast(err.message || 'Error', 'error');
  }
};

// Compatibilidad
if (typeof window !== 'undefined') {
  window.renderTicketFromData = renderTicketFromData;
}
