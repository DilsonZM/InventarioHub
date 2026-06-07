const express = require('express');
const router = express.Router();
const db = require('../models/db');

router.get('/', (req, res) => {
  const data = db.read();
  const { from, to } = req.query;

  let sales = [...data.sales].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (from) {
    sales = sales.filter(s => new Date(s.createdAt) >= new Date(from));
  }
  if (to) {
    sales = sales.filter(s => new Date(s.createdAt) <= new Date(to));
  }

  res.json({ success: true, data: sales, total: sales.length });
});

router.get('/:id', (req, res) => {
  const data = db.read();
  const sale = data.sales.find(s => s.id === req.params.id);
  if (!sale) {
    return res.status(404).json({ success: false, message: 'Venta no encontrada' });
  }
  res.json({ success: true, data: sale });
});

router.post('/', (req, res) => {
  const { items, paymentMethod } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'La venta debe contener al menos un producto' });
  }

  if (!paymentMethod) {
    return res.status(400).json({ success: false, message: 'Método de pago requerido' });
  }

  const data = db.read();

  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({ success: false, message: `Item inválido: productId y quantity son requeridos` });
    }

    const product = data.products.find(p => p.id === item.productId && p.active);
    if (!product) {
      return res.status(400).json({ success: false, message: `Producto ${item.productId} no encontrado` });
    }

    if (product.stock < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, Solicitado: ${item.quantity}`
      });
    }
  }

  let total = 0;
  const saleItems = [];

  for (const item of items) {
    const product = data.products.find(p => p.id === item.productId);
    const subtotal = product.price * item.quantity;
    total += subtotal;

    saleItems.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      subtotal
    });

    product.stock -= item.quantity;
    product.updatedAt = new Date().toISOString();
  }

  const sale = {
    id: db.generateId('s'),
    items: saleItems,
    total: Math.round(total * 100) / 100,
    paymentMethod,
    userId: req.user.id,
    createdAt: new Date().toISOString()
  };

  data.sales.push(sale);
  db.write(data);
  res.status(201).json({ success: true, data: sale });
});

module.exports = router;
