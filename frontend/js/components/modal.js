// components/modal.js
// Apertura, cierre y guardado contra descarte de modales.
// Antes: openModal, closeModal, showError y closeModalWithGuard en app.js.
// Mantiene compatibilidad con la delegacion de clicks existente
// (`data-close-modal`, `data-confirm-cancel`, `data-close-preview`,
// `data-close-ticket`, `data-close-calendar`, `data-apply-filters-overlay`).

import { $ } from '../core/dom.js';
import { store } from '../core/store.js';

export function openModal(id) {
  var sidebar = $('#sidebar');
  var sidebarOv = $('#sidebarOverlay');
  if (sidebar && window.innerWidth < 1024 && !sidebar.classList.contains('-translate-x-full')) {
    sidebar.classList.add('-translate-x-full');
    if (sidebarOv) sidebarOv.classList.add('hidden');
  }
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  // Asegurar que el overlay oscuro interno este visible.
  // Algunos modales (los nuevos) tienen un overlay con `hidden` por defecto;
  // otros lo tienen siempre visible. Nos aseguramos de que se vea.
  var innerOverlay = el.querySelector('.fixed.inset-0[data-close-modal], .fixed.inset-0[data-close-ticket], .fixed.inset-0[data-close-preview], .fixed.inset-0[data-close-calendar], .fixed.inset-0[data-confirm-cancel], .fixed.inset-0[data-confirm-action-cancel]');
  if (innerOverlay) innerOverlay.classList.remove('hidden');
}

export function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

export function showError(id, msg) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  var p = el.querySelector('p');
  if (p) p.textContent = msg;
}

// Cierra un modal con proteccion: si hay cambios sin guardar, muestra
// el confirm-discard. Si el usuario acepta, cierra; si no, no hace nada.
export function closeModalWithGuard(modalId) {
  var dirty = (modalId === 'saleModal' && store.state.saleDirty)
            || (modalId === 'compraModal' && store.state.compraDirty)
            || (modalId === 'dishModal' && store.state.dishDirty);
  if (dirty) {
    var modal = document.getElementById('confirmDiscardModal');
    if (modal) {
      store.state._pendingCloseModal = modalId;
      modal.classList.remove('hidden');
    }
  } else {
    closeModal(modalId);
  }
}

export function markSaleDirty() { store.state.saleDirty = true; }
export function markCompraDirty() { store.state.compraDirty = true; }
export function clearDirty() { store.state.saleDirty = false; store.state.compraDirty = false; }

