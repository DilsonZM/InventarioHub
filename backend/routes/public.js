// routes/public.js
// Endpoints PUBLICOS sin autenticacion. Usados por la vista de menu digital
// (frontend/public/menu.html) para que clientes finales puedan ver el menu
// y hacer reservas sin necesidad de login.

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// Rate limit en memoria (5 reservas / minuto por IP)
const rateMap = new Map();
function rateLimitOk(ip, key, max, windowMs) {
  var now = Date.now();
  var entry = rateMap.get(ip + ':' + key) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) { entry = { count: 0, reset: now + windowMs }; }
  entry.count += 1;
  rateMap.set(ip + ':' + key, entry);
  return entry.count <= max;
}

// Sanitiza una cadena basica (trim + longitud maxima)
function clean(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

// GET /api/public/menu
// Lista platos activos con su categoria. Pensado para la vista publica:
//   - NO requiere auth
//   - Devuelve solo lo necesario para mostrar la carta (id, nombre, desc,
//     precio, categoria, tipo, imagen_url si existe)
//   - Si el plato tiene ingredientes en receta, se considera "disponible"
//     solo si todos los ingredientes tienen stock suficiente.
//   - Tolerante: si la columna `categoria` no existe aun, hace fallback
//     a la agrupacion por `tipo` (plato -> 'platos', bebida -> 'bebidas').
router.get('/menu', async (req, res) => {
  try {
    var { data: platos, error } = await supabase
      .from('platos')
      .select('id, nombre, descripcion, precio_venta, tipo, categoria, imagen_url, activo')
      .eq('activo', true)
      .order('nombre', { ascending: true });
    if (error) {
      // Fallback si la columna categoria no existe (migracion pendiente)
      if (/column.*categoria/i.test(error.message || '')) {
        var fallback = await supabase
          .from('platos')
          .select('id, nombre, descripcion, precio_venta, tipo, imagen_url, activo')
          .eq('activo', true)
          .order('nombre', { ascending: true });
        if (fallback.error) throw fallback.error;
        platos = fallback.data;
      } else {
        throw error;
      }
    }

    // Calcular disponibilidad real segun stock de ingredientes
    var platoIds = (platos || []).map(function (p) { return p.id; });
    var disponibleSet = new Set(platoIds);
    if (platoIds.length > 0) {
      var { data: ings } = await supabase
        .from('plato_ingredientes')
        .select('plato_id, producto_id, cantidad, unidad')
        .in('plato_id', platoIds);
      var prodIds = [];
      (ings || []).forEach(function (i) { if (i.producto_id) prodIds.push(i.producto_id); });
      var stockMap = {};
      if (prodIds.length > 0) {
        var { data: prods } = await supabase
          .from('productos')
          .select('id, stock_actual, unidad_medida')
          .in('id', prodIds);
        (prods || []).forEach(function (p) { stockMap[p.id] = p; });
      }
      var disponiblePorPlato = {};
      (ings || []).forEach(function (i) {
        var prod = stockMap[i.producto_id];
        var stock = prod ? parseFloat(prod.stock_actual || 0) : 0;
        // Comparacion basica (mismas unidades); si no se puede convertir
        // se asume disponible para no bloquear al publico.
        if (disponiblePorPlato[i.plato_id] === undefined) disponiblePorPlato[i.plato_id] = true;
        if (stock < parseFloat(i.cantidad || 0)) disponiblePorPlato[i.plato_id] = false;
      });
      Object.keys(disponiblePorPlato).forEach(function (id) {
        if (!disponiblePorPlato[id]) disponibleSet.delete(id);
      });
    }

    var data = (platos || []).map(function (p) {
      return {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion || '',
        precio: parseFloat(p.precio_venta || 0),
        tipo: p.tipo,
        categoria: p.categoria || (p.tipo === 'bebida' ? 'bebidas' : 'platos'),
        imagen_url: p.imagen_url || null,
        disponible: disponibleSet.has(p.id)
      };
    });

    return res.json({ success: true, data: data });
  } catch (err) {
    console.error('[public/menu] error:', err.message);
    return res.status(500).json({ success: false, message: 'Error cargando el menu' });
  }
});

// POST /api/public/reservas
// Crea una reserva. Rate limit 5/min por IP.
router.post('/reservas', async (req, res) => {
  try {
    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!rateLimitOk(String(ip), 'reservas', 5, 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Demasiadas solicitudes. Intenta en un minuto.' });
    }
    var b = req.body || {};
    var nombre = clean(b.nombre, 150);
    var telefono = clean(b.telefono, 30);
    var fecha = clean(b.fecha, 10);
    var hora = clean(b.hora, 5);
    var notas = clean(b.notas, 500);
    var personas = parseInt(b.personas, 10);

    if (nombre.length < 2) return res.status(400).json({ success: false, message: 'Nombre invalido' });
    if (telefono.length < 7) return res.status(400).json({ success: false, message: 'Telefono invalido' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ success: false, message: 'Fecha invalida (YYYY-MM-DD)' });
    if (!/^\d{2}:\d{2}$/.test(hora)) return res.status(400).json({ success: false, message: 'Hora invalida (HH:MM)' });
    if (!Number.isInteger(personas) || personas < 1 || personas > 20) {
      return res.status(400).json({ success: false, message: 'Numero de personas invalido (1-20)' });
    }
    // No permitir fechas pasadas
    var todayStr = new Date().toISOString().slice(0, 10);
    if (fecha < todayStr) return res.status(400).json({ success: false, message: 'La fecha no puede ser en el pasado' });

    var { data, error } = await supabase
      .from('reservas')
      .insert([{
        nombre: nombre,
        telefono: telefono,
        fecha: fecha,
        hora: hora,
        personas: personas,
        notas: notas || null,
        estado: 'pendiente'
      }])
      .select('id, nombre, fecha, hora, personas')
      .single();
    if (error) {
      // Si la tabla no existe, mensaje claro para el operador
      if (/relation.*reservas.*does not exist/i.test(error.message || '') ||
          /Could not find the table/i.test(error.message || '')) {
        return res.status(503).json({
          success: false,
          message: 'Reservas no habilitadas. El operador debe aplicar la migracion.'
        });
      }
      throw error;
    }

    return res.json({ success: true, data: data, message: 'Reserva recibida' });
  } catch (err) {
    console.error('[public/reservas] error:', err.message);
    return res.status(500).json({ success: false, message: 'Error al registrar la reserva' });
  }
});

module.exports = router;
