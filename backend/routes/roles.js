// routes/roles.js
// CRUD de roles y permisos (RBAC). Acceso: permiso users.manage.
// Los usuarios heredan estrictamente los permisos de su rol: al guardar
// cambios en un rol impacta a todos los usuarios vinculados.

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { CATALOG, sanitizePermissions } = require('../lib/permissions');

function slugify(text) {
  return String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function rolePublic(r, userCount) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
    isSystem: !!r.is_system,
    userCount: userCount || 0,
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en
  };
}

// GET /api/roles/catalogo - catalogo de modulos/permisos para la matriz
router.get('/catalogo', authMiddleware, requirePermission('users.manage'), (req, res) => {
  res.json({ success: true, data: CATALOG });
});

// GET /api/roles - lista de roles con contador de usuarios
router.get('/', authMiddleware, requirePermission('users.manage'), async (req, res) => {
  try {
    const { data: roles, error } = await supabase
      .from('roles')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw error;

    const { data: users, error: usersError } = await supabase
      .from('perfiles')
      .select('role_id');
    if (usersError) throw usersError;

    const counts = {};
    (users || []).forEach(function (u) {
      counts[u.role_id] = (counts[u.role_id] || 0) + 1;
    });

    res.json({ success: true, data: (roles || []).map(function (r) { return rolePublic(r, counts[r.id]); }) });
  } catch (err) {
    console.error('Roles list error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// POST /api/roles - crear rol
router.post('/', authMiddleware, requirePermission('users.manage'), async (req, res) => {
  try {
    const { name, description, permissions } = req.body || {};
    const nombre = String(name || '').trim();
    if (nombre.length < 3) {
      return res.status(400).json({ success: false, message: 'El nombre del rol debe tener al menos 3 caracteres' });
    }
    const id = slugify(nombre);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Nombre de rol invalido' });
    }

    const { data: existing } = await supabase.from('roles').select('id').eq('id', id).maybeSingle();
    if (existing) {
      return res.status(400).json({ success: false, message: 'Ya existe un rol con ese nombre' });
    }

    const { data, error } = await supabase
      .from('roles')
      .insert({
        id: id,
        name: nombre,
        description: String(description || '').trim() || null,
        permissions: sanitizePermissions(permissions),
        is_system: false
      })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json({ success: true, data: rolePublic(data, 0), message: 'Rol creado' });
  } catch (err) {
    console.error('Rol create error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// PUT /api/roles/:id - editar nombre, descripcion y permisos del rol
router.put('/:id', authMiddleware, requirePermission('users.manage'), async (req, res) => {
  try {
    const { name, description, permissions } = req.body || {};

    const { data: role, error: getError } = await supabase
      .from('roles')
      .select('id, is_system')
      .eq('id', req.params.id)
      .maybeSingle();
    if (getError) throw getError;
    if (!role) {
      return res.status(404).json({ success: false, message: 'Rol no encontrado' });
    }

    // Los roles de sistema no se renombran (solo se editan sus permisos)
    if (role.is_system && (name !== undefined || description !== undefined)) {
      return res.status(400).json({
        success: false,
        message: 'Los roles base del sistema no se pueden renombrar. Solo se pueden editar sus permisos.'
      });
    }

    const update = { actualizado_en: new Date().toISOString() };
    if (name !== undefined) {
      const nombre = String(name || '').trim();
      if (nombre.length < 3) {
        return res.status(400).json({ success: false, message: 'El nombre del rol debe tener al menos 3 caracteres' });
      }
      update.name = nombre;
    }
    if (description !== undefined) update.description = String(description || '').trim() || null;
    if (permissions !== undefined) {
      const permisosFinales = sanitizePermissions(permissions);
      // El rol Administrador no puede quedarse sin gestion de usuarios (evita lockout)
      if (role.id === 'admin' && permisosFinales.indexOf('users.manage') === -1) {
        return res.status(400).json({
          success: false,
          message: 'El rol Administrador debe conservar el permiso "Gestionar usuarios y roles".'
        });
      }
      update.permissions = permisosFinales;
    }

    const { data, error } = await supabase
      .from('roles')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    res.json({ success: true, data: rolePublic(data), message: 'Rol actualizado' });
  } catch (err) {
    console.error('Rol update error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// DELETE /api/roles/:id - eliminar rol (solo si no es del sistema y no tiene usuarios)
router.delete('/:id', authMiddleware, requirePermission('users.manage'), async (req, res) => {
  try {
    const { data: role, error: getError } = await supabase
      .from('roles')
      .select('id, name, is_system')
      .eq('id', req.params.id)
      .maybeSingle();
    if (getError) throw getError;
    if (!role) {
      return res.status(404).json({ success: false, message: 'Rol no encontrado' });
    }
    if (role.is_system) {
      return res.status(400).json({ success: false, message: 'Los roles base del sistema no se pueden eliminar' });
    }

    const { count } = await supabase
      .from('perfiles')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', req.params.id)
      .eq('activo', true);
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar: tiene ' + count + (count === 1 ? ' usuario activo' : ' usuarios activos') + '. Cambiales el rol primero.'
      });
    }

    // Usuarios archivados con este rol: se reasignan a vendedor para poder borrar
    await supabase
      .from('perfiles')
      .update({ role_id: 'vendedor', role: 'vendedor' })
      .eq('role_id', req.params.id);

    const { error } = await supabase.from('roles').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Rol eliminado' });
  } catch (err) {
    console.error('Rol delete error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
