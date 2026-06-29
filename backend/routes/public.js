// routes/public.js
// Endpoints PUBLICOS sin autenticacion. Vista menu digital + reservas
// con items (carrito), login, mesas disponibles.

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// Rate limit
const rateMap = new Map();
function rateLimitOk(ip, key, max, windowMs) {
  var now = Date.now();
  var entry = rateMap.get(ip + ':' + key) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) { entry = { count: 0, reset: now + windowMs }; }
  entry.count += 1;
  rateMap.set(ip + ':' + key, entry);
  return entry.count <= max;
}
function clean(v, max) { return v == null ? '' : String(v).trim().slice(0, max); }
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '')); }
function makeToken(id) { return Buffer.from(String(id)).toString('base64'); }
function readToken(t) {
  if (!t || typeof t !== 'string') return null;
  try {
    var raw = Buffer.from(t, 'base64').toString('utf8');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return null;
    return raw;
  } catch (e) { return null; }
}

// GET /api/public/menu
router.get('/menu', async (req, res) => {
  try {
    var { data: platos, error } = await supabase
      .from('platos').select('id, nombre, descripcion, precio_venta, tipo, categoria, imagen_url, activo')
      .eq('activo', true).order('nombre', { ascending: true });
    if (error) {
      if (/column.*categoria/i.test(error.message || '')) {
        var fb = await supabase.from('platos')
          .select('id, nombre, descripcion, precio_venta, tipo, imagen_url, activo')
          .eq('activo', true).order('nombre', { ascending: true });
        if (fb.error) throw fb.error;
        platos = fb.data;
      } else { throw error; }
    }
    var platoIds = (platos || []).map(function (p) { return p.id; });
    var disponibleSet = new Set(platoIds);
    if (platoIds.length > 0) {
      var { data: ings } = await supabase.from('plato_ingredientes')
        .select('plato_id, producto_id, cantidad, unidad').in('plato_id', platoIds);
      var prodIds = [];
      (ings || []).forEach(function (i) { if (i.producto_id) prodIds.push(i.producto_id); });
      var stockMap = {};
      if (prodIds.length > 0) {
        var { data: prods } = await supabase.from('productos')
          .select('id, stock_actual, unidad_medida').in('id', prodIds);
        (prods || []).forEach(function (p) { stockMap[p.id] = p; });
      }
      var sinStockCount = {}, ingredientesCount = {};
      (ings || []).forEach(function (i) {
        var prod = stockMap[i.producto_id];
        var stock = prod ? parseFloat(prod.stock_actual || 0) : 0;
        ingredientesCount[i.plato_id] = (ingredientesCount[i.plato_id] || 0) + 1;
        if (stock <= 0) sinStockCount[i.plato_id] = (sinStockCount[i.plato_id] || 0) + 1;
      });
      Object.keys(ingredientesCount).forEach(function (id) {
        if (sinStockCount[id] === ingredientesCount[id]) disponibleSet.delete(id);
      });
    }
    var data = (platos || []).map(function (p) {
      return {
        id: p.id, nombre: p.nombre, descripcion: p.descripcion || '',
        precio: parseFloat(p.precio_venta || 0), tipo: p.tipo,
        categoria: p.categoria || (p.tipo === 'bebida' ? 'bebidas' : 'platos'),
        imagen_url: p.imagen_url || null, disponible: disponibleSet.has(p.id)
      };
    });
    return res.json({ success: true, data: data });
  } catch (err) {
    console.error('[public/menu] error:', err.message);
    return res.status(500).json({ success: false, message: 'Error cargando el menu' });
  }
});

// GET /api/public/mesas-disponibles?fecha=YYYY-MM-DD&hora=HH:MM
// Devuelve TODAS las mesas activas + flag 'disponible' según reservas
// existentes en pendiente|confirmada para esa fecha+hora.
router.get('/mesas-disponibles', async (req, res) => {
  try {
    var fecha = clean(req.query.fecha, 10);
    var hora = clean(req.query.hora, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ success: false, message: 'fecha invalida' });
    if (hora && !/^\d{2}:\d{2}$/.test(hora)) return res.status(400).json({ success: false, message: 'hora invalida' });

    var { data: mesas, error: mErr } = await supabase
      .from('mesas').select('id, nombre, activa')
      .eq('activa', true)
      .order('nombre', { ascending: true });
    if (mErr) throw mErr;

    // Buscar reservas activas que ocupan mesa
    var { data: reservas, error: rErr } = await supabase
      .from('reservas')
      .select('id, mesa_id, estado, fecha, hora')
      .eq('fecha', fecha)
      .in('estado', ['pendiente', 'confirmada']);
    if (rErr) throw rErr;

    // Map: mesa_id -> reserva activa
    var mesaOcupada = {};
    (reservas || []).forEach(function (r) {
      if (r.mesa_id) mesaOcupada[r.mesa_id] = r;
    });

    var data = (mesas || []).map(function (m) {
      var ocupada = mesaOcupada[m.id];
      return {
        id: m.id,
        nombre: m.nombre,
        disponible: !ocupada,
        ocupadaPor: ocupada ? { estado: ocupada.estado, hora: (ocupada.hora || '').slice(0, 5) } : null
      };
    });

    return res.json({ success: true, data: data });
  } catch (err) {
    console.error('[public/mesas-disponibles] error:', err.message);
    return res.status(500).json({ success: false, message: 'Error' });
  }
});

