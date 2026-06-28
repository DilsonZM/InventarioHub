// components/filters.js
// Sistema de filtros para las vistas de listado (sales, entradas, movimientos).
// Reemplaza a: initFilters, applyQuickPeriod, clearFilters, hasActiveFilters,
// updateClearBtn, updateFilterChips, openMobileFiltersModal, applyMobileFilters.
// Antes vivian inline en app.js. Ahora estan aisladas y reusables.

import { $ } from '../core/dom.js';
import { debounce, escapeHtml } from '../core/dom.js';
import { openModal } from './modal.js';

// Devuelve el loader (funcion global) correspondiente a una vista.
// Mantiene compatibilidad con app.js sin importar nada de alli.
function getLoaderForView(view) {
  if (view === 'dashboard') return window.loadDashboard;
  if (view === 'sales') return window.loadSales;
  if (view === 'entradas') return window.loadCompras;
  if (view === 'movimientos') return window.loadMovimientos;
  if (view === 'dishes') return window.loadDishes;
  return null;
}

export function hasActiveFilters(ids) {
  return !!(
    ($(ids.dateFrom) && $(ids.dateFrom).value) ||
    ($(ids.dateTo) && $(ids.dateTo).value) ||
    ($(ids.period) && $(ids.period).value) ||
    ($(ids.cocina) && $(ids.cocina).value) ||
    ($(ids.product) && $(ids.product).value) ||
    ($(ids.extra) && $(ids.extra).value)
  );
}

export function updateClearBtn(ids) {
  var btn = $(ids.clear);
  if (!btn) return;
  if (hasActiveFilters(ids)) btn.classList.add('active');
  else btn.classList.remove('active');
  updateFilterChips(ids);
}

export function updateFilterChips(ids) {
  var view = ids.view;
  if (!view) return;
  var chipsContainer = document.querySelector('[data-chips="' + view + '"]');
  if (!chipsContainer) return;

  var chips = [];
  var dateFrom = $(ids.dateFrom) ? $(ids.dateFrom).value : '';
  var dateTo = $(ids.dateTo) ? $(ids.dateTo).value : '';
  if (dateFrom && dateTo) {
    chips.push({ label: 'Fechas: ' + dateFrom + ' - ' + dateTo, clear: function () { $(ids.dateFrom).value = ''; $(ids.dateTo).value = ''; } });
  } else if (dateFrom) {
    chips.push({ label: 'Desde: ' + dateFrom, clear: function () { $(ids.dateFrom).value = ''; } });
  } else if (dateTo) {
    chips.push({ label: 'Hasta: ' + dateTo, clear: function () { $(ids.dateTo).value = ''; } });
  }

  var period = $(ids.period) ? $(ids.period).value : '';
  if (period) {
    var periodLabels = { today: 'Hoy', week: 'Esta semana', month: 'Este mes', quarter: 'Este trimestre', year: 'Este ano' };
    chips.push({ label: 'Periodo: ' + (periodLabels[period] || period), clear: function () { $(ids.period).value = ''; } });
  }
  if ($(ids.cocina) && $(ids.cocina).value) {
    chips.push({ label: 'Cocina: ' + $(ids.cocina).value, clear: function () { $(ids.cocina).value = ''; } });
  }
  if ($(ids.product) && $(ids.product).value) {
    var pEl = $(ids.product);
    var pLabel = ids.view === 'sales' ? 'Mesa' : 'Producto';
    var pText = pEl.options && pEl.options[pEl.selectedIndex] ? pEl.options[pEl.selectedIndex].textContent : pEl.value;
    chips.push({ label: pLabel + ': ' + pText, clear: function () { pEl.value = ''; } });
  }
  if (ids.extra && $(ids.extra) && $(ids.extra).value) {
    var exEl = $(ids.extra);
    var exText = exEl.options && exEl.options[exEl.selectedIndex] ? exEl.options[exEl.selectedIndex].textContent : $(ids.extra).value;
    chips.push({ label: exText, clear: function () { $(ids.extra).value = ''; } });
  }

  // Badge en el boton mobile
  var countSpan = document.querySelector('[data-open-filters="' + view + '"] .mobile-filters-count');
  if (countSpan) {
    if (chips.length > 0) {
      countSpan.textContent = chips.length;
      countSpan.classList.remove('hidden');
    } else {
      countSpan.classList.add('hidden');
    }
  }

  chipsContainer.innerHTML = chips.map(function (chip, idx) {
    return '<button class="filter-chip inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-100 text-brand-800 text-xs font-medium hover:bg-brand-100 transition-colors" data-chip-idx="' + idx + '">'
      + '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '<span>' + escapeHtml(chip.label) + '</span>'
      + '</button>';
  }).join('');

  // Click handlers de los chips
  var loader = getLoaderForView(view);
  chipsContainer.querySelectorAll('.filter-chip').forEach(function (btn, idx) {
    btn.addEventListener('click', function () {
      chips[idx].clear();
      updateClearBtn(ids);
      if (loader) loader();
    });
  });
}

