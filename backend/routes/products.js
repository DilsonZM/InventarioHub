const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requirePermission } = require('../middleware/auth');

async function ensureInventoryOpening(productId, stock, cost, userId) {
  if ((parseFloat(stock) || 0) <= 0) return;

  const { data: opening, error: openingError } = await supabase
    .from('inventario_aperturas')
    .select('id')
    .eq('producto_id', productId)
    .maybeSingle();
  if (openingError) throw openingError;
  if (opening) return;

  // No convertir una edición posterior a apertura si ya existen compras.
  const { data: purchase, error: purchaseError } = await supabase
    .from('compras')
    .select('id')
    .eq('producto_id', productId)
    .limit(1)
    .maybeSingle();
  if (purchaseError) throw purchaseError;
  if (purchase) return;

  const { error: insertError } = await supabase
    .from('inventario_aperturas')
    .insert({
      producto_id: productId,
      cantidad_inicial: parseFloat(stock) || 0,
      costo_unitario: parseFloat(cost) || 0,
      usuario_id: userId || null
    });
  if (insertError && insertError.code !== '23505') throw insertError;
}

router.get('/categories/list', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('nombre')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;

    await ensureInventoryOpening(data.id, data.stock_actual, data.precio_compra, req.user?.id);
    res.json({ success: true, data: data.map(c => c.nombre) });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { category, search, lowStock, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let categoryId = null;
    if (category) {
      const { data: catData } = await supabase.from('categorias').select('id').eq('nombre', category).single();
      categoryId = catData ? catData.id : null;
    }

    let countQuery = supabase
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true);

    if (categoryId) {
      countQuery = countQuery.eq('categoria_id', categoryId);
    }
    if (search) {
      countQuery = countQuery.or(`nombre.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    let query = supabase
      .from('productos')
      .select('*, categorias(nombre)')
      .eq('activo', true)
      .order('nombre')
      .range(offset, offset + limitNum - 1);

    if (categoryId) {
      query = query.eq('categoria_id', categoryId);
    }

    if (search) {
      query = query.or(`nombre.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    await ensureInventoryOpening(data.id, data.stock_actual, data.precio_compra, req.user?.id);

    let products = (data || []).map(p => ({
      id: p.id,
      name: p.nombre,
      description: p.descripcion,
      sku: p.sku,
      codigo_barras: p.codigo_barras,
      price: p.precio_venta,
      cost: p.precio_compra,
      stock: p.stock_actual,
      minStock: p.stock_minimo,
      unidad: p.unidad_medida || 'unidad',
      category: p.categorias?.nombre || 'Sin categoria',
      category_id: p.categoria_id,
      proveedor_id: p.proveedor_id,
      active: p.activo,
      createdAt: p.creado_en,
      updatedAt: p.actualizado_en
    }));

    if (lowStock === 'true') {
      products = products.filter(p => p.stock <= p.minStock);
    }

    res.json({
      success: true,
      data: products,
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    });
  } catch (err) {
    console.error('Products list error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.get('/low-stock', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vista_stock_bajo')
      .select('*')
      .order('stock_actual');

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Low stock error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// POST /api/products/merma - registrar merma (perdida operativa, descuenta stock)
// NOTA: debe ir ANTES de GET /:id para que Express no lo confunda con un id
router.post('/merma', requirePermission('puede_crear_salidas'), async (req, res) => {
  try {
    const { productId, cantidad, motivo } = req.body;

    if (!productId || !cantidad || parseFloat(cantidad) <= 0) {
      return res.status(400).json({ success: false, message: 'productId y cantidad (> 0) son requeridos' });
    }

    const { data: producto, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, stock_actual')
      .eq('id', productId)
      .single();
    if (prodError || !producto) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    if (parseFloat(producto.stock_actual) < parseFloat(cantidad)) {
      return res.status(400).json({
        success: false,
        message: 'Stock insuficiente para merma. Disponible: ' + parseFloat(producto.stock_actual)
      });
    }

    const { data: movId, error: movError } = await supabase.rpc('registrar_movimiento', {
      p_producto_id: productId,
      p_tipo: 'merma',
      p_cantidad: parseFloat(cantidad),
      p_motivo: motivo || 'Merma registrada',
      p_usuario_id: req.user ? req.user.id : null
    });

    if (movError) throw movError;

    const { data: updated } = await supabase
      .from('productos')
      .select('id, nombre, stock_actual')
      .eq('id', productId)
      .single();

    res.status(201).json({
      success: true,
      data: { movimientoId: movId, producto: updated },
      message: 'Merma registrada: ' + producto.nombre + ' (-' + cantidad + ')'
    });
  } catch (err) {
    console.error('Merma error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error del servidor' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*, categorias(nombre)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    const product = {
      id: data.id,
      name: data.nombre,
      description: data.descripcion,
      sku: data.sku,
      codigo_barras: data.codigo_barras,
      price: data.precio_venta,
      cost: data.precio_compra,
      stock: data.stock_actual,
      minStock: data.stock_minimo,
      unidad: data.unidad_medida || 'unidad',
      category: data.categorias?.nombre || 'Sin categoria',
      category_id: data.categoria_id,
      proveedor_id: data.proveedor_id,
      active: data.activo,
      createdAt: data.creado_en,
      updatedAt: data.actualizado_en
    };

    res.json({ success: true, data: product });
  } catch (err) {
    console.error('Product get error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.post('/', requirePermission('puede_crear_productos'), async (req, res) => {
  try {
    const { name, sku, category, cost, stock, minStock, description, codigo_barras, unidad } = req.body;

    if (!name || !sku || !category || cost === undefined || stock === undefined) {
      return res.status(400).json({ success: false, message: 'Campos requeridos: name, sku, category, cost, stock' });
    }

    const { data: cat } = await supabase.from('categorias').select('id').eq('nombre', category).single();
    if (!cat) {
      return res.status(400).json({ success: false, message: 'Categoría no válida' });
    }

    const { data: existing } = await supabase.from('productos').select('id').eq('sku', sku).single();
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ya existe un producto con ese SKU' });
    }

    const { data, error } = await supabase
      .from('productos')
      .insert({
        nombre: name,
        sku,
        codigo_barras: codigo_barras || null,
        categoria_id: cat.id,
        precio_venta: 0,
        precio_compra: cost,
        stock_actual: stock,
        stock_minimo: minStock || 0,
        unidad_medida: unidad || 'unidad',
        descripcion: description || ''
      })
      .select('*, categorias(nombre)')
      .single();

    if (error) throw error;

    const product = {
      id: data.id,
      name: data.nombre,
      description: data.descripcion,
      sku: data.sku,
      price: data.precio_venta,
      cost: data.precio_compra,
      stock: data.stock_actual,
      minStock: data.stock_minimo,
      unidad: data.unidad_medida || 'unidad',
      category: data.categorias?.nombre || 'Sin categoria',
      active: data.activo,
      createdAt: data.creado_en,
      updatedAt: data.actualizado_en
    };

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    console.error('Product create error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.put('/:id', requirePermission('puede_editar_productos'), async (req, res) => {
  try {
    const { name, sku, category, cost, stock, minStock, description, codigo_barras, unidad } = req.body;

    const { data: existing } = await supabase.from('productos').select('id, sku').eq('id', req.params.id).single();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    if (sku && sku !== existing.sku) {
      const { data: dup } = await supabase.from('productos').select('id').eq('sku', sku).neq('id', req.params.id).single();
      if (dup) {
        return res.status(400).json({ success: false, message: 'SKU ya existe en otro producto' });
      }
    }

    let categoryId = null;
    if (category) {
      const { data: cat } = await supabase.from('categorias').select('id').eq('nombre', category).single();
      categoryId = cat?.id;
    }

    const updateData = {};
    if (name !== undefined) updateData.nombre = name;
    if (sku !== undefined) updateData.sku = sku;
    if (codigo_barras !== undefined) updateData.codigo_barras = codigo_barras;
    if (categoryId !== undefined) updateData.categoria_id = categoryId;
    if (cost !== undefined) updateData.precio_compra = cost;
    if (stock !== undefined) updateData.stock_actual = stock;
    if (minStock !== undefined) updateData.stock_minimo = minStock;
    if (description !== undefined) updateData.descripcion = description;
    if (unidad !== undefined) updateData.unidad_medida = unidad;

    const { data, error } = await supabase
      .from('productos')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*, categorias(nombre)')
      .single();

    if (error) throw error;

    const product = {
      id: data.id,
      name: data.nombre,
      description: data.descripcion,
      sku: data.sku,
      price: data.precio_venta,
      cost: data.precio_compra,
      stock: data.stock_actual,
      minStock: data.stock_minimo,
      unidad: data.unidad_medida || 'unidad',
      category: data.categorias?.nombre || 'Sin categoria',
      active: data.activo,
      createdAt: data.creado_en,
      updatedAt: data.actualizado_en
    };

    res.json({ success: true, data: product });
  } catch (err) {
    console.error('Product update error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.delete('/:id', requirePermission('puede_eliminar_productos'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('productos')
      .update({ activo: false })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    res.json({ success: true, message: 'Producto eliminado' });
  } catch (err) {
    console.error('Product delete error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
