const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const authRoutes = require('./routes/auth');
const { authMiddleware } = require('./middleware/auth');
const supabase = require('./lib/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/sales', authMiddleware, salesRoutes);

app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const { count: totalProducts } = await supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true);

    const { data: stockData } = await supabase
      .from('productos')
      .select('stock_actual, precio_compra')
      .eq('activo', true);
    const totalStock = stockData?.reduce((sum, p) => sum + p.stock_actual, 0) || 0;
    const inventoryValue = stockData?.reduce((sum, p) => sum + (p.stock_actual * parseFloat(p.precio_compra)), 0) || 0;

    const { data: lowStockData } = await supabase
      .from('productos')
      .select('id, stock_actual, stock_minimo')
      .eq('activo', true);
    const lowStockCount = lowStockData?.filter(p => p.stock_actual <= p.stock_minimo).length || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todaySales } = await supabase
      .from('ventas')
      .select('total')
      .eq('estado', 'completada')
      .gte('creado_en', today.toISOString());
    const todaySalesCount = todaySales?.length || 0;
    const todayRevenue = todaySales?.reduce((sum, s) => sum + parseFloat(s.total), 0) || 0;

    res.json({
      success: true,
      data: {
        totalProducts: totalProducts || 0,
        totalStock,
        inventoryValue,
        lowStockCount,
        todaySales: todaySalesCount,
        todayRevenue
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
  console.log(`InventarioHub API corriendo en http://localhost:${PORT}`);
});
