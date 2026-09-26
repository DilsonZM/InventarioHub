// lib/finance.js
// Resumen contable de un periodo (zona Bogota).
//
//   Ingresos:  ventas facturadas del periodo
//   Costo:     insumos de los platos vendidos (receta) + productos directos
//   Egresos:   compras de inventario + mermas + gastos operativos
//
// Resultados:
//   margen        = facturado - costoVentas
//   utilidadBruta = margen - mermas
//   flujoCaja     = facturado - compras
//   utilidadNeta  = margen - mermas - gastos operativos

const supabase = require('./supabase');
const stockReport = require('./stock-report');

const CATEGORIAS_GASTO = ['arriendo', 'servicios', 'nomina', 'transporte', 'mantenimiento', 'otros'];

function todayBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

async function getFinanceSummary(from, to) {
  const { applyBogotaDateFilter } = require('./timezone');
  if (!from && !to) { from = to = todayBogota(); }
  else if (!from) { from = to; }
  else if (!to) { to = from; }
  if (from > to) { const t = from; from = to; to = t; }

  // --- Costos de referencia (platos por receta, productos por precio_compra)
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

  // --- Ventas del periodo
  let vq = supabase
    .from('ventas')
    .select('total, estado, estado_cocina, venta_detalles(producto_nombre, cantidad, es_plato, plato_id, producto_id)');
  vq = applyBogotaDateFilter(vq, 'creado_en', from, to);
  const { data: ventas, error: vErr } = await vq;
  if (vErr) throw vErr;

  let facturado = 0, pedidos = 0, cortesias = 0, canceladas = 0, costoVentas = 0;
  const platos = {};
  (ventas || []).forEach(function (v) {
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
      if (esCompletada) {
        if (d.es_plato && d.plato_id && platoCostos[d.plato_id] != null) {
          costoVentas += platoCostos[d.plato_id] * cant;
        } else if (d.producto_id && prodCostos[d.producto_id] != null) {
          costoVentas += prodCostos[d.producto_id] * cant;
        }
      }
    });
  });

  // --- Compras del periodo (por fecha_compra, zona Bogota no aplica: es DATE)
  let comprasTotal = 0, comprasCount = 0;
  try {
    const { data: compras } = await supabase
      .from('compras')
      .select('valor_total')
      .gte('fecha_compra', from)
      .lte('fecha_compra', to);
    (compras || []).forEach(function (c) { comprasTotal += parseFloat(c.valor_total) || 0; });
    comprasCount = (compras || []).length;
  } catch (e) { /* noop */ }

  // --- Mermas del periodo (movimientos tipo merma valorizados a costo)
  let mermasTotal = 0, mermasCount = 0;
  try {
    let mq = supabase
      .from('movimientos_inventario')
      .select('cantidad, productos(precio_compra)')
      .eq('tipo', 'merma');
    mq = applyBogotaDateFilter(mq, 'creado_en', from, to);
    const { data: mermas } = await mq;
    (mermas || []).forEach(function (m) {
      const costo = m.productos ? (parseFloat(m.productos.precio_compra) || 0) : 0;
      mermasTotal += (parseFloat(m.cantidad) || 0) * costo;
    });
    mermasCount = (mermas || []).length;
  } catch (e) { /* noop */ }

  // --- Gastos operativos del periodo
  let gastosTotal = 0;
  let gastos = [];
  try {
    const { data: gs } = await supabase
      .from('gastos')
      .select('id, fecha, categoria, descripcion, monto')
      .gte('fecha', from)
      .lte('fecha', to)
      .order('fecha', { ascending: false });
    gastos = gs || [];
    gastos.forEach(function (g) { gastosTotal += parseFloat(g.monto) || 0; });
  } catch (e) { /* noop */ }

  // --- Resultados
  const margen = facturado - costoVentas;
  const margenPct = facturado > 0 ? (margen / facturado) * 100 : 0;
  const utilidadBruta = margen - mermasTotal;
  const flujoCaja = facturado - comprasTotal;
  const utilidadNeta = margen - mermasTotal - gastosTotal;
  const ticketPromedio = pedidos > 0 ? facturado / pedidos : 0;

  const topPlatos = Object.keys(platos).map(function (k) { return { nombre: k, cant: platos[k] }; })
    .sort(function (a, b) { return b.cant - a.cant; })
    .slice(0, 5);

  return {
    from: from,
    to: to,
    facturado: Math.round(facturado * 100) / 100,
    pedidos: pedidos,
    ticketPromedio: Math.round(ticketPromedio * 100) / 100,
    cortesias: cortesias,
    canceladas: canceladas,
    costoVentas: Math.round(costoVentas * 100) / 100,
    margen: Math.round(margen * 100) / 100,
    margenPct: Math.round(margenPct * 10) / 10,
    comprasTotal: Math.round(comprasTotal * 100) / 100,
    comprasCount: comprasCount,
    mermasTotal: Math.round(mermasTotal * 100) / 100,
    mermasCount: mermasCount,
    gastosTotal: Math.round(gastosTotal * 100) / 100,
    gastosCount: gastos.length,
    gastos: gastos,
    utilidadBruta: Math.round(utilidadBruta * 100) / 100,
    flujoCaja: Math.round(flujoCaja * 100) / 100,
    utilidadNeta: Math.round(utilidadNeta * 100) / 100,
    topPlatos: topPlatos
  };
}

module.exports = { getFinanceSummary, CATEGORIAS_GASTO };
