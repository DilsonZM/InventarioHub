const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requirePermission } = require('../middleware/auth');

function convertUnit(cantidad, fromUnit, toUnit) {
  if (!fromUnit || !toUnit) return parseFloat(cantidad) || 0;
  var from = fromUnit.toLowerCase().trim();
  var to = toUnit.toLowerCase().trim();
  if (from === to) return parseFloat(cantidad) || 0;
  var toGrams = { g: 1, gr: 1, gramo: 1, gramos: 1, kg: 1000, kilo: 1000, kilos: 1000, lb: 453.592, lbs: 453.592, libra: 453.592, libras: 453.592, onza: 28.3495, oz: 28.3495 };
  var toML = { ml: 1, mililitro: 1, mililitros: 1, l: 1000, litro: 1000, litros: 1000, lt: 1000 };
  var c = parseFloat(cantidad) || 0;
  if (toGrams[from] && toGrams[to]) return (c * toGrams[from]) / toGrams[to];
  if (toML[from] && toML[to]) return (c * toML[from]) / toML[to];
  return c;
}

// Listar platos
router.get('/', async (req, res) => {
  try {
    const { tipo, activo, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let countQuery = supabase.from('platos').select('*', { count: 'exact', head: true });
    if (tipo) countQuery = countQuery.eq('tipo', tipo);
    if (activo !== undefined) countQuery = countQuery.eq('activo', activo === 'true');

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    let query = supabase
      .from('platos')
      .select('*, plato_ingredientes(count)')
      .order('nombre', { ascending: true })
      .range(offset, offset + limitNum - 1);

    if (tipo) query = query.eq('tipo', tipo);
    if (activo !== undefined) query = query.eq('activo', activo === 'true');

    const { data, error } = await query;
    if (error) throw error;

    // Obtener costo e ingredientes para cada plato
    var platoIds = (data || []).map(function (p) { return p.id; });
    var costosPorPlato = {};
    var ingredientesPorPlato = {};
    if (platoIds.length > 0) {
      var { data: costos } = await supabase
        .from('plato_ingredientes')
        .select('plato_id, producto_id, cantidad, unidad')
        .in('plato_id', platoIds);

      // Obtener info de productos para calcular costo
      var prodIds = [];
      (costos || []).forEach(function (c) { if (c.producto_id) prodIds.push(c.producto_id); });
      var prodInfo = {};
      if (prodIds.length > 0) {
        var { data: prods } = await supabase
          .from('productos')
          .select('id, nombre, precio_compra, unidad_medida, stock_actual')
          .in('id', prodIds);
        (prods || []).forEach(function (p) { prodInfo[p.id] = p; });
      }

      // Calcular stock disponible por plato (todos los ingredientes con stock >= necesario)
      var disponibilidadPorPlato = {};
      var totalNecesarioPorProducto = {};
      (costos || []).forEach(function (c) {
        var p = prodInfo[c.producto_id] || {};
        var prodUnidad = p.unidad_medida || '';
        var cantidadConv = convertUnit(c.cantidad, c.unidad, prodUnidad);
        if (!totalNecesarioPorProducto[c.producto_id]) totalNecesarioPorProducto[c.producto_id] = 0;
        totalNecesarioPorProducto[c.producto_id] += cantidadConv;
        // Un plato esta disponible si todos sus ingredientes tienen stock suficiente
        if (disponibilidadPorPlato[c.plato_id] === undefined) disponibilidadPorPlato[c.plato_id] = true;
        if ((p.stock_actual || 0) < cantidadConv) disponibilidadPorPlato[c.plato_id] = false;
      });

      (costos || []).forEach(function (c) {
        var p = prodInfo[c.producto_id] || {};
        var prodUnidad = p.unidad_medida || '';
        var cantidadConv = convertUnit(c.cantidad, c.unidad, prodUnidad);
        var precio = parseFloat(p.precio_compra || 0);
        var costoIng = Math.round(cantidadConv * precio * 100) / 100;
        costosPorPlato[c.plato_id] = (costosPorPlato[c.plato_id] || 0) + costoIng;
        if (!ingredientesPorPlato[c.plato_id]) ingredientesPorPlato[c.plato_id] = [];
        ingredientesPorPlato[c.plato_id].push({
          producto_id: c.producto_id,
          nombre: p.nombre || '?',
          cantidad: parseFloat(c.cantidad),
          unidad: c.unidad || '',
          costo: costoIng
        });
      });
    }

    const platos = (data || []).map(function (p) {
      var count = 0;
      if (p.plato_ingredientes && p.plato_ingredientes.length > 0 && p.plato_ingredientes[0].count !== undefined) {
        count = parseInt(p.plato_ingredientes[0].count);
      }
      var ings = ingredientesPorPlato[p.id] || [];
      // Disponible si: activo, tiene ingredientes, y todos con stock suficiente (o sin ingredientes = siempre disponible)
      var disp = p.activo && (ings.length === 0 || disponibilidadPorPlato[p.id] !== false);
      return {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        tipo: p.tipo,
        precio_venta: parseFloat(p.precio_venta),
        costo: Math.round((costosPorPlato[p.id] || 0) * 100) / 100,
        ingredientes: ings,
        disponible: disp,
        activo: p.activo,
        creado_en: p.creado_en,
        num_ingredientes: count
      };
    });

    res.json({ success: true, data: platos, total: count || 0, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('GET /api/dishes error:', err);
    res.status(500).json({ success: false, message: 'Error al listar platos' });
  }
});

// Obtener plato por ID con sus ingredientes
router.get('/:id', async (req, res) => {
  try {
    const { data: plato, error } = await supabase
      .from('platos')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ success: false, message: 'Plato no encontrado' });
      throw error;
    }

    const { data: ingredientes, error: ingError } = await supabase
      .from('plato_ingredientes')
      .select('*, productos!inner(id, nombre, unidad_medida, stock_actual)')
      .eq('plato_id', req.params.id)
      .order('id', { ascending: true });

    if (ingError) throw ingError;

    res.json({
      success: true,
      data: {
        ...plato,
        precio_venta: parseFloat(plato.precio_venta),
        ingredientes: (ingredientes || []).map(function (ing) {
          return {
            id: ing.id,
            producto_id: ing.producto_id,
            producto_nombre: ing.productos ? ing.productos.nombre : '(desconocido)',
            producto_unidad: ing.productos ? ing.productos.unidad_medida : '',
            producto_stock: ing.productos ? ing.productos.stock_actual : 0,
            cantidad: parseFloat(ing.cantidad),
            unidad: ing.unidad
          };
        })
      }
    });
  } catch (err) {
    console.error('GET /api/dishes/:id error:', err);
    res.status(500).json({ success: false, message: 'Error al obtener plato' });
  }
});

