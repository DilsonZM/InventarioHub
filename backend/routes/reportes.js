const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

router.get('/movimientos', async (req, res) => {
  try {
    const { page, limit, from, to, tipo } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let countQuery = supabase
      .from('movimientos_inventario')
      .select('*', { count: 'exact', head: true });

    if (from) countQuery = countQuery.gte('creado_en', from);
    if (to) countQuery = countQuery.lte('creado_en', to + 'T23:59:59');
    if (tipo) countQuery = countQuery.eq('tipo', tipo);

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    let query = supabase
      .from('movimientos_inventario')
      .select('*, productos(nombre, sku, unidad_medida), perfiles(username, nombre_completo)')
      .order('creado_en', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (from) query = query.gte('creado_en', from);
    if (to) query = query.lte('creado_en', to + 'T23:59:59');
    if (tipo) query = query.eq('tipo', tipo);

    const { data, error } = await query;
    if (error) throw error;

    const movimientos = (data || []).map(m => ({
      id: m.id,
      fecha: m.creado_en,
      movimiento: m.tipo,
      producto: m.productos?.nombre || '',
      codigo: m.productos?.sku || '',
      unidad: m.productos?.unidad_medida || '',
      cantidad: m.cantidad,
      cantidad_entrada: m.tipo === 'entrada' ? m.cantidad : 0,
      cantidad_salida: m.tipo === 'salida' ? m.cantidad : 0,
      cantidad_stock: m.stock_nuevo,
      stock_anterior: m.stock_anterior,
      motivo: m.motivo,
      usuario: m.perfiles?.username || '',
      usuario_nombre: m.perfiles?.nombre_completo || m.perfiles?.username || '',
      referencia: m.referencia
    }));

    res.json({
      success: true,
      data: movimientos,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (err) {
    console.error('Movimientos error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.get('/indicadores', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vista_indicadores')
      .select('*');

    if (error) throw error;

    res.json({ success: true, data: data || [], total: (data || []).length });
  } catch (err) {
    console.error('Indicadores error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
