const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = supabase
      .from('ventas')
      .select('*, venta_detalles(*), perfiles(username)')
      .order('creado_en', { ascending: false });

    if (from) query = query.gte('creado_en', from);
    if (to) query = query.lte('creado_en', to);

    const { data, error } = await query;
    if (error) throw error;

    const sales = (data || []).map(sale => ({
      id: sale.id,
      numero_venta: sale.numero_venta,
      total: sale.total,
      subtotal: sale.subtotal,
      impuesto: sale.impuesto,
      paymentMethod: sale.metodo_pago,
      estado: sale.estado,
      userId: sale.usuario_id,
      username: sale.perfiles?.username || 'Desconocido',
      clienteNombre: sale.cliente_nombre,
      createdAt: sale.creado_en,
      items: (sale.venta_detalles || []).map(item => ({
        productId: item.producto_id,
        productName: item.producto_nombre,
        quantity: item.cantidad,
        unitPrice: item.precio_unitario,
        subtotal: item.subtotal
      }))
    }));

    res.json({ success: true, data: sales, total: sales.length });
  } catch (err) {
    console.error('Sales list error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ventas')
      .select('*, venta_detalles(*), perfiles(username)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    const sale = {
      id: data.id,
      numero_venta: data.numero_venta,
      total: data.total,
      subtotal: data.subtotal,
      impuesto: data.impuesto,
      paymentMethod: data.metodo_pago,
      estado: data.estado,
      userId: data.usuario_id,
      username: data.perfiles?.username || 'Desconocido',
      clienteNombre: data.cliente_nombre,
      createdAt: data.creado_en,
      items: (data.venta_detalles || []).map(item => ({
        productId: item.producto_id,
        productName: item.producto_nombre,
        quantity: item.cantidad,
        unitPrice: item.precio_unitario,
        subtotal: item.subtotal
      }))
    };

    res.json({ success: true, data: sale });
  } catch (err) {
    console.error('Sale get error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { items, paymentMethod, clienteNombre } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'La venta debe contener al menos un producto' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Método de pago requerido' });
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Item inválido: productId y quantity son requeridos' });
      }
    }

    const { data: saleId, error } = await supabase.rpc('procesar_venta', {
      p_items: items.map(item => ({ producto_id: item.productId, cantidad: item.quantity })),
      p_metodo_pago: paymentMethod,
      p_usuario_id: req.user.id || null,
      p_cliente_nombre: clienteNombre || null
    });

    if (error) {
      if (error.message.includes('Stock insuficiente')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error.message.includes('Producto no encontrado')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      throw error;
    }

    const { data: sale } = await supabase
      .from('ventas')
      .select('*, venta_detalles(*)')
      .eq('id', saleId)
      .single();

    const response = {
      id: sale.id,
      numero_venta: sale.numero_venta,
      total: sale.total,
      paymentMethod: sale.metodo_pago,
      userId: sale.usuario_id,
      createdAt: sale.creado_en,
      items: (sale.venta_detalles || []).map(item => ({
        productId: item.producto_id,
        productName: item.producto_nombre,
        quantity: item.cantidad,
        unitPrice: item.precio_unitario,
        subtotal: item.subtotal
      }))
    };

    res.status(201).json({ success: true, data: response });
  } catch (err) {
    console.error('Sale create error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error del servidor' });
  }
});

module.exports = router;
