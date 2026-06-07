const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

router.get('/', async (req, res) => {
  try {
    const { from, to, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let countQuery = supabase.from('compras').select('*', { count: 'exact', head: true });
    if (from) countQuery = countQuery.gte('fecha_compra', from);
    if (to) countQuery = countQuery.lte('fecha_compra', to);

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    let query = supabase
      .from('compras')
      .select('*, productos(nombre, sku), proveedores(nombre)')
      .order('creado_en', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (from) query = query.gte('fecha_compra', from);
    if (to) query = query.lte('fecha_compra', to);

    const { data, error } = await query;
    if (error) throw error;

    const compras = (data || []).map(c => ({
      id: c.id,
      fecha_compra: c.fecha_compra,
      producto_id: c.producto_id,
      producto_nombre: c.productos?.nombre || '',
      producto_sku: c.productos?.sku || '',
      cantidad: c.cantidad,
      valor_unitario: c.valor_unitario,
      valor_total: c.valor_total,
      proveedor_nombre: c.proveedores?.nombre || '',
      notas: c.notas,
      creado_en: c.creado_en
    }));

    res.json({
      success: true,
      data: compras,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (err) {
    console.error('Compras list error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { producto_id, cantidad, valor_unitario, fecha_compra, proveedor_id, notas } = req.body;

    if (!producto_id || !cantidad || cantidad <= 0 || !valor_unitario || valor_unitario <= 0) {
      return res.status(400).json({ success: false, message: 'Producto, cantidad y valor unitario requeridos' });
    }

    const fecha = fecha_compra || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('compras')
      .insert({
        producto_id,
        cantidad,
        valor_unitario,
        fecha_compra: fecha,
        proveedor_id: proveedor_id || null,
        usuario_id: req.user ? req.user.id : null,
        notas: notas || null
      })
      .select('*, productos(nombre, sku), proveedores(nombre)')
      .single();

    if (error) throw error;

    await supabase.rpc('registrar_movimiento', {
      p_producto_id: producto_id,
      p_tipo: 'entrada',
      p_cantidad: cantidad,
      p_motivo: 'Compra - valor unitario: $' + valor_unitario,
      p_usuario_id: req.user ? req.user.id : null,
      p_proveedor_id: proveedor_id || null
    });

    res.status(201).json({
      success: true,
      data: {
        id: data.id,
        fecha_compra: data.fecha_compra,
        producto_nombre: data.productos?.nombre || '',
        producto_sku: data.productos?.sku || '',
        cantidad: data.cantidad,
        valor_unitario: data.valor_unitario,
        valor_total: data.valor_total,
        proveedor_nombre: data.proveedores?.nombre || ''
      }
    });
  } catch (err) {
    console.error('Compra create error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
