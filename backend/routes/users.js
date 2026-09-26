// routes/users.js
// Gestion de usuarios (RBAC): cada usuario se vincula a un rol y hereda
// estrictamente sus permisos. Ya no hay permisos individuales por usuario.

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const supabaseAuth = require('../lib/supabase-auth');
const tgCommands = require('../lib/telegram-commands');
const { getUserPermissions } = require('../middleware/auth');

const SALT_ROUNDS = 10;

const USER_SELECT = 'id, username, role, role_id, roles(id, name), email, nombre_completo, activo, estado_aprobacion, motivo_rechazo, solicitado_en, ultimo_acceso, creado_en, telegram_user_id';

function userPublic(u) {
  const role = u.roles || null;
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    roleId: u.role_id,
    roleName: role ? role.name : null,
    email: u.email,
    nombreCompleto: u.nombre_completo,
    activo: u.activo,
    estadoAprobacion: u.estado_aprobacion || 'aprobado',
    motivoRechazo: u.motivo_rechazo,
    solicitadoEn: u.solicitado_en,
    ultimoAcceso: u.ultimo_acceso,
    creadoEn: u.creado_en,
    telegramUserId: u.telegram_user_id != null ? Number(u.telegram_user_id) : null
  };
}

async function roleExists(roleId) {
  if (!roleId) return false;
  const { data } = await supabase.from('roles').select('id').eq('id', roleId).maybeSingle();
  return !!data;
}

async function getRoleIdOf(userId) {
  const { data } = await supabase.from('perfiles').select('role_id').eq('id', userId).maybeSingle();
  return data ? data.role_id : null;
}

// La cuenta Super Admin solo puede ser editada por su titular y nadie
// puede archivarla/eliminarla. Solo un Super Admin puede asignar ese rol.
const SUPERADMIN = 'superadmin';

// Refresca el menu de Telegram del usuario (si esta vinculado)
async function refreshTelegramMenu(userId, telegramId) {
  if (!telegramId) return;
  try {
    const info = await getUserPermissions(userId);
    await tgCommands.setUserCommands(telegramId, info.permissions);
  } catch (e) { /* no bloqueante */ }
}

