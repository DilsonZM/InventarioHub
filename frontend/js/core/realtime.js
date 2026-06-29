// core/realtime.js
// Polling de ventas recientes para que la web se actualice en tiempo real
// cuando un mesero registra un pedido desde el telefono. La primera vez
// se carga la lista normal; en cada tick se compara el ID mas alto con el
// conocido y se notifican los nuevos.
//
// Diseado para no romper el flujo existente: si la API falla o el usuario
// no esta autenticado, simplemente no hace nada (silencioso).

import { showToast } from '../components/toast.js';

const POLL_INTERVAL_MS = 8000; // 8 segundos entre cada verificacion

var lastKnownSaleIds = new Set();
var firstRun = true;
var timer = null;
var listeners = []; // funciones que reciben la lista de nuevas ventas

/**
 * Notifica a los listeners registrados que hay ventas nuevas.
 */
function emitNewSales(newSales) {
  listeners.forEach(function (fn) {
    try { fn(newSales); } catch (e) { console.warn('[realtime] listener error', e); }
  });
}

/**
 * Sonido corto (beep) usando WebAudio API para alertar de pedido nuevo.
 * No requiere archivos de audio externos.
 */
function beep(kind) {
  try {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var ctx = new AudioCtx();
    var now = ctx.currentTime;
    if (kind === 'success') {
      // Dos tonos ascendentes
      [
        { freq: 660, t: 0, d: 0.15 },
        { freq: 880, t: 0.15, d: 0.2 }
      ].forEach(function (n) {
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
    } else {
      // Tono simple
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (e) { /* ignore */ }
}

/**
 * Tick del polling. Hace una consulta ligera a /api/sales con limit=10
 * y compara IDs con los conocidos.
 */
async function tick() {
  try {
    if (!window.API || !window.API.sales) return;
    if (!window.API.isAuthenticated || !window.API.isAuthenticated()) return;

    var res = await window.API.sales.list({ limit: 10 });
    if (!res || !res.success || !Array.isArray(res.data)) return;
    var sales = res.data;

    if (firstRun) {
      // Primera vez: solo guardar IDs conocidos, no notificar
      sales.forEach(function (s) { lastKnownSaleIds.add(s.id); });
      firstRun = false;
      return;
    }

    // Detectar nuevas
    var newSales = sales.filter(function (s) { return !lastKnownSaleIds.has(s.id); });
    if (newSales.length === 0) return;

    // Actualizar set con todos los IDs actuales
    sales.forEach(function (s) { lastKnownSaleIds.add(s.id); });

    // Emitir a listeners
    emitNewSales(newSales);

    // Mostrar alerta visual y sonora para cada pedido nuevo
    newSales.forEach(function (sale) {
      var mesa = (sale.mesas && sale.mesas.nombre) || (sale.mesa_id ? 'Mesa ' + sale.mesa_id : 'Mostrador');
      var total = '$' + (sale.total || 0).toLocaleString('es-CO');
      var productos = (sale.venta_detalles || []).map(function (d) { return d.producto_nombre; }).filter(Boolean);
      var productosStr = productos.length ? productos.slice(0, 3).join(', ') + (productos.length > 3 ? '...' : '') : '';

      showToast('Nuevo pedido en ' + mesa + ' - ' + total + (productosStr ? ' (' + productosStr + ')' : ''), 'success');
      beep('success');
    });
  } catch (e) {
    // Silencioso: si falla una vez, seguimos intentando en el siguiente tick
  }
}

/**
 * Registra un listener para cuando hay ventas nuevas.
 * El listener recibe un array de ventas.
 */
export function onNewSales(fn) {
  if (typeof fn === 'function') listeners.push(fn);
  return function unsubscribe() {
    listeners = listeners.filter(function (l) { return l !== fn; });
  };
}

/**
 * Inicia el polling de ventas recientes.
 */
export function startRealtime() {
  if (timer) return; // ya esta corriendo
  // Limpiar el flag de primera ejecucion al iniciar
  firstRun = true;
  lastKnownSaleIds.clear();
  // Primer tick inmediato (carga IDs sin notificar)
  tick();
  // Polling periodico
  timer = setInterval(tick, POLL_INTERVAL_MS);
  console.log('[realtime] polling iniciado cada', POLL_INTERVAL_MS, 'ms');
}

/**
 * Detiene el polling.
 */
export function stopRealtime() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[realtime] polling detenido');
  }
}

/**
 * Para uso en tests: resetea el estado.
 */
export function _resetRealtime() {
  lastKnownSaleIds.clear();
  firstRun = true;
  listeners = [];
}
