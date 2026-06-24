const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware, requirePermission } = require('../middleware/auth');

// Cache en memoria para los campos de impresora.
// Esto permite que el sistema funcione aunque la BD no tenga las
// columnas nuevas todavia (la migracion se aplicara manualmente
// en Supabase Dashboard, pero el sistema ya esta operativo).
const memoryCache = {
  printerHost: '127.0.0.1',
  printerPort: 9100,
  printerEnabled: false,
  comandaEnabled: false,
  printerKind: 'browser',
  hasDbColumns: null // null = desconocido, true = BD tiene columnas, false = solo memoria
};

async function checkDbColumns() {
  if (memoryCache.hasDbColumns !== null) return memoryCache.hasDbColumns;
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('printer_host, printer_port, printer_enabled, comanda_enabled, printer_kind')
      .eq('id', 1)
      .single();
    if (error) {
      // Probablemente las columnas no existen
      memoryCache.hasDbColumns = false;
      return false;
    }
    if (data) {
      memoryCache.printerHost = data.printer_host || memoryCache.printerHost;
      memoryCache.printerPort = data.printer_port || memoryCache.printerPort;
      memoryCache.printerEnabled = !!data.printer_enabled;
      memoryCache.comandaEnabled = !!data.comanda_enabled;
      memoryCache.printerKind = data.printer_kind || 'browser';
    }
    memoryCache.hasDbColumns = true;
    return true;
  } catch (e) {
    memoryCache.hasDbColumns = false;
    return false;
  }
}

// GET /api/config - publico: devuelve modo_publico + config de impresora
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('modo_publico, titulo_publico')
      .eq('id', 1)
      .single();
    if (error || !data) {
      return res.json({ success: true, data: {
        modoPublico: false,
        tituloPublico: 'InventarioHub',
        printerHost: memoryCache.printerHost,
        printerPort: memoryCache.printerPort,
        printerEnabled: memoryCache.printerEnabled,
        comandaEnabled: memoryCache.comandaEnabled,
        printerKind: memoryCache.printerKind
      }});
    }
    await checkDbColumns();
    res.json({ success: true, data: {
      modoPublico: !!data.modo_publico,
      tituloPublico: data.titulo_publico,
      printerHost: memoryCache.printerHost,
      printerPort: memoryCache.printerPort,
      printerEnabled: memoryCache.printerEnabled,
      comandaEnabled: memoryCache.comandaEnabled,
      printerKind: memoryCache.printerKind
    }});
  } catch (err) {
    console.error('Config get error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// PUT /api/config - solo admin: actualizar modo_publico y config de impresora
router.put('/', authMiddleware, requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    const { modoPublico, tituloPublico, printerHost, printerPort, printerEnabled, comandaEnabled, printerKind } = req.body;
    const updateData = {};
    if (typeof modoPublico === 'boolean') updateData.modo_publico = modoPublico;
    if (tituloPublico) updateData.titulo_publico = tituloPublico;
    updateData.actualizado_en = new Date().toISOString();

    // Actualizar modo_publico en BD
    const { data, error } = await supabase
      .from('app_config')
      .update(updateData)
      .eq('id', 1)
      .select('modo_publico, titulo_publico')
      .single();
    if (error) throw error;

    // Actualizar cache en memoria
    if (printerHost !== undefined) memoryCache.printerHost = String(printerHost).trim() || '127.0.0.1';
    if (printerPort !== undefined) memoryCache.printerPort = parseInt(printerPort) || 9100;
    if (typeof printerEnabled === 'boolean') memoryCache.printerEnabled = printerEnabled;
    if (typeof comandaEnabled === 'boolean') memoryCache.comandaEnabled = comandaEnabled;
    if (printerKind && ['browser', 'thermal', 'both'].includes(printerKind)) {
      memoryCache.printerKind = printerKind;
    }

    // Intentar guardar en BD tambien
    let printerSavedToDb = false;
    try {
      const printerUpdate = {
        printer_host: memoryCache.printerHost,
        printer_port: memoryCache.printerPort,
        printer_enabled: memoryCache.printerEnabled,
        comanda_enabled: memoryCache.comandaEnabled,
        printer_kind: memoryCache.printerKind,
        actualizado_en: new Date().toISOString()
      };
      const { error: printerError } = await supabase
        .from('app_config')
        .update(printerUpdate)
        .eq('id', 1);
      if (!printerError) {
        printerSavedToDb = true;
        memoryCache.hasDbColumns = true;
      } else {
        memoryCache.hasDbColumns = false;
      }
    } catch (e) {
      memoryCache.hasDbColumns = false;
    }

    res.json({ success: true, data: {
      modoPublico: !!data.modo_publico,
      tituloPublico: data.titulo_publico,
      printerHost: memoryCache.printerHost,
      printerPort: memoryCache.printerPort,
      printerEnabled: memoryCache.printerEnabled,
      comandaEnabled: memoryCache.comandaEnabled,
      printerKind: memoryCache.printerKind,
      _printerDbSaved: printerSavedToDb
    }});
  } catch (err) {
    console.error('Config update error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// GET /api/config/printer - devuelve solo la config de impresora
router.get('/printer', async (req, res) => {
  await checkDbColumns();
  res.json({ success: true, data: {
    host: memoryCache.printerHost,
    port: memoryCache.printerPort,
    enabled: memoryCache.printerEnabled,
    comandaEnabled: memoryCache.comandaEnabled,
    kind: memoryCache.printerKind
  }});
});

module.exports = router;
module.exports.memoryCache = memoryCache; // expuesta para routes/print.js
