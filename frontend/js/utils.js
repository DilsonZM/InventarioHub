// Utilidades con cache para optimización de rendimiento
// Basado en: js-cache-function-results, js-cache-storage

const STORAGE_VERSION = 'v1';

// Timezone del proyecto (UTC-5)
const APP_TIMEZONE = 'America/Bogota';

const formatCache = new Map();

export function formatCurrency(n) {
  const key = `currency:${n}`;
  if (formatCache.has(key)) return formatCache.get(key);
  const num = Number(n);
  let result;
  if (Number.isFinite(num) && Number.isInteger(num)) {
    result = '$' + num.toLocaleString('en-US');
  } else {
    result = '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  formatCache.set(key, result);
  if (formatCache.size > 1000) {
    const firstKey = formatCache.keys().next().value;
    formatCache.delete(firstKey);
  }
  return result;
}

export function formatDate(iso) {
  const key = `date:${iso}`;
  if (formatCache.has(key)) return formatCache.get(key);
  const result = new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: APP_TIMEZONE
  });
  formatCache.set(key, result);
  if (formatCache.size > 1000) {
    const firstKey = formatCache.keys().next().value;
    formatCache.delete(firstKey);
  }
  return result;
}

export function formatDateShort(iso) {
  const key = `dateShort:${iso}`;
  if (formatCache.has(key)) return formatCache.get(key);
  const result = new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short',
    timeZone: APP_TIMEZONE
  });
  formatCache.set(key, result);
  return result;
}

