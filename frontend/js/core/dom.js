// core/dom.js
// Helpers basicos de DOM compartidos por toda la app.
// Mantenerlos centralizados permite reemplazar la implementacion
// (por ej. para tests con jsdom) sin tocar el resto del codigo.

export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function debounce(fn, wait) {
  var t;
  return function () {
    var args = arguments;
    var ctx = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(ctx, args); }, wait);
  };
}

// Aliases globales para mantener compatibilidad con el codigo heredado de app.js
// durante la migracion gradual. En fases posteriores se iran eliminando.
if (typeof window !== 'undefined') {
  window.$ = $;
  window.$$ = $$;
  window.escapeHtml = escapeHtml;
  window.debounce = debounce;
}
