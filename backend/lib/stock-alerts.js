// lib/stock-alerts.js
// Alerta a Telegram cuando un producto queda en o bajo su stock minimo.
// Se llama despues de operaciones que descuentan stock (ventas, mermas,
// reservas). Evita repetir la misma alerta con un cooldown por producto
// (columna productos.alerta_stock_enviada_en).
//
// Nunca lanza excepciones: si falla, solo queda el warning en consola.

const supabase = require('./supabase');
const { sendTelegramMessage, getBotSettings, buildLowStockReport } = require('./telegram');

const ALERT_COOLDOWN_HOURS = 12;

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

    const res = await sendTelegramMessage(
      buildLowStockReport(bajos, 'ALERTA DE STOCK BAJO'),
      { html: true }
    );
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

// Reporte diario de stock bajo (cron de Vercel, 8am Bogota).
// Lista TODOS los productos bajo minimo (ignora el cooldown de 12h).
async function sendDailyLowStockReport() {
  try {
    const settings = await getBotSettings();
    if (!settings.notificationsActive) return { skipped: 'notificaciones pausadas' };
    if (!settings.notifyLowStock) return { skipped: 'alertas de stock silenciadas' };

    const { data: prods, error } = await supabase
      .from('productos')
      .select('id, nombre, stock_actual, stock_minimo, unidad_medida')
      .eq('activo', true);
    if (error) throw error;

    const bajos = (prods || []).filter(function (p) {
      const stock = parseFloat(p.stock_actual) || 0;
      const min = parseFloat(p.stock_minimo) || 0;
      return min > 0 && stock <= min;
    });

    // Si no hay bajos, enviar el mensaje positivo igual
    const res = await sendTelegramMessage(
      buildLowStockReport(bajos, 'REPORTE DIARIO DE STOCK'),
      { html: true }
    );
    if (res && res.ok && bajos.length > 0) {
      const nowIso = new Date().toISOString();
      for (const p of bajos) {
        await supabase.from('productos').update({ alerta_stock_enviada_en: nowIso }).eq('id', p.id);
      }
    }
    return { sent: bajos.length };
  } catch (err) {
    console.warn('[stock-alerts] reporte diario error:', err.message);
    return { error: err.message };
  }
}

module.exports = { checkLowStockAlerts, sendDailyLowStockReport };
