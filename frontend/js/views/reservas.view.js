// reservas.view.js
// Vista admin de gestion de reservas. Lista, filtra, cambia estado,
// ver detalle con items del pedido.

import { $, escapeHtml, debounce } from '../core/dom.js';
import { showToast } from '../components/toast.js';
import { showConfirm, openModal, closeModal } from '../components/modal.js';

var state = {
  reservas: [],
  filterEstado: '',
  filterFecha: '',
  filterSearch: ''
};

function initReservas() {
  var elEstado = $('#filterReservaEstado');
  var elFecha = $('#filterReservaFecha');
  var elSearch = $('#filterReservaSearch');
  if (elEstado) elEstado.addEventListener('change', function () { state.filterEstado = this.value; loadReservas(); });
  if (elFecha) elFecha.addEventListener('change', function () { state.filterFecha = this.value; loadReservas(); });
  if (elSearch) elSearch.addEventListener('input', debounce(function () { state.filterSearch = this.value.trim().toLowerCase(); renderReservas(); }, 250));
}

async function loadReservas() {
  var tbody = $('#reservasTable');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center text-sm text-slate-400">Cargando reservas...</td></tr>';
  try {
    var params = {};
    if (state.filterEstado) params.estado = state.filterEstado;
    if (state.filterFecha) params.fecha = state.filterFecha;
    var res = await API.reservas.list(params);
    state.reservas = res.data || [];
    if (res.stats) updateReservasSummary(res.stats);
    renderReservas();
  } catch (err) {
    console.error('Error cargando reservas:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center text-sm text-rose-500">Error al cargar reservas</td></tr>';
  }
}

function updateReservasSummary(stats) {
  setText('resumenReservasPendientes', stats.pendientes || 0);
  setText('resumenReservasConfirmadas', stats.confirmadas || 0);
  setText('resumenReservasTotal', stats.total || 0);
  setText('resumenReservasConItems', stats.con_items || 0);
  setText('resumenReservasPlatos', stats.total_platos || 0);
}
function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

function renderReservas() {
  var tbody = $('#reservasTable');
  if (!tbody) return;

  var filtradas = state.reservas;
  if (state.filterSearch) {
    filtradas = filtradas.filter(function (r) {
      return (r.nombre || '').toLowerCase().indexOf(state.filterSearch) !== -1
          || (r.telefono || '').toLowerCase().indexOf(state.filterSearch) !== -1
          || (r.email || '').toLowerCase().indexOf(state.filterSearch) !== -1;
    });
  }

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-12 text-center text-sm text-slate-400">No hay reservas que coincidan con los filtros</td></tr>';
    return;
  }

  tbody.innerHTML = filtradas.map(function (r) {
    var estadoBadge = {
      pendiente:  '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Pendiente</span>',
      confirmada: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Confirmada</span>',
      completada: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">Completada</span>',
      cancelada:  '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">Cancelada</span>'
    }[r.estado] || r.estado;

    var acciones = '';
    if (r.estado === 'pendiente') {
      acciones += '<button onclick="window.reservaAccion(\'' + r.id + '\', \'confirmada\')" class="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors">Confirmar</button> ';
    }
    if (r.estado === 'confirmada') {
      acciones += '<button onclick="window.reservaAccion(\'' + r.id + '\', \'completada\')" class="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-medium transition-colors">Completar</button> ';
    }
    if (r.estado === 'pendiente' || r.estado === 'confirmada') {
      acciones += '<button onclick="window.reservaAccion(\'' + r.id + '\', \'cancelada\')" class="text-xs px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors">Cancelar</button> ';
    }
    acciones += '<button onclick="window.reservaEliminar(\'' + r.id + '\')" class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors">Eliminar</button>';

    var fechaBonita = formatFechaBonita(r.fecha);
    var itemsHtml = '';
    if (r.items && r.items.length > 0) {
      var itemsList = r.items.slice(0, 2).map(function (i) {
        return '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-brand-50 text-brand-800 text-[10px] font-semibold rounded">' + i.cantidad + 'x ' + escapeHtml(i.plato_nombre) + '</span>';
      }).join(' ');
      var mas = r.items.length > 2 ? ' <span class="text-[10px] text-slate-400 font-medium">+' + (r.items.length - 2) + '</span>' : '';
      itemsHtml = '<div class="flex flex-wrap items-center gap-1 mt-0.5">' + itemsList + mas + '</div>';
    }
    var subtotalPlatosTxt = (r.subtotal_platos && r.subtotal_platos > 0)
      ? '<span class="text-xs font-bold text-brand-600">$' + Number(r.subtotal_platos).toLocaleString('es-CO') + '</span>'
      : '<span class="text-xs text-slate-300">—</span>';
    var contactLine = '<a href="https://wa.me/' + escapeHtml((r.telefono || '').replace(/[^0-9]/g, '')) + '" target="_blank" class="text-sm text-emerald-600 hover:text-emerald-800 font-medium">' + escapeHtml(r.telefono) + '</a>';
    if (r.email) contactLine += '<p class="text-[10px] text-slate-400">' + escapeHtml(r.email) + '</p>';

    return ''
      + '<tr class="hover:bg-slate-50 transition-colors">'
      + '  <td class="px-6 py-3">'
      + '    <p class="text-sm font-semibold text-slate-800">' + escapeHtml(r.nombre) + '</p>'
      + (r.usuario_id ? '<p class="text-[10px] text-slate-400 mt-0.5">ID: ' + r.id.slice(-6) + '</p>' : '<p class="text-[10px] text-slate-400 mt-0.5">Anonima</p>')
      + '  </td>'
      + '  <td class="px-6 py-3">' + contactLine + '</td>'
      + '  <td class="px-6 py-3">'
      + '    <p class="text-sm text-slate-800 font-medium">' + fechaBonita + '</p>'
      + '    <p class="text-xs text-slate-500">' + (r.hora || '').slice(0, 5) + '</p>'
      + '  </td>'
      + '  <td class="px-6 py-3 text-center">'
      + '    <span class="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">' + r.personas + '</span>'
      + '  </td>'
      + '  <td class="px-6 py-3">'
      + '    ' + estadoBadge
      + (r.items_count > 0 ? '    <button onclick="window.reservaVerItems(\'' + r.id + '\')" class="ml-1 mt-1 text-[10px] text-brand-600 hover:text-brand-800 font-semibold underline">Ver pedido</button>' : '')
      + '  </td>'
      + '  <td class="px-6 py-3">'
      + '    ' + subtotalPlatosTxt
      +     itemsHtml
      + '  </td>'
      + '  <td class="px-6 py-3">'
      + (r.notas ? '<p class="text-xs text-slate-600 max-w-xs truncate" title="' + escapeHtml(r.notas) + '">' + escapeHtml(r.notas) + '</p>' : '<span class="text-xs text-slate-300">—</span>')
      + '  </td>'
      + '  <td class="px-6 py-3"><div class="flex flex-wrap gap-1 justify-end">' + acciones + '</div></td>'
      + '</tr>';
  }).join('');
}

