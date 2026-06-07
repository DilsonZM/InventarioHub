const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware, requirePermission } = require('../middleware/auth');

// GET /api/config - publico: devuelve solo el modo_publico
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('modo_publico, titulo_publico')
      .eq('id', 1)
      .single();
    if (error || !data) {
      return res.json({ success: true, data: { modoPublico: false, tituloPublico: 'InventarioHub' } });
    }
    res.json({ success: true, data: {
      modoPublico: !!data.modo_publico,
      tituloPublico: data.titulo_publico
    }});
  } catch (err) {
    console.error('Config get error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// PUT /api/config - solo admin: actualizar modo_publico
router.put('/', authMiddleware, requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    const { modoPublico, tituloPublico } = req.body;
    const updateData = {};
    if (typeof modoPublico === 'boolean') updateData.modo_publico = modoPublico;
    if (tituloPublico) updateData.titulo_publico = tituloPublico;
    updateData.actualizado_en = new Date().toISOString();

    const { data, error } = await supabase
      .from('app_config')
      .update(updateData)
      .eq('id', 1)
      .select('modo_publico, titulo_publico')
      .single();
    if (error) throw error;
    res.json({ success: true, data: {
      modoPublico: !!data.modo_publico,
      tituloPublico: data.titulo_publico
    }});
  } catch (err) {
    console.error('Config update error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
