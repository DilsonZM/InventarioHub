// lib/telegram.js
// Notificaciones de pedidos nuevos y avisos de "pedido listo" + comandos.
//
// El token del bot vive SOLO en variables de entorno del backend
// (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID), nunca en el frontend.
//
// Regla de oro: si Telegram falla o no esta configurado, el pedido
// NUNCA se cancela ni se le muestra un error al usuario; solo se
// registra el problema en consola.
//
// Control por comandos (webhook): /pausar, /reanudar, /silenciar_pos,
// /activar_pos, /silenciar_listos, /activar_listos, /estado.
// Los flags se guardan en app_config.

const supabase = require('./supabase');
const { normalizePhone, formatPhone } = require('./phone');
const stockReport = require('./stock-report');
const finance = require('./finance');
const { getUserPermissions } = require('../middleware/auth');

// Preferir IPv4 al conectar con la API de Telegram: en algunas redes el
// enrutamiento IPv6 es inestable y produce "fetch failed" intermitentes.
try { require('dns').setDefaultResultOrder('ipv4first'); } catch (e) { /* noop */ }

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

function isConfigured() {
  return !!(BOT_TOKEN && CHAT_ID);
}

function getConfiguredChatId() {
  return CHAT_ID;
}

function formatCurrency(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
}

// Escapa caracteres reservados de MarkdownV2 (texto normal)
function esc(s) {
  return String(s == null ? '' : s).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

// Escapa caracteres para parse_mode HTML
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// Configuracion del bot (app_config) con cache corta
// ============================================================

let _settingsCache = { value: null, ts: 0 };
const SETTINGS_TTL = 10000; // 10 segundos

async function getBotSettings() {
  if (_settingsCache.value && (Date.now() - _settingsCache.ts) < SETTINGS_TTL) {
    return _settingsCache.value;
  }
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('notifications_active, notify_pos_orders, notify_ready_orders, notify_low_stock')
      .eq('id', 1)
      .single();
    if (error || !data) throw (error || new Error('sin datos'));
    _settingsCache = {
      value: {
        notificationsActive: data.notifications_active !== false,
        notifyPosOrders: data.notify_pos_orders !== false,
        notifyReadyOrders: data.notify_ready_orders !== false,
        notifyLowStock: data.notify_low_stock !== false
      },
      ts: Date.now()
    };
  } catch (err) {
    // Si las columnas no existen todavia, no bloquear las notificaciones
    console.warn('[telegram] no se pudo leer app_config, usando defaults:', err.message);
    _settingsCache = {
      value: { notificationsActive: true, notifyPosOrders: true, notifyReadyOrders: true, notifyLowStock: true },
      ts: Date.now()
    };
  }
  return _settingsCache.value;
}

async function updateBotSetting(patch) {
  const { error } = await supabase.from('app_config').update(patch).eq('id', 1);
  if (error) throw error;
  _settingsCache = { value: null, ts: 0 }; // invalidar cache: efecto inmediato
}

// ============================================================
// Mensajes
// ============================================================

// NUEVO PEDIDO: banner naranja con texto limpio (sin bloques de codigo)
function buildOrderMessage(order) {
  const lines = [];
  lines.push('🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧');
  lines.push('*NUEVO PEDIDO REGISTRADO*');
  lines.push('🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧');
  lines.push('');
  lines.push('📍 *Destino:* ' + esc(order.destino || '—'));
  lines.push('🔢 *Pedido:* ' + esc(order.numero_venta || order.numero || '-'));
  if (order.personas) lines.push('👥 *Personas:* ' + esc(order.personas));
  if (order.cliente) lines.push('👤 *Cliente:* ' + esc(order.cliente));
  if (order.telefono) {
    // Telefono con link directo al chat de WhatsApp (wa.me)
    var telNorm = normalizePhone(order.telefono);
    if (telNorm) {
      var waDigits = telNorm.replace(/\D/g, '');
      lines.push('📞 *Teléfono:* [' + esc(formatPhone(telNorm)) + '](https://wa.me/' + waDigits + ')');
    } else {
      lines.push('📞 *Teléfono:* ' + esc(order.telefono));
    }
  }
  if (order.direccion) lines.push('🏠 *Dirección:* ' + esc(order.direccion));
  if (order.barrio) lines.push('🗺️ *Barrio:* ' + esc(order.barrio));
  lines.push('');
  lines.push('📋 *Productos:*');
  (order.items || []).forEach(function (it) {
    lines.push('• ' + esc((it.cantidad || 1) + 'x ' + (it.nombre || '')));
    if (it.observacion) lines.push('   📝 ' + esc(it.observacion));
  });
  if (!order.items || order.items.length === 0) {
    lines.push('• (sin platos, solo reserva de mesa)');
  }
  lines.push('');
  lines.push('💰 *Total:* ' + esc(formatCurrency(order.total)));
  if (order.notas) lines.push('📝 *Notas:* ' + esc(order.notas));
  lines.push('');
  lines.push('🕒 ' + esc(order.hora || new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })));
  return lines.join('\n');
}

// PEDIDO LISTO: banner verde con texto limpio (sin bloques de codigo)
// Incluye el mesero que atendio y, solo para pedidos web, el WhatsApp del cliente.
function buildReadyMessage(order) {
  const lines = [];
  lines.push('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩');
  lines.push('*¡PLATO LISTO PARA SERVIR\\!*');
  lines.push('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩');
  lines.push('');
  lines.push('📍 *Mesa / Destino:* ' + esc(order.destino || '—'));
  lines.push('🔢 *Pedido:* ' + esc(order.numero_venta || '-'));
  if (order.mesero) lines.push('🙋 *Mesero:* ' + esc(order.mesero));
  if (order.telefono) {
    // Solo pedidos de la web publica: WhatsApp del cliente con link directo
    var telNorm = normalizePhone(order.telefono);
    if (telNorm) {
      var waDigits = telNorm.replace(/\D/g, '');
      lines.push('📞 *WhatsApp cliente:* [' + esc(formatPhone(telNorm)) + '](https://wa.me/' + waDigits + ')');
    } else {
      lines.push('📞 *WhatsApp cliente:* ' + esc(order.telefono));
    }
  }
  lines.push('');
  lines.push('🛎️ *Retirar de cocina:*');
  (order.items || []).forEach(function (it) {
    lines.push('• ' + esc((it.cantidad || 1) + 'x ' + (it.nombre || '')));
  });
  lines.push('');
  lines.push('🏃💨 Favor pasar a recoger y servir\\.');
  return lines.join('\n');
}

