const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requirePermission } = require('../middleware/auth');
const { applyBogotaDateFilter } = require('../lib/timezone');

router.get('/', async (req, res) => {
  try {
    const { from, to, page, limit, cocina, search } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let countQuery = supabase
      .from('ventas')
      .select('*', { count: 'exact', head: true });

    countQuery = applyBogotaDateFilter(countQuery, 'creado_en', from, to);
    if (cocina) countQuery = countQuery.eq('metodo_pago', cocina);

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    let query = supabase
      .from('ventas')
      .select('*, venta_detalles(*), perfiles(username, nombre_completo)')
      .order('creado_en', { ascending: false })
      .range(offset, offset + limitNum - 1);

    query = applyBogotaDateFilter(query, 'creado_en', from, to);
    if (cocina) query = query.eq('metodo_pago', cocina);

    const { data, error } = await query;
    if (error) throw error;

    const searchLower = (search || '').toString().toLowerCase().trim();
    const filtered = (data || []).filter(sale => {
      if (!searchLower) return true;
      return sale.venta_detalles && sale.venta_detalles.some(function (it) {
        return (it.producto_nombre || '').toLowerCase().includes(searchLower);
      });
    });

    const sales = filtered.map(sale => ({
      id: sale.id,
      numero_venta: sale.numero_venta,
      total: sale.total,
      subtotal: sale.subtotal,
      impuesto: sale.impuesto,
      paymentMethod: sale.metodo_pago,
      estado: sale.estado,
      userId: sale.usuario_id,
      username: sale.perfiles?.username || 'Desconocido',
      usuario_nombre: sale.perfiles?.nombre_completo || sale.perfiles?.username || 'Desconocido',
      clienteNombre: sale.cliente_nombre,
      createdAt: sale.creado_en,
      items: (sale.venta_detalles || []).map(item => ({
        productId: item.producto_id,
        productName: item.producto_nombre,
        quantity: item.cantidad,
        unitPrice: item.precio_unitario,
        subtotal: item.subtotal,
        cantidadPresentacion: item.cantidad_presentacion,
        unidadPresentacion: item.unidad_presentacion,
        factorConversion: item.factor_conversion,
        platoId: item.plato_id || null,
        esPlato: item.es_plato || false
      }))
    }));

    res.json({
      success: true,
      data: sales,
      total: searchLower ? filtered.length : (count || 0),
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((searchLower ? filtered.length : (count || 0)) / limitNum)
    });
  } catch (err) {
    console.error('Sales list error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ventas')
      .select('*, venta_detalles(*), perfiles(username, nombre_completo)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    // Resolver ingredientes consumidos para ventas de platos
    var ingredientesConsumidos = [];
    for (var di = 0; di < (data.venta_detalles || []).length; di++) {
      var det = data.venta_detalles[di];
      if (det.es_plato && det.plato_id) {
        var { data: receta } = await supabase
          .from('plato_ingredientes')
          .select('cantidad, unidad, productos!inner(nombre, unidad_medida)')
          .eq('plato_id', det.plato_id);
        if (receta) {
          for (var ri = 0; ri < receta.length; ri++) {
            var ing = receta[ri];
            ingredientesConsumidos.push({
              nombre: ing.productos.nombre,
              cantidad: parseFloat(ing.cantidad) * det.cantidad,
              unidad: ing.unidad,
              por: det.producto_nombre + ' x' + det.cantidad
            });
          }
        }
      }
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
        subtotal: item.subtotal,
        cantidadPresentacion: item.cantidad_presentacion,
        unidadPresentacion: item.unidad_presentacion,
        factorConversion: item.factor_conversion,
        platoId: item.plato_id || null,
        esPlato: item.es_plato || false
      })),
      ingredientesConsumidos: ingredientesConsumidos
    };

    res.json({ success: true, data: sale });
  } catch (err) {
    console.error('Sale get error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// PUT /api/sales/:id - editar salida con recalculo de stock
router.put('/:id', requirePermission('puede_editar_salidas'), async (req, res) => {
  try {
    const { items, paymentMethod } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'La salida debe contener al menos un producto' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Cocina requerida' });
    }

    // Obtener la venta original con sus detalles
    const { data: original, error: origError } = await supabase
      .from('ventas')
      .select('*, venta_detalles(*)')
      .eq('id', req.params.id)
      .single();
    if (origError || !original) {
      return res.status(404).json({ success: false, message: 'Salida no encontrada' });
    }

    // Construir mapa de cantidades originales por producto
    const originalMap = {};
    for (const d of original.venta_detalles) {
      originalMap[d.producto_id] = (originalMap[d.producto_id] || 0) + d.cantidad;
    }

    // Construir mapa de cantidades nuevas
    const newMap = {};
    for (const item of items) {
      newMap[item.productId] = (newMap[item.productId] || 0) + item.quantity;
    }

    // Devolver al stock las cantidades que se redujeron
    for (const prodId of Object.keys(originalMap)) {
      const origQty = originalMap[prodId];
      const newQty = newMap[prodId] || 0;
      if (newQty < origQty) {
        const diff = origQty - newQty;
        await supabase.rpc('registrar_movimiento', {
          p_producto_id: prodId,
          p_tipo: 'entrada',
          p_cantidad: diff,
          p_motivo: 'Ajuste por edicion de venta ' + original.numero_venta,
          p_usuario_id: req.user ? req.user.id : null
        });
      }
    }

    // Validar que las cantidades nuevas no excedan stock
    for (const prodId of Object.keys(newMap)) {
      const origQty = originalMap[prodId] || 0;
      const newQty = newMap[prodId];
      // Stock disponible = stock_actual + lo que se devuelve de este producto
      const { data: prod } = await supabase
        .from('productos')
        .select('stock_actual, nombre')
        .eq('id', prodId)
        .single();
      if (!prod) {
        return res.status(400).json({ success: false, message: 'Producto no encontrado' });
      }
      const stockDisponible = prod.stock_actual + (origQty > 0 ? origQty : 0);
      if (newQty > stockDisponible) {
        return res.status(400).json({
          success: false,
          message: 'Stock insuficiente para ' + prod.nombre + '. Disponible: ' + stockDisponible
        });
      }
    }

    // Descontar las nuevas cantidades (o la diferencia si aumento)
    for (const prodId of Object.keys(newMap)) {
      const origQty = originalMap[prodId] || 0;
      const newQty = newMap[prodId];
      if (newQty > origQty) {
        const diff = newQty - origQty;
        await supabase.rpc('registrar_movimiento', {
          p_producto_id: prodId,
          p_tipo: 'salida',
          p_cantidad: diff,
          p_motivo: 'Ajuste por edicion de venta ' + original.numero_venta,
          p_usuario_id: req.user ? req.user.id : null
        });
      }
    }

    // Eliminar detalles viejos y crear nuevos
    await supabase.from('venta_detalles').delete().eq('venta_id', req.params.id);

    let subtotal = 0;
    const detallesNuevos = [];
    for (const item of items) {
      const { data: prod } = await supabase
        .from('productos')
        .select('id, nombre, precio_venta')
        .eq('id', item.productId)
        .single();
      if (!prod) {
        return res.status(400).json({ success: false, message: 'Producto no encontrado' });
      }
      const cant = item.quantity;
      const sub = prod.precio_venta * cant;
      subtotal += sub;
      detallesNuevos.push({
        venta_id: req.params.id,
        producto_id: prod.id,
        producto_nombre: prod.nombre,
        cantidad: cant,
        precio_unitario: prod.precio_venta,
        subtotal: sub,
        cantidad_presentacion: item.cantidadPresentacion || null,
        unidad_presentacion: item.unidadPresentacion || null,
        factor_conversion: item.factorConversion || 1
      });
    }
    const { error: detallesError } = await supabase.from('venta_detalles').insert(detallesNuevos);
    if (detallesError) throw detallesError;

    // Actualizar cabecera
    const impuesto = subtotal * 0.19;
    const total = subtotal * 1.19;
    const { data: updated, error: updateError } = await supabase
      .from('ventas')
      .update({
        metodo_pago: paymentMethod,
        subtotal: subtotal,
        impuesto: impuesto,
        total: total
      })
      .eq('id', req.params.id)
      .select('*, venta_detalles(*), perfiles(username, nombre_completo)')
      .single();
    if (updateError) throw updateError;

    res.json({ success: true, data: {
      id: updated.id,
      numero_venta: updated.numero_venta,
      total: updated.total,
      subtotal: updated.subtotal,
      impuesto: updated.impuesto,
      paymentMethod: updated.metodo_pago,
      userId: updated.usuario_id,
      usuario_nombre: updated.perfiles?.nombre_completo || updated.perfiles?.username || '',
      createdAt: updated.creado_en,
      items: (updated.venta_detalles || []).map(item => ({
        productId: item.producto_id,
        productName: item.producto_nombre,
        quantity: item.cantidad,
        unitPrice: item.precio_unitario,
        subtotal: item.subtotal,
        cantidadPresentacion: item.cantidad_presentacion,
        unidadPresentacion: item.unidad_presentacion,
        factorConversion: item.factor_conversion
      }))
    }});
  } catch (err) {
    console.error('Sale update error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error del servidor' });
  }
});