// POST /api/public/login
router.post('/login', async (req, res) => {
  try {
    var b = req.body || {};
    var nombre = clean(b.nombre, 150);
    var telefono = clean(b.telefono, 30);
    var email = clean(b.email, 150);
    if (telefono.length < 7) return res.status(400).json({ success: false, message: 'Telefono invalido' });
    if (email && !isEmail(email)) return res.status(400).json({ success: false, message: 'Email invalido' });

    // Si NO viene nombre (caso "Iniciar sesion" solo con telefono):
    // buscar si el telefono ya existe y devolver el usuario tal cual.
    if (nombre.length < 2) {
      var { data: existing, error: exErr } = await supabase
        .from('usuarios_publicos')
        .select('id, nombre, telefono, email, total_visitas, ultima_visita, creado_en')
        .eq('telefono', telefono)
        .maybeSingle();
      if (exErr) throw exErr;
      if (existing) {
        return res.json({
          success: true,
          data: { token: makeToken(existing.id), usuario: existing },
          message: 'Bienvenido de vuelta, ' + ((existing.nombre || '').split(' ')[0] || 'amigo')
        });
      }
      // No existe y no dio nombre: error claro
      return res.status(404).json({
        success: false,
        message: 'No encontramos tu cuenta. Crea una primero con tu nombre y WhatsApp.'
      });
    }

    // Caso completo: viene nombre -> upsert (crea o actualiza nombre)
    var { data: usuarioId, error: rpcError } = await supabase
      .rpc('upsert_usuario_publico', { p_nombre: nombre, p_telefono: telefono });
    if (rpcError) throw rpcError;
    if (email) {
      await supabase.from('usuarios_publicos').update({ email: email }).eq('id', usuarioId);
    }
    var { data: usuario, error: uErr } = await supabase
      .from('usuarios_publicos')
      .select('id, nombre, telefono, email, total_visitas, ultima_visita, creado_en')
      .eq('id', usuarioId).single();
    if (uErr) throw uErr;
    var firstName = (usuario.nombre || '').split(' ')[0] || 'amigo';
    return res.json({
      success: true,
      data: { token: makeToken(usuario.id), usuario: usuario },
      message: usuario.total_visitas > 0 ? 'Bienvenido de vuelta, ' + firstName : 'Hola, ' + firstName
    });
  } catch (err) {
    console.error('[public/login] error:', err.message);
    return res.status(500).json({ success: false, message: 'Error en login: ' + err.message });
  }
});

// GET /api/public/mis-reservas
router.get('/mis-reservas', async (req, res) => {
  try {
    var token = req.headers['authorization'];
    if (token && token.startsWith('Bearer ')) token = token.slice(7);
    var usuarioId = readToken(token);
    if (!usuarioId) return res.status(401).json({ success: false, message: 'No autorizado' });
    var { data, error } = await supabase
      .from('reservas')
      .select('id, fecha, hora, personas, subtotal_platos, notas, estado, mesa_id, mesa_nombre, numero_venta, creado_en, reserva_items(id, plato_nombre, cantidad, precio_unitario, subtotal)')
      .eq('usuario_id', usuarioId)
      .order('fecha', { ascending: false })
      .limit(50);
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[public/mis-reservas] error:', err.message);
    return res.status(500).json({ success: false, message: 'Error' });
  }
});