// fetch con timeout (evita que un cuelgue bloquee el flujo del pedido)
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs || 6000);
  try {
    return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

// fetch con reintentos cortos: la red hacia Telegram a veces da ETIMEDOUT
async function fetchWithRetry(url, options, attempts) {
  const max = attempts || 3;
  let lastErr = null;
  for (let i = 0; i < max; i++) {
    try {
      return await fetchWithTimeout(url, options, 6000);
    } catch (err) {
      lastErr = err;
      if (i < max - 1) await new Promise(function (r) { setTimeout(r, 600); });
    }
  }
  throw lastErr;
}

// options.markdown: true (default) para MarkdownV2; false para texto plano
// options.html: true para parse_mode HTML (tiene prioridad sobre markdown)
// options.replyMarkup: teclado inline de Telegram (botones)
async function sendTelegramMessage(text, options) {
  if (!isConfigured()) return { ok: false, skipped: true };
  const useHtml = !!(options && options.html);
  const useMarkdown = !useHtml && (!options || options.markdown !== false);
  const targetChat = (options && options.chatId) ? options.chatId : CHAT_ID;
  try {
    const payload = { chat_id: targetChat, text: text };
    if (useHtml) {
      payload.parse_mode = 'HTML';
      payload.disable_web_page_preview = true;
      payload.link_preview_options = { is_disabled: true };
    } else if (useMarkdown) {
      payload.parse_mode = 'MarkdownV2';
      // Evita la tarjeta de preview del link de WhatsApp (ocupa mucho espacio)
      payload.disable_web_page_preview = true;
      payload.link_preview_options = { is_disabled: true };
    }
    if (options && options.replyMarkup) payload.reply_markup = options.replyMarkup;
    const res = await fetchWithRetry('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn('[telegram] envio fallo:', res.status, String(body).slice(0, 200));
      return { ok: false };
    }
    const body = await res.json().catch(function () { return null; });
    console.log('[telegram] notificacion enviada');
    return { ok: true, messageId: body && body.result ? body.result.message_id : null };
  } catch (err) {
    console.warn('[telegram] error (no bloqueante):', err.message);
    return { ok: false, error: err.message };
  }
}

// Envia la notificacion de un pedido nuevo. Nunca lanza excepciones.
// origin: 'pos' | 'public' (solo 'pos' respeta notify_pos_orders)
async function notifyNewOrder(order, origin) {
  try {
    if (!isConfigured()) {
      console.log('[telegram] no configurado (falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID)');
      return;
    }
    const settings = await getBotSettings();
    if (!settings.notificationsActive) {
      console.log('[telegram] omitido: notificaciones pausadas (/reanudar para activar)');
      return;
    }
    if (origin === 'pos' && !settings.notifyPosOrders) {
      console.log('[telegram] omitido: pedidos POS silenciados (/activar_pos para activar)');
      return;
    }
    await sendTelegramMessage(buildOrderMessage(order || {}));
  } catch (err) {
    console.warn('[telegram] notifyNewOrder error (no bloqueante):', err.message);
  }
}

// Envia un documento (PDF) al chat configurado. No lanza excepciones.
async function sendTelegramDocument(buffer, filename, caption, options) {
  if (!isConfigured()) return { ok: false, skipped: true };
  const targetChat = (options && options.chatId) ? options.chatId : CHAT_ID;
  try {
    const form = new FormData();
    form.append('chat_id', String(targetChat));
    form.append('document', new Blob([buffer], { type: 'application/pdf' }), filename || 'reporte.pdf');
    if (caption) form.append('caption', caption);
    const res = await fetchWithRetry('https://api.telegram.org/bot' + BOT_TOKEN + '/sendDocument', {
      method: 'POST',
      body: form
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn('[telegram] envio documento fallo:', res.status, String(body).slice(0, 200));
      return { ok: false };
    }
    console.log('[telegram] documento enviado');
    return { ok: true };
  } catch (err) {
    console.warn('[telegram] sendDocument error (no bloqueante):', err.message);
    return { ok: false, error: err.message };
  }
}

// Responde al callback de un boton (quita el "relojito" de carga). No lanza.
async function answerCallbackQuery(callbackQueryId, text) {
  if (!isConfigured() || !callbackQueryId) return;
  try {
    const payload = { callback_query_id: callbackQueryId };
    if (text) payload.text = text;
    await fetchWithRetry('https://api.telegram.org/bot' + BOT_TOKEN + '/answerCallbackQuery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('[telegram] answerCallbackQuery error (no bloqueante):', err.message);
  }
}

// Edita un mensaje ya enviado (paneles y reportes con botones). No lanza.
// options.html: true para parse_mode HTML (tiene prioridad sobre markdown)
async function editTelegramMessage(text, messageId, options) {
  if (!isConfigured() || !messageId) return { ok: false };
  const useHtml = !!(options && options.html);
  const useMarkdown = !useHtml && (!options || options.markdown !== false);
  const targetChat = (options && options.chatId) ? options.chatId : CHAT_ID;
  try {
    const payload = { chat_id: targetChat, message_id: messageId, text: text };
    if (useHtml) {
      payload.parse_mode = 'HTML';
      payload.disable_web_page_preview = true;
      payload.link_preview_options = { is_disabled: true };
    } else if (useMarkdown) {
      payload.parse_mode = 'MarkdownV2';
      payload.disable_web_page_preview = true;
      payload.link_preview_options = { is_disabled: true };
    }
    if (options && options.replyMarkup) payload.reply_markup = options.replyMarkup;
    const res = await fetchWithRetry('https://api.telegram.org/bot' + BOT_TOKEN + '/editMessageText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn('[telegram] edit fallo:', res.status, String(body).slice(0, 200));
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[telegram] editMessage error (no bloqueante):', err.message);
    return { ok: false, error: err.message };
  }
}

// Aviso de "pedido listo" para meseros/salon. Nunca lanza excepciones.
async function notifyOrderReady(order) {
  try {
    if (!isConfigured()) {
      console.log('[telegram] no configurado (falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID)');
      return;
    }
    const settings = await getBotSettings();
    if (!settings.notificationsActive) {
      console.log('[telegram] listo omitido: notificaciones pausadas');
      return;
    }
    if (!settings.notifyReadyOrders) {
      console.log('[telegram] listo omitido: avisos de listos silenciados (/activar_listos para activar)');
      return;
    }
    await sendTelegramMessage(buildReadyMessage(order || {}));
  } catch (err) {
    console.warn('[telegram] notifyOrderReady error (no bloqueante):', err.message);
  }
}

// ============================================================
// Resumen de ventas (/hoy [desde] [hasta]) - zona Bogota (UTC-5)
// ============================================================

function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function addDaysBogota(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00-05:00');
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

function startOfMonthBogota() {
  return todayBogota().slice(0, 8) + '01';
}

function prevMonthRangeBogota() {
  const t = todayBogota();
  let y = parseInt(t.slice(0, 4), 10);
  let m = parseInt(t.slice(5, 7), 10) - 1;
  if (m === 0) { m = 12; y--; }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: y + '-' + String(m).padStart(2, '0') + '-01',
    to: y + '-' + String(m).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0')
  };
}

// Acepta 'YYYY-MM-DD', 'DD/MM/YYYY', 'DDMMYYYY', 'DD/MM' (año actual)
// y devuelve siempre 'YYYY-MM-DD'
function parseDateArg(raw) {
  const s = String(raw || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  m = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const year = todayBogota().slice(0, 4);
    return year + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  }
  return null;
}

function formatDateEs(dateStr) {
  try {
    return new Date(dateStr + 'T12:00:00-05:00').toLocaleDateString('es-CO', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch (e) { return dateStr; }
}

// Fecha larga en español con inicial mayúscula: "Sábado, 26 de septiembre de 2026"
function formatDateEsLong(dateStr) {
  try {
    const s = new Date(dateStr + 'T12:00:00-05:00').toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch (e) { return dateStr; }
}

// Resumen de ventas de un rango (fechas 'YYYY-MM-DD' en zona Bogota)
async function buildDailySummaryRange(from, to) {
  const { applyBogotaDateFilter } = require('./timezone');
  if (!from || !to) { from = to = todayBogota(); }
  if (from > to) { const t = from; from = to; to = t; }

  let query = supabase
    .from('ventas')
    .select('total, estado, estado_cocina, venta_detalles(producto_nombre, cantidad, subtotal, es_plato, plato_id, producto_id)');
  query = applyBogotaDateFilter(query, 'creado_en', from, to);
  const { data, error } = await query;
  if (error) throw error;

  // Costos para el margen estimado: platos (receta) y productos (precio_compra)
  const platoCostos = {};
  try {
    const dishes = await stockReport.getDishesData();
    dishes.forEach(function (d) { platoCostos[d.id] = d.costo; });
  } catch (e) { /* noop */ }
  const prodCostos = {};
  try {
    const { data: prods } = await supabase.from('productos').select('id, precio_compra');
    (prods || []).forEach(function (p) { prodCostos[p.id] = parseFloat(p.precio_compra) || 0; });
  } catch (e) { /* noop */ }

  let pedidos = 0, facturado = 0, cortesias = 0, canceladas = 0, costoVentas = 0;
  const platos = {};
  (data || []).forEach(function (v) {
    if (v.estado_cocina === 'cancelada') { canceladas++; return; }
    pedidos++;
    if (v.estado_cocina === 'cortesia') cortesias++;
    const esCompletada = v.estado === 'completada';
    if (esCompletada) facturado += parseFloat(v.total) || 0;
    (v.venta_detalles || []).forEach(function (d) {
      const cant = parseInt(d.cantidad, 10) || 0;
      if (d.es_plato) {
        const k = d.producto_nombre || '?';
        platos[k] = (platos[k] || 0) + cant;
      }
      // Costo solo de ventas facturadas (mismo universo que el facturado)
      if (esCompletada) {
        if (d.es_plato && d.plato_id && platoCostos[d.plato_id] != null) {
          costoVentas += platoCostos[d.plato_id] * cant;
        } else if (d.producto_id && prodCostos[d.producto_id] != null) {
          costoVentas += prodCostos[d.producto_id] * cant;
        }
      }
    });
  });

  const margen = facturado - costoVentas;
  const margenPct = facturado > 0 ? (margen / facturado) * 100 : 0;

  const top = Object.keys(platos).map(function (k) { return { nombre: k, cant: platos[k] }; })
    .sort(function (a, b) { return b.cant - a.cant; })
    .slice(0, 5);

  const esDia = from === to;
  const lines = [];
  lines.push('📊 RESUMEN DE VENTAS ' + (esDia ? 'DEL DÍA' : 'DEL PERIODO'));
  lines.push('📅 ' + (esDia ? formatDateEsLong(from) : ('Del ' + formatDateEs(from) + ' al ' + formatDateEs(to))));
  lines.push('');
  lines.push('🧾 Pedidos cerrados: ' + pedidos);
  lines.push('💰 Facturado: ' + formatCurrency(facturado));
  lines.push('📈 Margen estimado: ' + formatCurrency(margen) + ' (' + margenPct.toFixed(1) + '%)');
  lines.push('🎁 Cortesías: ' + cortesias);
  lines.push('❌ Cancelados: ' + canceladas);
  lines.push('');
  if (top.length === 0) {
    lines.push('🍽️ Sin platos vendidos en ese período.');
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    lines.push('🏆 Top 5 Platos más vendidos:');
    top.forEach(function (p, i) {
      lines.push((i + 1) + '. ' + (medals[i] || '') + ' ' + p.nombre + ' (' + p.cant + 'x)');
    });
  }
  return lines.join('\n');
}

// ============================================================
// Panel de notificaciones (/notificaciones)
// Botones con emojis de estado: 🟢 activo / 🔴 inactivo
// ============================================================

async function buildNotificationsPanel() {
  const s = await getBotSettings();
  const ON = '🟢';
  const OFF = '🔴';

  const lines = [];
  lines.push('🔔 *PANEL DE NOTIFICACIONES*');
  lines.push('');
  lines.push('📊 *Estado actual:*');
  lines.push(s.notificationsActive ? '🔔 Notificaciones: ACTIVAS' : '⏸️ Notificaciones: PAUSADAS');
  lines.push(s.notifyPosOrders ? '🛒 Pedidos POS: ACTIVOS' : '🔇 Pedidos POS: SILENCIADOS');
  lines.push(s.notifyReadyOrders ? '🍽️ Avisos de listos: ACTIVOS' : '🔇 Avisos de listos: SILENCIADOS');
  lines.push(s.notifyLowStock ? '📦 Stock bajo: ACTIVAS' : '🔇 Stock bajo: SILENCIADAS');
  lines.push('');
  lines.push('Tocá un botón para activar o desactivar:');

  return {
    text: lines.join('\n'),
    markdown: true,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: (s.notifyPosOrders ? ON : OFF) + ' 🛒 POS', callback_data: 'ntf:pos' },
          { text: (s.notifyReadyOrders ? ON : OFF) + ' 🍽️ Listos', callback_data: 'ntf:listos' }
        ],
        [
          { text: (s.notifyLowStock ? ON : OFF) + ' 📦 Stock', callback_data: 'ntf:stock' },
          { text: (s.notificationsActive ? ON : OFF) + ' 🔔 Todo', callback_data: 'ntf:all' }
        ],
        [
          { text: '🔄 Actualizar', callback_data: 'ntf:refresh' }
        ]
      ]
    }
  };
}

// ============================================================
// Panel de inventario (/inventario) - reportes PDF bajo pedido
// ============================================================

function fmtNum(n) {
  return (Number(n) || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

async function buildInventoryPanel() {
  const prods = await stockReport.getProductsData();
  const bajos = prods.filter(function (p) { return p.minStock > 0 && p.stock <= p.minStock; }).length;
  const lines = [];
  lines.push('📦 *INVENTARIO Y REPORTES*');
  lines.push('');
  lines.push('📊 Productos activos: ' + prods.length);
  lines.push('⚠️ Bajo mínimo: ' + bajos);
  lines.push('');
  lines.push('Generá un PDF:');
  return {
    text: lines.join('\n'),
    markdown: true,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '⚠️ Stock bajo', callback_data: 'inv:bajos' },
          { text: '📦 Productos', callback_data: 'inv:productos' }
        ],
        [
          { text: '🍽️ Platos', callback_data: 'inv:platos' },
          { text: '🥤 Bebidas', callback_data: 'inv:bebidas' }
        ],
        [
          { text: '🔄 Actualizar', callback_data: 'inv:refresh' }
        ]
      ]
    }
  };
}

// Reporte de stock bajo con formato rico (parse_mode HTML).
// Acepta items con { nombre, stock|stock_actual, minStock|stock_minimo, unidad|unidad_medida }.
// Clasifica en CRITICO/AGOTADO (stock <= 0 o <= 25% del minimo) y EN ALERTA.
function buildLowStockReport(bajos, title) {
  const APP_URL = process.env.APP_URL || 'https://inventory-app-one-azure.vercel.app';
  const lines = [];
  lines.push('📦📦📦📦📦📦📦📦📦📦');
  lines.push('⚠️ <b>' + escHtml(title || 'STOCK BAJO') + '</b>');
  lines.push('📦📦📦📦📦📦📦📦📦📦');
  lines.push('');
  lines.push('📅 ' + escHtml(new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short'
  })));
  lines.push('');

  if (!bajos || bajos.length === 0) {
    lines.push('✅ Todo el inventario se encuentra sobre el nivel mínimo operativo.');
    return lines.join('\n');
  }

  const criticos = [];
  const alerta = [];
  bajos.forEach(function (p) {
    const stock = parseFloat(p.stock != null ? p.stock : p.stock_actual) || 0;
    const min = parseFloat(p.minStock != null ? p.minStock : p.stock_minimo) || 0;
    const unidad = p.unidad || p.unidad_medida || '';
    const falta = Math.round(Math.max(0, min - stock) * 100) / 100;
    const item = { nombre: p.nombre, stock: stock, min: min, unidad: unidad, falta: falta };
    if (stock <= 0 || (min > 0 && stock <= min * 0.25)) criticos.push(item);
    else alerta.push(item);
  });
  const byRatio = function (a, b) { return (a.stock / (a.min || 1)) - (b.stock / (b.min || 1)); };
  criticos.sort(byRatio);
  alerta.sort(byRatio);

  function itemLine(it) {
    return '• <b>' + escHtml(it.nombre) + '</b>: ' + fmtNum(it.stock) + ' ' + escHtml(it.unidad)
      + ' (mín. ' + fmtNum(it.min) + ') ➔ Falta: ' + fmtNum(it.falta) + ' ' + escHtml(it.unidad);
  }

  if (criticos.length > 0) {
    lines.push('🔴 <b>CRÍTICO / AGOTADO</b>');
    lines.push('');
    criticos.forEach(function (it) { lines.push(itemLine(it)); });
    lines.push('');
  }
  if (alerta.length > 0) {
    lines.push('🟡 <b>EN ALERTA</b>');
    lines.push('');
    alerta.forEach(function (it) { lines.push(itemLine(it)); });
    lines.push('');
  }

  lines.push('🛒 <b>Total insumos a reponer:</b> ' + bajos.length);
  lines.push('');
  lines.push('🔗 <a href="' + APP_URL + '/index.html#entradas">Registrar entradas en InventarioHub</a>');
  return lines.join('\n');
}

