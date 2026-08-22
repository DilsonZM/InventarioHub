const supabase = require('./supabase');

function convertToBaseUnit(cantidad, fromUnit, toUnit) {
  var value = parseFloat(cantidad) || 0;
  if (!fromUnit || !toUnit) return value;
  var from = fromUnit.toLowerCase().trim();
  var to = toUnit.toLowerCase().trim();
  if (from === to) return value;

  var grams = { g: 1, gr: 1, gramo: 1, gramos: 1, kg: 1000, kilo: 1000, kilos: 1000, lb: 453.592, libra: 453.592, onza: 28.3495, oz: 28.3495 };
  var milliliters = { ml: 1, mililitro: 1, mililitros: 1, l: 1000, litro: 1000, litros: 1000, lt: 1000 };
  var units = { unidad: 1, und: 1, unid: 1, docena: 12, decena: 10 };

  if (grams[from] && grams[to]) return (value * grams[from]) / grams[to];
  if (milliliters[from] && milliliters[to]) return (value * milliliters[from]) / milliliters[to];
  if (units[from] && units[to]) return (value * units[from]) / units[to];
  return value;
}

function reservationIsDue(reserva, now) {
  if (!reserva || !reserva.fecha || !reserva.hora) return true;
  var scheduled = new Date(String(reserva.fecha) + 'T' + String(reserva.hora).slice(0, 8) + '-05:00');
  if (Number.isNaN(scheduled.getTime())) return true;
  return scheduled.getTime() <= (now || new Date()).getTime() + 60 * 60 * 1000;
}

function makeOrderNumber() {
  var date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return 'P-' + date + '-' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

async function createOrderFromReservation(reserva) {
  if (!reserva || reserva.numero_venta) return null;

  var items = reserva.reserva_items || [];
  if (items.length === 0) return null;

  var ingredientesTotales = {};
  var insumosTanda = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var { data: receta, error: recetaError } = await supabase
      .from('plato_ingredientes')
      .select('producto_id, cantidad, unidad, rendimiento_por_tanda, cantidad_tanda, productos!inner(nombre, unidad_medida)')
      .eq('plato_id', item.plato_id);
    if (recetaError) throw recetaError;

    var quantity = Math.max(1, parseInt(item.cantidad, 10) || 1);
    (receta || []).forEach(function (ing) {
      var productUnit = ing.productos?.unidad_medida || '';
      if (parseInt(ing.rendimiento_por_tanda, 10) > 1 && parseFloat(ing.cantidad_tanda) > 0) {
        insumosTanda.push({
          producto_id: ing.producto_id,
          porciones: quantity,
          rendimiento: parseInt(ing.rendimiento_por_tanda, 10),
          cantidad_tanda: parseFloat(ing.cantidad_tanda)
        });
        return;
      }

      var converted = convertToBaseUnit(parseFloat(ing.cantidad) * quantity, ing.unidad, productUnit);
      if (!ingredientesTotales[ing.producto_id]) {
        ingredientesTotales[ing.producto_id] = {
          nombre: ing.productos?.nombre || 'Producto',
          cantidad_total: 0
        };
      }
      ingredientesTotales[ing.producto_id].cantidad_total += converted;
    });
  }

  var ingredientIds = Object.keys(ingredientesTotales);
  for (var j = 0; j < ingredientIds.length; j++) {
    var productId = ingredientIds[j];
    var needed = ingredientesTotales[productId].cantidad_total;
    var { data: product, error: productError } = await supabase
      .from('productos')
      .select('stock_actual')
      .eq('id', productId)
      .single();
    if (productError || !product) throw new Error('Producto no encontrado');
    if (parseFloat(product.stock_actual) < needed) {
      throw new Error('Stock insuficiente de ' + ingredientesTotales[productId].nombre);
    }
  }

  var subtotal = (items || []).reduce(function (sum, item) {
    return sum + (parseFloat(item.subtotal) || 0);
  }, 0);
  var isDelivery = reserva.tipo_pedido === 'domicilio';
  var deliveryCost = isDelivery ? (parseFloat(reserva.costo_domicilio) || 3000) : 0;
  var orderNumber = makeOrderNumber();
  var notes = reserva.notas || '';
  if (isDelivery) {
    notes = ('Domicilio: ' + (reserva.direccion_entrega || '')
      + (reserva.barrio_entrega ? ' | Barrio: ' + reserva.barrio_entrega : '')
      + (notes ? ' | ' + notes : '')).slice(0, 500);
  }

  var { data: venta, error: ventaError } = await supabase
    .from('ventas')
    .insert({
      numero_venta: orderNumber,
      cliente_nombre: reserva.nombre,
      cliente_documento: reserva.telefono,
      subtotal: subtotal,
      impuesto: 0,
      total: subtotal + deliveryCost,
      metodo_pago: isDelivery ? 'domicilio' : 'cocina',
      estado: 'pendiente',
      notas: notes || null,
      mesa_id: isDelivery ? null : (reserva.mesa_id || null),
      estado_cocina: 'pendiente',
      costo_domicilio: deliveryCost,
      propina: 0,
      bono_descuento: 0,
      forma_pago: null
    })
    .select('id, numero_venta, total')
    .single();
  if (ventaError) throw ventaError;

  var details = items.map(function (item) {
    return {
      venta_id: venta.id,
      producto_id: null,
      producto_nombre: item.plato_nombre,
      cantidad: Math.max(1, parseInt(item.cantidad, 10) || 1),
      precio_unitario: parseFloat(item.precio_unitario) || 0,
      subtotal: parseFloat(item.subtotal) || 0,
      plato_id: item.plato_id,
      es_plato: true,
      observacion: item.notas || null
    };
  });
  var { error: detailError } = await supabase.from('venta_detalles').insert(details);
  if (detailError) throw detailError;

  for (var k = 0; k < ingredientIds.length; k++) {
    var normalId = ingredientIds[k];
    await supabase.rpc('registrar_movimiento', {
      p_producto_id: normalId,
      p_tipo: 'salida',
      p_cantidad: ingredientesTotales[normalId].cantidad_total,
      p_motivo: 'Pedido desde reserva ' + orderNumber,
      p_usuario_id: null
    });
  }

  for (var t = 0; t < insumosTanda.length; t++) {
    await supabase.rpc('procesar_tanda_insumo', {
      p_producto_id: insumosTanda[t].producto_id,
      p_porciones_vendidas: insumosTanda[t].porciones,
      p_rendimiento_por_tanda: insumosTanda[t].rendimiento,
      p_cantidad_tanda: insumosTanda[t].cantidad_tanda,
      p_venta_id: venta.id,
      p_usuario_id: null,
      p_motivo: 'Pedido desde reserva ' + orderNumber
    });
  }

  await supabase.from('reservas').update({ numero_venta: orderNumber }).eq('id', reserva.id);
  return venta;
}

module.exports = { createOrderFromReservation, reservationIsDue, convertToBaseUnit };
