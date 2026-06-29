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
    var pLabel = ids.view === 'sales' ? 'Destino' : 'Producto';
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
    return '<button class="filter-chip group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-slate-100/80 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 text-[11px] font-medium border border-slate-200/80 dark:border-slate-600/60 hover:bg-slate-200 dark:hover:bg-slate-600/80 transition-colors" data-chip-idx="' + idx + '">'
      + '<span>' + escapeHtml(chip.label) + '</span>'
      + '<span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200/60 dark:bg-slate-800/60 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 transition-colors">'
      + '<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '</span>'
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

  // Selectores de los inputs a clonar al drawer.
  // Nota: el dashboard tiene 'filterDateFromDash'/'filterDateToDash', los demas
  // vistas usan 'filterDateFrom'/'filterDateTo' con prefijo opcional.
  var sourceSelectors = view === 'dashboard' ? [
    '#filterDateFromDash',
    '#filterDateToDash',
    '#filterQuickPeriodDash',
    '#filterCocinaDash',
    '#filterProductDash'
  ] : [
    '#filterDateFrom' + prefix,
    '#filterDateTo' + prefix,
    '#filterQuickPeriod' + prefix,
    view === 'sales' ? '#filterMesa' : ('#filterProductSearch' + prefix)
  ];
  if (view === 'movimientos') sourceSelectors.push('#filterTipoMov');

  // Deduplicar wrappers: si dos inputs comparten el mismo wrapper padre (caso comun
  // en dashboard donde Desde/Hasta estan en el mismo <div class="flex items-stretch">),
  // clonar UNA sola vez ese wrapper en vez de duplicarlo.
  // Ademas, si el wrapper padre directo tiene un <label> (caso "Rango de fechas"),
  // subimos un nivel mas para incluir el label en el clon.
  var seen = new Set();
  var html = '';
  sourceSelectors.forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    var wrap = el.closest('div');
    if (!wrap || seen.has(wrap)) return;
    // Subir un nivel si el padre directo del wrap tiene un <label> (label del grupo)
    var candidate = wrap;
    if (wrap.parentElement && wrap.parentElement.querySelector(':scope > label')) {
      candidate = wrap.parentElement;
    }
    if (seen.has(candidate)) return;
    seen.add(candidate);
    // Tambien marcar todos los descendientes para que no se vuelvan a procesar
    var descendants = candidate.querySelectorAll('input, select');
    descendants.forEach(function (d) { seen.add(d.parentElement); });
    html += candidate.outerHTML;
  });
  content.innerHTML = html;

  // Sincronizar valores actuales (desktop -> drawer)
  sourceSelectors.forEach(function (sel) {
    var src = document.querySelector(sel);
    var dst = content.querySelector(sel);
    if (src && dst) dst.value = src.value;
  });

  // Wire de eventos en el drawer: cambio en un input del drawer se propaga al
  // desktop y dispara el loader de la vista, para que los filtros se apliquen
  // automaticamente sin necesidad de tocar "Aplicar".
  var loader = getLoaderForView(view);
  sourceSelectors.forEach(function (sel) {
    var drawerEl = content.querySelector(sel);
    var desktopEl = document.querySelector(sel);
    if (!drawerEl || !desktopEl) return;
    var handler = function () {
      // Sincronizar valor al desktop y disparar el evento change para que
      // los listeners existentes del desktop (initFilters) se ejecuten.
      if (desktopEl.value !== drawerEl.value) {
        desktopEl.value = drawerEl.value;
      }
      desktopEl.dispatchEvent(new Event('change', { bubbles: true }));
    };
    drawerEl.addEventListener('change', handler);
    if (drawerEl.type === 'text' || drawerEl.type === 'search') {
      drawerEl.addEventListener('input', handler);
    }
  });

  // Wire del boton Aplicar: cierra el drawer (los filtros ya se aplicaron live)
  var applyBtn = document.getElementById('mobileFiltersApply');
  if (applyBtn) {
    applyBtn.setAttribute('data-view', view);
    // Reemplazar el handler (clonar para evitar duplicar listeners al reabrir)
    var newApply = applyBtn.cloneNode(true);
    applyBtn.parentNode.replaceChild(newApply, applyBtn);
    newApply.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      applyMobileFilters(view);
    });
  }

  // Wire del boton Limpiar del drawer: vacia todos los inputs (desktop + drawer),
  // recarga la vista y cierra el drawer.
  var clearBtn = document.getElementById('mobileFiltersClear');
  if (clearBtn) {
    clearBtn.setAttribute('data-view', view);
    var newClear = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newClear, clearBtn);
    newClear.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      sourceSelectors.forEach(function (sel) {
        var de = document.querySelector(sel);
        if (de) {
          de.value = '';
          de.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      // Re-render drawer con valores vacios
      renderBottomSheet(view);
      // Recargar vista con filtros vacios
      if (loader) loader();
      // Cerrar drawer
      applyMobileFilters(view);
    });
  }

  openModal('mobileFiltersModal');
}

function renderBottomSheet(view) {
  // Helper publico para re-renderizar el drawer desde fuera (usado por Limpiar).
  // Redirige a openMobileFiltersModal con re-apertura forzada.
  openMobileFiltersModal(view);
}

// Cierra el modal mobile. Los filtros ya se aplican en vivo via los listeners
// wireados en openMobileFiltersModal, asi que "Aplicar" solo cierra.
export function applyMobileFilters(view) {
  var modal = document.getElementById('mobileFiltersModal');
  if (modal) modal.classList.add('hidden');
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