// Lista de stock bajo para el comando /stockbajos (mismo formato)
async function buildLowStockText() {
  const bajos = await stockReport.getLowStockData();
  return buildLowStockReport(bajos, 'STOCK BAJO');
}

// ============================================================
// Finanzas (/finanzas) - informe contable con selector de fechas
// ============================================================

function buildFinanceReportText(s) {
  const esDia = s.from === s.to;
  const lines = [];
  lines.push('📊 <b>INFORME FINANCIERO</b>');
  lines.push('');
  lines.push('📅 ' + escHtml(esDia ? formatDateEsLong(s.from) : ('Del ' + formatDateEs(s.from) + ' al ' + formatDateEs(s.to))));
  lines.push('');
  lines.push('💵 <b>INGRESOS</b>');
  lines.push('');
  lines.push('• Facturado: ' + formatCurrency(s.facturado));
  lines.push('• Pedidos: ' + s.pedidos + ' · Ticket promedio: ' + formatCurrency(s.ticketPromedio));
  lines.push('• Cortesías: ' + s.cortesias + ' · Cancelados: ' + s.canceladas);
  lines.push('');
  lines.push('📦 <b>COSTO Y MARGEN</b>');
  lines.push('');
  lines.push('• Costo de insumos: ' + formatCurrency(s.costoVentas));
  lines.push('• Margen bruto: ' + formatCurrency(s.margen) + ' (' + s.margenPct + '%)');
  lines.push('');
  lines.push('🛒 <b>EGRESOS</b>');
  lines.push('');
  lines.push('• Compras de inventario: ' + formatCurrency(s.comprasTotal) + ' · ' + s.comprasCount + (s.comprasCount === 1 ? ' compra' : ' compras'));
  lines.push('• Mermas: ' + formatCurrency(s.mermasTotal) + ' · ' + s.mermasCount + (s.mermasCount === 1 ? ' merma' : ' mermas'));
  lines.push('• Gastos operativos: ' + formatCurrency(s.gastosTotal) + ' · ' + s.gastosCount + (s.gastosCount === 1 ? ' gasto' : ' gastos'));
  lines.push('<i>Gastos operativos: arriendo, servicios, nómina, etc. Se registran con /gasto</i>');
  lines.push('');
  lines.push('📈 <b>RESULTADO</b>');
  lines.push('');
  lines.push('• Utilidad bruta: ' + formatCurrency(s.utilidadBruta));
  lines.push('• Flujo de caja: ' + formatCurrency(s.flujoCaja));
  lines.push('• <b>Utilidad neta:</b> ' + formatCurrency(s.utilidadNeta));
  lines.push('');
  if ((s.topPlatos || []).length > 0) {
    const medals = ['🥇', '🥈', '🥉'];
    lines.push('🏆 <b>Top 5 Platos más vendidos:</b>');
    lines.push('');
    s.topPlatos.forEach(function (p, i) {
      lines.push((i + 1) + '. ' + (medals[i] || '') + ' ' + escHtml(p.nombre) + ' (' + p.cant + 'x)');
    });
  }
  return lines.join('\n');
}

