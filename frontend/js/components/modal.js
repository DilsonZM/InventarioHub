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
  window.markSaleDirty = markSaleDirty;
  window.markCompraDirty = markCompraDirty;
}
