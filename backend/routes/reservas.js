// routes/reservas.js
// Gestion de reservas (solo admin). Lista con filtros, detalle con items,
// cambio de estado, eliminar.

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
      .select('id, nombre, telefono, email, fecha, hora, personas, notas, estado, subtotal_platos, usuario_id, creado_en, reserva_items(id, plato_nombre, cantidad, precio_unitario, subtotal, notas)')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .limit(limitNum);

    if (estado && ESTADOS_VALIDOS.indexOf(estado) !== -1) query = query.eq('estado', estado);
    if (fecha) query = query.eq('fecha', fecha);

    var { data, error } = await query;
    if (error) throw error;

    var reservas = (data || []).map(function (r) {
      var items = r.reserva_items || [];
      return Object.assign({}, r, {
        items_count: items.length,
        items: items
      });
    });

    var stats = {
      total: reservas.length,
      pendientes: reservas.filter(function (r) { return r.estado === 'pendiente'; }).length,
      confirmadas: reservas.filter(function (r) { return r.estado === 'confirmada'; }).length,
      hoy: reservas.filter(function (r) { return r.fecha === new Date().toISOString().slice(0, 10); }).length,
      con_items: reservas.filter(function (r) { return r.items_count > 0; }).length,
      total_platos: reservas.reduce(function (s, r) { return s + (r.items_count || 0); }, 0)
    };

    return res.json({ success: true, data: reservas, stats: stats });
  } catch (err) {
    console.error('[reservas] list error:', err.message);
    return res.status(500).json({ success: false, message: 'Error al listar reservas' });
  }
});

// PATCH /api/reservas/:id/estado { estado }
router.patch('/:id/estado', requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    var id = req.params.id;
    var estado = (req.body && req.body.estado || '').toString();
    if (ESTADOS_VALIDOS.indexOf(estado) === -1) {
      return res.status(400).json({ success: false, message: 'Estado invalido' });
    }
    var { data, error } = await supabase
      .from('reservas')
      .update({ estado: estado })
      .eq('id', id)
      .select('id, estado')
      .single();
    if (error) throw error;
    return res.json({ success: true, data: data });
  } catch (err) {
    console.error('[reservas] patch error:', err.message);
    return res.status(500).json({ success: false, message: 'Error al cambiar estado' });
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