function formatFechaBonita(yyyy_mm_dd) {
  var parts = String(yyyy_mm_dd).split('-');
  if (parts.length !== 3) return yyyy_mm_dd;
  var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  var meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return d.getDate() + ' ' + meses[d.getMonth()];
}

async function reservaAccion(id, nuevoEstado) {
  try {
    await API.reservas.updateEstado(id, nuevoEstado);
    showToast('Reserva ' + nuevoEstado, 'success');
    loadReservas();
  } catch (err) {
    showToast('Error al cambiar estado', 'error');
  }
}

async function reservaEliminar(id) {
  var ok = await showConfirm('Eliminar reserva', 'Esta accion no se puede deshacer. Eliminar la reserva?');
  if (!ok) return;
  try {
    await API.reservas.delete(id);
    showToast('Reserva eliminada', 'success');
    loadReservas();
  } catch (err) {
    showToast('Error al eliminar', 'error');
  }
}

function reservaVerItems(id) {
  var r = state.reservas.find(function (x) { return x.id === id; });
  if (!r) return;
  var items = r.items || [];
  var html = ''
    + '<div class="p-5 sm:p-6">'
    + '  <div class="flex items-start justify-between mb-4">'
    + '    <div>'
    + '      <h3 class="text-lg font-bold text-slate-800">Detalle del pedido</h3>'
    + '      <p class="text-xs text-slate-500 mt-0.5">' + escapeHtml(r.nombre) + ' · ' + formatFechaBonita(r.fecha) + ' ' + (r.hora || '').slice(0, 5) + ' · ' + r.personas + ' pers.</p>'
    + '    </div>'
    + '    <button onclick="window.reservaCerrarDetalle()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" aria-label="Cerrar">'
    + '      <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
    + '    </button>'
    + '  </div>';
  if (items.length === 0) {
    html += '<p class="text-sm text-slate-500 text-center py-8">Esta reserva no incluye platos (solo mesa).</p>';
  } else {
    html += '<div class="space-y-2">';
    items.forEach(function (i) {
      var precio = parseFloat(i.precio_unitario);
      var sub = parseFloat(i.subtotal);
      html += ''
        + '<div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">'
        + '  <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center text-xl flex-shrink-0">🍽️</div>'
        + '  <div class="flex-1 min-w-0">'
        + '    <p class="text-sm font-semibold text-slate-800 truncate">' + escapeHtml(i.plato_nombre) + '</p>'
        + '    <p class="text-xs text-slate-500">' + i.cantidad + ' x $' + precio.toLocaleString('es-CO') + '</p>'
        + (i.notas ? '<p class="text-[10px] text-amber-600 mt-0.5">Nota: ' + escapeHtml(i.notas) + '</p>' : '')
        + '  </div>'
        + '  <p class="text-sm font-bold text-brand-600">$' + sub.toLocaleString('es-CO') + '</p>'
        + '</div>';
    });
    html += '</div>';
    html += '<div class="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">'
         + '  <p class="text-sm text-slate-600 font-medium">Subtotal del pedido</p>'
         + '  <p class="text-xl font-extrabold text-brand-600">$' + Number(r.subtotal_platos || 0).toLocaleString('es-CO') + '</p>'
         + '</div>';
  }
  html += '</div>';
  openModal(html, { wide: false });
  // Guardar referencia al modal para cerrar
  window._lastReservaModal = true;
}

function reservaCerrarDetalle() {
  closeModal();
}

if (typeof window !== 'undefined') {
  window.initReservas = initReservas;
  window.loadReservas = loadReservas;
  window.reservaAccion = reservaAccion;
  window.reservaEliminar = reservaEliminar;
  window.reservaVerItems = reservaVerItems;
  window.reservaCerrarDetalle = reservaCerrarDetalle;
}

export { initReservas, loadReservas };
