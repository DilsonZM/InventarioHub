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
      + '  <td class="px-6 py-3">'
      + (r.tipo_pedido === 'domicilio'
        ? '    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">🛵 Domicilio</span>'
          + '<p class="text-xs text-slate-600 mt-1 max-w-[180px] truncate" title="' + escapeHtml(r.direccion_entrega || '') + '">' + escapeHtml(r.direccion_entrega || 'Sin direccion') + '</p>'
          + (r.costo_domicilio > 0 ? '<p class="text-[10px] text-slate-400">Domicilio $' + Number(r.costo_domicilio).toLocaleString('es-CO') + '</p>' : '')
        : '    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">🍽️ Mesa</span>'
          + (r.mesa_nombre ? '<p class="text-xs text-slate-600 mt-1">' + escapeHtml(r.mesa_nombre) + '</p>' : '')
          + (r.personas ? '<p class="text-[10px] text-slate-400">' + r.personas + ' pers.</p>' : ''))
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
    // Cuando confirma una reserva CON items, preguntamos si quiere
    // crear el pedido ya o esperar hasta 1h antes de la hora programada.
    var r = state.reservas.find(function (x) { return x.id === id; });
    var tieneItems = r && r.items && r.items.length > 0;
    var payload = { estado: nuevoEstado };
    if (nuevoEstado === 'confirmada' && tieneItems) {
      var crearYa = await showConfirmarReservaModal(r);
      if (crearYa === null) return; // cancelado
      payload.crear_pedido_inmediato = crearYa;
    }
    await API.reservas.updateEstado(id, payload);
    showToast('Reserva ' + nuevoEstado, 'success');
    loadReservas();
  } catch (err) {
    showToast('Error al cambiar estado', 'error');
  }
}

