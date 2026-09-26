// routes/gastos.js
// CRUD de gastos operativos (modulo Finanzas).
// Acceso: permiso puede_ver_finanzas.

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requirePermission } = require('../middleware/auth');
const { CATEGORIAS_GASTO } = require('../lib/finance');

// GET /api/gastos?from&to&categoria
router.get('/', requirePermission('puede_ver_finanzas'), async (req, res) => {
  try {
    const { from, to, categoria } = req.query;
    let q = supabase
      .from('gastos')
      .select('id, fecha, categoria, descripcion, monto, usuario_id, creado_en')
      .order('fecha', { ascending: false });
    if (from) q = q.gte('fecha', from);
    if (to) q = q.lte('fecha', to);
    if (categoria) q = q.eq('categoria', categoria);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Gastos list error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// POST /api/gastos
router.post('/', requirePermission('puede_ver_finanzas'), async (req, res) => {
  try {
    const { fecha, categoria, descripcion, monto } = req.body || {};
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) {
      return res.status(400).json({ success: false, message: 'El monto debe ser mayor a 0' });
    }
    const cat = (categoria || 'otros').toString().trim().toLowerCase();
    if (CATEGORIAS_GASTO.indexOf(cat) === -1) {
      return res.status(400).json({ success: false, message: 'Categoria invalida. Valores: ' + CATEGORIAS_GASTO.join(', ') });
    }
    const insert = {
      fecha: fecha || new Date().toISOString().slice(0, 10),
      categoria: cat,
      descripcion: (descripcion || '').toString().trim() || null,
      monto: Math.round(montoNum * 100) / 100,
      usuario_id: req.user ? req.user.id : null
    };
    const { data, error } = await supabase.from('gastos').insert(insert).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data: data, message: 'Gasto registrado' });
  } catch (err) {
    console.error('Gasto create error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error del servidor' });
  }
});

// PUT /api/gastos/:id
router.put('/:id', requirePermission('puede_ver_finanzas'), async (req, res) => {
  try {
    const { fecha, categoria, descripcion, monto } = req.body || {};
    const update = {};
    if (fecha) update.fecha = fecha;
    if (categoria) {
      const cat = categoria.toString().trim().toLowerCase();
      if (CATEGORIAS_GASTO.indexOf(cat) === -1) {
        return res.status(400).json({ success: false, message: 'Categoria invalida' });
      }
      update.categoria = cat;
    }
    if (descripcion !== undefined) update.descripcion = (descripcion || '').toString().trim() || null;
    if (monto !== undefined) {
      const montoNum = parseFloat(monto);
      if (!montoNum || montoNum <= 0) {
        return res.status(400).json({ success: false, message: 'El monto debe ser mayor a 0' });
      }
      update.monto = Math.round(montoNum * 100) / 100;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'Nada que actualizar' });
    }
    const { data, error } = await supabase.from('gastos').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, data: data, message: 'Gasto actualizado' });
  } catch (err) {
    console.error('Gasto update error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error del servidor' });
  }
});

// DELETE /api/gastos/:id
router.delete('/:id', requirePermission('puede_ver_finanzas'), async (req, res) => {
  try {
    const { error } = await supabase.from('gastos').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Gasto eliminado' });
  } catch (err) {
    console.error('Gasto delete error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
