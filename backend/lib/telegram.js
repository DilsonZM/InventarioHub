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
  const max = attempts || 2;
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
async function sendTelegramMessage(text, options) {
  if (!isConfigured()) return { ok: false, skipped: true };
  const useMarkdown = !options || options.markdown !== false;
  try {
    const payload = { chat_id: CHAT_ID, text: text };
    if (useMarkdown) {
      payload.parse_mode = 'MarkdownV2';
      // Evita la tarjeta de preview del link de WhatsApp (ocupa mucho espacio)
      payload.disable_web_page_preview = true;
      payload.link_preview_options = { is_disabled: true };
    }
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
    console.log('[telegram] notificacion enviada');
    return { ok: true };
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

// Acepta 'YYYY-MM-DD' o 'DD/MM' (o 'DD-MM') y devuelve 'YYYY-MM-DD'
function parseDateArg(raw) {
  const s = String(raw || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const year = todayBogota().slice(0, 4);
    const dd = String(m[1]).padStart(2, '0');
    const mm = String(m[2]).padStart(2, '0');
    return year + '-' + mm + '-' + dd;
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

// Resumen de ventas de un dia o rango (fechas en zona Bogota)
async function buildDailySummary(args) {
  const { applyBogotaDateFilter } = require('./timezone');
  let from, to;
  const a1 = args[0] ? parseDateArg(args[0]) : null;
  const a2 = args[1] ? parseDateArg(args[1]) : null;
  if (!args.length) {
    from = to = todayBogota();
  } else if (args.length === 1 && a1) {
    from = to = a1;
  } else if (args.length >= 2 && a1 && a2) {
    from = a1; to = a2;
    if (from > to) { const t = from; from = to; to = t; }
  } else {
    return '⚠️ Formato inválido\\. Usá:\n/hoy\n/hoy 26/09\n/hoy 20/09 26/09\n/hoy 2026-09-26';
  }

  let query = supabase
    .from('ventas')
    .select('total, estado, estado_cocina, venta_detalles(producto_nombre, cantidad)');
  query = applyBogotaDateFilter(query, 'creado_en', from, to);
  const { data, error } = await query;
  if (error) throw error;

  let pedidos = 0, facturado = 0, cortesias = 0, canceladas = 0;
  const platos = {};
  (data || []).forEach(function (v) {
    if (v.estado_cocina === 'cancelada') { canceladas++; return; }
    pedidos++;
    if (v.estado_cocina === 'cortesia') cortesias++;
    if (v.estado === 'completada') facturado += parseFloat(v.total) || 0;
    (v.venta_detalles || []).forEach(function (d) {
      const k = d.producto_nombre || '?';
      platos[k] = (platos[k] || 0) + (parseInt(d.cantidad, 10) || 0);
    });
  });

  const lista = Object.keys(platos).map(function (k) { return { nombre: k, cant: platos[k] }; })
    .sort(function (a, b) { return b.cant - a.cant; });

  const lines = [];
  lines.push('📊 RESUMEN DE VENTAS');
  lines.push('📅 ' + (from === to ? formatDateEs(from) : (formatDateEs(from) + ' → ' + formatDateEs(to))));
  lines.push('');
  lines.push('🧾 Pedidos: ' + pedidos);
  lines.push('💰 Facturado: ' + formatCurrency(facturado));
  lines.push('🎁 Cortesías: ' + cortesias);
  lines.push('❌ Cancelados: ' + canceladas);
  lines.push('');
  if (lista.length === 0) {
    lines.push('🍽️ Sin ventas registradas en ese período.');
  } else {
    lines.push('🍽️ Vendidos:');
    lista.slice(0, 15).forEach(function (p) {
      lines.push('• ' + p.cant + 'x ' + p.nombre);
    });
    if (lista.length > 15) lines.push('…y ' + (lista.length - 15) + ' más');
  }
  return lines.join('\n');
}

// ============================================================
// Comandos del chat
// ============================================================

const HELP_TEXT = [
  '🤖 Comandos disponibles:',
  '',
  '/estado — Ver el estado actual',
  '/hoy — Resumen de ventas de hoy (o /hoy 20/09 26/09)',
  '/pausar — Pausar todas las notificaciones',
  '/reanudar — Reanudar notificaciones',
  '/silenciar_pos — Silenciar pedidos del POS',
  '/activar_pos — Activar pedidos del POS',
  '/silenciar_listos — Silenciar avisos de platos listos',
  '/activar_listos — Activar avisos de platos listos',
  '/silenciar_stock — Silenciar alertas de stock bajo',
  '/activar_stock — Activar alertas de stock bajo'
].join('\n');

// Procesa un comando y devuelve el texto de respuesta (o null si no es comando)
async function handleTelegramCommand(text) {
  const clean = String(text || '').trim();
  const cmd = clean.toLowerCase().split('@')[0].split(/\s+/)[0];

  switch (cmd) {
    case '/start':
    case '/ayuda':
    case '/help':
      return HELP_TEXT;
    case '/hoy':
    case '/resumen': {
      const args = clean.split(/\s+/).slice(1);
      return await buildDailySummary(args);
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

module.exports = {
  notifyNewOrder,
  notifyOrderReady,
  sendTelegramMessage,
  buildOrderMessage,
  buildReadyMessage,
  buildDailySummary,
  handleTelegramCommand,
  getBotSettings,
  updateBotSetting,
  getConfiguredChatId,
  isConfigured
};
