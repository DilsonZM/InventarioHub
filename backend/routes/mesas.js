const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requirePermission } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('mesas')
      .select('*')
      .order('nombre');
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Mesas list error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.post('/', requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ success: false, message: 'Nombre requerido' });
    const { data, error } = await supabase
      .from('mesas')
      .insert({ nombre })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('Mesa create error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.put('/:id', requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    const { nombre, activa } = req.body;
    const updates = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (activa !== undefined) updates.activa = activa;
    const { data, error } = await supabase
      .from('mesas')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('Mesa update error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.delete('/:id', requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    const { error } = await supabase.from('mesas').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Mesa eliminada' });
  } catch (err) {
    console.error('Mesa delete error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