async function buildFinancePanel() {
  return {
    text: '📊 <b>INFORME FINANCIERO</b>\n\nElegí el período:',
    html: true,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '📆 Hoy', callback_data: 'fin:hoy' },
          { text: '📆 Ayer', callback_data: 'fin:ayer' }
        ],
        [
          { text: '🗓️ Últimos 7 días', callback_data: 'fin:7d' },
          { text: '🗓️ Este mes', callback_data: 'fin:mes' }
        ],
        [
          { text: '🗓️ Mes pasado', callback_data: 'fin:mespasado' }
        ]
      ]
    }
  };
}

function financeRange(action) {
  const hoy = todayBogota();
  switch (action) {
    case 'hoy': return { from: hoy, to: hoy };
    case 'ayer': return { from: addDaysBogota(hoy, -1), to: addDaysBogota(hoy, -1) };
    case '7d': return { from: addDaysBogota(hoy, -6), to: hoy };
    case 'mes': return { from: startOfMonthBogota(), to: hoy };
    case 'mespasado': return prevMonthRangeBogota();
    default: return null;
  }
}

// ============================================================
// Wizard de gasto (/gasto): preguntas guiadas por el chat
// ============================================================

const CAT_LABELS = {
  arriendo: '🏠 Arriendo',
  servicios: '💡 Servicios',
  nomina: '👷 Nómina',
  transporte: '🚚 Transporte',
  mantenimiento: '🔧 Mantenimiento',
  otros: '📌 Otros'
};