// showConfirm(opts, onConfirm): muestra el confirmActionModal con
// titulo, mensaje, textos de botones y variante (color pastel) y
// resuelve onConfirm cuando el usuario acepta. Cancelar / overlay
// no hacen nada.
//
// opts = {
//   title:        string  (default: '¿Confirmar?')
//   message:      string  (default: '¿Estás seguro?')
//   confirmText:  string  (default: 'Confirmar')
//   cancelText:   string  (default: 'Cancelar')
//   variant:      'danger' | 'warning' | 'info' (default: 'danger')
//   icon:         string HTML para icono custom (sobreescribe variant)
// }
export function showConfirm(opts, onConfirm) {
  var modal = document.getElementById('confirmActionModal');
  if (!modal) return;

  var titleEl = modal.querySelector('#confirmActionTitle');
  var msgEl = modal.querySelector('#confirmActionMessage');
  var okBtn = modal.querySelector('#confirmActionOk');
  var cancelBtn = modal.querySelector('[data-confirm-action-cancel]:not(.overlay)');
  // El primer [data-confirm-action-cancel] es el overlay; el segundo es el boton
  var allCancels = modal.querySelectorAll('[data-confirm-action-cancel]');
  var cancelBtnEl = allCancels.length > 1 ? allCancels[allCancels.length - 1] : null;
  var iconWrap = modal.querySelector('#confirmActionIcon');

  if (titleEl) titleEl.textContent = opts.title || '¿Confirmar?';
  if (msgEl) msgEl.textContent = opts.message || '¿Estás seguro?';
  if (okBtn) okBtn.textContent = opts.confirmText || 'Confirmar';
  if (cancelBtnEl) cancelBtnEl.textContent = opts.cancelText || 'Cancelar';

  // Variante de color (pastel): danger = rose, warning = amber, info = sky
  var variant = opts.variant || 'danger';
  var palette = {
    danger:  { bg: 'bg-rose-100',  fg: 'text-rose-600',  btn: 'bg-rose-600 hover:bg-rose-700' },
    warning: { bg: 'bg-amber-100', fg: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700' },
    info:    { bg: 'bg-sky-100',   fg: 'text-sky-600',   btn: 'bg-sky-600 hover:bg-sky-700' }
  };
  var p = palette[variant] || palette.danger;

  if (iconWrap) {
    // Quitar todas las clases de color previas
    iconWrap.className = 'w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ' + p.bg;
    if (opts.icon) {
      iconWrap.innerHTML = opts.icon;
      // aplicar color al SVG interno
      var svg = iconWrap.querySelector('svg');
      if (svg) svg.className = 'w-6 h-6 ' + p.fg;
    } else {
      // Icono por defecto segun variante
      var defaultIcon = variant === 'warning'
        ? '<svg class="w-6 h-6 ' + p.fg + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'
        : '<svg class="w-6 h-6 ' + p.fg + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>';
      iconWrap.innerHTML = defaultIcon;
    }
  }

  if (okBtn) {
    // Quitar clases de color previas del boton
    okBtn.className = 'flex-1 px-4 py-2.5 text-white font-semibold rounded-xl shadow-sm text-sm touch-target transition-colors ' + p.btn;
  }

  // Abrir el modal (reusa openModal para asegurar que el overlay se muestre)
  openModal('confirmActionModal');

  // Handler del OK: clonar el boton para limpiar listeners anteriores
  if (okBtn) {
    var newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    newOk.addEventListener('click', function () {
      closeModal('confirmActionModal');
      if (typeof onConfirm === 'function') onConfirm();
    });
  }
}

// Delegacion global de clicks para data-close-modal, data-confirm-cancel,
// data-confirm-action-cancel, data-close-preview, data-close-ticket,
// data-close-calendar, data-apply-filters-overlay.
// Antes eran 6 addEventListener sueltos en app.js. Aqui se consolidan.
export function initModalDelegation() {
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || !target.closest) return;

    // Helper: dado un elemento clickeado, encuentra el contenedor del modal
    // (el div.fixed.inset-0 mas cercano) sin importar el z-index.
    function findModalContainer(el) {
      // Caso 1: el click fue en un overlay interno que tiene data-close-*
      // -> subir al contenedor padre
      var container = el.closest('.fixed.inset-0');
      return container;
    }

    var el = target.closest('[data-close-modal]');
    if (el) {
      var modalEl = findModalContainer(el);
      if (modalEl) modalEl.classList.add('hidden');
      return;
    }
    var confirmCancel = target.closest('[data-confirm-cancel]');
    if (confirmCancel) {
      var m = document.getElementById('confirmDiscardModal');
      if (m) m.classList.add('hidden');
      return;
    }
    var confirmActionCancel = target.closest('[data-confirm-action-cancel]');
    if (confirmActionCancel) {
      var cm = document.getElementById('confirmActionModal');
      if (cm) cm.classList.add('hidden');
      return;
    }
    var closePreview = target.closest('[data-close-preview]');
    if (closePreview) {
      var pm = document.getElementById('orderPreviewModal');
      if (pm) pm.classList.add('hidden');
      return;
    }
    var closeTicket = target.closest('[data-close-ticket]');
    if (closeTicket) {
      var tm = document.getElementById('ticketModal');
      if (tm) tm.classList.add('hidden');
      return;
    }
    var closeCalendar = target.closest('[data-close-calendar]');
    if (closeCalendar) {
      var calm = document.getElementById('dateRangeModal');
      if (calm) calm.classList.add('hidden');
      return;
    }
    var applyOverlay = target.closest('[data-apply-filters-overlay]');
    if (applyOverlay) {
      var btn = document.getElementById('mobileFiltersApply');
      var view = btn ? btn.getAttribute('data-view') : 'sales';
      if (typeof window.applyMobileFilters === 'function') window.applyMobileFilters(view);
      return;
    }
  });
}

if (typeof window !== 'undefined') {
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.showError = showError;
  window.closeModalWithGuard = closeModalWithGuard;
  window.showConfirm = showConfirm;
  window.markSaleDirty = markSaleDirty;
  window.markCompraDirty = markCompraDirty;
}