// Telegram ID: numero entero positivo o null
function normalizeTelegramId(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

// Email efectivo para Supabase Auth (los perfiles sin correo usan placeholder)
function effectiveEmail(username, email) {
  const mail = String(email || '').trim().toLowerCase();
  if (mail) return mail;
  return String(username || '').toLowerCase() + '@cornerhouse.local';
}

// GET /api/users - listar usuarios
router.get('/', authMiddleware, requirePermission('users.manage'), async (req, res) => {
  try {
    let query = supabase.from('perfiles').select(USER_SELECT);
    if (req.query.todos !== '1') {
      query = query.eq('activo', true);
    }
    const { data, error } = await query.order('creado_en', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data: (data || []).map(userPublic) });
  } catch (err) {
    console.error('Users list error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// POST /api/users - crear usuario (o reactivar uno inactivo con el mismo username)
router.post('/', authMiddleware, requirePermission('users.manage'), async (req, res) => {
  try {
    const { username, password, nombreCompleto, email, roleId, telegramUserId } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Usuario y contrasena requeridos' });
    }
    if (username.length < 3) {
      return res.status(400).json({ success: false, message: 'El usuario debe tener al menos 3 caracteres' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contrasena debe tener al menos 6 caracteres' });
    }
    const userRoleId = (await roleExists(roleId)) ? roleId : 'vendedor';
    if (userRoleId === SUPERADMIN && (await getRoleIdOf(req.user.id)) !== SUPERADMIN) {
      return res.status(403).json({ success: false, message: 'Solo un Super Admin puede asignar ese rol' });
    }

    const authEmail = effectiveEmail(username, email);

    const { data: existing } = await supabase
      .from('perfiles')
      .select('id, activo, auth_id')
      .eq('username', username)
      .single();

    if (existing) {
      if (existing.activo) {
        return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe y esta activo' });
      }
      // Reactivar: sincronizar credenciales en Supabase Auth
      let authId = existing.auth_id;
      try {
        if (authId) {
          await supabaseAuth.adminUpdateUser(authId, { password: password, email: authEmail, email_confirm: true });
        } else {
          const created = await supabaseAuth.adminCreateUser({ email: authEmail, password: password, email_confirm: true });
          authId = created.id;
        }
      } catch (authErr) {
        console.error('Reactivar: error en Supabase Auth:', authErr.message);
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const tgId = normalizeTelegramId(telegramUserId);
      const reactPatch = {
        password_hash: passwordHash,
        auth_id: authId || null,
        role_id: userRoleId,
        role: userRoleId,
        email: authEmail,
        nombre_completo: nombreCompleto || null,
        activo: true,
        estado_aprobacion: 'aprobado'
      };
      if (tgId !== undefined) reactPatch.telegram_user_id = tgId;
      const { data: reactivated, error: reactError } = await supabase
        .from('perfiles')
        .update(reactPatch)
        .eq('id', existing.id)
        .select(USER_SELECT)
        .single();

      if (reactError) throw reactError;
      refreshTelegramMenu(reactivated.id, reactivated.telegram_user_id).catch(function () { /* noop */ });
      return res.status(200).json({ success: true, data: userPublic(reactivated), message: 'Usuario reactivado (ya existia inactivo)' });
    }

    // Nuevo usuario: primero Supabase Auth, luego el perfil
    let authUser;
    try {
      authUser = await supabaseAuth.adminCreateUser({
        email: authEmail,
        password: password,
        email_confirm: true,
        user_metadata: { username: username, nombre_completo: nombreCompleto || null }
      });
    } catch (authErr) {
      if (/already|registered|exists/i.test(authErr.message)) {
        return res.status(400).json({ success: false, message: 'Ya existe una cuenta con ese correo' });
      }
      throw authErr;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { data: user, error } = await supabase
      .from('perfiles')
      .insert({
        username,
        password_hash: passwordHash,
        auth_id: authUser.id,
        role_id: userRoleId,
        role: userRoleId,
        email: authEmail,
        nombre_completo: nombreCompleto || null,
        telegram_user_id: normalizeTelegramId(telegramUserId) || null,
        estado_aprobacion: 'aprobado'
      })
      .select(USER_SELECT)
      .single();
    if (error) {
      try { await supabaseAuth.adminDeleteUser(authUser.id); } catch (e) { /* noop */ }
      throw error;
    }

    refreshTelegramMenu(user.id, user.telegram_user_id).catch(function () { /* noop */ });
    res.status(201).json({ success: true, data: userPublic(user) });
  } catch (err) {
    console.error('User create error:', err);
    if (err && err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Ese Telegram ID ya esta vinculado a otro usuario' });
    }
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// PUT /api/users/:id - editar usuario
router.put('/:id', authMiddleware, requirePermission('users.manage'), async (req, res) => {
  try {
    const { username, password, nombreCompleto, email, roleId, activo, telegramUserId } = req.body;

    const { data: target, error: targetError } = await supabase
      .from('perfiles')
      .select('id, role_id, auth_id, username')
      .eq('id', req.params.id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const isSelf = req.user.id === req.params.id;
    const requesterRoleId = await getRoleIdOf(req.user.id);

    // Cuenta Super Admin: solo su titular puede editarla
    if (target.role_id === SUPERADMIN) {
      if (!isSelf) {
        return res.status(403).json({ success: false, message: 'La cuenta Super Admin solo puede ser editada por su titular' });
      }
      if (roleId && roleId !== SUPERADMIN) {
        return res.status(400).json({ success: false, message: 'No se puede cambiar el rol de la cuenta Super Admin' });
      }
    }
    // Solo un Super Admin puede asignar el rol Super Admin
    if (roleId === SUPERADMIN && requesterRoleId !== SUPERADMIN) {
      return res.status(403).json({ success: false, message: 'Solo un Super Admin puede asignar ese rol' });
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (email !== undefined) updateData.email = email || null;
    if (nombreCompleto !== undefined) updateData.nombre_completo = nombreCompleto || null;
    if (roleId) {
      if (!(await roleExists(roleId))) {
        return res.status(400).json({ success: false, message: 'Rol invalido' });
      }
      updateData.role_id = roleId;
      updateData.role = roleId;
    }
    if (typeof activo === 'boolean') updateData.activo = activo;
    const tgId = normalizeTelegramId(telegramUserId);
    if (tgId !== undefined) updateData.telegram_user_id = tgId;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'La contrasena debe tener al menos 6 caracteres' });
      }
      updateData.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    // Sincronizar credenciales con Supabase Auth
    if (target.auth_id && (password || email !== undefined)) {
      const authPatch = {};
      if (password) authPatch.password = password;
      if (email !== undefined) {
        authPatch.email = effectiveEmail(target.username, email);
        authPatch.email_confirm = true;
        updateData.email = authPatch.email;
      }
      try {
        await supabaseAuth.adminUpdateUser(target.auth_id, authPatch);
      } catch (authErr) {
        console.error('User update: error en Supabase Auth:', authErr.message);
        return res.status(400).json({ success: false, message: 'No se pudo actualizar el correo/clave en Auth: ' + authErr.message });
      }
    }

    const { data, error } = await supabase
      .from('perfiles')
      .update(updateData)
      .eq('id', req.params.id)
      .select(USER_SELECT)
      .single();
    if (error) throw error;

    refreshTelegramMenu(data.id, data.telegram_user_id).catch(function () { /* noop */ });
    res.json({ success: true, data: userPublic(data) });
  } catch (err) {
    console.error('User update error:', err);
    if (err && err.code === '23505') {
      return res.status(400).json({ success: false, message: 'Ese Telegram ID ya esta vinculado a otro usuario' });
    }
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// DELETE /api/users/:id                → archivar (soft-delete: activo=false)
// DELETE /api/users/:id?permanente=1   → eliminar de verdad (solo archivados).
//   El historial (ventas, movimientos, compras) se conserva sin vinculo.
router.delete('/:id', authMiddleware, requirePermission('users.manage'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'No puedes eliminarte a ti mismo' });
    }
    const permanente = req.query.permanente === '1' || req.query.permanente === 'true';

    const { data: user, error: getError } = await supabase
      .from('perfiles')
      .select('id, username, role_id, activo, auth_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (getError) throw getError;
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // La cuenta Super Admin no se puede archivar ni eliminar (nadie, ni su titular)
    if (user.role_id === SUPERADMIN) {
      return res.status(403).json({ success: false, message: 'La cuenta Super Admin no se puede archivar ni eliminar' });
    }

    if (!permanente) {
      const { error } = await supabase
        .from('perfiles')
        .update({ activo: false })
        .eq('id', req.params.id);
      if (error) throw error;
      return res.json({ success: true, message: 'Usuario archivado' });
    }

    if (user.activo) {
      return res.status(400).json({ success: false, message: 'Archivá el usuario antes de eliminarlo permanentemente' });
    }

    // No dejar el sistema sin administradores
    if (user.role_id === 'admin') {
      const { count } = await supabase
        .from('perfiles')
        .select('id', { count: 'exact', head: true })
        .eq('role_id', 'admin');
      if ((count || 0) <= 1) {
        return res.status(400).json({ success: false, message: 'No se puede eliminar el ultimo administrador' });
      }
    }

    // Borrar tambien el usuario de Supabase Auth (credenciales)
    if (user.auth_id) {
      try { await supabaseAuth.adminDeleteUser(user.auth_id); } catch (e) { /* noop */ }
    }

    const { error } = await supabase.from('perfiles').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (err) {
    console.error('User delete error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// POST /api/users/:id/aprobar - aprobar usuario pendiente (rol por defecto: vendedor)
router.post('/:id/aprobar', authMiddleware, requirePermission('users.manage'), async (req, res) => {
  try {
    const { roleId, nombreCompleto } = req.body || {};
    const finalRole = (await roleExists(roleId)) ? roleId : 'vendedor';
    const updateData = {
      estado_aprobacion: 'aprobado',
      motivo_rechazo: null,
      role_id: finalRole,
      role: finalRole
    };
    if (nombreCompleto) updateData.nombre_completo = nombreCompleto;

    const { data, error } = await supabase
      .from('perfiles')
      .update(updateData)
      .eq('id', req.params.id)
      .select(USER_SELECT)
      .single();
    if (error) throw error;
    res.json({ success: true, data: userPublic(data) });
  } catch (err) {
    console.error('User approve error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// POST /api/users/:id/rechazar - rechazar usuario pendiente
router.post('/:id/rechazar', authMiddleware, requirePermission('users.manage'), async (req, res) => {
  try {
    const { motivo } = req.body || {};
    const { data, error } = await supabase
      .from('perfiles')
      .update({
        estado_aprobacion: 'rechazado',
        motivo_rechazo: motivo || 'Sin motivo especificado'
      })
      .eq('id', req.params.id)
      .select(USER_SELECT)
      .single();
    if (error) throw error;
    res.json({ success: true, data: userPublic(data) });
  } catch (err) {
    console.error('User reject error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
