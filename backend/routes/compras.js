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

    // Obtener producto antes de actualizar stock para el promedio ponderado
    var { data: producto, error: prodErr } = await supabase
      .from('productos')
      .select('stock_actual, precio_compra')
      .eq('id', producto_id)
      .single();
    if (prodErr || !producto) {
      // Rollback: eliminar la compra recien creada
      await supabase.from('compras').delete().eq('id', data.id);
      return res.status(400).json({ success: false, message: 'Producto no encontrado' });
    }

    await supabase.rpc('registrar_movimiento', {
      p_producto_id: producto_id,
      p_tipo: 'entrada',
      p_cantidad: cantidad,
      p_motivo: 'Compra - valor unitario: $' + valor_unitario,
      p_usuario_id: req.user ? req.user.id : null,
      p_proveedor_id: proveedor_id || null
    });

    // Promedio ponderado: (stock_antes * precio_antes + cantidad * precio_nuevo) / stock_nuevo
    var stockAntes = parseFloat(producto.stock_actual) || 0;
    var precioAntes = parseFloat(producto.precio_compra) || 0;
    var stockNuevo = stockAntes + cantidad;
    var nuevoPromedio = stockNuevo > 0
      ? Math.round(((stockAntes * precioAntes + cantidad * valor_unitario) / stockNuevo) * 100) / 100
      : valor_unitario;

    await supabase.from('productos').update({ precio_compra: nuevoPromedio }).eq('id', producto_id);

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

// GET /api/compras/:id - obtener una entrada por ID
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('compras')
      .select('*, productos(nombre, sku, unidad_medida), perfiles(username, nombre_completo)')
      .eq('id', req.params.id)
      .single();
    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Entrada no encontrada' });
    }
    const compra = {
      id: data.id,
      fecha_compra: data.fecha_compra,
      producto_id: data.producto_id,
      producto_nombre: data.productos?.nombre || '',
      producto_sku: data.productos?.sku || '',
      producto_unidad: data.productos?.unidad_medida || 'unidad',
      cantidad: data.cantidad,
      cantidad_presentacion: data.cantidad_presentacion,
      unidad_presentacion: data.unidad_presentacion,
      factor_conversion: data.factor_conversion || 1,
      valor_unitario: data.valor_unitario,
      valor_total: data.valor_total,
      proveedor_id: data.proveedor_id,
      usuario_nombre: data.perfiles?.nombre_completo || data.perfiles?.username || '',
      notas: data.notas,
      creado_en: data.creado_en
    };
    res.json({ success: true, data: compra });
  } catch (err) {
    console.error('GET compra error:', err);
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

    // === Revertir promedio ponderado de la compra original ===
    var prodOrig = producto_id; // puede ser el mismo o distinto
    var { data: prodOrigData } = await supabase
      .from('productos')
      .select('stock_actual, precio_compra')
      .eq('id', original.producto_id)
      .single();
    if (prodOrigData) {
      var stockOrigActual = parseFloat(prodOrigData.stock_actual) || 0;
      var precioOrigActual = parseFloat(prodOrigData.precio_compra) || 0;
      var stockSinEsta = stockOrigActual - parseFloat(original.cantidad);
      if (stockSinEsta > 0) {
        var precioSinEsta = Math.round(((precioOrigActual * stockOrigActual - parseFloat(original.valor_unitario) * parseFloat(original.cantidad)) / stockSinEsta) * 100) / 100;
        if (precioSinEsta < 0) precioSinEsta = 0;
        await supabase.from('productos').update({ precio_compra: precioSinEsta }).eq('id', original.producto_id);
      } else {
        // Si el stock queda en 0 o negativo, mantener el precio actual
        await supabase.from('productos').update({ precio_compra: 0 }).eq('id', original.producto_id);
      }
    }

    // === Ajustar stock (logica existente) ===
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

    // === Aplicar nuevo promedio ponderado para la compra editada ===
    var { data: prodNewData } = await supabase
      .from('productos')
      .select('stock_actual, precio_compra')
      .eq('id', producto_id)
      .single();
    if (prodNewData) {
      var stockNewActual = parseFloat(prodNewData.stock_actual) || 0;
      var precioNewActual = parseFloat(prodNewData.precio_compra) || 0;
      var stockAntesDeEsta = stockNewActual - cantidad;
      if (stockAntesDeEsta < 0) stockAntesDeEsta = 0;
      var nuevoPromedio = stockNewActual > 0
        ? Math.round(((stockAntesDeEsta * precioNewActual + cantidad * valor_unitario) / stockNewActual) * 100) / 100
        : valor_unitario;
      if (nuevoPromedio < 0) nuevoPromedio = 0;
      await supabase.from('productos').update({ precio_compra: nuevoPromedio }).eq('id', producto_id);
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

    // Revertir promedio ponderado de esta compra
    var { data: prodData } = await supabase
      .from('productos')
      .select('stock_actual, precio_compra')
      .eq('id', original.producto_id)
      .single();
    if (prodData) {
      var stockActual = parseFloat(prodData.stock_actual) || 0;
      var precioActual = parseFloat(prodData.precio_compra) || 0;
      var cantOriginal = parseFloat(original.cantidad);
      var stockSinEsta = stockActual - cantOriginal;
      if (stockSinEsta > 0) {
        var precioSinEsta = Math.round(((precioActual * stockActual - parseFloat(original.valor_unitario) * cantOriginal) / stockSinEsta) * 100) / 100;
        if (precioSinEsta < 0) precioSinEsta = 0;
        await supabase.from('productos').update({ precio_compra: precioSinEsta }).eq('id', original.producto_id);
      } else {
        await supabase.from('productos').update({ precio_compra: 0 }).eq('id', original.producto_id);
      }
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
