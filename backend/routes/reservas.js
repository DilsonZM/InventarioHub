// routes/reservas.js
// Gestion de reservas (solo admin). Lista con filtros, detalle con items,
// cambio de estado (al confirmar CON items crea pedido automaticamente),
// eliminar.

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requirePermission } = require('../middleware/auth');

const ESTADOS_VALIDOS = ['pendiente', 'confirmada', 'cancelada', 'completada'];

// GET /api/reservas?estado=&fecha=&limit=
router.get('/', requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    var { estado, fecha, limit } = req.query;
    var limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
    var query = supabase
      .from('reservas')
      .select('id, nombre, telefono, email, fecha, hora, personas, notas, estado, subtotal_platos, mesa_id, mesa_nombre, numero_venta, usuario_id, creado_en, reserva_items(id, plato_nombre, cantidad, precio_unitario, subtotal, notas)')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .limit(limitNum);
    if (estado && ESTADOS_VALIDOS.indexOf(estado) !== -1) query = query.eq('estado', estado);
    if (fecha) query = query.eq('fecha', fecha);
    var { data, error } = await query;
    if (error) throw error;
    var reservas = (data || []).map(function (r) {
      var items = r.reserva_items || [];
      return Object.assign({}, r, { items_count: items.length, items: items });
    });
    var stats = {
      total: reservas.length,
      pendientes: reservas.filter(function (r) { return r.estado === 'pendiente'; }).length,
      confirmadas: reservas.filter(function (r) { return r.estado === 'confirmada'; }).length,
      hoy: reservas.filter(function (r) { return r.fecha === new Date().toISOString().slice(0, 10); }).length,
      con_items: reservas.filter(function (r) { return r.items_count > 0; }).length,
      total_platos: reservas.reduce(function (s, r) { return s + (r.items_count || 0); }, 0),
      con_pedido: reservas.filter(function (r) { return r.numero_venta; }).length
    };
    return res.json({ success: true, data: reservas, stats: stats });
  } catch (err) {
    console.error('[reservas] list error:', err.message);
    return res.status(500).json({ success: false, message: 'Error al listar reservas' });
  }
});

// PATCH /api/reservas/:id/estado { estado, mesa_id? }
router.patch('/:id/estado', requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    var id = req.params.id;
    var b = req.body || {};
    var estado = (b.estado || '').toString();
    var mesaId = b.mesa_id || null;
    if (ESTADOS_VALIDOS.indexOf(estado) === -1) {
      return res.status(400).json({ success: false, message: 'Estado invalido' });
    }

    // Si pasan mesa_id, actualizar
    if (mesaId) {
      var { data: mesa, error: mErr } = await supabase
        .from('mesas').select('id, nombre').eq('id', mesaId).single();
      if (mErr || !mesa) return res.status(400).json({ success: false, message: 'Mesa no encontrada' });
      await supabase.from('reservas').update({ mesa_id: mesaId, mesa_nombre: mesa.nombre }).eq('id', id);
    }

    // Obtener reserva actual con sus items
    var { data: reserva, error: rErr } = await supabase
      .from('reservas')
      .select('id, estado, subtotal_platos, numero_venta, nombre, telefono, email, reserva_items(id, plato_id, plato_nombre, cantidad, precio_unitario, subtotal, notas)')
      .eq('id', id).single();
    if (rErr) throw rErr;

    // Al CONFIRMAR una reserva con items, crear pedido automaticamente
    if (estado === 'confirmada' && reserva && (reserva.reserva_items || []).length > 0 && !reserva.numero_venta) {
      var items = reserva.reserva_items;
      // Generar numero de venta
      var fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      var numeroVenta = 'P-' + fechaStr + '-' + String(Date.now()).slice(-4);
      var subtotal = parseFloat(reserva.subtotal_platos || 0);

      // Crear venta
      var { data: venta, error: vErr } = await supabase
        .from('ventas')
        .insert([{
          numero_venta: numeroVenta,
          cliente_nombre: reserva.nombre,
          cliente_documento: reserva.telefono,
          subtotal: subtotal,
          impuesto: 0,
          total: subtotal,
          metodo_pago: 'efectivo',
          estado: 'pendiente',
          notas: 'Pedido generado automaticamente desde reserva #' + id.slice(-6)
        }])
        .select('id, numero_venta, total')
        .single();
      if (vErr) throw vErr;

      // Crear venta_detalles (uno por cada item)
      var ventaDetalles = items.map(function (it) {
        return {
          venta_id: venta.id,
          producto_id: it.plato_id,
          producto_nombre: it.plato_nombre,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          subtotal: it.subtotal
        };
      });
      var { error: vdErr } = await supabase.from('venta_detalles').insert(ventaDetalles);
      if (vdErr) console.error('[reservas] venta_detalles error:', vdErr.message);

      // Descontar stock: registrar movimiento por cada item
      for (var i = 0; i < items.length; i++) {
        var it2 = items[i];
        try {
          // Buscar ingredientes del plato y descontar proporcionalmente
          var { data: ings } = await supabase
            .from('plato_ingredientes')
            .select('producto_id, cantidad, unidad')
            .eq('plato_id', it2.plato_id);
          for (var k = 0; k < (ings || []).length; k++) {
            var ing = ings[k];
            var cantDescontar = parseFloat(ing.cantidad) * it2.cantidad;
            try {
              await supabase.rpc('registrar_movimiento', {
                p_producto_id: ing.producto_id,
                p_tipo: 'salida',
                p_cantidad: cantDescontar,
                p_motivo: 'Pedido desde reserva',
                p_usuario_id: null
              });
            } catch (e2) { /* ignore individual errors */ }
          }
        } catch (e3) { /* ignore */ }
      }

      // Guardar numero_venta en la reserva
      await supabase.from('reservas').update({ numero_venta: numeroVenta }).eq('id', id);
    }

    // Cambiar estado
    var { data, error } = await supabase
      .from('reservas')
      .update({ estado: estado })
      .eq('id', id)
      .select('id, estado, numero_venta')
      .single();
    if (error) throw error;
    return res.json({ success: true, data: data });
  } catch (err) {
    console.error('[reservas] patch error:', err.message);
    return res.status(500).json({ success: false, message: 'Error al cambiar estado: ' + err.message });
  }
});

// DELETE /api/reservas/:id
router.delete('/:id', requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    var id = req.params.id;
    var { error } = await supabase.from('reservas').delete().eq('id', id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error('[reservas] delete error:', err.message);
    return res.status(500).json({ success: false, message: 'Error al eliminar' });
  }
});

module.exports = router;
