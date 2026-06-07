const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const authRoutes = require('./routes/auth');
const comprasRoutes = require('./routes/compras');
const reportesRoutes = require('./routes/reportes');
const { authMiddleware } = require('./middleware/auth');
const supabase = require('./lib/supabase');

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
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/sales', authMiddleware, salesRoutes);
app.use('/api/compras', authMiddleware, comprasRoutes);
app.use('/api/reportes', authMiddleware, reportesRoutes);

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
    if (from) {
      ventasQuery = ventasQuery.gte('creado_en', from);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      ventasQuery = ventasQuery.gte('creado_en', today.toISOString());
    }
    if (to) {
      ventasQuery = ventasQuery.lte('creado_en', to + 'T23:59:59');
    }
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
