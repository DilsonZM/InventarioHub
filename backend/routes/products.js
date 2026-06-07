const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { adminOnly } = require('../middleware/auth');

router.get('/categories/list', (req, res) => {
  const data = db.read();
  res.json({ success: true, data: data.categories });
});

router.get('/', (req, res) => {
  const data = db.read();
  const { category, search, lowStock } = req.query;

  let products = data.products.filter(p => p.active);

  if (category) {
    products = products.filter(p => p.category === category);
  }

  if (search) {
    const term = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term)
    );
  }

  if (lowStock === 'true') {
    products = products.filter(p => p.stock <= p.minStock);
  }

  res.json({ success: true, data: products, total: products.length });
});

router.get('/:id', (req, res) => {
  const data = db.read();
  const product = data.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Producto no encontrado' });
  }
  res.json({ success: true, data: product });
});

router.post('/', adminOnly, (req, res) => {
  const { name, sku, category, price, cost, stock, minStock, description } = req.body;

  if (!name || !sku || !category || price === undefined || cost === undefined || stock === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Campos requeridos: name, sku, category, price, cost, stock',
      errors: { name: !name, sku: !sku, category: !category, price: price === undefined, cost: cost === undefined, stock: stock === undefined }
    });
  }

  if (typeof price !== 'number' || price < 0 || typeof cost !== 'number' || cost < 0 || typeof stock !== 'number' || stock < 0) {
    return res.status(400).json({ success: false, message: 'price, cost y stock deben ser números positivos' });
  }

  const data = db.read();
  const exists = data.products.find(p => p.sku === sku);
  if (exists) {
    return res.status(400).json({ success: false, message: 'Ya existe un producto con ese SKU' });
  }

  const now = new Date().toISOString();
  const product = {
    id: db.generateId('p'),
    name,
    sku,
    category,
    price,
    cost,
    stock,
    minStock: minStock || 0,
    description: description || '',
    active: true,
    createdAt: now,
    updatedAt: now
  };

  data.products.push(product);
  db.write(data);
  res.status(201).json({ success: true, data: product });
});

router.put('/:id', adminOnly, (req, res) => {
  const data = db.read();
  const index = data.products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Producto no encontrado' });
  }

  const { name, sku, category, price, cost, stock, minStock, description } = req.body;
  const existing = data.products[index];

  if (sku && sku !== existing.sku) {
    const dup = data.products.find(p => p.sku === sku && p.id !== req.params.id);
    if (dup) {
      return res.status(400).json({ success: false, message: 'SKU ya existe en otro producto' });
    }
  }

  const updated = {
    ...existing,
    name: name !== undefined ? name : existing.name,
    sku: sku !== undefined ? sku : existing.sku,
    category: category !== undefined ? category : existing.category,
    price: price !== undefined ? price : existing.price,
    cost: cost !== undefined ? cost : existing.cost,
    stock: stock !== undefined ? stock : existing.stock,
    minStock: minStock !== undefined ? minStock : existing.minStock,
    description: description !== undefined ? description : existing.description,
    updatedAt: new Date().toISOString()
  };

  data.products[index] = updated;
  db.write(data);
  res.json({ success: true, data: updated });
});

router.delete('/:id', adminOnly, (req, res) => {
  const data = db.read();
  const index = data.products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Producto no encontrado' });
  }

  data.products[index].active = false;
  data.products[index].updatedAt = new Date().toISOString();
  db.write(data);
  res.json({ success: true, message: 'Producto eliminado (soft delete)' });
});

module.exports = router;