export function applyQuickPeriod(ids, loader) {
  loader = loader || getLoaderForView(ids.view);
  var period = $(ids.period).value;
  if (!period) return;
  // Usar la fecha/hora actual en la timezone de la app (UTC-5)
  var now = window.Utils.nowInAppTZ();
  var todayStr = window.Utils.todayInAppTZ();
  var today = new Date(todayStr + 'T00:00:00');
  var from, to;
  switch (period) {
    case 'today': from = today; to = now; break;
    case 'week':
      var dow = today.getDay();
      from = new Date(today);
      from.setDate(today.getDate() - dow);
      to = now;
      break;
    case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); to = now; break;
    case 'quarter':
      var q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1);
      to = now;
      break;
    case 'year': from = new Date(now.getFullYear(), 0, 1); to = now; break;
  }
  if (from) $(ids.dateFrom).value = from.toISOString().split('T')[0];
  if (to) $(ids.dateTo).value = to.toISOString().split('T')[0];
  updateClearBtn(ids);
  if (loader) loader();
}

export function clearFilters(ids, loader) {
  loader = loader || getLoaderForView(ids.view);
  if ($(ids.dateFrom)) $(ids.dateFrom).value = '';
  if ($(ids.dateTo)) $(ids.dateTo).value = '';
  if ($(ids.period)) $(ids.period).value = '';
  if ($(ids.product)) $(ids.product).value = '';
  if (ids.extra && $(ids.extra)) $(ids.extra).value = '';
  if (ids.cocina && $(ids.cocina)) $(ids.cocina).value = '';
  if (loader) loader();
  updateClearBtn(ids);
}

export function initFilters(view) {
  var prefix = view === 'sales' ? '' : (view === 'entradas' ? 'Entradas' : 'Mov');
  var ids = {
    view: view,
    dateFrom: '#filterDateFrom' + prefix,
    dateTo: '#filterDateTo' + prefix,
    period: '#filterQuickPeriod' + prefix,
    product: view === 'sales' ? '#filterMesa' : ('#filterProductSearch' + prefix),
    clear: '#clearFiltersBtn' + prefix,
    extra: view === 'movimientos' ? '#filterTipoMov' : null
  };
  var loader = getLoaderForView(view);

  if ($(ids.dateFrom)) $(ids.dateFrom).addEventListener('change', function () { $(ids.period).value = ''; updateClearBtn(ids); if (loader) loader(); });
  if ($(ids.dateTo)) $(ids.dateTo).addEventListener('change', function () { $(ids.period).value = ''; updateClearBtn(ids); if (loader) loader(); });
  if ($(ids.period)) $(ids.period).addEventListener('change', function () { applyQuickPeriod(ids, loader); });
  if ($(ids.product) && $(ids.product).tagName === 'INPUT') {
    $(ids.product).addEventListener('input', debounce(function () { updateClearBtn(ids); if (loader) loader(); }, 350));
  } else if ($(ids.product) && $(ids.product).tagName === 'SELECT') {
    $(ids.product).addEventListener('change', function () { updateClearBtn(ids); if (loader) loader(); });
  }
  if (ids.extra && $(ids.extra)) {
    $(ids.extra).addEventListener('change', function () { updateClearBtn(ids); if (loader) loader(); });
  }
  if ($(ids.clear)) $(ids.clear).addEventListener('click', function () { clearFilters(ids, loader); });

  // Mobile: boton Filtros y limpiar
  var openBtn = document.querySelector('[data-open-filters="' + view + '"]');
  if (openBtn) openBtn.addEventListener('click', function () { openMobileFiltersModal(view); });
  var clearMobile = document.getElementById('clearFiltersBtn' + (view === 'sales' ? 'Mobile' : (view === 'entradas' ? 'EntradasMobile' : (view === 'movimientos' ? 'MovMobile' : 'DashMobile'))));
  if (clearMobile) clearMobile.addEventListener('click', function () { clearFilters(ids, loader); });

  // Default periodo = Hoy al cargar
  if ($(ids.period) && !$(ids.period).value) {
    $(ids.period).value = 'today';
    applyQuickPeriod(ids, loader);
  }

  updateClearBtn(ids);
}

