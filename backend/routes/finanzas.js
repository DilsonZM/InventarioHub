// routes/finanzas.js
// Resumen contable del periodo (modulo Finanzas).
// Acceso RBAC: finance.view.

const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/auth');
const { getFinanceSummary } = require('../lib/finance');

// GET /api/finanzas/resumen?from&to
router.get('/resumen', requirePermission('finance.view'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const summary = await getFinanceSummary(from, to);
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Finanzas resumen error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
