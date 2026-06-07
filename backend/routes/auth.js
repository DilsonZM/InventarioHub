const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../lib/supabase');
const { generateToken, authMiddleware } = require('../middleware/auth');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

router.post('/register', async (req, res) => {
  try {
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

    const { data: existing } = await supabase
      .from('perfiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe' });
    }

    const { data: user, error } = await supabase
      .from('perfiles')
      .insert({
        username,
        password_hash: hashPassword(password),
        role: userRole
      })
      .select('id, username, role')
      .single();

    if (error) throw error;

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: { token, user: { id: user.id, username: user.username, role: user.role } }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
    }

    const { data: user, error } = await supabase
      .from('perfiles')
      .select('id, username, password_hash, role')
      .eq('username', username)
      .eq('activo', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    if (user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    await supabase.from('perfiles').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id);

    const token = generateToken(user);

    res.json({
      success: true,
      data: { token, user: { id: user.id, username: user.username, role: user.role } }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, data: { id: req.user.id, username: req.user.username, role: req.user.role } });
});

module.exports = router;
