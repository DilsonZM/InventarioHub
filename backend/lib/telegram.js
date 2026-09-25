// lib/telegram.js
// Notificaciones de pedidos nuevos a Telegram.
//
// El token del bot vive SOLO en variables de entorno del backend
// (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID), nunca en el frontend.
//
// Regla de oro: si Telegram falla o no esta configurado, el pedido
// NUNCA se cancela ni se le muestra un error al usuario; solo se
// registra el problema en consola.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

function isConfigured() {
  return !!(BOT_TOKEN && CHAT_ID);
}

function formatCurrency(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
}

// Escapa caracteres reservados de Markdown (v1) de Telegram
function esc(s) {
  return String(s == null ? '' : s).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function buildOrderMessage(order) {
  const lines = [];
  lines.push('🔔 *Nuevo Pedido Registrado*');
  lines.push('');
  // Etiqueta: "Pedido" para ordenes con platos, "Reserva" para reservas de mesa
  lines.push('*' + esc(order.ref_label || 'Pedido') + ':* ' + esc(order.numero_venta || order.numero || '-'));
  lines.push('*Destino:* ' + esc(order.destino || '—'));
  if (order.cliente) lines.push('*Cliente:* ' + esc(order.cliente));
  if (order.telefono) lines.push('*Teléfono:* ' + esc(order.telefono));
  if (order.direccion) lines.push('*Dirección:* ' + esc(order.direccion));
  if (order.barrio) lines.push('*Barrio:* ' + esc(order.barrio));
  lines.push('');
  lines.push('*Productos:*');
  (order.items || []).forEach(function (it) {
    lines.push('• ' + esc((it.cantidad || 1) + 'x ' + (it.nombre || '')));
    if (it.observacion) lines.push('   📝 ' + esc(it.observacion));
  });
  if (!order.items || order.items.length === 0) {
    lines.push('• (sin platos, solo reserva de mesa)');
  }
  lines.push('');
  lines.push('*Total:* ' + esc(formatCurrency(order.total)));
  if (order.notas) lines.push('*Notas:* ' + esc(order.notas));
  lines.push('');
  lines.push('🕐 ' + esc(order.hora || new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })));
  return lines.join('\n');
}

async function sendTelegramMessage(text) {
  if (!isConfigured()) return { ok: false, skipped: true };
  try {
    const res = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: 'MarkdownV2' })
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
async function notifyNewOrder(order) {
  try {
    if (!isConfigured()) {
      console.log('[telegram] no configurado (falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID)');
      return;
    }
    await sendTelegramMessage(buildOrderMessage(order || {}));
  } catch (err) {
    console.warn('[telegram] notifyNewOrder error (no bloqueante):', err.message);
  }
}

module.exports = { notifyNewOrder, sendTelegramMessage, buildOrderMessage, isConfigured };
