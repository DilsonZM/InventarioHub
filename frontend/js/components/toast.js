// components/toast.js
// Notificacion toast (success / error / info).
// Antes: showToast() en app.js. Sin dependencias externas.

import { $ } from '../core/dom.js';

const COLORS = {
  success: 'bg-brand-100 border-brand-200 text-brand-800',
  error:   'bg-red-100 border-red-200 text-red-800',
  info:    'bg-brand-100 border-brand-200 text-brand-800'
};

const ICONS = {
  success: '<svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
  error:   '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
  info:    '<svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>'
};

let timer = null;

export function showToast(message, type) {
  type = type || 'success';
  var toast = $('#toast');
  if (!toast) return;
  var msg = $('#toastMessage');
  var icon = $('#toastIcon');
  if (msg) msg.textContent = message;
  if (icon) icon.innerHTML = ICONS[type] || ICONS.info;
  var child = toast.firstElementChild;
  if (child) child.className = 'flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border ' + (COLORS[type] || COLORS.info);
  toast.classList.remove('hidden');
  if (timer) clearTimeout(timer);
  timer = setTimeout(function () { toast.classList.add('hidden'); }, 3500);
}

if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