function catLabel(cat) {
  return CAT_LABELS[cat] || cat;
}

function categoriasKeyboard() {
  const cats = finance.CATEGORIAS_GASTO;
  const rows = [];
  for (let i = 0; i < cats.length; i += 2) {
    rows.push(cats.slice(i, i + 2).map(function (c) {
      return { text: catLabel(c), callback_data: 'gas:cat:' + c };
    }));
  }
  rows.push([{ text: '❌ Cancelar', callback_data: 'gas:cancel' }]);
  return { inline_keyboard: rows };
}

async function getEstado(chatId) {
  try {
    const { data } = await supabase
      .from('telegram_estado')
      .select('estado, datos')
      .eq('chat_id', chatId)
      .maybeSingle();
    return data || null;
  } catch (e) {
    return null;
  }
}

async function setEstado(chatId, estado, datos) {
  await supabase.from('telegram_estado').upsert({
    chat_id: chatId,
    estado: estado,
    datos: datos || {},
    actualizado_en: new Date().toISOString()
  }, { onConflict: 'chat_id' });
}

async function clearEstado(chatId) {
  try {
    await supabase.from('telegram_estado').delete().eq('chat_id', chatId);
  } catch (e) { /* noop */ }
}

// Inicia el formulario guiado de gasto (paso 1: monto)
async function startGastoWizard(chatId) {
  await setEstado(chatId, 'gasto_monto', {});
  return {
    text: '💸 <b>Nuevo gasto operativo</b>\n\n1️⃣ Enviá el <b>monto</b> (solo el número, ej: 150000).\n\nPara cancelar enviá /cancelar.',
    html: true
  };
}