// POST /api/public/reservas
// Body: { nombre, telefono, email?, fecha, hora, personas, notas?, mesa_id?, items: [{plato_id, cantidad, notas?}] }
router.post('/reservas', async (req, res) => {
  try {
    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!rateLimitOk(String(ip), 'reservas', 5, 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Demasiadas solicitudes. Intenta en un minuto.' });
    }
    var b = req.body || {};
    var nombre = clean(b.nombre, 150);
    var telefono = clean(b.telefono, 30);
    var email = clean(b.email, 150);
    var fecha = clean(b.fecha, 10);
    var hora = clean(b.hora, 5);
    var notas = clean(b.notas, 500);
    var personas = parseInt(b.personas, 10);
    var mesaId = clean(b.mesa_id, 60) || null;
    var items = Array.isArray(b.items) ? b.items : [];

    if (nombre.length < 2) return res.status(400).json({ success: false, message: 'Nombre invalido' });
    if (telefono.length < 7) return res.status(400).json({ success: false, message: 'Telefono invalido' });
    if (email && !isEmail(email)) return res.status(400).json({ success: false, message: 'Email invalido' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ success: false, message: 'Fecha invalida' });
    if (!/^\d{2}:\d{2}$/.test(hora)) return res.status(400).json({ success: false, message: 'Hora invalida' });
    if (!Number.isInteger(personas) || personas < 1 || personas > 20) {
      return res.status(400).json({ success: false, message: 'Numero de personas invalido (1-20)' });
    }
    var todayStr = new Date().toISOString().slice(0, 10);
    if (fecha < todayStr) return res.status(400).json({ success: false, message: 'La fecha no puede ser en el pasado' });

    // Verificar mesa si viene
    var mesaNombre = null;
    if (mesaId) {
      // Validar UUID basico
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mesaId)) {
        return res.status(400).json({ success: false, message: 'mesa_id invalido' });
      }
      var { data: mesa, error: mesaErr } = await supabase
        .from('mesas').select('id, nombre, activa')
        .eq('id', mesaId).single();
      if (mesaErr || !mesa) return res.status(400).json({ success: false, message: 'Mesa no encontrada' });
      if (!mesa.activa) return res.status(400).json({ success: false, message: 'Mesa no disponible' });
      mesaNombre = mesa.nombre;
      // Verificar que no este ocupada
      var { data: conflict } = await supabase
        .from('reservas')
        .select('id')
        .eq('mesa_id', mesaId)
        .eq('fecha', fecha)
        .in('estado', ['pendiente', 'confirmada'])
        .limit(1);
      if (conflict && conflict.length > 0) {
        return res.status(409).json({ success: false, message: 'La mesa ' + mesa.nombre + ' ya esta reservada en ese horario' });
      }
    }

    // Validar items
    var itemsValidados = [];
    var subtotalPlatos = 0;
    if (items.length > 0) {
      var platoIds = items.map(function (i) { return i.plato_id; }).filter(Boolean);
      var { data: platosInfo, error: pErr } = await supabase
        .from('platos').select('id, nombre, precio_venta, activo').in('id', platoIds);
      if (pErr) throw pErr;
      var platoMap = {};
      (platosInfo || []).forEach(function (p) { platoMap[p.id] = p; });
      for (var idx = 0; idx < items.length; idx++) {
        var it = items[idx];
        if (!it.plato_id) continue;
        var p = platoMap[it.plato_id];
        if (!p) return res.status(400).json({ success: false, message: 'Plato no encontrado' });
        if (!p.activo) return res.status(400).json({ success: false, message: 'Plato no disponible: ' + p.nombre });
        var cant = parseInt(it.cantidad, 10);
        if (!Number.isInteger(cant) || cant < 1 || cant > 50) {
          return res.status(400).json({ success: false, message: 'Cantidad invalida' });
        }
        var precio = parseFloat(p.precio_venta);
        var sub = Math.round(cant * precio * 100) / 100;
        itemsValidados.push({
          plato_id: p.id, plato_nombre: p.nombre, cantidad: cant,
          precio_unitario: precio, subtotal: sub,
          notas: clean(it.notas, 200) || null
        });
        subtotalPlatos += sub;
      }
    }

    var authHeader = req.headers['authorization'] || '';
    var usuarioId = null;
    if (authHeader.startsWith('Bearer ')) usuarioId = readToken(authHeader.slice(7));

    var insertObj = {
      nombre: nombre, telefono: telefono, fecha: fecha, hora: hora,
      personas: personas, notas: notas || null, estado: 'pendiente',
      subtotal_platos: Math.round(subtotalPlatos * 100) / 100
    };
    if (email) insertObj.email = email;
    if (usuarioId) insertObj.usuario_id = usuarioId;
    if (mesaId) {
      insertObj.mesa_id = mesaId;
      insertObj.mesa_nombre = mesaNombre;
    }

    var { data: reserva, error } = await supabase.from('reservas')
      .insert([insertObj])
      .select('id, nombre, fecha, hora, personas, subtotal_platos, mesa_id, mesa_nombre')
      .single();
    if (error) {
      if (/relation.*reservas.*does not exist/i.test(error.message || '')) {
        return res.status(503).json({ success: false, message: 'Reservas no habilitadas. Operador debe aplicar la migracion.' });
      }
      throw error;
    }

    if (itemsValidados.length > 0) {
      var itemsConReserva = itemsValidados.map(function (it) {
        return Object.assign({}, it, { reserva_id: reserva.id });
      });
      var { error: itemsErr } = await supabase.from('reserva_items').insert(itemsConReserva);
      if (itemsErr) console.error('[public/reservas] error items:', itemsErr.message);
    }

    return res.json({
      success: true,
      data: Object.assign({}, reserva, {
        items_count: itemsValidados.length,
        items: itemsValidados
      }),
      message: 'Reserva recibida'
    });
  } catch (err) {
    console.error('[public/reservas] error:', err.message);
    return res.status(500).json({ success: false, message: 'Error al registrar la reserva: ' + err.message });
  }
});

module.exports = router;