// Modal custom (no SweetAlert) para elegir si crear pedido inmediato.
// Devuelve true (ya), false (esperar), o null (cancelado).
// Por defecto "Crear pedido ya" viene pre-seleccionado.
function showConfirmarReservaModal(r) {
  return new Promise(function (resolve) {
    var itemsCount = (r.items || []).length;
    var fechaTxt = formatFechaBonita(r.fecha) + ' ' + (r.hora || '').slice(0, 5);
    var isDelivery = r.tipo_pedido === 'domicilio';
    var destinoTxt = isDelivery
      ? '🛵 ' + (r.direccion_entrega || 'Domicilio')
      : (r.mesa_nombre ? '🍽️ ' + r.mesa_nombre : '🍽️ Mesa');

    var modal = document.createElement('div');
    modal.id = 'confirmarReservaModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.style.background = 'rgba(15, 23, 42, 0.55)';
    modal.innerHTML = ''
      + '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">'
      + '  <div class="p-5 sm:p-6">'
      + '    <div class="flex items-center gap-3 mb-4">'
      + '      <div class="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">'
      + '        <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
      + '      </div>'
      + '      <div>'
      + '        <h3 class="text-base font-bold text-slate-800">Confirmar reserva</h3>'
      + '        <p class="text-xs text-slate-500 mt-0.5">' + escapeHtml(r.nombre) + ' &middot; ' + fechaTxt + '</p>'
      + '        <p class="text-[11px] text-brand-600 font-semibold mt-0.5">' + destinoTxt + ' &middot; ' + itemsCount + ' plato' + (itemsCount !== 1 ? 's' : '') + '</p>'
      + '      </div>'
      + '    </div>'
      + '    <p class="text-sm text-slate-600 mb-4">¿Como quieres enviar el pedido a cocina?</p>'
      + '    <div class="space-y-2">'
      + '      <label class="flex items-start gap-3 p-3 border-2 border-emerald-500 bg-emerald-50 rounded-xl cursor-pointer transition-colors" data-opcion="ya">'
      + '        <input type="radio" name="crear_pedido_opcion" value="ya" checked class="mt-1 accent-emerald-600">'
      + '        <div>'
      + '          <p class="text-sm font-bold text-slate-800">Crear pedido ya</p>'
      + '          <p class="text-xs text-slate-500 mt-0.5">Aparece inmediatamente en Pedidos. Recomendado para reservas cercanas.</p>'
      + '        </div>'
      + '      </label>'
      + '      <label class="flex items-start gap-3 p-3 border border-slate-200 hover:border-slate-300 bg-white rounded-xl cursor-pointer transition-colors" data-opcion="esperar">'
      + '        <input type="radio" name="crear_pedido_opcion" value="esperar" class="mt-1 accent-emerald-600">'
      + '        <div>'
      + '          <p class="text-sm font-bold text-slate-800">Esperar hasta 1h antes</p>'
      + '          <p class="text-xs text-slate-500 mt-0.5">El pedido aparecera automaticamente ~60 min antes de la hora programada.</p>'
      + '        </div>'
      + '      </label>'
      + '    </div>'
      + '  </div>'
      + '  <div class="border-t border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-end gap-2">'
      + '    <button data-cancel class="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>'
      + '    <button data-ok class="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm">Confirmar reserva</button>'
      + '  </div>'
      + '</div>';

    document.body.appendChild(modal);

    function cerrar(val) {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      resolve(val);
    }

    modal.querySelectorAll('[data-opcion]').forEach(function (label) {
      label.addEventListener('click', function () {
        modal.querySelectorAll('[data-opcion]').forEach(function (l) {
          l.classList.remove('border-emerald-500', 'bg-emerald-50');
          l.classList.add('border-slate-200', 'bg-white');
          var inp = l.querySelector('input');
          if (inp) inp.checked = false;
        });
        label.classList.remove('border-slate-200', 'bg-white');
        label.classList.add('border-emerald-500', 'bg-emerald-50');
        var inp = label.querySelector('input');
        if (inp) inp.checked = true;
      });
    });

    modal.querySelector('[data-cancel]').addEventListener('click', function () { cerrar(null); });
    modal.querySelector('[data-ok]').addEventListener('click', function () {
      var val = modal.querySelector('input[name="crear_pedido_opcion"]:checked');
      cerrar(val ? val.value === 'ya' : true); // default true si nada marcado
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) cerrar(null);
    });
  });
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
  var isDelivery = r.tipo_pedido === 'domicilio';
  var destinoLine = isDelivery
    ? '🛵 Domicilio · ' + escapeHtml(r.direccion_entrega || 'Sin direccion') + (r.barrio_entrega ? ' · ' + escapeHtml(r.barrio_entrega) : '')
    : (r.mesa_nombre ? '🍽️ Mesa ' + escapeHtml(r.mesa_nombre) : '🍽️ Mesa') + (r.personas ? ' · ' + r.personas + ' pers.' : '');
  var html = ''
    + '<div class="p-5 sm:p-6">'
    + '  <div class="flex items-start justify-between mb-4">'
    + '    <div>'
    + '      <h3 class="text-lg font-bold text-slate-800">' + (isDelivery ? 'Detalle del domicilio' : 'Detalle del pedido') + '</h3>'
    + '      <p class="text-xs text-slate-500 mt-0.5">' + escapeHtml(r.nombre) + ' · ' + formatFechaBonita(r.fecha) + ' ' + (r.hora || '').slice(0, 5) + '</p>'
    + '      <p class="text-xs font-medium ' + (isDelivery ? 'text-amber-700' : 'text-brand-600') + ' mt-0.5">' + destinoLine + '</p>'
    + (isDelivery && r.costo_domicilio > 0 ? '<p class="text-[10px] text-slate-400">Domicilio $' + Number(r.costo_domicilio).toLocaleString('es-CO') + '</p>' : '')
    + '    </div>'
    + '    <button onclick="window.reservaCerrarDetalle()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" aria-label="Cerrar">'
    + '      <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
    + '    </button>'
    + '  </div>';
  if (items.length === 0) {
    html += '<p class="text-sm text-slate-500 text-center py-8">' + (isDelivery ? 'Este domicilio no incluye platos.' : 'Esta reserva no incluye platos (solo mesa).') + '</p>';
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
    var totalLine = r.subtotal_platos || 0;
    if (isDelivery && r.costo_domicilio > 0) {
      html += '<div class="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between">'
        + '  <p class="text-sm text-slate-600 font-medium">Subtotal del pedido</p>'
        + '  <p class="text-base font-extrabold text-slate-800">$' + Number(totalLine).toLocaleString('es-CO') + '</p>'
        + '</div>';
      html += '<div class="flex items-center justify-between">'
        + '  <p class="text-sm text-slate-600 font-medium">Domicilio</p>'
        + '  <p class="text-base font-extrabold text-amber-700">$' + Number(r.costo_domicilio).toLocaleString('es-CO') + '</p>'
        + '</div>';
      totalLine += r.costo_domicilio;
    }
    html += '<div class="mt-2 pt-3 border-t border-slate-200 flex items-center justify-between">'
         + '  <p class="text-sm text-slate-800 font-semibold">Total</p>'
         + '  <p class="text-xl font-extrabold text-brand-600">$' + Number(totalLine).toLocaleString('es-CO') + '</p>'
         + '</div>';
  }
  html += '</div>';
  openModal(html, { wide: false });
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