// Procesa un texto libre mientras hay un wizard activo. Devuelve null si
// el chat no tiene ningún flujo pendiente (o si el texto es un comando).
async function handleGastoFlowText(text, chatId, ctx) {
  const context = ctx || {};
  if (!chatId) return null;
  // Solo usuarios vinculados con permiso de gastos, y solo por privado
  if (!context.actor || context.actor.permissions.indexOf('finance.gastos') === -1) return null;
  if (!context.isPrivate) return null;
  const clean = String(text || '').trim();
  if (!clean || clean.charAt(0) === '/') return null;
  const estado = await getEstado(chatId);
  if (!estado || String(estado.estado).indexOf('gasto_') !== 0) return null;

  // Paso 1: monto
  if (estado.estado === 'gasto_monto') {
    const monto = parseFloat(clean.replace(/[^0-9.,]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    if (!monto || monto <= 0 || monto > 999999999) {
      return {
        text: '⚠️ No entendí el monto. Enviá solo el número (ej: <code>150000</code>) o /cancelar.',
        html: true
      };
    }
    await setEstado(chatId, 'gasto_categoria', { monto: Math.round(monto * 100) / 100 });
    return {
      text: '💵 Monto: <b>' + formatCurrency(monto) + '</b>\n\n2️⃣ Elegí la <b>categoría</b>:',
      html: true,
      replyMarkup: categoriasKeyboard()
    };
  }

  // Paso 3: descripción (texto libre)
  if (estado.estado === 'gasto_descripcion') {
    const d = estado.datos || {};
    return await guardarGastoWizard(chatId, d.monto, d.categoria, clean.slice(0, 300));
  }

  return null;
}

// Guarda el gasto del wizard y devuelve el mensaje de confirmación.
// edit=true cuando se responde a un botón (edita el mensaje en el lugar).
async function guardarGastoWizard(chatId, monto, categoria, descripcion, edit) {
  const { error } = await supabase.from('gastos').insert({
    fecha: todayBogota(),
    categoria: categoria,
    descripcion: descripcion || null,
    monto: monto,
    usuario_id: null
  });
  if (error) throw error;
  await clearEstado(chatId);
  const lines = [
    '✅ <b>Gasto registrado</b>',
    '',
    '• Fecha: ' + formatDateEs(todayBogota()),
    '• Categoría: ' + catLabel(categoria),
    '• Monto: ' + formatCurrency(monto)
  ];
  if (descripcion) lines.push('• Descripción: ' + escHtml(descripcion));
  return {
    text: lines.join('\n'),
    html: true,
    edit: !!edit,
    toast: '✅ Gasto registrado',
    replyMarkup: {
      inline_keyboard: [[
        { text: '📊 Ver informe de hoy', callback_data: 'fin:hoy' },
        { text: '➕ Otro gasto', callback_data: 'gas:nuevo' }
      ]]
    }
  };
}

// ============================================================
// Comandos del chat
// ============================================================

// ============================================================
// RBAC de Telegram: el bot decide segun el rol del usuario
// ============================================================

// Comandos que requieren permiso. `sensitive` = solo por privado
// (lo contable/admin nunca se responde en el grupo).
const COMMAND_RULES = {
  '/notificaciones': { perm: 'users.manage', sensitive: true },
  '/notif': { perm: 'users.manage', sensitive: true },
  '/estado': { perm: 'users.manage', sensitive: true },
  '/pausar': { perm: 'users.manage', sensitive: true },
  '/reanudar': { perm: 'users.manage', sensitive: true },
  '/silenciar_pos': { perm: 'users.manage', sensitive: true },
  '/activar_pos': { perm: 'users.manage', sensitive: true },
  '/silenciar_listos': { perm: 'users.manage', sensitive: true },
  '/activar_listos': { perm: 'users.manage', sensitive: true },
  '/silenciar_stock': { perm: 'users.manage', sensitive: true },
  '/activar_stock': { perm: 'users.manage', sensitive: true },
  '/inventario': { perm: 'products.view' },
  '/inventarios': { perm: 'products.view' },
  '/stockbajos': { perm: 'products.view' },
  '/bajos': { perm: 'products.view' },
  '/finanzas': { perm: 'finance.view', sensitive: true },
  '/gasto': { perm: 'finance.gastos', sensitive: true },
  '/hoy': { perm: 'finance.view', sensitive: true },
  '/resumen': { perm: 'finance.view', sensitive: true },
  '/rango': { perm: 'finance.view', sensitive: true }
};

// Resuelve el actor de Telegram (perfil + permisos) por su Telegram ID
async function getTelegramActor(fromId) {
  if (!fromId) return null;
  try {
    const { data } = await supabase
      .from('perfiles')
      .select('id, username, activo')
      .eq('telegram_user_id', fromId)
      .maybeSingle();
    if (!data || data.activo === false) return null;
    const info = await getUserPermissions(data.id);
    return {
      userId: data.id,
      username: data.username,
      roleId: info.roleId,
      roleName: info.roleName,
      permissions: info.permissions
    };
  } catch (e) {
    return null;
  }
}

// Ayuda filtrada segun permisos del actor
function buildHelpText(actor, isPrivate) {
  const lines = ['🤖 <b>Comandos disponibles</b>', ''];
  lines.push('/id — Ver tu Telegram ID (para vincular tu cuenta)');

  if (!actor) {
    lines.push('');
    lines.push('🔒 Tu Telegram no está vinculado a una cuenta.');
    lines.push('Enviá /id y pedile al administrador que cargue ese número en tu usuario (Usuarios y Roles).');
    lines.push('/ayuda — Ver esta ayuda');
    return lines.join('\n');
  }

  const can = function (perm) { return actor.permissions.indexOf(perm) !== -1; };
  const priv = isPrivate ? '' : ' <i>(solo por privado)</i>';
  if (can('products.view')) {
    lines.push('/stockbajos — Ver los productos bajo mínimo ahora');
    lines.push('/inventario — Reportes PDF (productos, platos, bebidas, stock bajo)');
  }
  if (can('finance.view')) {
    lines.push('/hoy — Resumen de ventas de hoy' + priv);
    lines.push('/rango — Resumen por rango de fechas' + priv);
    lines.push('/finanzas — Informe contable' + priv);
  }
  if (can('finance.gastos')) lines.push('/gasto — Registrar un gasto operativo' + priv);
  if (can('users.manage')) {
    lines.push('/notificaciones — Panel para activar/silenciar avisos' + priv);
    lines.push('/estado — Ver el estado del bot' + priv);
  }
  lines.push('/ayuda — Ver esta ayuda');
  lines.push('');
  lines.push('👤 Rol: <b>' + escHtml(actor.roleName || actor.roleId || '-') + '</b>');
  return lines.join('\n');
}

function denyResponse(reason) {
  return { text: reason, html: true };
}

// Procesa un comando. ctx = { fromId, isPrivate, actor }
async function handleTelegramCommand(text, ctx) {
  const context = ctx || {};
  const clean = String(text || '').trim();
  const cmd = clean.toLowerCase().split('@')[0].split(/\s+/)[0];

  // /id siempre disponible (para poder vincular la cuenta)
  if (cmd === '/id') {
    return {
      text: '🆔 Tu Telegram ID es: <code>' + String(context.fromId || '?') + '</code>\n\nPedile al administrador que lo cargue en tu usuario (Usuarios y Roles → Telegram ID).',
      html: true
    };
  }

  // Ayuda filtrada por permisos
  if (cmd === '/start' || cmd === '/ayuda' || cmd === '/help') {
    return { text: buildHelpText(context.actor, !!context.isPrivate), html: true };
  }

  // Control de acceso por comando
  const rule = COMMAND_RULES[cmd];
  if (rule) {
    if (!context.actor) {
      return denyResponse('🔒 Tu Telegram no está vinculado a una cuenta.\nEnviá /id y pedile al administrador que cargue ese número en tu usuario.');
    }
    if (context.actor.permissions.indexOf(rule.perm) === -1) {
      return denyResponse('⛔ No tenés permiso para este comando.');
    }
    if (rule.sensitive && !context.isPrivate) {
      return denyResponse('🔒 Ese comando es privado.\nAbrí el chat con el bot y pedilo ahí.');
    }
  }

  switch (cmd) {
    case '/notificaciones':
    case '/notif': {
      const panel = await buildNotificationsPanel();
      return { text: panel.text, markdown: panel.markdown, replyMarkup: panel.replyMarkup };
    }
    case '/inventario':
    case '/inventarios': {
      const panel = await buildInventoryPanel();
      return { text: panel.text, markdown: panel.markdown, replyMarkup: panel.replyMarkup };
    }
    case '/stockbajos':
    case '/bajos': {
      return {
        text: await buildLowStockText(),
        html: true,
        replyMarkup: {
          inline_keyboard: [[
            { text: '📄 Generar PDF', callback_data: 'inv:bajos' }
          ]]
        }
      };
    }
    case '/finanzas': {
      const args = clean.split(/\s+/).slice(1);
      if (args.length === 0) return await buildFinancePanel();
      const d1 = parseDateArg(args[0]);
      const d2 = args[1] ? parseDateArg(args[1]) : d1;
      if (!d1 || !d2) return '⚠️ Formato inválido. Ej: /finanzas 20/09/2026 26/09/2026';
      const summary = await finance.getFinanceSummary(d1, d2);
      return {
        text: buildFinanceReportText(summary),
        html: true,
        replyMarkup: { inline_keyboard: [[{ text: '📄 Generar PDF', callback_data: 'fin:pdf:' + d1 + ':' + d2 }]] }
      };
    }
    case '/cancelar':
    case '/cancel': {
      await clearEstado(getConfiguredChatId());
      return { text: '❌ Operación cancelada.', html: true };
    }
    case '/gasto': {
      const args = clean.split(/\s+/).slice(1);
      // Sin argumentos: formulario guiado por pasos
      if (args.length === 0) return await startGastoWizard(getConfiguredChatId());
      const monto = parseFloat(String(args[0] || '').replace(/[^0-9.]/g, ''));
      const categoria = String(args[1] || 'otros').toLowerCase();
      const descripcion = args.slice(2).join(' ') || null;
      if (!monto || monto <= 0) return '⚠️ Uso: /gasto 150000 arriendo [descripción]';
      if (finance.CATEGORIAS_GASTO.indexOf(categoria) === -1) {
        return '⚠️ Categoría inválida. Opciones: ' + finance.CATEGORIAS_GASTO.join(', ');
      }
      const { error } = await supabase.from('gastos').insert({
        fecha: todayBogota(),
        categoria: categoria,
        descripcion: descripcion,
        monto: Math.round(monto * 100) / 100,
        usuario_id: null
      });
      if (error) throw error;
      return '✅ Gasto registrado: ' + formatCurrency(monto) + ' · ' + categoria + (descripcion ? ' · ' + descripcion : '');
    }
    case '/hoy':
    case '/resumen': {
      const args = clean.split(/\s+/).slice(1);
      if (args.length === 0) return await buildDailySummaryRange(todayBogota(), todayBogota());
      const d = parseDateArg(args[0]);
      if (!d) return '⚠️ Formato inválido. Ej: /hoy 26/09/2026';
      return await buildDailySummaryRange(d, d);
    }
    case '/rango': {
      const args = clean.split(/\s+/).slice(1);
      if (args.length === 0) {
        // Selector de fechas con botones
        return {
          text: '📅 Elegí el rango de fechas:',
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '📆 Hoy', callback_data: 'rango:hoy' },
                { text: '📆 Ayer', callback_data: 'rango:ayer' }
              ],
              [
                { text: '🗓️ Últimos 7 días', callback_data: 'rango:7d' },
                { text: '🗓️ Este mes', callback_data: 'rango:mes' }
              ],
              [
                { text: '🗓️ Mes pasado', callback_data: 'rango:mespasado' }
              ]
            ]
          }
        };
      }
      const d1 = parseDateArg(args[0]);
      const d2 = args[1] ? parseDateArg(args[1]) : d1;
      if (!d1 || !d2) return '⚠️ Formato inválido. Ej: /rango 20/09/2026 26/09/2026';
      return await buildDailySummaryRange(d1, d2);
    }
    case '/pausar':
      await updateBotSetting({ notifications_active: false });
      return '⏸️ Bot pausado. No se enviarán notificaciones.';
    case '/reanudar':
      await updateBotSetting({ notifications_active: true });
      return '▶️ Bot activo. Notificaciones reanudadas.';
    case '/silenciar_pos':
      await updateBotSetting({ notify_pos_orders: false });
      return '🔇 Notificaciones de pedidos POS desactivadas.';
    case '/activar_pos':
      await updateBotSetting({ notify_pos_orders: true });
      return '🔔 Notificaciones de pedidos POS activadas.';
    case '/silenciar_listos':
      await updateBotSetting({ notify_ready_orders: false });
      return '🔇 Alertas de platos listos desactivadas.';
    case '/activar_listos':
      await updateBotSetting({ notify_ready_orders: true });
      return '🔔 Alertas de platos listos activadas.';
    case '/silenciar_stock':
      await updateBotSetting({ notify_low_stock: false });
      return '🔇 Alertas de stock bajo desactivadas.';
    case '/activar_stock':
      await updateBotSetting({ notify_low_stock: true });
      return '🔔 Alertas de stock bajo activadas.';
    case '/estado': {
      const s = await getBotSettings();
      return [
        '📊 Estado del bot',
        '',
        s.notificationsActive ? '🔔 Notificaciones: ACTIVAS' : '⏸️ Notificaciones: PAUSADAS',
        s.notifyPosOrders ? '🛒 Pedidos POS: ACTIVOS' : '🔇 Pedidos POS: SILENCIADOS',
        s.notifyReadyOrders ? '🍽️ Avisos de listos: ACTIVOS' : '🔇 Avisos de listos: SILENCIADOS',
        s.notifyLowStock ? '📦 Stock bajo: ACTIVAS' : '🔇 Stock bajo: SILENCIADAS'
      ].join('\n');
    }
    default:
      return null; // no es un comando reconocido
  }
}

