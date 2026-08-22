// core/realtime.js
// Polling de solicitudes nuevas (pedidos + reservas) para que la web se
// actualice en tiempo real cuando llega una solicitud desde el publico o
// desde el telefono del mesero.
//
// Cada 8s consulta:
//   - GET /api/sales?estado=pendiente      -> pedidos esperando atencion
//   - GET /api/reservas?estado=pendiente   -> reservas pendientes de confirmar
// Detecta las que son NUEVAS (IDs no vistos), muestra un banner no bloqueante
// y hace un sonido. Tambien alimenta los badges pulsantes del sidebar
// (Pedidos / Reservas).
//
// Silencioso ante fallos: sin sesion, sin permiso, red caida, etc.
// La vista se recarga via listeners (onNewSales / onNewReservas).

const POLL_INTERVAL_MS = 8000; // 8 segundos entre cada verificacion

var lastKnownSaleIds = new Set();
var lastKnownReservaIds = new Set();
var firstRunSales = true;
var firstRunReservas = true;
var timer = null;
var salesListeners = [];
var reservaListeners = [];

// Contadores de pendientes (para los badges del sidebar).
// lastSeen se persiste en localStorage: el badge aparece solo cuando hay
// pendientes NUEVOS desde la ultima vez que se abrio la vista.
var pendingCounts = { sales: 0, reservas: 0 };
var lastSeen = {
  sales: loadLastSeen('sales'),
  reservas: loadLastSeen('reservas')
};

function lsKey(type) { return 'invhub:lastSeen:' + type; }

function loadLastSeen(type) {
  try {
    var n = parseInt(window.localStorage.getItem(lsKey(type)), 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch (e) { return null; }
}

function persistLastSeen(type) {
  try { window.localStorage.setItem(lsKey(type), String(lastSeen[type])); } catch (e) { /* ignore */ }
}

// ==================== Badges del sidebar ====================

function badgeEl(type) {
  return document.getElementById(type === 'sales' ? 'navBadgeSales' : 'navBadgeReservas');
}

function refreshBadge(type) {
  var el = badgeEl(type);
  if (!el) return;
  var show = lastSeen[type] != null && pendingCounts[type] > lastSeen[type];
  el.classList.toggle('show', show);
}

// Marca como visto un tipo ('sales' | 'reservas'). Lo llama el router
// cuando se abre la vista o al hacer click en el banner.
export function markSeen(type) {
  if (type !== 'sales' && type !== 'reservas') return;
  lastSeen[type] = pendingCounts[type] || 0;
  persistLastSeen(type);
  refreshBadge(type);
}

// ==================== Banner no bloqueante ====================

var bannerTimer = null;

function bannerEl() {
  return document.getElementById('realtimeBanner');
}

function buildBanner() {
  var el = document.createElement('div');
  el.id = 'realtimeBanner';
  el.setAttribute('role', 'status');
  el.addEventListener('click', function () {
    el.classList.remove('show');
    var view = el.getAttribute('data-view');
    if (view && window.navigate) {
      markSeen(view);
      window.navigate(view);
    }
  });
  document.body.appendChild(el);
  return el;
}

function showBanner(data) {
  var el = bannerEl() || buildBanner();
  var accent = data.kind === 'reserva' ? 'var(--color-accent-amber)' : 'var(--color-accent-brand)';
  el.setAttribute('data-view', data.view);
  el.style.borderLeftColor = accent;
  el.innerHTML =
    '<div class="rtb-icon ' + data.kind + '">' + data.icon + '</div>' +
    '<div><div class="rtb-title">' + data.title + '</div>' +
    '<div class="rtb-msg">' + data.message + '</div></div>';
  el.classList.add('show');
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(function () { el.classList.remove('show'); }, 9000);
}

// ==================== Sonido (WebAudio, sin archivos) ====================

function beep(kind) {
  try {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var ctx = new AudioCtx();
    var now = ctx.currentTime;
    var tones = kind === 'reserva'
      ? [{ freq: 523, t: 0, d: 0.15 }, { freq: 659, t: 0.15, d: 0.15 }, { freq: 784, t: 0.3, d: 0.25 }]
      : [{ freq: 660, t: 0, d: 0.15 }, { freq: 880, t: 0.15, d: 0.2 }];
    tones.forEach(function (n) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.frequency.value = n.freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d);
    });
  } catch (e) { /* ignore */ }
}

// ==================== Emisores de eventos ====================

function emitNewSales(newSales) {
  salesListeners.forEach(function (fn) {
    try { fn(newSales); } catch (e) { console.warn('[realtime] listener error', e); }
  });
}

function emitNewReservas(newReservas) {
  reservaListeners.forEach(function (fn) {
    try { fn(newReservas); } catch (e) { console.warn('[realtime] listener error', e); }
  });
}

// ==================== Polling de pedidos ====================

