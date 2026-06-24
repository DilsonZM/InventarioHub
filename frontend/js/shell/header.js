// shell/header.js
// Header sticky: boton de tema, fecha actual, boton "Nuevo Pedido".
// Antes: setCurrentDate en app.js y la logica de window.openPOS en el onclick
// inline del index.html (que delegamos a la vista POS o app.js).

import { $ } from '../core/dom.js';

export function setCurrentDate() {
  var el = $('#currentDate');
  if (!el) return;
  var tz = (window.Utils && Utils.APP_TIMEZONE) || 'America/Bogota';
  try {
    el.textContent = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: tz
    });
  } catch (e) {
    el.textContent = new Date().toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}

if (typeof window !== 'undefined') {
  window.setCurrentDate = setCurrentDate;
}
