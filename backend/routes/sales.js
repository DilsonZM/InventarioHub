const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requirePermission } = require('../middleware/auth');
const { applyBogotaDateFilter } = require('../lib/timezone');

router.get('/', async (req, res) => {
  try {
    const { from, to, page, limit, mesa, modo, search } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let countQuery = supabase
      .from('ventas')
      .select('*', { count: 'exact', head: true });

    countQuery = applyBogotaDateFilter(countQuery, 'creado_en', from, to);
    if (mesa) countQuery = countQuery.eq('mesa_id', mesa);
    if (modo) countQuery = countQuery.eq('metodo_pago', modo);

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    let query = supabase
      .from('ventas')
      .select('*, venta_detalles(*), perfiles(username, nombre_completo), mesas(nombre)')
      .order('creado_en', { ascending: false })
      .range(offset, offset + limitNum - 1);

    query = applyBogotaDateFilter(query, 'creado_en', from, to);
    if (mesa) query = query.eq('mesa_id', mesa);
    if (modo) query = query.eq('metodo_pago', modo);

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
      estadoCocina: sale.estado_cocina || 'pendiente',
      mesaId: sale.mesa_id || null,
      mesaNombre: sale.mesas?.nombre || null,
      costoDomicilio: parseFloat(sale.costo_domicilio) || 0,
      propina: parseFloat(sale.propina) || 0,
      bonoDescuento: parseFloat(sale.bono_descuento) || 0,
      formaPago: sale.forma_pago || null,
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
        observacion: item.observacion || null,
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
      .select('*, venta_detalles(*), perfiles(username, nombre_completo), mesas(nombre)')
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
      estadoCocina: data.estado_cocina || 'pendiente',
      mesaId: data.mesa_id || null,
      mesaNombre: data.mesas?.nombre || null,
      costoDomicilio: parseFloat(data.costo_domicilio) || 0,
      propina: parseFloat(data.propina) || 0,
      bonoDescuento: parseFloat(data.bono_descuento) || 0,
      formaPago: data.forma_pago || null,
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
        observacion: item.observacion || null,
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
    const { items, platos, paymentMethod, mesa_id } = req.body;
    const hasItems = items && Array.isArray(items) && items.length > 0;
    const hasPlatos = platos && Array.isArray(platos) && platos.length > 0;
    if (!hasItems && !hasPlatos) {
      return res.status(400).json({ success: false, message: 'La salida debe contener al menos un producto o plato' });
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

    // === 1. Revertir stock de platos originales ===
    for (const d of original.venta_detalles) {
      if (d.es_plato && d.plato_id) {
        const { data: receta } = await supabase
          .from('plato_ingredientes')
          .select('producto_id, cantidad, unidad, productos!inner(unidad_medida)')
          .eq('plato_id', d.plato_id);
        if (receta) {
          for (const ing of receta) {
            var conv = convertToBaseUnit(ing.cantidad * d.cantidad, ing.unidad, ing.productos.unidad_medida);
            await supabase.rpc('registrar_movimiento', {
              p_producto_id: ing.producto_id,
              p_tipo: 'entrada',
              p_cantidad: conv,
              p_motivo: 'Ajuste por edicion de venta ' + original.numero_venta,
              p_usuario_id: req.user ? req.user.id : null
            });
          }
        }
      }
    }

    // === 2. Revertir stock de productos directos originales ===
    const originalMap = {};
    for (const d of original.venta_detalles) {
      if (!d.es_plato && d.producto_id) {
        originalMap[d.producto_id] = (originalMap[d.producto_id] || 0) + d.cantidad;
      }
    }
    for (const prodId of Object.keys(originalMap)) {
      const origQty = originalMap[prodId];
      const newQty = 0; // Se recalcula abajo
      // Devolver todo el stock original (despues se descuenta lo nuevo)
      await supabase.rpc('registrar_movimiento', {
        p_producto_id: prodId,
        p_tipo: 'entrada',
        p_cantidad: origQty,
        p_motivo: 'Ajuste por edicion de venta ' + original.numero_venta,
        p_usuario_id: req.user ? req.user.id : null
      });
    }

    var subtotal = 0;

    // === 3. Validar y preparar nuevos platos ===
    var ingredientesTotales = {};
    if (hasPlatos) {
      for (var i = 0; i < platos.length; i++) {
        var pd = platos[i];
        var cantPlato = Math.max(1, parseInt(pd.cantidad) || 1);
        var { data: receta, error: recetaErr } = await supabase
          .from('plato_ingredientes')
          .select('producto_id, cantidad, unidad, productos!inner(nombre, unidad_medida)')
          .eq('plato_id', pd.plato_id);
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
      // Validar stock para ingredientes
      var ingIds = Object.keys(ingredientesTotales);
      for (var k = 0; k < ingIds.length; k++) {
        var pid = ingIds[k];
        var needed = ingredientesTotales[pid].cantidad_total;
        var { data: prod, error: prodErr } = await supabase.from('productos').select('stock_actual').eq('id', pid).single();
        if (prodErr || !prod) return res.status(400).json({ success: false, message: 'Producto no encontrado' });
        if (parseFloat(prod.stock_actual) < needed) {
          return res.status(400).json({ success: false, message: 'Stock insuficiente de ' + ingredientesTotales[pid].nombre + '. Disponible: ' + parseFloat(prod.stock_actual) + ', Necesario: ' + Math.round(needed * 1000) / 1000 });
        }
      }
    }

    // === 4. Validar y preparar nuevos productos directos ===
    var newProductMap = {};
    if (hasItems) {
      for (var ni = 0; ni < items.length; ni++) {
        var it = items[ni];
        if (!it.productId || !it.quantity) continue;
        newProductMap[it.productId] = (newProductMap[it.productId] || 0) + it.quantity;
      }
      for (var pi of Object.keys(newProductMap)) {
        var { data: prod, error: prodErr } = await supabase.from('productos').select('stock_actual, nombre').eq('id', pi).single();
        if (prodErr || !prod) return res.status(400).json({ success: false, message: 'Producto no encontrado' });
        if (parseFloat(prod.stock_actual) < newProductMap[pi]) {
          return res.status(400).json({ success: false, message: 'Stock insuficiente de ' + prod.nombre + '. Disponible: ' + prod.stock_actual });
        }
      }
    }

    // === 5. Aplicar deducciones de ingredientes ===
    if (hasPlatos) {
      var ingIds2 = Object.keys(ingredientesTotales);
      for (var p = 0; p < ingIds2.length; p++) {
        var pid2 = ingIds2[p];
        await supabase.rpc('registrar_movimiento', {
          p_producto_id: pid2, p_tipo: 'salida',
          p_cantidad: ingredientesTotales[pid2].cantidad_total,
          p_motivo: 'Ajuste por edicion de venta ' + original.numero_venta,
          p_usuario_id: req.user ? req.user.id : null
        });
      }
    }

    // === 6. Aplicar deducciones de productos directos ===
    if (hasItems) {
      for (var qi of Object.keys(newProductMap)) {
        await supabase.rpc('registrar_movimiento', {
          p_producto_id: qi, p_tipo: 'salida',
          p_cantidad: newProductMap[qi],
          p_motivo: 'Ajuste por edicion de venta ' + original.numero_venta,
          p_usuario_id: req.user ? req.user.id : null
        });
      }
    }

    // === 7. Eliminar detalles viejos y crear nuevos ===
    await supabase.from('venta_detalles').delete().eq('venta_id', req.params.id);

    var detallesNuevos = [];

    // Insertar detalles de platos
    if (hasPlatos) {
      for (var n = 0; n < platos.length; n++) {
        var pd2 = platos[n];
        var cant2 = Math.max(1, parseInt(pd2.cantidad) || 1);
        var precio2 = parseFloat(pd2.precioUnitario) || 0;
        var { data: pi2 } = await supabase.from('platos').select('nombre, precio_venta').eq('id', pd2.plato_id).single();
        if (!pi2) continue;
        if (!precio2) {
          var { data: efPrecio } = await supabase.rpc('precio_efectivo_plato', { p_plato_id: pd2.plato_id });
          precio2 = parseFloat(efPrecio) || parseFloat(pi2.precio_venta);
        }
        var subDish = precio2 * cant2;
        subtotal += subDish;
        detallesNuevos.push({
          venta_id: req.params.id,
          producto_id: null,
          producto_nombre: pi2.nombre,
          cantidad: cant2,
          precio_unitario: precio2,
          subtotal: subDish,
          plato_id: pd2.plato_id,
          es_plato: true,
          observacion: pd2.observacion || null
        });
      }
    }

    // Insertar detalles de productos directos
    if (hasItems) {
      for (var mi = 0; mi < items.length; mi++) {
        var item = items[mi];
        if (!item.productId || !item.quantity) continue;
        var { data: prod } = await supabase
          .from('productos')
          .select('id, nombre, precio_venta')
          .eq('id', item.productId)
          .single();
        if (!prod) {
          return res.status(400).json({ success: false, message: 'Producto no encontrado' });
        }
        var cant = item.quantity;
        var sub = prod.precio_venta * cant;
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
          factor_conversion: item.factorConversion || 1,
          observacion: item.observacion || null
        });
      }
    }

    var { error: detallesError } = await supabase.from('venta_detalles').insert(detallesNuevos);
    if (detallesError) throw detallesError;

    // === 8. Actualizar cabecera (IVA incluido: no cobrar adicional) ===
    var costoDomicilio = parseFloat(req.body.costoDomicilio) || parseFloat(original.costo_domicilio) || 0;
    var propina = parseFloat(req.body.propina) || parseFloat(original.propina) || 0;
    var bonoDescuento = parseFloat(req.body.bonoDescuento) || parseFloat(original.bono_descuento) || 0;
    var impuesto = Math.round(subtotal * 19 / 119 * 100) / 100;
    var total = subtotal + costoDomicilio - bonoDescuento + propina;
    var { data: updated, error: updateError } = await supabase
      .from('ventas')
      .update({
        metodo_pago: paymentMethod,
        mesa_id: mesa_id || null,
        subtotal: subtotal,
        impuesto: impuesto,
        total: total,
        costo_domicilio: costoDomicilio,
        propina: propina,
        bono_descuento: bonoDescuento,
        forma_pago: req.body.formaPago || original.forma_pago || null
      })
      .eq('id', req.params.id)
      .select('*, venta_detalles(*), perfiles(username, nombre_completo), mesas(nombre)')
      .single();
    if (updateError) throw updateError;

    res.json({ success: true, data: mapSaleResponse(updated) });
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
    const { items, platos, paymentMethod, clienteNombre, mesa_id, costoDomicilio, propina, bonoDescuento, formaPago } = req.body;

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
        factor_conversion: item.factorConversion || 1,
        observacion: item.observacion || null
      })),
      p_metodo_pago: paymentMethod,
      p_usuario_id: req.user.id || null,
      p_cliente_nombre: clienteNombre || null,
      p_costo_domicilio: parseFloat(costoDomicilio) || 0,
      p_propina: parseFloat(propina) || 0,
      p_bono_descuento: parseFloat(bonoDescuento) || 0,
      p_forma_pago: formaPago || null,
      p_mesa_id: mesa_id || null,
      p_estado_cocina: 'pendiente'
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
    estadoCocina: sale.estado_cocina || 'pendiente',
    costoDomicilio: parseFloat(sale.costo_domicilio) || 0,
    propina: parseFloat(sale.propina) || 0,
    bonoDescuento: parseFloat(sale.bono_descuento) || 0,
    formaPago: sale.forma_pago || null,
    userId: sale.usuario_id,
    username: sale.perfiles ? sale.perfiles.username : 'Desconocido',
    usuario_nombre: sale.perfiles ? (sale.perfiles.nombre_completo || sale.perfiles.username) : 'Desconocido',
    clienteNombre: sale.cliente_nombre, createdAt: sale.creado_en,
    mesaId: sale.mesa_id || null,
    mesaNombre: sale.mesas ? sale.mesas.nombre : null,
    items: (sale.venta_detalles || []).map(function (item) {
      return {
        productId: item.producto_id, productName: item.producto_nombre,
        quantity: item.cantidad, unitPrice: item.precio_unitario,
        subtotal: item.subtotal,
        cantidadPresentacion: item.cantidad_presentacion,
        unidadPresentacion: item.unidad_presentacion,
        factorConversion: item.factor_conversion,
        observacion: item.observacion || null,
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
      if (!precio) {
        var { data: efPrecio } = await supabase.rpc('precio_efectivo_plato', { p_plato_id: pd.plato_id });
        precio = parseFloat(efPrecio) || 0;
        if (!precio) { var { data: pi } = await supabase.from('platos').select('precio_venta').eq('id', pd.plato_id).single(); precio = pi ? parseFloat(pi.precio_venta) : 0; }
      }
      totalVenta += precio * cant;
    }

    var numVenta = 'P-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    var costoDomicilio = parseFloat(req.body.costoDomicilio) || 0;
    var propina = parseFloat(req.body.propina) || 0;
    var bonoDescuento = parseFloat(req.body.bonoDescuento) || 0;
    var impuestoVenta = Math.round(totalVenta * 19 / 119 * 100) / 100;
    var totalFinal = totalVenta + costoDomicilio - bonoDescuento + propina;
    var { data: venta, error: ventaErr } = await supabase.from('ventas').insert({
      numero_venta: numVenta, metodo_pago: paymentMethod, usuario_id: req.user ? req.user.id : null,
      cliente_nombre: clienteNombre || null, estado: saleEstado,
      mesa_id: req.body.mesa_id || null,
      subtotal: totalVenta, impuesto: impuestoVenta, total: totalFinal,
      costo_domicilio: costoDomicilio, propina: propina, bono_descuento: bonoDescuento,
      forma_pago: req.body.formaPago || null,
      estado_cocina: req.body.estadoCocina || 'pendiente'
    }).select().single();
    if (ventaErr) throw ventaErr;

    for (var n = 0; n < platos.length; n++) {
      var pd2 = platos[n];
      var cant2 = Math.max(1, parseInt(pd2.cantidad) || 1);
      var precio2 = parseFloat(pd2.precioUnitario) || 0;
      var { data: pi2 } = await supabase.from('platos').select('nombre, precio_venta').eq('id', pd2.plato_id).single();
      if (!pi2) continue;
      if (!precio2) {
        // Usar precio_efectivo (con descuento si aplica)
        var { data: efPrecio } = await supabase.rpc('precio_efectivo_plato', { p_plato_id: pd2.plato_id });
        precio2 = parseFloat(efPrecio) || parseFloat(pi2.precio_venta);
      }
      await supabase.from('venta_detalles').insert({
        venta_id: venta.id, producto_id: null, producto_nombre: pi2.nombre,
        cantidad: cant2, precio_unitario: precio2, subtotal: precio2 * cant2,
        plato_id: pd2.plato_id, es_plato: true,
        observacion: pd2.observacion || null
      });
    }

    // Procesar productos directos (items) si vienen en el mismo pedido
    var items = req.body.items;
    if (items && Array.isArray(items)) {
      for (var ni = 0; ni < items.length; ni++) {
        var it = items[ni];
        if (!it.productId || !it.quantity) continue;
        var { data: prod } = await supabase.from('productos').select('nombre, precio_venta, stock_actual').eq('id', it.productId).single();
        if (!prod) continue;
        var itemQty = parseFloat(it.quantity) || 0;
        if (itemQty <= 0) continue;
        var itemSub = itemQty * parseFloat(prod.precio_venta);
        totalVenta += itemSub;
        await supabase.from('venta_detalles').insert({
          venta_id: venta.id, producto_id: it.productId, producto_nombre: prod.nombre,
          cantidad: itemQty, precio_unitario: prod.precio_venta, subtotal: itemSub,
          es_plato: false, observacion: it.observacion || null
        });
      }
      // Actualizar total de la venta (IVA incluido: no cobrar adicional)
      var impFinal = Math.round(totalVenta * 19 / 119 * 100) / 100;
      var totFinal = totalVenta + costoDomicilio - bonoDescuento + propina;
      await supabase.from('ventas').update({
        subtotal: totalVenta, impuesto: impFinal, total: totFinal
      }).eq('id', venta.id);
    }

    if (saleEstado !== 'pendiente') {
      var idsDesc = Object.keys(ingredientesTotales);
      for (var p = 0; p < idsDesc.length; p++) {
        var pid2 = idsDesc[p];
        await supabase.rpc('registrar_movimiento', {
          p_producto_id: pid2, p_tipo: 'salida',
          p_cantidad: ingredientesTotales[pid2].cantidad_total,
          p_motivo: 'Venta de platos ' + numVenta,
          p_usuario_id: req.user ? req.user.id : null
        });
      }
      // Descontar productos directos
      if (items) {
        for (var qi = 0; qi < items.length; qi++) {
          var it2 = items[qi];
          if (!it2.productId || !it2.quantity) continue;
          await supabase.rpc('registrar_movimiento', {
            p_producto_id: it2.productId, p_tipo: 'salida',
            p_cantidad: parseFloat(it2.quantity) || 0,
            p_motivo: 'Venta ' + numVenta,
            p_usuario_id: req.user ? req.user.id : null
          });
        }
      }
    }

    var { data: saleFull } = await supabase.from('ventas')
      .select('*, venta_detalles(*), perfiles(username, nombre_completo), mesas(nombre)')
      .eq('id', venta.id).single();

    res.status(201).json({ success: true, data: mapSaleResponse(saleFull),
      message: saleEstado === 'pendiente' ? 'Pedido creado (pendiente)' : 'Pedido confirmado' });
  } catch (err) {
    console.error('handleDishSale error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error al procesar pedido' });
  }
}