// Crear plato (admin)
router.post('/', requirePermission('puede_crear_productos'), async (req, res) => {
  try {
    const { nombre, descripcion, tipo, precio_venta, ingredientes } = req.body;

    if (!nombre || !nombre.trim()) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    if (!tipo || !['plato', 'bebida'].includes(tipo)) return res.status(400).json({ success: false, message: 'Tipo inválido (plato o bebida)' });

    const { data: plato, error } = await supabase
      .from('platos')
      .insert({
        nombre: nombre.trim(),
        descripcion: (descripcion || '').trim(),
        tipo: tipo,
        precio_venta: parseFloat(precio_venta) || 0
      })
      .select()
      .single();

    if (error) throw error;

    if (ingredientes && Array.isArray(ingredientes) && ingredientes.length > 0) {
      const ingsToInsert = ingredientes
        .filter(function (ing) { return ing.producto_id && ing.producto_id.toString().trim(); })
        .map(function (ing) {
          return {
            plato_id: plato.id,
            producto_id: ing.producto_id,
            cantidad: Math.max(0, parseFloat(ing.cantidad) || 0),
            unidad: ing.unidad || 'unidad'
          };
        })
        .filter(function (ing) { return ing.cantidad > 0; });

      if (ingsToInsert.length > 0) {
        const { error: ingError } = await supabase.from('plato_ingredientes').insert(ingsToInsert);
        if (ingError) {
          await supabase.from('platos').delete().eq('id', plato.id);
          throw ingError;
        }
      }
    }

    res.status(201).json({ success: true, data: plato, message: 'Plato creado' });
  } catch (err) {
    console.error('POST /api/dishes error:', err);
    res.status(500).json({ success: false, message: 'Error al crear plato' });
  }
});

// Actualizar plato (admin)
router.put('/:id', requirePermission('puede_editar_productos'), async (req, res) => {
  try {
    const { nombre, descripcion, tipo, precio_venta, activo, ingredientes } = req.body;

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion.trim();
    if (tipo !== undefined) {
      if (!['plato', 'bebida'].includes(tipo)) return res.status(400).json({ success: false, message: 'Tipo inválido' });
      updateData.tipo = tipo;
    }
    if (precio_venta !== undefined) updateData.precio_venta = parseFloat(precio_venta);
    if (activo !== undefined) updateData.activo = activo;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from('platos').update(updateData).eq('id', req.params.id);
      if (error) throw error;
    }

    // Reemplazar ingredientes si se envían
    if (ingredientes !== undefined) {
      await supabase.from('plato_ingredientes').delete().eq('plato_id', req.params.id);

      const ingsToInsert = (ingredientes || [])
        .filter(function (ing) { return ing.producto_id && ing.producto_id.toString().trim(); })
        .map(function (ing) {
          return {
            plato_id: req.params.id,
            producto_id: ing.producto_id,
            cantidad: Math.max(0, parseFloat(ing.cantidad) || 0),
            unidad: ing.unidad || 'unidad'
          };
        })
        .filter(function (ing) { return ing.cantidad > 0; });

      if (ingsToInsert.length > 0) {
        const { error: ingError } = await supabase.from('plato_ingredientes').insert(ingsToInsert);
        if (ingError) throw ingError;
      }
    }

    res.json({ success: true, message: 'Plato actualizado' });
  } catch (err) {
    console.error('PUT /api/dishes/:id error:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar plato' });
  }
});

// Soft-delete plato
router.delete('/:id', requirePermission('puede_eliminar_productos'), async (req, res) => {
  try {
    const { error } = await supabase.from('platos').update({ activo: false }).eq('id', req.params.id);
    if (error) throw error;

    res.json({ success: true, message: 'Plato desactivado' });
  } catch (err) {
    console.error('DELETE /api/dishes/:id error:', err);
    res.status(500).json({ success: false, message: 'Error al desactivar plato' });
  }
});

module.exports = router;
