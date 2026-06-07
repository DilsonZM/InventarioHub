const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../models/db');
const { generateToken, authMiddleware } = require('../middleware/auth');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

router.post('/register', (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
  }

  if (username.length < 3) {
    return res.status(400).json({ success: false, message: 'El usuario debe tener al menos 3 caracteres' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const validRoles = ['admin', 'vendedor'];
  const userRole = role && validRoles.includes(role) ? role : 'vendedor';

  const data = db.read();
  const exists = data.users.find(u => u.username === username);
  if (exists) {
    return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe' });
  }

  const user = {
    id: db.generateId('u'),
    username,
    password: hashPassword(password),
    role: userRole,
    createdAt: new Date().toISOString()
  };

  data.users.push(user);
  db.write(data);

  const token = generateToken(user);

  res.status(201).json({
    success: true,
    data: {
      token,
      user: { id: user.id, username: user.username, role: user.role }
    }
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
  }

  const data = db.read();
  const user = data.users.find(u => u.username === username);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
  }

  const hashedInput = hashPassword(password);
  if (user.password !== hashedInput) {
    return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
  }

  const token = generateToken(user);

  res.json({
    success: true,
    data: {
      token,
      user: { id: user.id, username: user.username, role: user.role }
    }
  });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, data: { id: req.user.id, username: req.user.username, role: req.user.role } });
});

module.exports = router;
