// routes/public.js
// Endpoints PUBLICOS sin autenticacion. Usados por la vista de menu digital
// (frontend/public/menu.html) para que clientes finales puedan ver el menu,
// registrarse/login con nombre+WhatsApp y hacer/consultar reservas.

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

function clean(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

// Token simple (base64 del usuario_id). Es un "session token" para esta demo:
// en produccion habria que firmar con JWT_SECRET.
function makeToken(usuarioId) {
  return Buffer.from(String(usuarioId)).toString('base64');
}
function readToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    var raw = Buffer.from(token, 'base64').toString('utf8');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return null;
    return raw;
  } catch (e) { return null; }
}

// GET /api/public/menu
router.get('/menu', async (req, res) => {
  try {
    var { data: platos, error } = await supabase
      .from('platos')
      .select('id, nombre, descripcion, precio_venta, tipo, categoria, imagen_url, activo')
      .eq('activo', true)
      .order('nombre', { ascending: true });
    if (error) {
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
      // Politica: NO disponible solo si TODOS los ingredientes tienen stock 0.
      var sinStockCount = {};
      var ingredientesCount = {};
      (ings || []).forEach(function (i) {
        var prod = stockMap[i.producto_id];
        var stock = prod ? parseFloat(prod.stock_actual || 0) : 0;
        ingredientesCount[i.plato_id] = (ingredientesCount[i.plato_id] || 0) + 1;
        if (stock <= 0) sinStockCount[i.plato_id] = (sinStockCount[i.plato_id] || 0) + 1;
      });
      Object.keys(ingredientesCount).forEach(function (platoId) {
        if (sinStockCount[platoId] === ingredientesCount[platoId]) {
          disponibleSet.delete(platoId);
        }
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

// POST /api/public/login
// Login/registro con nombre + WhatsApp. Si el telefono ya existe, devuelve
// el usuario existente. Si no, crea uno nuevo.
router.post('/login', async (req, res) => {
  try {
    var b = req.body || {};
    var nombre = clean(b.nombre, 150);
    var telefono = clean(b.telefono, 30);
    if (nombre.length < 2) return res.status(400).json({ success: false, message: 'Nombre invalido' });
    if (telefono.length < 7) return res.status(400).json({ success: false, message: 'Telefono invalido' });

    var { data: usuarioId, error: rpcError } = await supabase
      .rpc('upsert_usuario_publico', { p_nombre: nombre, p_telefono: telefono });
    if (rpcError) throw rpcError;

    var { data: usuario, error: userError } = await supabase
      .from('usuarios_publicos')
      .select('id, nombre, telefono, total_visitas, ultima_visita, creado_en')
      .eq('id', usuarioId)
      .single();
    if (userError) throw userError;

    var firstName = (usuario.nombre || '').split(' ')[0] || 'amigo';
    return res.json({
      success: true,
      data: {
        token: makeToken(usuario.id),
        usuario: usuario
      },
      message: usuario.total_visitas > 0 ? 'Bienvenido de vuelta, ' + firstName : 'Hola, ' + firstName
    });
  } catch (err) {
    console.error('[public/login] error:', err.message);
    return res.status(500).json({ success: false, message: 'Error en login: ' + err.message });
  }
});

// GET /api/public/mis-reservas
// Devuelve las reservas del usuario autenticado.
router.get('/mis-reservas', async (req, res) => {
  try {
    var token = req.headers['authorization'];
    if (token && token.startsWith('Bearer ')) token = token.slice(7);
    var usuarioId = readToken(token);
    if (!usuarioId) return res.status(401).json({ success: false, message: 'No autorizado' });

    var { data, error } = await supabase
      .from('reservas')
      .select('id, nombre, telefono, fecha, hora, personas, notas, estado, creado_en')
      .eq('usuario_id', usuarioId)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false })
      .limit(50);
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[public/mis-reservas] error:', err.message);
    return res.status(500).json({ success: false, message: 'Error' });
  }
});

// POST /api/public/reservas
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
    var todayStr = new Date().toISOString().slice(0, 10);
    if (fecha < todayStr) return res.status(400).json({ success: false, message: 'La fecha no puede ser en el pasado' });

    var authHeader = req.headers['authorization'] || '';
    var usuarioId = null;
    if (authHeader.startsWith('Bearer ')) {
      usuarioId = readToken(authHeader.slice(7));
    }

    var insertObj = {
      nombre: nombre,
      telefono: telefono,
      fecha: fecha,
      hora: hora,
      personas: personas,
      notas: notas || null,
      estado: 'pendiente'
    };
    if (usuarioId) insertObj.usuario_id = usuarioId;

    var { data, error } = await supabase
      .from('reservas')
      .insert([insertObj])
      .select('id, nombre, fecha, hora, personas')
      .single();
    if (error) {
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
