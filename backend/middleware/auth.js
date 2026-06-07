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

module.exports = { authMiddleware, adminOnly, generateToken, JWT_SECRET };