async function tickSales() {
  try {
    if (!window.API || !window.API.sales) return;
    if (!window.API.isAuthenticated || !window.API.isAuthenticated()) return;

    var res = await window.API.sales.list({ estado: 'pendiente', limit: 100 });
    if (!res || !res.success || !Array.isArray(res.data)) return;
    var sales = res.data;
    pendingCounts.sales = sales.length;

    if (firstRunSales) {
      // Primera vez: solo registrar IDs conocidos y la base de pendientes
      sales.forEach(function (s) { lastKnownSaleIds.add(s.id); });
      if (lastSeen.sales == null) { lastSeen.sales = sales.length; persistLastSeen('sales'); }
      firstRunSales = false;
      refreshBadge('sales');
      return;
    }

    var newSales = sales.filter(function (s) { return !lastKnownSaleIds.has(s.id); });
    sales.forEach(function (s) { lastKnownSaleIds.add(s.id); });

    if (newSales.length > 0) {
      emitNewSales(newSales);
      showBanner(buildSaleBanner(newSales));
      beep('pedido');
    }
    refreshBadge('sales');
  } catch (e) {
    // Silencioso: seguimos intentando en el siguiente tick
  }
}

function buildSaleBanner(newSales) {
  var first = newSales[0];
  var mesa = first.mesaNombre || (first.mesaId ? 'Mesa ' + first.mesaId : 'Mostrador');
  var total = '$' + (first.total || 0).toLocaleString('es-CO');
  var numVenta = first.numero_venta || 'S/N';
  var extra = newSales.length > 1 ? ' (+' + (newSales.length - 1) + ' mas)' : '';
  return {
    kind: 'pedido',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    title: 'Nuevo pedido',
    message: '#' + numVenta + ' &middot; ' + mesa + ' &middot; ' + total + extra,
    view: 'sales'
  };
}

// ==================== Polling de reservas ====================

async function tickReservas() {
  try {
    if (!window.API || !window.API.reservas) return;
    if (!window.API.isAuthenticated || !window.API.isAuthenticated()) return;

    var res = await window.API.reservas.list({ estado: 'pendiente', limit: 100 });
    if (!res || !res.success || !Array.isArray(res.data)) return;
    var reservas = res.data;
    pendingCounts.reservas = reservas.length;

    if (firstRunReservas) {
      reservas.forEach(function (r) { lastKnownReservaIds.add(r.id); });
      if (lastSeen.reservas == null) { lastSeen.reservas = reservas.length; persistLastSeen('reservas'); }
      firstRunReservas = false;
      refreshBadge('reservas');
      return;
    }

    var newReservas = reservas.filter(function (r) { return !lastKnownReservaIds.has(r.id); });
    reservas.forEach(function (r) { lastKnownReservaIds.add(r.id); });

    if (newReservas.length > 0) {
      emitNewReservas(newReservas);
      showBanner(buildReservaBanner(newReservas));
      beep('reserva');
    }
    refreshBadge('reservas');
  } catch (e) {
    // Silencioso: sin permiso (vendedor), sin red, etc.
  }
}

function buildReservaBanner(newReservas) {
  var first = newReservas[0];
  var tipo = first.tipo_pedido === 'domicilio' ? 'Domicilio' : 'Mesa';
  var destino = first.tipo_pedido === 'domicilio'
    ? (first.barrio_entrega || first.direccion_entrega || '')
    : (first.mesa_nombre || '');
  var hora = String(first.hora || '').slice(0, 5);
  var items = (first.reserva_items || []).length;
  var mensaje = tipo
    + (destino ? ' &middot; ' + destino : '')
    + (hora ? ' &middot; ' + hora : '')
    + (items ? ' &middot; ' + items + ' plato' + (items !== 1 ? 's' : '') : '')
    + (newReservas.length > 1 ? ' (+' + (newReservas.length - 1) + ' mas)' : '');
  return {
    kind: 'reserva',
    icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
    title: 'Nueva reserva',
    message: mensaje,
    view: 'reservas'
  };
}

// ==================== Arranque / parada ====================

function tick() {
  tickSales();
  tickReservas();
}

export function onNewSales(fn) {
  if (typeof fn === 'function') salesListeners.push(fn);
  return function unsubscribe() {
    salesListeners = salesListeners.filter(function (l) { return l !== fn; });
  };
}

export function onNewReservas(fn) {
  if (typeof fn === 'function') reservaListeners.push(fn);
  return function unsubscribe() {
    reservaListeners = reservaListeners.filter(function (l) { return l !== fn; });
  };
}

export function startRealtime() {
  if (timer) return; // ya esta corriendo
  firstRunSales = true;
  firstRunReservas = true;
  lastKnownSaleIds.clear();
  lastKnownReservaIds.clear();
  // Primer tick inmediato (carga IDs sin notificar)
  tick();
  // Polling periodico
  timer = setInterval(tick, POLL_INTERVAL_MS);
  console.log('[realtime] polling iniciado cada', POLL_INTERVAL_MS, 'ms');
}

export function stopRealtime() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[realtime] polling detenido');
  }
}

export function _resetRealtime() {
  lastKnownSaleIds.clear();
  lastKnownReservaIds.clear();
  firstRunSales = true;
  firstRunReservas = true;
  salesListeners = [];
  reservaListeners = [];
}