// DELETE /api/sales/:id - eliminar salida y revertir stock
router.delete('/:id', requirePermission('puede_eliminar_salidas'), async (req, res) => {
  try {
    const { data: original, error: origError } = await supabase
      .from('ventas')
      .select('*, venta_detalles(*)')
      .eq('id', req.params.id)
      .single();
    if (origError || !original) {
      return res.status(404).json({ success: false, message: 'Salida no encontrada' });
    }

    // Revertir stock segun tipo de venta
    for (const d of original.venta_detalles) {
      if (d.es_plato && d.plato_id) {
        const { data: receta } = await supabase
          .from('plato_ingredientes')
          .select('producto_id, cantidad')
          .eq('plato_id', d.plato_id);
        if (receta) {
          for (const ing of receta) {
            await supabase.rpc('registrar_movimiento', {
              p_producto_id: ing.producto_id,
              p_tipo: 'entrada',
              p_cantidad: ing.cantidad * d.cantidad,
              p_motivo: 'Eliminacion de venta ' + original.numero_venta,
              p_usuario_id: req.user ? req.user.id : null
            });
          }
        }
      } else if (d.producto_id) {
        await supabase.rpc('registrar_movimiento', {
          p_producto_id: d.producto_id,
          p_tipo: 'entrada',
          p_cantidad: d.cantidad,
          p_motivo: 'Eliminacion de venta ' + original.numero_venta,
          p_usuario_id: req.user ? req.user.id : null
        });
      }
    }

    await supabase.from('venta_detalles').delete().eq('venta_id', req.params.id);
    const { error: delError } = await supabase.from('ventas').delete().eq('id', req.params.id);
    if (delError) throw delError;

    res.json({ success: true, message: 'Salida eliminada' });
  } catch (err) {
    console.error('Sale delete error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.post('/', requirePermission('puede_crear_salidas'), async (req, res) => {
  try {
    const { items, platos, paymentMethod, clienteNombre } = req.body;

    if (platos && Array.isArray(platos) && platos.length > 0) {
      await handleDishSale(req, res);
      return;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'La venta debe contener al menos un producto o plato' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Metodo de pago requerido' });
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Item invalido: productId y quantity son requeridos' });
      }
    }

    const { data: saleId, error } = await supabase.rpc('procesar_venta', {
      p_items: items.map(item => ({
        producto_id: item.productId,
        cantidad: item.quantity,
        cantidad_presentacion: item.cantidadPresentacion || null,
        unidad_presentacion: item.unidadPresentacion || null,
        factor_conversion: item.factorConversion || 1
      })),
      p_metodo_pago: paymentMethod,
      p_usuario_id: req.user.id || null,
      p_cliente_nombre: clienteNombre || null
    });

    if (error) throw error;

    const { data: sale } = await supabase
      .from('ventas')
      .select('*, venta_detalles(*)')
      .eq('id', saleId)
      .single();

    const response = mapSaleResponse(sale);
    res.status(201).json({ success: true, data: response, message: 'Venta registrada' });
  } catch (err) {
    console.error('Sale create error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error del servidor' });
  }
});

