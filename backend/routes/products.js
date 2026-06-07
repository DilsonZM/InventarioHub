const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { adminOnly } = require('../middleware/auth');

router.get('/categories/list', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('nombre')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    res.json({ success: true, data: data.map(c => c.nombre) });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { category, search, lowStock } = req.query;

    let query = supabase
      .from('productos')
      .select('*, categorias(nombre)')
      .eq('activo', true)
      .order('nombre');

    if (category) {
      query = query.eq('categorias.nombre', category);
    }

    if (search) {
      query = query.or(`nombre.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    let products = data.map(p => ({
      id: p.id,
      name: p.nombre,
      description: p.descripcion,
      sku: p.sku,
      codigo_barras: p.codigo_barras,
      price: p.precio_venta,
      cost: p.precio_compra,
      stock: p.stock_actual,
      minStock: p.stock_minimo,
      category: p.categorias?.nombre || 'Sin categoría',
      category_id: p.categoria_id,
      proveedor_id: p.proveedor_id,
      active: p.activo,
      createdAt: p.creado_en,
      updatedAt: p.actualizado_en
    }));

    if (lowStock === 'true') {
      products = products.filter(p => p.stock <= p.minStock);
    }

    res.json({ success: true, data: products, total: products.length });
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
      category: data.categorias?.nombre || 'Sin categoría',
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

router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, sku, category, price, cost, stock, minStock, description, codigo_barras } = req.body;

    if (!name || !sku || !category || price === undefined || cost === undefined || stock === undefined) {
      return res.status(400).json({ success: false, message: 'Campos requeridos: name, sku, category, price, cost, stock' });
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
        precio_venta: price,
        precio_compra: cost,
        stock_actual: stock,
        stock_minimo: minStock || 0,
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
      category: data.categorias?.nombre || 'Sin categoría',
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

router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { name, sku, category, price, cost, stock, minStock, description, codigo_barras } = req.body;

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
    if (price !== undefined) updateData.precio_venta = price;
    if (cost !== undefined) updateData.precio_compra = cost;
    if (stock !== undefined) updateData.stock_actual = stock;
    if (minStock !== undefined) updateData.stock_minimo = minStock;
    if (description !== undefined) updateData.descripcion = description;

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
      category: data.categorias?.nombre || 'Sin categoría',
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

router.delete('/:id', adminOnly, async (req, res) => {
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