// Procesa el callback de un boton (selector de fechas o panel de notificaciones)
async function handleTelegramCallback(data, ctx) {
  const context = ctx || {};
  const parts = String(data || '').split(':');
  const key = parts[0];

  // Control de acceso por tipo de boton (mismos permisos que la web)
  const CALLBACK_RULES = {
    fin: { perm: 'finance.view', sensitive: true },
    gas: { perm: 'finance.gastos', sensitive: true },
    ntf: { perm: 'users.manage', sensitive: true },
    inv: { perm: 'products.view' },
    rango: { perm: 'finance.view', sensitive: true }
  };
  const rule = CALLBACK_RULES[key];
  if (rule) {
    if (!context.actor) {
      return { text: '🔒 Vinculá tu cuenta de Telegram para usar esto. Enviá /id y pedile al administrador que cargue tu ID.', html: true, toast: 'Sin permiso' };
    }
    if (context.actor.permissions.indexOf(rule.perm) === -1) {
      return { text: '⛔ No tenés permiso para esta acción.', html: true, toast: 'Sin permiso' };
    }
    if (rule.sensitive && !context.isPrivate) {
      return { text: '🔒 Esta acción es privada. Usá el chat privado con el bot.', html: true, toast: 'Solo por privado' };
    }
  }

  // --- Selector de fechas (/rango) ---
  if (key === 'rango') {
    const hoy = todayBogota();
    let from, to;
    switch (parts[1]) {
      case 'hoy': from = to = hoy; break;
      case 'ayer': from = to = addDaysBogota(hoy, -1); break;
      case '7d': from = addDaysBogota(hoy, -6); to = hoy; break;
      case 'mes': from = startOfMonthBogota(); to = hoy; break;
      case 'mespasado': {
        const r = prevMonthRangeBogota();
        from = r.from; to = r.to;
        break;
      }
      default: return null;
    }
    const text = await buildDailySummaryRange(from, to);
    return {
      text: text,
      replyMarkup: {
        inline_keyboard: [[
          { text: '📆 Hoy', callback_data: 'rango:hoy' },
          { text: '🗓️ Este mes', callback_data: 'rango:mes' }
        ]]
      }
    };
  }

  // --- Panel de inventario (/inventario): genera PDFs bajo pedido ---
  if (key === 'inv') {
    const action = parts[1];

    if (action === 'refresh') {
      const panel = await buildInventoryPanel();
      return { text: panel.text, markdown: panel.markdown, replyMarkup: panel.replyMarkup, edit: true, toast: '🔄 Actualizado' };
    }

    if (action === 'productos') {
      const data = await stockReport.getProductsData();
      const pdf = await stockReport.buildProductsPdf(data, 'Inventario');
      return {
        document: { buffer: pdf, filename: 'inventario.pdf', caption: '📦 Inventario completo (' + data.length + ' productos)' },
        toast: '📄 Generando inventario...'
      };
    }

    if (action === 'bajos') {
      const data = await stockReport.getLowStockData();
      if (data.length === 0) return { text: '✅ No hay productos en o bajo el mínimo.', toast: 'Sin stock bajo' };
      const pdf = await stockReport.buildProductsPdf(data, 'Productos con Stock Bajo');
      return {
        document: { buffer: pdf, filename: 'stock-bajo.pdf', caption: '⚠️ Productos con stock bajo (' + data.length + ')' },
        toast: '📄 Generando reporte...'
      };
    }

    if (action === 'platos' || action === 'bebidas') {
      const esPlato = action === 'platos';
      const data = await stockReport.getDishesData(esPlato ? 'plato' : 'bebida');
      if (data.length === 0) {
        return { text: (esPlato ? '🍽️ No hay platos activos.' : '🥤 No hay bebidas activas.'), toast: 'Sin datos' };
      }
      const pdf = await stockReport.buildDishesPdf(data, esPlato ? 'Platos' : 'Bebidas');
      return {
        document: {
          buffer: pdf,
          filename: (esPlato ? 'platos' : 'bebidas') + '.pdf',
          caption: (esPlato ? '🍽️ Platos' : '🥤 Bebidas') + ' (' + data.length + ') — costo, precio y margen'
        },
        toast: '📄 Generando reporte...'
      };
    }

    return null;
  }

  // --- Finanzas (/finanzas): informe contable + PDF ---
  if (key === 'fin') {
    const action = parts[1];
    if (action === 'pdf') {
      const from = parts[2];
      const to = parts[3];
      const summary = await finance.getFinanceSummary(from, to);
      const pdf = await stockReport.buildFinancePdf(summary, 'Informe Financiero');
      return {
        document: {
          buffer: pdf,
          filename: 'informe-financiero.pdf',
          caption: '📊 Informe financiero ' + from + ' → ' + to
        },
        toast: '📄 Generando informe...'
      };
    }
    const range = financeRange(action);
    if (!range) return null;
    const summary = await finance.getFinanceSummary(range.from, range.to);
    return {
      text: buildFinanceReportText(summary),
      html: true,
      replyMarkup: { inline_keyboard: [[{ text: '📄 Generar PDF', callback_data: 'fin:pdf:' + range.from + ':' + range.to }]] },
      edit: true,
      toast: '📊 Informe listo'
    };
  }

  // --- Wizard de gasto (/gasto) ---
  if (key === 'gas') {
    const action = parts[1];
    const chatId = getConfiguredChatId();

    if (action === 'nuevo') {
      return await startGastoWizard(chatId);
    }

    if (action === 'cancel') {
      await clearEstado(chatId);
      return { text: '❌ Registro cancelado.', html: true, edit: true, toast: 'Cancelado' };
    }

    if (action === 'cat') {
      const cat = parts[2];
      const estado = await getEstado(chatId);
      if (!estado || estado.estado !== 'gasto_categoria' || finance.CATEGORIAS_GASTO.indexOf(cat) === -1) {
        return { text: '⚠️ La sesión expiró. Enviá /gasto para empezar de nuevo.', html: true, toast: 'Sesión expirada' };
      }
      await setEstado(chatId, 'gasto_descripcion', { monto: estado.datos.monto, categoria: cat });
      return {
        text: '💵 Monto: <b>' + formatCurrency(estado.datos.monto) + '</b>\n🏷️ Categoría: <b>' + catLabel(cat) + '</b>\n\n3️⃣ Escribí una <b>descripción</b> (opcional) o tocá el botón:',
        html: true,
        edit: true,
        toast: 'Categoría: ' + catLabel(cat),
        replyMarkup: {
          inline_keyboard: [[
            { text: '⏭️ Sin descripción', callback_data: 'gas:skip' },
            { text: '❌ Cancelar', callback_data: 'gas:cancel' }
          ]]
        }
      };
    }

    if (action === 'skip') {
      const estado = await getEstado(chatId);
      if (!estado || estado.estado !== 'gasto_descripcion') {
        return { text: '⚠️ La sesión expiró. Enviá /gasto para empezar de nuevo.', html: true, toast: 'Sesión expirada' };
      }
      return await guardarGastoWizard(chatId, estado.datos.monto, estado.datos.categoria, null, true);
    }

    return null;
  }

  // --- Panel de notificaciones (/notificaciones) ---
  if (key === 'ntf') {
    const action = parts[1];
    let toast = null;
    const s = await getBotSettings();
    switch (action) {
      case 'pos':
        await updateBotSetting({ notify_pos_orders: !s.notifyPosOrders });
        toast = s.notifyPosOrders ? '🔇 POS desactivado' : '🔔 POS activado';
        break;
      case 'listos':
        await updateBotSetting({ notify_ready_orders: !s.notifyReadyOrders });
        toast = s.notifyReadyOrders ? '🔇 Listos desactivado' : '🔔 Listos activado';
        break;
      case 'stock':
        await updateBotSetting({ notify_low_stock: !s.notifyLowStock });
        toast = s.notifyLowStock ? '🔇 Stock desactivado' : '🔔 Stock activado';
        break;
      case 'all': {
        // "Todo" activa/desactiva TODAS las opciones a la vez
        const nuevo = !s.notificationsActive;
        await updateBotSetting({
          notifications_active: nuevo,
          notify_pos_orders: nuevo,
          notify_ready_orders: nuevo,
          notify_low_stock: nuevo
        });
        toast = nuevo ? '▶️ Todo activado' : '⏸️ Todo pausado';
        break;
      }
      case 'refresh':
        toast = '🔄 Actualizado';
        break;
      default:
        return null;
    }
    const panel = await buildNotificationsPanel();
    return {
      text: panel.text,
      markdown: panel.markdown,
      replyMarkup: panel.replyMarkup,
      edit: true,
      toast: toast
    };
  }

  return null;
}

module.exports = {
  notifyNewOrder,
  notifyOrderReady,
  sendTelegramMessage,
  sendTelegramDocument,
  editTelegramMessage,
  buildOrderMessage,
  buildReadyMessage,
  buildDailySummaryRange,
  buildFinanceReportText,
  buildNotificationsPanel,
  buildInventoryPanel,
  buildLowStockText,
  buildLowStockReport,
  handleTelegramCommand,
  handleTelegramCallback,
  handleGastoFlowText,
  getTelegramActor,
  answerCallbackQuery,
  getBotSettings,
  updateBotSetting,
  getConfiguredChatId,
  isConfigured
};
