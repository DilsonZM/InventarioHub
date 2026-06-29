// reservas.view.js
// Vista admin de gestion de reservas. Lista, filtra, cambia estado
// (confirmar/cancelar/completar) y permite ver detalle de cada reserva.

import { $, escapeHtml, debounce } from '../core/dom.js';
import { showToast } from '../components/toast.js';
import { showConfirm } from '../components/modal.js';

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
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-sm text-slate-400">Cargando reservas...</td></tr>';
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
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-sm text-rose-500">Error al cargar reservas</td></tr>';
  }
}

function updateReservasSummary(stats) {
  var s = $('resumenReservasPendientes'); if (s) s.textContent = stats.pendientes || 0;
  var s = $('resumenReservasConfirmadas'); if (s) s.textContent = stats.confirmadas || 0;
  var s = $('resumenReservasHoy'); if (s) s.textContent = stats.hoy || 0;
  var s = $('resumenReservasTotal'); if (s) s.textContent = stats.total || 0;
}

function renderReservas() {
  var tbody = $('#reservasTable');
  if (!tbody) return;

  var filtradas = state.reservas;
  if (state.filterSearch) {
    filtradas = filtradas.filter(function (r) {
      return (r.nombre || '').toLowerCase().indexOf(state.filterSearch) !== -1
          || (r.telefono || '').toLowerCase().indexOf(state.filterSearch) !== -1;
    });
  }

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-12 text-center text-sm text-slate-400">No hay reservas que coincidan con los filtros</td></tr>';
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
      acciones += '<button onclick="window.reservaAccion(\'' + r.id + '\', \'confirmada\')" class="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors" title="Confirmar reserva">Confirmar</button> ';
    }
    if (r.estado === 'confirmada') {
      acciones += '<button onclick="window.reservaAccion(\'' + r.id + '\', \'completada\')" class="text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-medium transition-colors" title="Marcar como completada">Completar</button> ';
    }
    if (r.estado === 'pendiente' || r.estado === 'confirmada') {
      acciones += '<button onclick="window.reservaAccion(\'' + r.id + '\', \'cancelada\')" class="text-xs px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors" title="Cancelar reserva">Cancelar</button> ';
    }
    acciones += '<button onclick="window.reservaEliminar(\'' + r.id + '\')" class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors" title="Eliminar">Eliminar</button>';

    var fechaBonita = formatFechaBonita(r.fecha);

    return ''
      + '<tr class="hover:bg-slate-50 transition-colors">'
      + '  <td class="px-6 py-3">'
      + '    <p class="text-sm font-semibold text-slate-800">' + escapeHtml(r.nombre) + '</p>'
      + (r.usuario_id ? '<p class="text-[10px] text-slate-400 mt-0.5">ID: ' + r.id.slice(-6) + '</p>' : '')
      + '  </td>'
      + '  <td class="px-6 py-3">'
      + '    <a href="https://wa.me/' + escapeHtml((r.telefono || '').replace(/[^0-9]/g, '')) + '" target="_blank" class="text-sm text-emerald-600 hover:text-emerald-800 font-medium">' + escapeHtml(r.telefono) + '</a>'
      + '  </td>'
      + '  <td class="px-6 py-3">'
      + '    <p class="text-sm text-slate-800 font-medium">' + fechaBonita + '</p>'
      + '    <p class="text-xs text-slate-500">' + (r.hora || '').slice(0, 5) + '</p>'
      + '  </td>'
      + '  <td class="px-6 py-3 text-center">'
      + '    <span class="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">' + r.personas + '</span>'
      + '  </td>'
      + '  <td class="px-6 py-3">' + estadoBadge + '</td>'
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

// Exponer en window para handlers inline
if (typeof window !== 'undefined') {
  window.initReservas = initReservas;
  window.loadReservas = loadReservas;
  window.reservaAccion = reservaAccion;
  window.reservaEliminar = reservaEliminar;
}

export { initReservas, loadReservas };