function saveStorage(key, data) {
  try {
    localStorage.setItem(`${key}:${STORAGE_VERSION}`, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function loadStorage(key) {
  try {
    const raw = localStorage.getItem(`${key}:${STORAGE_VERSION}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearStorage(key) {
  try {
    localStorage.removeItem(`${key}:${STORAGE_VERSION}`);
  } catch {}
}

export function debounce(fn, ms) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

function throttle(fn, ms) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function nowInAppTZ() {
  // Devuelve la fecha/hora actual en la timezone de la app (UTC-5),
  // robusta al timezone del navegador: extrae los componentes
  // directamente del timezone objetivo y construye un Date local.
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const get = (type) => (parts.find(p => p.type === type) || {}).value || '0';
  return new Date(
    parseInt(get('year'), 10),
    parseInt(get('month'), 10) - 1,
    parseInt(get('day'), 10),
    parseInt(get('hour'), 10) % 24, // 24:00 a 0
    parseInt(get('minute'), 10),
    parseInt(get('second'), 10)
  );
}

export function todayInAppTZ() {
  // Devuelve un string YYYY-MM-DD con la fecha actual en la timezone de la app
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return formatter.format(now); // en-CA da formato YYYY-MM-DD
}

export function exportToCSV(rows, filename) {
  if (!rows || rows.length === 0) return false;
  const headers = Object.keys(rows[0]);
  const escapeCSV = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? '"' + s + '"' : s;
  };
  const csv = headers.map(escapeCSV).join(',') + '\n'
    + rows.map(r => headers.map(h => escapeCSV(r[h])).join(',')).join('\n');

  const bom = '\uFEFF'; // BOM para Excel en español
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  return true;
}

export function printStockReport(products, title) {
  if (!products || products.length === 0) return false;

  const fecha = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  const lines = [];
  let totalNeeded = 0;
  let criticalCount = 0;

  products.forEach(p => {
    if (p.stock <= 0) criticalCount++;
    totalNeeded += (p.minStock || 0) - (p.stock || 0);
  });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title || 'Reporte de Stock')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans','Segoe UI',sans-serif;color:#1a1a2e;background:#f8f9fc;padding:40px 24px;max-width:700px;margin:0 auto;font-size:13px;line-height:1.5}
  .card{background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 20px rgba(0,0,0,.06);border:1px solid #e8ecf1}
  .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px dashed #e8ecf1}
  .header h1{font-family:'Space Mono',monospace;font-size:20px;letter-spacing:2px;color:#073626;margin-bottom:4px;font-weight:700}
  .header h2{font-size:13px;color:#7d8c98;font-weight:500;letter-spacing:1px}
  .header .sub{font-size:11px;color:#94a3b8;margin-top:2px}
  .meta{display:flex;justify-content:space-between;gap:16px;margin-bottom:20px;font-size:12px;color:#64748b}
  .meta .label{font-weight:600;color:#334155}
  .title-bar{background:#f0f4f8;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
  .title-bar h3{font-size:14px;font-weight:700;color:#0f172a}
  .title-bar .count{font-size:12px;color:#64748b;font-weight:500}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;padding:10px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#64748b;border-bottom:2px solid #e8ecf1}
  td{padding:10px 8px;border-bottom:1px solid #f1f5f9;color:#334155}
  tr:hover td{background:#f8fafc}
  .stock-bar{display:inline-block;height:6px;border-radius:3px;min-width:30px;vertical-align:middle;margin-right:6px}
  .stock-critical .stock-bar{background:#ef4444}
  .stock-low .stock-bar{background:#f59e0b}
  .name{font-weight:600;color:#0f172a}
  .sku{font-family:'Space Mono',monospace;font-size:11px;color:#94a3b8}
  .qty{text-align:right;font-weight:600;font-family:'Space Mono',monospace}
  .footer{text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e8ecf1;font-size:11px;color:#94a3b8}
  .footer .brand{font-weight:600;color:#64748b}
  .summary{display:flex;gap:16px;margin-bottom:16px}
  .summary-box{flex:1;background:#f8fafc;border-radius:10px;padding:12px;text-align:center}
  .summary-box .val{font-family:'Space Mono',monospace;font-size:18px;font-weight:700;color:#0f172a}
  .summary-box .lab{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px}
  .print-btn{display:none}
  @media print{
    body{background:#fff;padding:0;max-width:100%}
    .card{box-shadow:none;border:none;padding:20px 16px}
    .print-btn{display:none!important}
    @page{margin:12mm}
  }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>CORNER HOUSE</h1>
    <h2>Sabores que unen</h2>
    <div class="sub">Reporte generado ${escapeHtml(fecha)}</div>
  </div>

  <div class="meta">
    <div><span class="label">Tipo:</span> ${escapeHtml(title || 'Reporte de Stock')}</div>
    <div><span class="label">Fecha:</span> ${escapeHtml(fecha)}</div>
  </div>

  <div class="summary">
    <div class="summary-box"><div class="val">${products.length}</div><div class="lab">Productos</div></div>
    <div class="summary-box"><div class="val">${criticalCount}</div><div class="lab">Agotados</div></div>
    <div class="summary-box"><div class="val" style="color:#dc2626">${totalNeeded}</div><div class="lab">Faltante Total</div></div>
  </div>

  <div class="title-bar">
    <h3>Detalle de Productos</h3>
    <div class="count">${products.length} items</div>
  </div>

  <table>
    <thead><tr><th>Producto</th><th>SKU</th><th style="text-align:right">Actual</th><th style="text-align:right">Mínimo</th><th style="text-align:right">Unidad</th></tr></thead>
    <tbody>
      ${products.map(p => {
        const pct = p.minStock > 0 ? Math.min((p.stock / p.minStock) * 100, 100) : 0;
        const cls = p.stock <= 0 ? 'stock-critical' : (p.stock <= p.minStock ? 'stock-low' : '');
        return `<tr class="${cls}">
          <td><span class="name">${escapeHtml(p.name || p.nombre || '')}</span></td>
          <td><span class="sku">${escapeHtml(p.sku || '')}</span></td>
          <td class="qty" style="color:${p.stock <= 0 ? '#ef4444' : p.stock <= p.minStock ? '#f59e0b' : '#16a34a'}">${Math.round((p.stock || 0) * 100) / 100}</td>
          <td class="qty">${p.minStock || 0}</td>
          <td class="qty">${escapeHtml(p.unidad || 'unidad')}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p class="brand">Corner House — Sabores que unen</p>
    <p>Este reporte es informativo. Revise el inventario antes de hacer pedidos.</p>
    <p>Impreso: ${escapeHtml(fecha)}</p>
  </div>
</div>
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 200);
  });
<\/script>
</body>
</html>`;

  const w = window.open('', 'cornerhouse_stock', 'width=560,height=800,scrollbars=yes');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

window.Utils = {
  APP_TIMEZONE,
  formatCurrency,
  formatDate,
  formatDateShort,
  nowInAppTZ,
  todayInAppTZ,
  saveStorage,
  loadStorage,
  clearStorage,
  debounce,
  throttle,
  escapeHtml,
  exportToCSV,
  printStockReport,
};
