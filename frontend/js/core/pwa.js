// core/pwa.js
// Registro del Service Worker para soporte PWA.
// Antes vivia inline en el DOMContentLoaded de app.js.

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js')
    .then(function (reg) {
      console.log('[PWA] Service Worker registrado:', reg.scope);
    })
    .catch(function (err) {
      console.warn('[PWA] No se pudo registrar SW:', err);
    });
}
