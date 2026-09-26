// lib/stock-report.js
// Datos y generacion de PDFs para los reportes de Telegram:
//   - Productos (inventario completo)   -> mismo template que Utils.printStockReport
//   - Stock bajo (filtrado)             -> mismo template
//   - Platos / Bebidas (nuevo)          -> Plato | Costo | Precio | Margen | Margen %
//
// Los PDFs se generan SOLO bajo pedido (boton/comando) y se envian por Telegram.

const PDFDocument = require('pdfkit');
const supabase = require('./supabase');

const BRAND = '#073626';
const MUTED = '#7d8c98';
const LIGHT = '#94a3b8';
const TEXT = '#334155';
const LINE = '#e2e8f0';
const GREEN = '#16a34a';
const AMBER = '#f59e0b';
const RED = '#ef4444';

function fmtNum(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

function formatCurrency(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
}

function nowEs() {
  return new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'long', timeStyle: 'short'
  });
}

// Conversion de unidades (misma regla que routes/dishes.js)
function convertUnit(cantidad, fromUnit, toUnit) {
  const value = parseFloat(cantidad) || 0;
  if (!fromUnit || !toUnit) return value;
  const from = String(fromUnit).toLowerCase().trim();
  const to = String(toUnit).toLowerCase().trim();
  if (from === to) return value;
  const grams = { g: 1, gr: 1, gramo: 1, gramos: 1, kg: 1000, kilo: 1000, kilos: 1000, lb: 453.592, libra: 453.592, onza: 28.3495, oz: 28.3495 };
  const ml = { ml: 1, mililitro: 1, mililitros: 1, l: 1000, litro: 1000, litros: 1000, lt: 1000 };
  const units = { unidad: 1, und: 1, unid: 1, docena: 12, decena: 10 };
  if (grams[from] && grams[to]) return (value * grams[from]) / grams[to];
  if (ml[from] && ml[to]) return (value * ml[from]) / ml[to];
  if (units[from] && units[to]) return (value * units[from]) / units[to];
  return value;
}

// ============================================================
// Datos
// ============================================================

async function getProductsData() {
  const { data, error } = await supabase
    .from('productos')
    .select('id, nombre, sku, stock_actual, stock_minimo, unidad_medida, categorias(nombre)')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data || []).map(function (p) {
    return {
      nombre: p.nombre,
      sku: p.sku || '',
      stock: parseFloat(p.stock_actual) || 0,
      minStock: parseFloat(p.stock_minimo) || 0,
      unidad: p.unidad_medida || 'unidad',
      categoria: p.categorias ? p.categorias.nombre : ''
    };
  });
}

async function getLowStockData() {
  const all = await getProductsData();
  return all.filter(function (p) { return p.minStock > 0 && p.stock <= p.minStock; });
}

async function getDishesData(tipo) {
  let q = supabase.from('platos')
    .select('id, nombre, tipo, precio_venta')
    .eq('activo', true);
  if (tipo) q = q.eq('tipo', tipo);
  const { data: platos, error } = await q;
  if (error) throw error;
  const ids = (platos || []).map(function (p) { return p.id; });
  if (ids.length === 0) return [];

  const { data: ings } = await supabase
    .from('plato_ingredientes')
    .select('plato_id, cantidad, unidad, rendimiento_por_tanda, productos(precio_compra, unidad_medida)')
    .in('plato_id', ids);

  const costos = {};
  (ings || []).forEach(function (ing) {
    const prod = ing.productos || {};
    const cantidadConv = convertUnit(ing.cantidad, ing.unidad, prod.unidad_medida || '');
    let costoIng = cantidadConv * (parseFloat(prod.precio_compra) || 0);
    const rend = parseInt(ing.rendimiento_por_tanda, 10) || 1;
    if (rend > 1) costoIng = costoIng / rend; // Tipo C: costo por porcion
    costos[ing.plato_id] = (costos[ing.plato_id] || 0) + costoIng;
  });

  return (platos || []).map(function (p) {
    const costo = Math.round((costos[p.id] || 0) * 100) / 100;
    const precio = parseFloat(p.precio_venta) || 0;
    const margen = Math.round((precio - costo) * 100) / 100;
    const margenPct = precio > 0 ? Math.round((margen / precio) * 1000) / 10 : 0;
    return { id: p.id, nombre: p.nombre, tipo: p.tipo, costo: costo, precio: precio, margen: margen, margenPct: margenPct };
  }).sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
}

// ============================================================
// Generacion de PDF (estructura del template existente)
// ============================================================

function drawHeader(doc, title) {
  const fecha = nowEs();
  doc.font('Helvetica-Bold').fontSize(18).fillColor(BRAND)
    .text('CORNER HOUSE', { align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor(MUTED)
    .text('Sabores que unen', { align: 'center' });
  doc.fontSize(8).fillColor(LIGHT)
    .text('Reporte generado ' + fecha, { align: 'center' });
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT).text('Tipo: ', { continued: true });
  doc.font('Helvetica').fillColor(TEXT).text(title);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT).text('Fecha: ', { continued: true });
  doc.font('Helvetica').fillColor(TEXT).text(fecha);
  doc.moveDown(0.6);
}

function drawSummary(doc, items) {
  const startX = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const boxW = (usable - 10 * (items.length - 1)) / items.length;
  const y = doc.y;
  items.forEach(function (it, i) {
    const x = startX + i * (boxW + 10);
    doc.roundedRect(x, y, boxW, 38, 6).fillAndStroke('#f8fafc', LINE);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f172a')
      .text(String(it.value), x, y + 7, { width: boxW, align: 'center' });
    doc.font('Helvetica').fontSize(7).fillColor(LIGHT)
      .text(it.label.toUpperCase(), x, y + 24, { width: boxW, align: 'center' });
  });
  doc.y = y + 50;
}

