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

// Middleware granular: chequea un flag de permiso especifico
function requirePermission(perm) {
  return async (req, res, next) => {
    try {
      const supabase = require('../lib/supabase');
      const { data, error } = await supabase
        .from('perfiles')
        .select(perm)
        .eq('id', req.user.id)
        .single();
      if (error) throw error;
      if (!data || !data[perm]) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para esta accion' });
      }
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

module.exports = { authMiddleware, adminOnly, requirePermission, generateToken, JWT_SECRET };
