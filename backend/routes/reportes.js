const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

router.get('/movimientos', async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const { count } = await supabase.from('vista_movimientos').select('*', { count: 'exact', head: true });

    const { data, error } = await supabase
      .from('vista_movimientos')
      .select('*')
      .order('fecha', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
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