// ============================================================================
// Helpers: conversion de unidades, respuesta y venta de platos
// ============================================================================

function convertToBaseUnit(cantidad, fromUnit, toUnit) {
  if (!fromUnit || !toUnit) return cantidad;
  var from = fromUnit.toLowerCase().trim();
  var to = toUnit.toLowerCase().trim();
  if (from === to) return cantidad;
  var toGrams = { g: 1, gr: 1, gramo: 1, gramos: 1, kg: 1000, kilo: 1000, kilos: 1000, lb: 453.592, lbs: 453.592, libra: 453.592, libras: 453.592, onza: 28.3495, oz: 28.3495 };
  var toML = { ml: 1, mililitro: 1, mililitros: 1, l: 1000, litro: 1000, litros: 1000, lt: 1000 };
  if (toGrams[from] && toGrams[to]) return (cantidad * toGrams[from]) / toGrams[to];
  if (toML[from] && toML[to]) return (cantidad * toML[from]) / toML[to];
  return cantidad;
}

function mapSaleResponse(sale) {
  return {
    id: sale.id, numero_venta: sale.numero_venta, total: sale.total,
    subtotal: sale.subtotal, impuesto: sale.impuesto,
    paymentMethod: sale.metodo_pago, estado: sale.estado,
    userId: sale.usuario_id,
    username: sale.perfiles ? sale.perfiles.username : 'Desconocido',
    usuario_nombre: sale.perfiles ? (sale.perfiles.nombre_completo || sale.perfiles.username) : 'Desconocido',
    clienteNombre: sale.cliente_nombre, createdAt: sale.creado_en,
    items: (sale.venta_detalles || []).map(function (item) {
      return {
        productId: item.producto_id, productName: item.producto_nombre,
        quantity: item.cantidad, unitPrice: item.precio_unitario,
        subtotal: item.subtotal,
        cantidadPresentacion: item.cantidad_presentacion,
        unidadPresentacion: item.unidad_presentacion,
        factorConversion: item.factor_conversion,
        platoId: item.plato_id || null, esPlato: item.es_plato || false
      };
    })
  };
}

