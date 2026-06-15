const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requirePermission } = require('../middleware/auth');
const { applyBogotaDateFilter } = require('../lib/timezone');

router.get('/', async (req, res) => {
  try {
    const { from, to, page, limit, search } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let countQuery = supabase.from('compras').select('*', { count: 'exact', head: true });
    countQuery = applyBogotaDateFilter(countQuery, 'fecha_compra', from, to);

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    let query = supabase
      .from('compras')
      .select('*, productos(nombre, sku, unidad_medida), proveedores(nombre), perfiles(username, nombre_completo)')
      .order('creado_en', { ascending: false })
      .range(offset, offset + limitNum - 1);

    query = applyBogotaDateFilter(query, 'fecha_compra', from, to);

    const { data, error } = await query;
    if (error) throw error;

    const searchLower = (search || '').toString().toLowerCase().trim();
    const filtered = (data || []).filter(c => {
      if (!searchLower) return true;
      const pname = (c.productos && c.productos.nombre) || '';
      const sku = (c.productos && c.productos.sku) || '';
      return pname.toLowerCase().includes(searchLower) || sku.toLowerCase().includes(searchLower);
    });

    const compras = filtered.map(c => ({
      id: c.id,
      fecha_compra: c.fecha_compra,
      producto_id: c.producto_id,
      producto_nombre: c.productos?.nombre || '',
      producto_sku: c.productos?.sku || '',
      producto_unidad: c.productos?.unidad_medida || 'unidad',
      cantidad: c.cantidad,
      valor_unitario: c.valor_unitario,
      valor_total: c.valor_total,
      cantidad_presentacion: c.cantidad_presentacion,
      unidad_presentacion: c.unidad_presentacion,
      factor_conversion: c.factor_conversion,
      proveedor_nombre: c.proveedores?.nombre || '',
      usuario_id: c.usuario_id,
      usuario_nombre: c.perfiles?.nombre_completo || c.perfiles?.username || '',
      usuario_username: c.perfiles?.username || '',
      notas: c.notas,
      creado_en: c.creado_en
    }));

    res.json({
      success: true,
      data: compras,
      total: searchLower ? filtered.length : (count || 0),
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((searchLower ? filtered.length : (count || 0)) / limitNum)
    });
  } catch (err) {
    console.error('Compras list error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.post('/', requirePermission('puede_crear_entradas'), async (req, res) => {
  try {
    const { producto_id, cantidad, valor_unitario, fecha_compra, proveedor_id, notas, cantidad_presentacion, unidad_presentacion, factor_conversion } = req.body;

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
        notas: notas || null,
        cantidad_presentacion: cantidad_presentacion || null,
        unidad_presentacion: unidad_presentacion || null,
        factor_conversion: factor_conversion || 1
      })
      .select('*, productos(nombre, sku, unidad_medida), proveedores(nombre), perfiles(username, nombre_completo)')
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
        producto_unidad: data.productos?.unidad_medida || 'unidad',
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

// PUT /api/compras/:id - editar entrada con recalculo de stock
router.put('/:id', requirePermission('puede_editar_entradas'), async (req, res) => {
  try {
    const { producto_id, cantidad, valor_unitario, fecha_compra, proveedor_id, notas, cantidad_presentacion, unidad_presentacion, factor_conversion } = req.body;

    if (!producto_id || !cantidad || cantidad <= 0 || !valor_unitario || valor_unitario <= 0) {
      return res.status(400).json({ success: false, message: 'Producto, cantidad y valor unitario requeridos' });
    }

    const { data: original, error: origError } = await supabase
      .from('compras')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (origError || !original) {
      return res.status(404).json({ success: false, message: 'Entrada no encontrada' });
    }

    // Revertir la entrada original
    if (original.producto_id === producto_id) {
      // Mismo producto: ajustar diferencia
      const diff = original.cantidad - cantidad;
      if (diff > 0) {
        // Se desconto de mas: devolver
        await supabase.rpc('registrar_movimiento', {
          p_producto_id: producto_id,
          p_tipo: 'salida',
          p_cantidad: diff,
          p_motivo: 'Ajuste por edicion de compra',
          p_usuario_id: req.user ? req.user.id : null
        });
      } else if (diff < 0) {
        // Falta: agregar
        await supabase.rpc('registrar_movimiento', {
          p_producto_id: producto_id,
          p_tipo: 'entrada',
          p_cantidad: -diff,
          p_motivo: 'Ajuste por edicion de compra',
          p_usuario_id: req.user ? req.user.id : null
        });
      }
    } else {
      // Producto distinto: revertir viejo, aplicar nuevo
      await supabase.rpc('registrar_movimiento', {
        p_producto_id: original.producto_id,
        p_tipo: 'salida',
        p_cantidad: original.cantidad,
        p_motivo: 'Revertir compra por edicion',
        p_usuario_id: req.user ? req.user.id : null
      });
      await supabase.rpc('registrar_movimiento', {
        p_producto_id: producto_id,
        p_tipo: 'entrada',
        p_cantidad: cantidad,
        p_motivo: 'Ajuste por edicion de compra',
        p_usuario_id: req.user ? req.user.id : null
      });
    }

    const fecha = fecha_compra || new Date().toISOString().split('T')[0];
    const { data: updated, error: updateError } = await supabase
      .from('compras')
      .update({
        producto_id,
        cantidad,
        valor_unitario,
        fecha_compra: fecha,
        proveedor_id: proveedor_id || null,
        notas: notas || null,
        cantidad_presentacion: cantidad_presentacion || null,
        unidad_presentacion: unidad_presentacion || null,
        factor_conversion: factor_conversion || 1
      })
      .eq('id', req.params.id)
      .select('*, productos(nombre, sku, unidad_medida), proveedores(nombre), perfiles(username, nombre_completo)')
      .single();
    if (updateError) throw updateError;

    res.json({ success: true, data: {
      id: updated.id,
      fecha_compra: updated.fecha_compra,
      producto_nombre: updated.productos?.nombre || '',
      producto_sku: updated.productos?.sku || '',
      producto_unidad: updated.productos?.unidad_medida || 'unidad',
      cantidad: updated.cantidad,
      valor_unitario: updated.valor_unitario,
      valor_total: updated.valor_total,
      proveedor_nombre: updated.proveedores?.nombre || '',
      usuario_nombre: updated.perfiles?.nombre_completo || updated.perfiles?.username || ''
    }});
  } catch (err) {
    console.error('Compra update error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error del servidor' });
  }
});

// DELETE /api/compras/:id - eliminar entrada y revertir stock
router.delete('/:id', requirePermission('puede_eliminar_entradas'), async (req, res) => {
  try {
    const { data: original, error: origError } = await supabase
      .from('compras')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (origError || !original) {
      return res.status(404).json({ success: false, message: 'Entrada no encontrada' });
    }

    // Revertir la entrada: descontar del stock
    await supabase.rpc('registrar_movimiento', {
      p_producto_id: original.producto_id,
      p_tipo: 'salida',
      p_cantidad: original.cantidad,
      p_motivo: 'Eliminacion de compra',
      p_usuario_id: req.user ? req.user.id : null
    });

    const { error: delError } = await supabase.from('compras').delete().eq('id', req.params.id);
    if (delError) throw delError;

    res.json({ success: true, message: 'Entrada eliminada' });
  } catch (err) {
    console.error('Compra delete error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
