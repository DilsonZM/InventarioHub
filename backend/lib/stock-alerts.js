// lib/stock-alerts.js
// Alerta a Telegram cuando un producto queda en o bajo su stock minimo.
// Se llama despues de operaciones que descuentan stock (ventas, mermas,
// reservas). Evita repetir la misma alerta con un cooldown por producto
// (columna productos.alerta_stock_enviada_en).
//
// Nunca lanza excepciones: si falla, solo queda el warning en consola.

const supabase = require('./supabase');
const { sendTelegramMessage, getBotSettings } = require('./telegram');

const ALERT_COOLDOWN_HOURS = 12;

function fmtNum(n) {
  return (Number(n) || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

async function checkLowStockAlerts() {
  try {
    const settings = await getBotSettings();
    if (!settings.notificationsActive) return;
    if (!settings.notifyLowStock) {
      console.log('[stock-alerts] omitido: alertas de stock silenciadas');
      return;
    }

    const { data: prods, error } = await supabase
      .from('productos')
      .select('id, nombre, stock_actual, stock_minimo, unidad_medida, alerta_stock_enviada_en')
      .eq('activo', true);
    if (error) throw error;

    const cutoff = Date.now() - ALERT_COOLDOWN_HOURS * 60 * 60 * 1000;
    const bajos = (prods || []).filter(function (p) {
      const stock = parseFloat(p.stock_actual) || 0;
      const min = parseFloat(p.stock_minimo) || 0;
      if (min <= 0 || stock > min) return false;
      if (p.alerta_stock_enviada_en && new Date(p.alerta_stock_enviada_en).getTime() > cutoff) return false;
      return true;
    });
    if (bajos.length === 0) return;

    // Mas critico primero (menor proporcion stock/minimo)
    bajos.sort(function (a, b) {
      const ra = (parseFloat(a.stock_actual) || 0) / (parseFloat(a.stock_minimo) || 1);
      const rb = (parseFloat(b.stock_actual) || 0) / (parseFloat(b.stock_minimo) || 1);
      return ra - rb;
    });

    const lines = [];
    lines.push('⚠️ ALERTA DE STOCK BAJO');
    lines.push('');
    lines.push('🔴 Productos en o bajo el mínimo:');
    bajos.slice(0, 20).forEach(function (p) {
      lines.push('• ' + p.nombre + ': ' + fmtNum(p.stock_actual) + ' ' + (p.unidad_medida || '')
        + ' (mín. ' + fmtNum(p.stock_minimo) + ')');
    });
    if (bajos.length > 20) lines.push('…y ' + (bajos.length - 20) + ' más');
    lines.push('');
    lines.push('🛒 Registra una entrada o ajusta el stock.');

    const res = await sendTelegramMessage(lines.join('\n'), { markdown: false });
    if (res && res.ok) {
      const nowIso = new Date().toISOString();
      for (const p of bajos) {
        await supabase.from('productos').update({ alerta_stock_enviada_en: nowIso }).eq('id', p.id);
      }
      console.log('[stock-alerts] alerta enviada para', bajos.length, 'productos');
    }
  } catch (err) {
    console.warn('[stock-alerts] error (no bloqueante):', err.message);
  }
}

module.exports = { checkLowStockAlerts };
