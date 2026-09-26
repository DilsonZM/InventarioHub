// routes/cron.js
// Endpoints para los cron jobs de Vercel (alerta diaria de stock bajo).
//
// Vercel envia automaticamente el header:
//   Authorization: Bearer <CRON_SECRET>
// cuando la variable de entorno CRON_SECRET esta configurada.
// Si no hay secreto configurado (desarrollo local), se permite el acceso.

const express = require('express');
const router = express.Router();
const { sendDailyLowStockReport } = require('../lib/stock-alerts');

function autorizado(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.authorization || '';
  return auth === 'Bearer ' + secret;
}

// GET /api/cron/low-stock - reporte diario de stock bajo (8am Bogota)
router.get('/low-stock', async (req, res) => {
  if (!autorizado(req)) {
    return res.status(401).json({ success: false, message: 'No autorizado' });
  }
  const result = await sendDailyLowStockReport();
  return res.json({ success: true, data: result });
});

module.exports = router;
