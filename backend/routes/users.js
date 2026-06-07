const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const SALT_ROUNDS = 10;

const PERMISSION_COLS = `
  puede_crear_productos, puede_editar_productos, puede_eliminar_productos,
  puede_crear_salidas, puede_editar_salidas, puede_eliminar_salidas,
  puede_crear_entradas, puede_editar_entradas, puede_eliminar_entradas,
  puede_gestionar_usuarios, puede_ver_inventario, puede_ver_movimientos, puede_ver_dashboard
`.replace(/\s+/g, ' ').trim();

function userPublic(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    email: u.email,
    nombreCompleto: u.nombre_completo,
    activo: u.activo,
    ultimoAcceso: u.ultimo_acceso,
    creadoEn: u.creado_en,
    permisos: {
      puedeCrearProductos: !!u.puede_crear_productos,
      puedeEditarProductos: !!u.puede_editar_productos,
      puedeEliminarProductos: !!u.puede_eliminar_productos,
      puedeCrearSalidas: !!u.puede_crear_salidas,
      puedeEditarSalidas: !!u.puede_editar_salidas,
      puedeEliminarSalidas: !!u.puede_eliminar_salidas,
      puedeCrearEntradas: !!u.puede_crear_entradas,
      puedeEditarEntradas: !!u.puede_editar_entradas,
      puedeEliminarEntradas: !!u.puede_eliminar_entradas,
      puedeGestionarUsuarios: !!u.puede_gestionar_usuarios,
      puedeVerInventario: !!u.puede_ver_inventario,
      puedeVerMovimientos: !!u.puede_ver_movimientos,
      puedeVerDashboard: !!u.puede_ver_dashboard
    }
  };
}

function plantillaPorRol(role) {
  if (role === 'admin') {
    return {
      puede_crear_productos: true, puede_editar_productos: true, puede_eliminar_productos: true,
      puede_crear_salidas: true, puede_editar_salidas: true, puede_eliminar_salidas: true,
      puede_crear_entradas: true, puede_editar_entradas: true, puede_eliminar_entradas: true,
      puede_gestionar_usuarios: true, puede_ver_inventario: true, puede_ver_movimientos: true, puede_ver_dashboard: true
    };
  }
  return {
    puede_crear_salidas: true, puede_editar_salidas: false, puede_eliminar_salidas: false,
    puede_crear_entradas: false, puede_editar_entradas: false, puede_eliminar_entradas: false,
    puede_gestionar_usuarios: false, puede_ver_inventario: true, puede_ver_movimientos: true, puede_ver_dashboard: true
  };
}

// GET /api/users - listar usuarios
router.get('/', authMiddleware, requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, username, role, email, nombre_completo, activo, ultimo_acceso, creado_en, ' + PERMISSION_COLS)
      .order('creado_en', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data: (data || []).map(userPublic) });
  } catch (err) {
    console.error('Users list error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// POST /api/users - crear usuario
router.post('/', authMiddleware, requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    const { username, password, nombreCompleto, email, role, permisos } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Usuario y contrasena requeridos' });
    }
    if (username.length < 3) {
      return res.status(400).json({ success: false, message: 'El usuario debe tener al menos 3 caracteres' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contrasena debe tener al menos 6 caracteres' });
    }
    const validRoles = ['admin', 'vendedor'];
    const userRole = validRoles.includes(role) ? role : 'vendedor';

    const { data: existing } = await supabase
      .from('perfiles')
      .select('id')
      .eq('username', username)
      .single();
    if (existing) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const basePerms = plantillaPorRol(userRole);
    const finalPerms = permisos ? { ...basePerms, ...permisos } : basePerms;

    const { data: user, error } = await supabase
      .from('perfiles')
      .insert({
        username,
        password_hash: passwordHash,
        role: userRole,
        email: email || null,
        nombre_completo: nombreCompleto || null,
        ...finalPerms
      })
      .select('id, username, role, email, nombre_completo, activo, ultimo_acceso, creado_en, ' + PERMISSION_COLS)
      .single();
    if (error) throw error;

    res.status(201).json({ success: true, data: userPublic(user) });
  } catch (err) {
    console.error('User create error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// PUT /api/users/:id - editar usuario
router.put('/:id', authMiddleware, requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    const { username, password, nombreCompleto, email, role, permisos, activo } = req.body;
    const updateData = {};
    if (username) updateData.username = username;
    if (email !== undefined) updateData.email = email || null;
    if (nombreCompleto !== undefined) updateData.nombre_completo = nombreCompleto || null;
    if (role) updateData.role = role;
    if (typeof activo === 'boolean') updateData.activo = activo;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'La contrasena debe tener al menos 6 caracteres' });
      }
      updateData.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    }
    if (permisos) {
      Object.assign(updateData, permisos);
    }

    const { data, error } = await supabase
      .from('perfiles')
      .update(updateData)
      .eq('id', req.params.id)
      .select('id, username, role, email, nombre_completo, activo, ultimo_acceso, creado_en, ' + PERMISSION_COLS)
      .single();
    if (error) throw error;

    res.json({ success: true, data: userPublic(data) });
  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// DELETE /api/users/:id - eliminar (soft-delete: activo=false)
router.delete('/:id', authMiddleware, requirePermission('puede_gestionar_usuarios'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'No puedes eliminarte a ti mismo' });
    }
    const { error } = await supabase
      .from('perfiles')
      .update({ activo: false })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Usuario desactivado' });
  } catch (err) {
    console.error('User delete error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