// Modal de filtros para mobile. Clona los inputs del desktop al modal.
export function openMobileFiltersModal(view) {
  var prefix = view === 'sales' ? '' : (view === 'entradas' ? 'Entradas' : 'Mov');
  var modal = document.getElementById('mobileFiltersModal');
  if (!modal) return;
  var content = document.getElementById('mobileFiltersContent');
  if (!content) return;

  // Clonar el contenido de los filtros del desktop
  var sourceSelectors = [
    '#filterDateFrom' + prefix,
    '#filterDateTo' + prefix,
    '#filterQuickPeriod' + prefix,
    view === 'sales' ? '#filterMesa' : ('#filterProductSearch' + prefix)
  ];
  if (view === 'movimientos') sourceSelectors.push('#filterTipoMov');

  content.innerHTML = sourceSelectors
    .map(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return '';
      // Clonar el contenedor padre para mantener label
      var wrap = el.closest('div');
      return wrap ? wrap.outerHTML : '';
    })
    .join('');

  // Sincronizar valores actuales
  sourceSelectors.forEach(function (sel) {
    var src = document.querySelector(sel);
    var dst = content.querySelector(sel);
    if (src && dst) dst.value = src.value;
  });

  // Guardar la vista actual en el boton Aplicar
  var applyBtn = document.getElementById('mobileFiltersApply');
  if (applyBtn) applyBtn.setAttribute('data-view', view);

  openModal('mobileFiltersModal');
}

// Aplica los filtros del modal mobile a los inputs del desktop y recarga.
export function applyMobileFilters(view) {
  var prefix = view === 'sales' ? '' : (view === 'entradas' ? 'Entradas' : 'Mov');
  var content = document.getElementById('mobileFiltersContent');
  if (!content) return;
  var sourceSelectors = [
    '#filterDateFrom' + prefix,
    '#filterDateTo' + prefix,
    '#filterQuickPeriod' + prefix,
    view === 'sales' ? '#filterMesa' : ('#filterProductSearch' + prefix)
  ];
  if (view === 'movimientos') sourceSelectors.push('#filterTipoMov');

  sourceSelectors.forEach(function (sel) {
    var src = content.querySelector(sel);
    var dst = document.querySelector(sel);
    if (src && dst) dst.value = src.value;
  });

  // Cerrar el modal
  var modal = document.getElementById('mobileFiltersModal');
  if (modal) modal.classList.add('hidden');

  // Recargar la vista
  var loader = getLoaderForView(view);
  if (loader) loader();
}

// Re-exponer en window para el codigo heredado
if (typeof window !== 'undefined') {
  window.initFilters = initFilters;
  window.applyQuickPeriod = applyQuickPeriod;
  window.clearFilters = clearFilters;
  window.hasActiveFilters = hasActiveFilters;
  window.updateClearBtn = updateClearBtn;
  window.updateFilterChips = updateFilterChips;
  window.openMobileFiltersModal = openMobileFiltersModal;
  window.applyMobileFilters = applyMobileFilters;
}