// Avanzar estado de cocina
router.patch('/:id/estado-cocina', requirePermission('puede_crear_salidas'), async (req, res) => {
  try {
    var { estado } = req.body;
    var validos = ['pendiente', 'preparando', 'listo', 'entregado'];
    if (!estado || !validos.includes(estado)) {
      return res.status(400).json({ success: false, message: 'Estado invalido. Valores: pendiente, preparando, listo, entregado' });
    }

    var { data: venta } = await supabase.from('ventas').select('estado_cocina').eq('id', req.params.id).single();
    if (!venta) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

    var secuencia = { pendiente: 'preparando', preparando: 'listo', listo: 'entregado' };
    var actual = venta.estado_cocina || 'pendiente';
    if (estado !== secuencia[actual]) {
      return res.status(400).json({ success: false, message: 'Transicion invalida de ' + actual + ' a ' + estado });
    }

    var { error } = await supabase.from('ventas').update({ estado_cocina: estado }).eq('id', req.params.id);
    if (error) throw error;

    res.json({ success: true, data: { estadoCocina: estado }, message: 'Estado actualizado a ' + estado });
  } catch (err) {
    console.error('PATCH estado-cocina error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// PUT /api/sales/:id/tip - editar propina (permitido siempre, incluso si estado='completada')
router.put('/:id/tip', requirePermission('puede_editar_salidas'), async (req, res) => {
  try {
    var propina = parseFloat(req.body.propina);
    if (isNaN(propina) || propina < 0) {
      return res.status(400).json({ success: false, message: 'Propina invalida. Debe ser un numero >= 0' });
    }

    var { data: venta, error: getError } = await supabase
      .from('ventas')
      .select('id, subtotal, costo_domicilio, bono_descuento, propina')
      .eq('id', req.params.id)
      .single();
    if (getError || !venta) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    var subtotal = parseFloat(venta.subtotal) || 0;
    var domicilio = parseFloat(venta.costo_domicilio) || 0;
    var bono = parseFloat(venta.bono_descuento) || 0;
    var nuevoTotal = subtotal + domicilio - bono + propina;

    var { data: updated, error: updateError } = await supabase
      .from('ventas')
      .update({ propina: propina, total: nuevoTotal })
      .eq('id', req.params.id)
      .select('id, propina, total')
      .single();
    if (updateError) throw updateError;

    res.json({ success: true, data: { propina: updated.propina, total: updated.total }, message: 'Propina actualizada' });
  } catch (err) {
    console.error('PUT tip error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// PUT /api/sales/:id/payment - editar forma_pago, propina y bono_descuento juntos
// Usado al cerrar la venta (el cliente decide como paga despues de hacer el pedido)
router.put('/:id/payment', requirePermission('puede_editar_salidas'), async (req, res) => {
  try {
    var formaPago = req.body.formaPago || null;
    var propina = parseFloat(req.body.propina);
    var bono = parseFloat(req.body.bonoDescuento);

    if (isNaN(propina) || propina < 0) propina = null; // no cambiar
    if (isNaN(bono) || bono < 0) bono = null; // no cambiar

    var { data: venta, error: getError } = await supabase
      .from('ventas')
      .select('id, subtotal, costo_domicilio, bono_descuento, propina, forma_pago')
      .eq('id', req.params.id)
      .single();
    if (getError || !venta) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    var subtotal = parseFloat(venta.subtotal) || 0;
    var domicilio = parseFloat(venta.costo_domicilio) || 0;
    var finalPropina = propina !== null ? propina : parseFloat(venta.propina) || 0;
    var finalBono = bono !== null ? bono : parseFloat(venta.bono_descuento) || 0;
    var finalFormaPago = formaPago || venta.forma_pago || null;
    var nuevoTotal = subtotal + domicilio - finalBono + finalPropina;

    var { data: updated, error: updateError } = await supabase
      .from('ventas')
      .update({
        forma_pago: finalFormaPago,
        propina: finalPropina,
        bono_descuento: finalBono,
        total: nuevoTotal
      })
      .eq('id', req.params.id)
      .select('id, forma_pago, propina, bono_descuento, total')
      .single();
    if (updateError) throw updateError;

    res.json({
      success: true,
      data: {
        formaPago: updated.forma_pago,
        propina: updated.propina,
        bonoDescuento: updated.bono_descuento,
        total: updated.total
      },
      message: 'Pago actualizado'
    });
  } catch (err) {
    console.error('PUT payment error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// POST /api/sales/comanda - crear comanda (pedido inicial, estado pendiente)
// Descuenta stock pero no factura (estado = 'pendiente', se factura despues)
router.post('/comanda', requirePermission('puede_crear_salidas'), async (req, res) => {
  try {
    // Reusar la logica de POST / pero forzando estado='pendiente'
    req.body.estado = 'pendiente';
    req.body.estadoCocina = 'pendiente';

    // Si hay platos, usar handleDishSale (que ya maneja estado='pendiente' sin descontar stock)
    if (req.body.platos && Array.isArray(req.body.platos) && req.body.platos.length > 0) {
      await handleDishSale(req, res);
      return;
    }

    // Si solo hay items directos, usar procesar_venta con estado pendiente
    const { items, paymentMethod, clienteNombre, mesa_id, costoDomicilio, propina, bonoDescuento, formaPago } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'La comanda debe contener al menos un producto o plato' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Metodo de pago requerido' });
    }

    const { data: saleId, error } = await supabase.rpc('procesar_venta', {
      p_items: items.map(item => ({
        producto_id: item.productId,
        cantidad: item.quantity,
        cantidad_presentacion: item.cantidadPresentacion || null,
        unidad_presentacion: item.unidadPresentacion || null,
        factor_conversion: item.factorConversion || 1,
        observacion: item.observacion || null
      })),
      p_metodo_pago: paymentMethod,
      p_usuario_id: req.user.id || null,
      p_cliente_nombre: clienteNombre || null,
      p_costo_domicilio: parseFloat(costoDomicilio) || 0,
      p_propina: parseFloat(propina) || 0,
      p_bono_descuento: parseFloat(bonoDescuento) || 0,
      p_forma_pago: formaPago || null,
      p_mesa_id: mesa_id || null,
      p_estado_cocina: 'pendiente'
    });

    if (error) throw error;

    // Marcar como pendiente (comanda, no facturada)
    await supabase.from('ventas').update({ estado: 'pendiente' }).eq('id', saleId);

    const { data: sale } = await supabase
      .from('ventas')
      .select('*, venta_detalles(*), perfiles(username, nombre_completo), mesas(nombre)')
      .eq('id', saleId)
      .single();

    res.status(201).json({ success: true, data: mapSaleResponse(sale), message: 'Comanda registrada (pendiente)' });
  } catch (err) {
    console.error('POST comanda error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error del servidor' });
  }
});

module.exports = router;
