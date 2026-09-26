const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({ success: false, message: 'JWT_SECRET no configurado' });
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token no proporcionado' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalido o expirado' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Se requieren permisos de administrador' });
  }
  next();
}

// RBAC: resuelve el rol y sus permisos para un usuario.
// Devuelve { roleId, roleName, permissions: [...] }
async function getUserPermissions(userId) {
  const supabase = require('../lib/supabase');
  const { data, error } = await supabase
    .from('perfiles')
    .select('role_id, roles(id, name, permissions)')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const role = data && data.roles ? data.roles : null;
  return {
    roleId: data ? data.role_id : null,
    roleName: role ? role.name : null,
    permissions: role && Array.isArray(role.permissions) ? role.permissions : []
  };
}

// Middleware granular: chequea un permiso del rol del usuario (RBAC).
// El usuario hereda estrictamente los permisos de su rol asignado.
function requirePermission(perm) {
  return async (req, res, next) => {
    try {
      const info = await getUserPermissions(req.user.id);
      if (info.permissions.indexOf(perm) === -1) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para esta accion' });
      }
      req.userRole = info;
      next();
    } catch (err) {
      console.error('Permission check error:', err);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  };
}

function generateToken(user) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado');
  }
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Middleware granular: basta con tener UNO de los permisos indicados
function requireAnyPermission(perms) {
  return async (req, res, next) => {
    try {
      const info = await getUserPermissions(req.user.id);
      const allowed = Array.isArray(perms) && perms.some(function (p) {
        return info.permissions.indexOf(p) !== -1;
      });
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para esta accion' });
      }
      req.userRole = info;
      next();
    } catch (err) {
      console.error('Permission check error:', err);
      res.status(500).json({ success: false, message: 'Error del servidor' });
    }
  };
}

module.exports = { authMiddleware, adminOnly, requirePermission, requireAnyPermission, getUserPermissions, generateToken, JWT_SECRET };
