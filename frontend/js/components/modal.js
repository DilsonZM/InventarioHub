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
  var overlay = $('#sidebarOverlay');
  if (sidebar && window.innerWidth < 1024 && !sidebar.classList.contains('-translate-x-full')) {
    sidebar.classList.add('-translate-x-full');
    if (overlay) overlay.classList.add('hidden');
  }
  var el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
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
    var el = target.closest('[data-close-modal]');
    if (el) {
      var modalEl = el.closest('.fixed.inset-0.z-50, .fixed.inset-0.z-55, .fixed.inset-0.z-\\[55\\]');
      if (modalEl) {
        // Si el modal es el de filters mobile, aplica filtros al cerrar.
        if (modalEl.id === 'mobileFiltersModal') {
          // El comportamiento exacto (aplicar filtros al cerrar) se hace
          // en components/filters.js. Aqui solo cerramos visualmente.
          modalEl.classList.add('hidden');
        } else {
          modalEl.classList.add('hidden');
        }
      }
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
      // Dispara el boton aplicar del modal mobile (que vive en app.js)
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
