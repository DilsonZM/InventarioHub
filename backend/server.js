const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const authRoutes = require('./routes/auth');
const comprasRoutes = require('./routes/compras');
const reportesRoutes = require('./routes/reportes');
const usersRoutes = require('./routes/users');
const configRoutes = require('./routes/config');
const dishesRoutes = require('./routes/dishes');
const mesasRoutes = require('./routes/mesas');
const { authMiddleware, requirePermission } = require('./middleware/auth');
const supabase = require('./lib/supabase');
const { applyBogotaDateFilter } = require('./lib/timezone');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',').map(s => s.trim());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));

app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend'), {
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    if (filePath.endsWith('manifest.json')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/sales', authMiddleware, salesRoutes);
app.use('/api/compras', authMiddleware, comprasRoutes);
app.use('/api/reportes', authMiddleware, reportesRoutes);
app.use('/api/dishes', authMiddleware, dishesRoutes);
app.use('/api/mesas', authMiddleware, mesasRoutes);

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const { from, to, cocina } = req.query;

    const { count: totalProducts } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true);

    const { data: stockData } = await supabase
      .from('productos')
      .select('stock_actual, precio_compra')
      .eq('activo', true);
    const totalStock = stockData ? stockData.reduce((sum, p) => sum + p.stock_actual, 0) : 0;
    const inventoryValue = stockData ? stockData.reduce((sum, p) => sum + (p.stock_actual * parseFloat(p.precio_compra)), 0) : 0;

    const { data: lowStockData } = await supabase
      .from('productos')
      .select('id, stock_actual, stock_minimo')
      .eq('activo', true);
    const lowStockCount = lowStockData ? lowStockData.filter(p => p.stock_actual <= p.stock_minimo).length : 0;

    let ventasQuery = supabase
      .from('ventas')
      .select('total')
      .eq('estado', 'completada');
    ventasQuery = applyBogotaDateFilter(ventasQuery, 'creado_en', from, to);
    if (cocina) {
      ventasQuery = ventasQuery.eq('metodo_pago', cocina);
    }
    const { data: periodSales } = await ventasQuery;
    const periodSalesCount = periodSales ? periodSales.length : 0;
    const periodRevenue = periodSales ? periodSales.reduce((sum, s) => sum + parseFloat(s.total), 0) : 0;

    let label = 'Hoy';
    if (from && to) label = 'Periodo';
    else if (from) label = 'Desde ' + from;

    res.json({
      success: true,
      data: {
        totalProducts: totalProducts || 0,
        totalStock,
        inventoryValue,
        lowStockCount,
        periodSales: periodSalesCount,
        periodRevenue,
        periodLabel: label
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Stats de platos: mas vendidos, margen
app.get('/api/stats/dishes', authMiddleware, async (req, res) => {
  try {
    // Platos mas vendidos (desde venta_detalles con es_plato=true)
    var { data: topDishes, error: topErr } = await supabase
      .from('venta_detalles')
      .select('producto_nombre, plato_id, cantidad')
      .eq('es_plato', true);

    if (topErr) throw topErr;

    // Agrupar por plato
    var ventasPorPlato = {};
    (topDishes || []).forEach(function (d) {
      var key = d.plato_id || d.producto_nombre;
      if (!ventasPorPlato[key]) ventasPorPlato[key] = { nombre: d.producto_nombre, plato_id: d.plato_id, cantidad: 0 };
      ventasPorPlato[key].cantidad += d.cantidad;
    });

    // Ordenar por cantidad descendente y tomar top 5
    var sorted = Object.values(ventasPorPlato).sort(function (a, b) { return b.cantidad - a.cantidad; }).slice(0, 5);

    // Obtener costo de cada plato
    for (var i = 0; i < sorted.length; i++) {
      if (!sorted[i].plato_id) continue;
      var { data: ings } = await supabase
        .from('plato_ingredientes')
        .select('cantidad, unidad, productos!inner(precio_compra, unidad_medida)')
        .eq('plato_id', sorted[i].plato_id);
      var costoTotal = 0;
      (ings || []).forEach(function (ing) {
        var prodUnidad = ing.productos ? ing.productos.unidad_medida || '' : '';
        // Conversion simple
        var conv = parseFloat(ing.cantidad) || 0;
        var from = (ing.unidad || '').toLowerCase().trim();
        var to = prodUnidad.toLowerCase().trim();
        if (from !== to && from && to) {
          var toGrams = { g: 1, kg: 1000, lb: 453.592, onza: 28.3495 };
          var toML = { ml: 1, l: 1000, litro: 1000 };
          if (toGrams[from] && toGrams[to]) conv = (conv * toGrams[from]) / toGrams[to];
          else if (toML[from] && toML[to]) conv = (conv * toML[from]) / toML[to];
        }
        costoTotal += conv * parseFloat((ing.productos && ing.productos.precio_compra) || 0);
      });
      sorted[i].costo = costoTotal;
      sorted[i].precio_venta = 0;
      // Obtener precio del plato
      var { data: plato } = await supabase.from('platos').select('precio_venta').eq('id', sorted[i].plato_id).single();
      if (plato) sorted[i].precio_venta = parseFloat(plato.precio_venta);
    }

    res.json({ success: true, data: sorted });
  } catch (err) {
    console.error('Dish stats error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'InventarioHub API running', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log('InventarioHub API corriendo en http://localhost:' + PORT);
});