function drawTable(doc, columns, rows) {
  const startX = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rowH = 16;
  let y = doc.y;

  function header() {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b');
    columns.forEach(function (c) {
      doc.text(c.label.toUpperCase(), startX + c.x, y, { width: c.w, align: c.align || 'left', lineBreak: false });
    });
    y += 12;
    doc.moveTo(startX, y).lineTo(startX + usable, y).strokeColor(LINE).lineWidth(1).stroke();
    y += 4;
  }

  header();
  doc.font('Helvetica').fontSize(8);

  rows.forEach(function (row) {
    if (y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      y = doc.page.margins.top;
      header();
      doc.font('Helvetica').fontSize(8);
    }
    columns.forEach(function (c) {
      const cell = row.cells[c.key];
      doc.fillColor(row.colorFor && row.colorFor[c.key] ? row.colorFor[c.key] : TEXT)
        .text(String(cell == null ? '' : cell), startX + c.x, y, { width: c.w, align: c.align || 'left', lineBreak: false });
    });
    y += rowH;
    doc.moveTo(startX, y - 5).lineTo(startX + usable, y - 5).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
  });

  doc.y = y + 8;
}

function drawFooter(doc) {
  const fecha = nowEs();
  const y = doc.page.height - doc.page.margins.bottom - 40;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b')
    .text('Corner House — Sabores que unen', doc.page.margins.left, y, { align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor(LIGHT)
    .text('Este reporte es informativo. Revise el inventario antes de hacer pedidos.', { align: 'center' });
  doc.text('Impreso: ' + fecha, { align: 'center' });
}

function renderPdf(build) {
  return new Promise(function (resolve, reject) {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks = [];
      doc.on('data', function (c) { chunks.push(c); });
      doc.on('end', function () { resolve(Buffer.concat(chunks)); });
      doc.on('error', reject);
      build(doc);
      doc.end();
    } catch (err) { reject(err); }
  });
}

// PDF de productos (inventario completo o stock bajo)
function buildProductsPdf(products, title) {
  return renderPdf(function (doc) {
    drawHeader(doc, title);
    const agotados = products.filter(function (p) { return p.stock <= 0; }).length;
    const bajos = products.filter(function (p) { return p.stock > 0 && p.minStock > 0 && p.stock <= p.minStock; }).length;
    drawSummary(doc, [
      { value: products.length, label: 'Productos' },
      { value: agotados, label: 'Agotados' },
      { value: bajos, label: 'Bajo minimo' }
    ]);

    const columns = [
      { key: 'nombre', label: 'Producto', x: 0, w: 205 },
      { key: 'sku', label: 'SKU', x: 210, w: 85 },
      { key: 'stock', label: 'Actual', x: 300, w: 60, align: 'right' },
      { key: 'minStock', label: 'Minimo', x: 365, w: 55, align: 'right' },
      { key: 'unidad', label: 'Unidad', x: 425, w: 90, align: 'right' }
    ];

    const rows = products.map(function (p) {
      let color = GREEN;
      if (p.stock <= 0) color = RED;
      else if (p.minStock > 0 && p.stock <= p.minStock) color = AMBER;
      return {
        cells: { nombre: p.nombre, sku: p.sku, stock: fmtNum(p.stock), minStock: fmtNum(p.minStock), unidad: p.unidad },
        colorFor: { stock: color }
      };
    });

    drawTable(doc, columns, rows);
    drawFooter(doc);
  });
}

// PDF de platos / bebidas: nombre, costo de operacion y margen
function buildDishesPdf(dishes, title) {
  return renderPdf(function (doc) {
    drawHeader(doc, title);
    const margenProm = dishes.length > 0
      ? Math.round((dishes.reduce(function (s, d) { return s + d.margenPct; }, 0) / dishes.length) * 10) / 10
      : 0;
    const conMargenNegativo = dishes.filter(function (d) { return d.margen < 0; }).length;
    drawSummary(doc, [
      { value: dishes.length, label: 'Items' },
      { value: margenProm + '%', label: 'Margen prom.' },
      { value: conMargenNegativo, label: 'Margen negativo' }
    ]);

    const columns = [
      { key: 'nombre', label: 'Plato', x: 0, w: 215 },
      { key: 'costo', label: 'Costo', x: 220, w: 70, align: 'right' },
      { key: 'precio', label: 'Precio venta', x: 295, w: 75, align: 'right' },
      { key: 'margen', label: 'Margen', x: 375, w: 70, align: 'right' },
      { key: 'margenPct', label: 'Margen %', x: 450, w: 65, align: 'right' }
    ];

    const rows = dishes.map(function (d) {
      return {
        cells: {
          nombre: d.nombre,
          costo: formatCurrency(d.costo),
          precio: formatCurrency(d.precio),
          margen: formatCurrency(d.margen),
          margenPct: d.margenPct + '%'
        },
        colorFor: { margen: d.margen < 0 ? RED : GREEN, margenPct: d.margen < 0 ? RED : GREEN }
      };
    });

    drawTable(doc, columns, rows);
    drawFooter(doc);
  });
}

module.exports = {
  getProductsData,
  getLowStockData,
  getDishesData,
  buildProductsPdf,
  buildDishesPdf
};
