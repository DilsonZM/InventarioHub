// views/finanzas.view.js
// Modulo Finanzas: informe contable (ingresos, costos, compras, mermas,
// gastos operativos y resultados) + gestion de gastos.
// Acceso: permiso finance.gastos.

import { $, escapeHtml } from '../core/dom.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal, showConfirm } from '../components/modal.js';
import { formatCurrency } from '../utils.js';

var CATS = ['arriendo', 'servicios', 'nomina', 'transporte', 'mantenimiento', 'otros'];
var CAT_LABELS = {
  arriendo: 'Arriendo', servicios: 'Servicios', nomina: 'Nómina',
  transporte: 'Transporte', mantenimiento: 'Mantenimiento', otros: 'Otros'
};

var state = { summary: null, gastos: [] };

function fmtDate(dt) {
  var y = dt.getFullYear();
  var m = String(dt.getMonth() + 1).padStart(2, '0');
  var d = String(dt.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function periodRange(period) {
  var hoy = new Date();
  var y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
  switch (period) {
    case 'today': return { from: fmtDate(hoy), to: fmtDate(hoy) };
    case 'week': {
      var day = (hoy.getDay() + 6) % 7; // lunes = 0
      return { from: fmtDate(new Date(y, m, d - day)), to: fmtDate(hoy) };
    }
    case 'month': return { from: fmtDate(new Date(y, m, 1)), to: fmtDate(hoy) };
    case 'quarter': {
      var qm = Math.floor(m / 3) * 3;
      return { from: fmtDate(new Date(y, qm, 1)), to: fmtDate(hoy) };
    }
    case 'year': return { from: fmtDate(new Date(y, 0, 1)), to: fmtDate(hoy) };
    default: return null;
  }
}

function initFinanzas() {
  // RBAC: el modulo puede verse con finance.view (informe) y/o
  // finance.gastos (registrar gastos). Se oculta lo que no corresponda.
  var hasReport = window.can('finance.view');
  var hasGastos = window.can('finance.gastos');
  if (!hasReport) {
    ['finFilters', 'finKpis', 'finResult'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }
  if (!hasGastos) {
    var gastosSection = document.getElementById('finGastosSection');
    if (gastosSection) gastosSection.classList.add('hidden');
  }

  var applyBtn = $('#finApplyBtn');
  if (applyBtn) applyBtn.addEventListener('click', loadFinanzas);
  var exportBtn = $('#finExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportFinancePdf);
  var newBtn = $('#finNewGastoBtn');
  if (newBtn) newBtn.addEventListener('click', function () { openGastoModal(); });
  var form = $('#gastoForm');
  if (form) form.addEventListener('submit', saveGasto);
  var period = $('#finFilterPeriod');
  if (period) {
    period.addEventListener('change', function () {
      var r = periodRange(this.value);
      if (r) {
        $('#finFilterDateFrom').value = r.from;
        $('#finFilterDateTo').value = r.to;
        loadFinanzas();
      }
    });
  }
  // Auto-aplicar al cambiar cualquiera de las dos fechas (sin esperar a "Consultar")
  ['finFilterDateFrom', 'finFilterDateTo'].forEach(function (id) {
    var el = $('#' + id);
    if (el) el.addEventListener('change', loadFinanzas);
  });
  // Rango por defecto: este mes
  var fromEl = $('#finFilterDateFrom');
  var toEl = $('#finFilterDateTo');
  if (fromEl && toEl && !fromEl.value) {
    var r = periodRange('month');
    fromEl.value = r.from;
    toEl.value = r.to;
  }
}

async function loadFinanzas() {
  var from = $('#finFilterDateFrom') ? $('#finFilterDateFrom').value : '';
  var to = $('#finFilterDateTo') ? $('#finFilterDateTo').value : '';
  try {
    if (window.can('finance.view')) {
      var res = await API.finanzas.resumen({ from: from, to: to });
      state.summary = res.data || null;
      renderSummary();
    }
    if (window.can('finance.gastos')) {
      var gastosRes = await API.gastos.list({ from: from, to: to });
      state.gastos = gastosRes.data || [];
      renderGastos();
    }
  } catch (err) {
    showToast('Error al cargar finanzas: ' + (err.message || ''), 'error');
  }
}

function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function fmtDateEs(iso) {
  if (!iso) return '';
  var p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}

function renderSummary() {
  var s = state.summary || {};
  setText('finAppliedRange', s.from && s.to ? '· ' + fmtDateEs(s.from) + ' → ' + fmtDateEs(s.to) : '');
  setText('finKpiFacturado', formatCurrency(s.facturado || 0));
  setText('finKpiCosto', formatCurrency(s.costoVentas || 0));
  setText('finKpiMargen', formatCurrency(s.margen || 0));
  setText('finKpiMargenPct', (s.margenPct || 0) + '% de margen');
  setText('finKpiCompras', formatCurrency(s.comprasTotal || 0));
  setText('finKpiGastos', formatCurrency(s.gastosTotal || 0));
  setText('finKpiNeta', formatCurrency(s.utilidadNeta || 0));
  setText('finResBruta', formatCurrency(s.utilidadBruta || 0));
  setText('finResFlujo', formatCurrency(s.flujoCaja || 0));
  setText('finResNeta', formatCurrency(s.utilidadNeta || 0));
  setText('finResPedidos', s.pedidos || 0);
  setText('finResTicket', formatCurrency(s.ticketPromedio || 0));
  setText('finResCortesias', s.cortesias || 0);
  setText('finResCancelados', s.canceladas || 0);
}

function renderGastos() {
  var tbody = $('#finGastosTable');
  var cards = $('#finGastosCards');
  var countEl = $('#finGastosCount');
  var gastos = state.gastos || [];
  if (countEl) {
    countEl.textContent = gastos.length === 0
      ? 'Sin gastos en el período'
      : (gastos.length + (gastos.length === 1 ? ' gasto' : ' gastos') + ' · ' + formatCurrency(state.summary ? state.summary.gastosTotal : 0));
  }
  if (!tbody || !cards) return;

  if (gastos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-sm text-slate-400">Sin gastos registrados en el período</td></tr>';
    cards.innerHTML = '<p class="text-center text-sm text-slate-400 py-8">Sin gastos registrados en el período</p>';
    return;
  }

  var canEdit = window.can && window.can('finance.gastos');
  tbody.innerHTML = gastos.map(function (g) {
    return '<tr class="hover:bg-slate-50 transition-colors">'
      + '<td class="px-6 py-3 text-sm text-slate-600">' + escapeHtml(g.fecha || '') + '</td>'
      + '<td class="px-6 py-3 text-sm"><span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">' + escapeHtml(CAT_LABELS[g.categoria] || g.categoria) + '</span></td>'
      + '<td class="px-6 py-3 text-sm text-slate-600">' + escapeHtml(g.descripcion || '—') + '</td>'
      + '<td class="px-6 py-3 text-sm font-semibold text-slate-800 text-right font-mono">' + formatCurrency(g.monto) + '</td>'
      + '<td class="px-6 py-3 text-right">'
      + (canEdit ? '<div class="flex items-center justify-end gap-1.5">'
        + '<button onclick="window.finEditGasto(\'' + g.id + '\')" class="pedido-action-btn action-edit" title="Editar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>'
        + '<button onclick="window.finDeleteGasto(\'' + g.id + '\')" class="pedido-action-btn action-delete" title="Eliminar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>'
        + '</div>' : '—')
      + '</td></tr>';
  }).join('');

  cards.innerHTML = gastos.map(function (g) {
    return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-2">'
      + '<div class="flex items-center justify-between">'
      + '<span class="text-xs text-slate-500">' + escapeHtml(g.fecha || '') + '</span>'
      + '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">' + escapeHtml(CAT_LABELS[g.categoria] || g.categoria) + '</span>'
      + '</div>'
      + '<p class="text-sm text-slate-700">' + escapeHtml(g.descripcion || '—') + '</p>'
      + '<div class="flex items-center justify-between pt-2 border-t border-slate-100">'
      + '<span class="text-sm font-bold text-slate-800 font-mono">' + formatCurrency(g.monto) + '</span>'
      + (canEdit ? '<div class="flex items-center gap-1.5">'
        + '<button onclick="window.finEditGasto(\'' + g.id + '\')" class="pedido-action-btn action-edit" title="Editar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>'
        + '<button onclick="window.finDeleteGasto(\'' + g.id + '\')" class="pedido-action-btn action-delete" title="Eliminar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>'
        + '</div>' : '')
      + '</div></div>';
  }).join('');
}

function openGastoModal(gasto) {
  var isEdit = !!gasto;
  $('#gastoModalTitle').textContent = isEdit ? 'Editar gasto' : 'Nuevo gasto';
  $('#gastoId').value = isEdit ? gasto.id : '';
  $('#gastoFecha').value = isEdit ? gasto.fecha : fmtDate(new Date());
  $('#gastoCategoria').value = isEdit ? gasto.categoria : 'arriendo';
  $('#gastoMonto').value = isEdit ? gasto.monto : '';
  $('#gastoDescripcion').value = isEdit ? (gasto.descripcion || '') : '';
  $('#gastoError').classList.add('hidden');
  openModal('gastoModal');
}

async function saveGasto(e) {
  e.preventDefault();
  var id = $('#gastoId').value;
  var payload = {
    fecha: $('#gastoFecha').value,
    categoria: $('#gastoCategoria').value,
    monto: parseFloat($('#gastoMonto').value) || 0,
    descripcion: $('#gastoDescripcion').value.trim()
  };
  if (!payload.fecha || payload.monto <= 0) {
    var errEl = $('#gastoError');
    errEl.querySelector('p').textContent = 'Completa la fecha y un monto mayor a 0';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    if (id) {
      await API.gastos.update(id, payload);
      showToast('Gasto actualizado', 'success');
    } else {
      await API.gastos.create(payload);
      showToast('Gasto registrado', 'success');
    }
    closeModal('gastoModal');
    loadFinanzas();
  } catch (err) {
    var errEl2 = $('#gastoError');
    errEl2.querySelector('p').textContent = err.message || 'Error al guardar';
    errEl2.classList.remove('hidden');
  }
}

function exportFinancePdf() {
  var s = state.summary;
  if (!s) { showToast('Primero consultá el período', 'warning'); return; }
  var fecha = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  var rows = [
    ['Facturado (' + (s.pedidos || 0) + ' pedidos)', formatCurrency(s.facturado)],
    ['Costo de insumos vendidos', '-' + formatCurrency(s.costoVentas)],
    ['Margen bruto (' + (s.margenPct || 0) + '%)', formatCurrency(s.margen)],
    ['Mermas', '-' + formatCurrency(s.mermasTotal)],
    ['Utilidad bruta', formatCurrency(s.utilidadBruta)],
    ['Compras de inventario (' + (s.comprasCount || 0) + ')', '-' + formatCurrency(s.comprasTotal)],
    ['Flujo de caja', formatCurrency(s.flujoCaja)],
    ['Gastos operativos (' + (s.gastosCount || 0) + ')', '-' + formatCurrency(s.gastosTotal)],
    ['UTILIDAD NETA', formatCurrency(s.utilidadNeta)]
  ];
  var gastosRows = (state.gastos || []).map(function (g) {
    return '<tr><td>' + escapeHtml(g.fecha || '') + '</td><td>' + escapeHtml(CAT_LABELS[g.categoria] || g.categoria)
      + '</td><td>' + escapeHtml(g.descripcion || '') + '</td><td class="qty">' + formatCurrency(g.monto) + '</td></tr>';
  }).join('');

  var html = '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Informe Financiero</title><style>'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:\'DM Sans\',\'Segoe UI\',sans-serif;color:#1a1a2e;background:#f8f9fc;padding:40px 24px;max-width:700px;margin:0 auto;font-size:13px;line-height:1.5}'
    + '.card{background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 20px rgba(0,0,0,.06);border:1px solid #e8ecf1}'
    + '.header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px dashed #e8ecf1}'
    + '.header h1{font-family:\'Space Mono\',monospace;font-size:20px;letter-spacing:2px;color:#073626;margin-bottom:4px;font-weight:700}'
    + '.header h2{font-size:13px;color:#7d8c98;font-weight:500;letter-spacing:1px}'
    + '.header .sub{font-size:11px;color:#94a3b8;margin-top:2px}'
    + 'table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}'
    + 'th{text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#64748b;border-bottom:2px solid #e8ecf1}'
    + 'td{padding:8px;border-bottom:1px solid #f1f5f9;color:#334155}'
    + '.qty{text-align:right;font-weight:600;font-family:\'Space Mono\',monospace}'
    + 'h3{font-size:13px;font-weight:700;color:#0f172a;margin:20px 0 4px}'
    + '.footer{text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e8ecf1;font-size:11px;color:#94a3b8}'
    + '@media print{body{background:#fff;padding:0;max-width:100%}.card{box-shadow:none;border:none;padding:20px 16px}@page{margin:12mm}}'
    + '</style></head><body><div class="card">'
    + '<div class="header"><h1>CORNER HOUSE</h1><h2>Sabores que unen</h2><div class="sub">Informe generado ' + escapeHtml(fecha) + '</div></div>'
    + '<p style="font-size:12px;color:#64748b"><b>Período:</b> ' + escapeHtml(s.from + ' → ' + s.to) + ' &nbsp;·&nbsp; <b>Fecha:</b> ' + escapeHtml(fecha) + '</p>'
    + '<h3>Resultados del período</h3><table><thead><tr><th>Concepto</th><th class="qty">Monto</th></tr></thead><tbody>'
    + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="qty">' + r[1] + '</td></tr>'; }).join('')
    + '</tbody></table>'
    + (gastosRows ? '<h3>Gastos operativos</h3><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="qty">Monto</th></tr></thead><tbody>' + gastosRows + '</tbody></table>' : '')
    + '<div class="footer"><p><b>Corner House — Sabores que unen</b></p><p>Informe informativo. Revise los movimientos antes de tomar decisiones.</p><p>Impreso: ' + escapeHtml(fecha) + '</p></div>'
    + '</div><script>window.addEventListener("load",function(){setTimeout(function(){window.print();},200)});<\/script></body></html>';

  var w = window.open('', 'cornerhouse_finanzas', 'width=560,height=800,scrollbars=yes');
  if (!w) { showToast('Permite ventanas emergentes para exportar', 'error'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// Exposicion global (onclick inline)
window.initFinanzas = initFinanzas;
window.loadFinanzas = loadFinanzas;
window.finEditGasto = function (id) {
  var g = (state.gastos || []).find(function (x) { return x.id === id; });
  if (g) openGastoModal(g);
};
window.finDeleteGasto = function (id) {
  var g = (state.gastos || []).find(function (x) { return x.id === id; });
  if (!g) return;
  showConfirm({
    title: '¿Eliminar gasto?',
    message: (CAT_LABELS[g.categoria] || g.categoria) + ' · ' + formatCurrency(g.monto) + (g.descripcion ? ' · ' + g.descripcion : ''),
    confirmText: 'Eliminar',
    variant: 'danger'
  }, async function () {
    try {
      await API.gastos.delete(id);
      showToast('Gasto eliminado', 'success');
      loadFinanzas();
    } catch (err) {
      showToast('Error: ' + (err.message || ''), 'error');
    }
  });
};