async function handleDishSale(req, res) {
  try {
    var platos = req.body.platos;
    var paymentMethod = req.body.paymentMethod;
    var clienteNombre = req.body.clienteNombre;
    if (!paymentMethod) return res.status(400).json({ success: false, message: 'Cocina requerida' });
    var saleEstado = req.body.estado || 'completada';

    var ingredientesTotales = {};
    for (var i = 0; i < platos.length; i++) {
      var d = platos[i];
      var cantPlato = Math.max(1, parseInt(d.cantidad) || 1);
      var { data: receta, error: recetaErr } = await supabase
        .from('plato_ingredientes')
        .select('producto_id, cantidad, unidad, productos!inner(nombre, unidad_medida)')
        .eq('plato_id', d.plato_id);
      if (recetaErr) throw recetaErr;
      if (!receta || receta.length === 0) continue;
      for (var j = 0; j < receta.length; j++) {
        var ing = receta[j];
        var pid = ing.producto_id;
        var prodUnidad = ing.productos.unidad_medida || '';
        var converted = convertToBaseUnit(ing.cantidad * cantPlato, ing.unidad, prodUnidad);
        if (ingredientesTotales[pid]) {
          ingredientesTotales[pid].cantidad_total += converted;
        } else {
          ingredientesTotales[pid] = { nombre: ing.productos.nombre, cantidad_total: converted, unidad: prodUnidad };
        }
      }
    }

    var prodIds = Object.keys(ingredientesTotales);
    for (var k = 0; k < prodIds.length; k++) {
      var pid = prodIds[k];
      var needed = ingredientesTotales[pid].cantidad_total;
      var { data: prod, error: prodErr } = await supabase.from('productos').select('stock_actual').eq('id', pid).single();
      if (prodErr || !prod) return res.status(400).json({ success: false, message: 'Producto no encontrado' });
      if (parseFloat(prod.stock_actual) < needed) {
        return res.status(400).json({ success: false, message: 'Stock insuficiente de ' + ingredientesTotales[pid].nombre + '. Disponible: ' + parseFloat(prod.stock_actual) + ', Necesario: ' + Math.round(needed * 1000) / 1000 });
      }
    }

    var totalVenta = 0;
    for (var m = 0; m < platos.length; m++) {
      var pd = platos[m];
      var cant = Math.max(1, parseInt(pd.cantidad) || 1);
      var precio = parseFloat(pd.precioUnitario) || 0;
      if (!precio) { var { data: pi } = await supabase.from('platos').select('precio_venta').eq('id', pd.plato_id).single(); precio = pi ? parseFloat(pi.precio_venta) : 0; }
      totalVenta += precio * cant;
    }

    var numVenta = 'P-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    var { data: venta, error: ventaErr } = await supabase.from('ventas').insert({
      numero_venta: numVenta, metodo_pago: paymentMethod, usuario_id: req.user ? req.user.id : null,
      cliente_nombre: clienteNombre || null, estado: saleEstado,
      subtotal: totalVenta, impuesto: totalVenta * 0.19, total: totalVenta * 1.19
    }).select().single();
    if (ventaErr) throw ventaErr;

    for (var n = 0; n < platos.length; n++) {
      var pd2 = platos[n];
      var cant2 = Math.max(1, parseInt(pd2.cantidad) || 1);
      var precio2 = parseFloat(pd2.precioUnitario) || 0;
      var { data: pi2 } = await supabase.from('platos').select('nombre, precio_venta').eq('id', pd2.plato_id).single();
      if (!pi2) continue;
      if (!precio2) precio2 = parseFloat(pi2.precio_venta);
      await supabase.from('venta_detalles').insert({
        venta_id: venta.id, producto_id: null, producto_nombre: pi2.nombre,
        cantidad: cant2, precio_unitario: precio2, subtotal: precio2 * cant2,
        plato_id: pd2.plato_id, es_plato: true
      });
    }

    if (saleEstado !== 'pendiente') {
      var idsDesc = Object.keys(ingredientesTotales);
      for (var p = 0; p < idsDesc.length; p++) {
        var pid2 = idsDesc[p];
        var { error: moveErr } = await supabase.rpc('registrar_movimiento', {
          p_producto_id: pid2, p_tipo: 'salida',
          p_cantidad: ingredientesTotales[pid2].cantidad_total,
          p_motivo: 'Venta de platos ' + numVenta,
          p_usuario_id: req.user ? req.user.id : null
        });
        if (moveErr) throw moveErr;
      }
    }

    var { data: saleFull } = await supabase.from('ventas')
      .select('*, venta_detalles(*), perfiles(username, nombre_completo)')
      .eq('id', venta.id).single();

    res.status(201).json({ success: true, data: mapSaleResponse(saleFull),
      message: saleEstado === 'pendiente' ? 'Pedido creado (pendiente)' : 'Pedido confirmado' });
  } catch (err) {
    console.error('handleDishSale error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error al procesar pedido' });
  }
}

module.exports = router;
