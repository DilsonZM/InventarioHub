// components/table.js
// Helpers comunes para el renderizado de tablas y listas en cards (responsive).
// Aqui vive la logica del "estado vacio" (empty state) que se repite en
// casi todas las vistas de la app (dashboard, sales, compras, productos, etc).

import { escapeHtml } from '../core/dom.js';

// Genera el HTML del empty state que se muestra cuando una vista no tiene
// datos. `opts` admite: titulo, mensaje, icono SVG, colspan.
export function renderEmptyState(opts) {
  opts = opts || {};
  var title = opts.title || 'Sin datos';
  var message = opts.message || 'No se encontraron registros.';
  var icon = opts.icon || '<svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>';
  var colspan = opts.colspan || 1;
  var tdAttr = colspan > 1 ? ' colspan="' + colspan + '"' : '';

  var wrap = '<div class="flex flex-col items-center gap-3">'
    + '<div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">' + icon + '</div>'
    + '<p class="text-sm font-medium text-slate-600">' + escapeHtml(title) + '</p>'
    + (message ? '<p class="text-xs text-slate-400">' + escapeHtml(message) + '</p>' : '')
    + '</div>';

  return '<div' + tdAttr + ' class="px-6 py-8 text-center">' + wrap + '</div>';
}

// Genera un "cargando..." para tablas y listas.
export function renderLoading(colspan) {
  colspan = colspan || 1;
  var tdAttr = colspan > 1 ? ' colspan="' + colspan + '"' : '';
  return '<div' + tdAttr + ' class="px-6 py-8 text-center text-sm text-slate-400">Cargando...</div>';
}

// Resetea el innerHTML de un contenedor (table, div, ul, etc) a su estado
// de "cargando" de forma segura. Util cuando un loader re-renderiza.
export function setLoading(tbodyOrContainer, colspan) {
  if (!tbodyOrContainer) return;
  tbodyOrContainer.innerHTML = renderLoading(colspan);
}

// Devuelve el tag de un movimiento en formato badge (entrada, salida, ajuste).
export function movimientoBadge(tipo) {
  var map = {
    entrada: '<span class="movimiento-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Entrada</span>',
    salida:  '<span class="movimiento-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>Salida</span>',
    ajuste:  '<span class="movimiento-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Ajuste</span>'
  };
  return map[tipo] || tipo;
}

// Devuelve un badge con la clase semantica segun el stock disponible.
export function stockBadge(stock, minStock) {
  if (stock === 0) {
    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 stock-badge-red">Sin stock</span>';
  }
  if (stock <= minStock) {
    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 stock-badge-orange">Bajo</span>';
  }
  return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 stock-badge-green">OK</span>';
}

// Renderiza un paginador simple. Recibe el contenedor, la pagina actual,
// el total de paginas y un callback al hacer click.
export function renderPagination(container, opts) {
  if (!container) return;
  var current = opts.current || 1;
  var total = opts.total || 1;
  var onClick = opts.onClick || function () {};
  if (total <= 1) {
    container.innerHTML = '';
    return;
  }
  var html = '<div class="flex items-center justify-center gap-1 mt-4">';
  var prevDisabled = current <= 1;
  html += '<button ' + (prevDisabled ? 'disabled' : '') + ' data-page="' + (current - 1) + '" class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm ' + (prevDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50') + '">Anterior</button>';
  var start = Math.max(1, current - 2);
  var end = Math.min(total, current + 2);
  if (start > 1) html += '<span class="px-2 text-slate-400">...</span>';
  for (var i = start; i <= end; i++) {
    var active = i === current;
    html += '<button data-page="' + i + '" class="px-3 py-1.5 rounded-lg text-sm ' + (active ? 'bg-brand-600 text-white' : 'border border-slate-200 hover:bg-slate-50') + '">' + i + '</button>';
  }
  if (end < total) html += '<span class="px-2 text-slate-400">...</span>';
  var nextDisabled = current >= total;
  html += '<button ' + (nextDisabled ? 'disabled' : '') + ' data-page="' + (current + 1) + '" class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm ' + (nextDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50') + '">Siguiente</button>';
  html += '</div>';
  container.innerHTML = html;
  // Listeners
  container.querySelectorAll('button[data-page]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var p = parseInt(btn.getAttribute('data-page'));
      if (p && p >= 1 && p <= total) onClick(p);
    });
  });
}

// Compatibilidad con el codigo heredado
if (typeof window !== 'undefined') {
  window.renderEmptyState = renderEmptyState;
  window.renderLoading = renderLoading;
  window.movimientoBadge = movimientoBadge;
  window.stockBadge = stockBadge;
  window.renderPagination = renderPagination;
}
