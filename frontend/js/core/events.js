// core/events.js
// Event bus y delegacion global de clicks.
// En el monolito de app.js existian 6 `document.addEventListener('click', ...)`
// sueltos para data-close-modal, data-confirm-cancel, data-open-filters, etc.
// Aqui los consolidamos en una sola delegacion con un mapa `selectores -> handler`.
//
// API:
//   on(selector, fn)   Registra un handler que se ejecuta cuando el target
//                      del click es el selector o un descendiente.
//   off(selector, fn)  Quita un handler previamente registrado.
//   initEvents()       Instala el listener global (lo llama main.js al boot).
//   emit(name, detail) Despacha un CustomEvent sobre `document` (util para
//                      que capas se comuniquen sin acoplarse a una vista).

const handlers = new Map(); // selector -> Array<fn>

/**
 * Registra un handler para un selector CSS.
 * El handler recibe (event, target) donde target es el elemento que matchea.
 * Si registras varios handlers para el mismo selector se ejecutan en orden.
 */
export function on(selector, handler) {
  if (typeof selector !== 'string' || !selector) return;
  if (typeof handler !== 'function') return;
  if (!handlers.has(selector)) handlers.set(selector, []);
  handlers.get(selector).push(handler);
}

/** Quita un handler. Si no se pasa handler, limpia todos los del selector. */
export function off(selector, handler) {
  if (!handlers.has(selector)) return;
  if (!handler) { handlers.delete(selector); return; }
  var list = handlers.get(selector);
  var idx = list.indexOf(handler);
  if (idx !== -1) list.splice(idx, 1);
  if (list.length === 0) handlers.delete(selector);
}

function dispatch(e) {
  var target = e.target;
  if (!target || typeof target.closest !== 'function') return;
  handlers.forEach(function (list, selector) {
    var match = target.closest(selector);
    if (match) {
      // Recorremos copia por si un handler hace off() durante la ejecucion
      list.slice().forEach(function (fn) {
        try { fn(e, match); } catch (err) { console.error('[events] handler error for', selector, err); }
      });
    }
  });
}

let installed = false;
/** Instala el listener global. Idempotente. */
export function initEvents() {
  if (installed) return;
  installed = true;
  document.addEventListener('click', dispatch);
}

/** Despacha un CustomEvent sobre document. Util como bus pub/sub simple. */
export function emit(name, detail) {
  try {
    document.dispatchEvent(new CustomEvent(name, { detail: detail }));
  } catch (err) {
    // Fallback para navegadores que no soportan CustomEvent
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(name, false, false, detail);
    document.dispatchEvent(evt);
  }
}

if (typeof window !== 'undefined') {
  window.__coreEvents = { on, off, initEvents, emit };
}
