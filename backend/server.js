const express = require('express');
const cors = require('cors');
const path = require('path');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const authRoutes = require('./routes/auth');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/sales', authMiddleware, salesRoutes);

app.get('/api/stats', authMiddleware, (req, res) => {
  const db = require('./models/db');
  const data = db.read();
  const totalProducts = data.products.reduce((sum, p) => sum + p.stock, 0);
  const totalValue = data.products.reduce((sum, p) => sum + (p.stock * p.cost), 0);
  const lowStock = data.products.filter(p => p.stock <= p.minStock);
  const todaySales = data.sales.filter(s => {
    const saleDate = new Date(s.createdAt).toDateString();
    return saleDate === new Date().toDateString();
  });
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);

  res.json({
    success: true,
    data: {
      totalProducts: data.products.length,
      totalStock: totalProducts,
      inventoryValue: totalValue,
      lowStockCount: lowStock.length,
      todaySales: todaySales.length,
      todayRevenue: todayTotal
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
