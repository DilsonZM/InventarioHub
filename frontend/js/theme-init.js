// theme-init.js
// Aplica el tema (claro/oscuro) ANTES del primer render para evitar
// el "flash" del tema claro cuando el usuario tiene dark mode guardado.
// Lee la clave `theme:v1` de localStorage; si no existe, respeta
// `prefers-color-scheme` del sistema operativo.
// Debe cargarse en el <head>, idealmente antes de main.css para que
// el selector [data-theme="dark"] tome efecto al renderizar.
(function () {
  'use strict';
  try {
    var t = localStorage.getItem('theme:v1');
    if (!t && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      t = 'dark';
    }
    if (t) {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {
    // localStorage puede estar bloqueado (modo privado, sandbox, etc.)
    // En ese caso, simplemente no aplicamos el tema forzado.
  }
})();
