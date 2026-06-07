const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const { generateToken, authMiddleware } = require('../middleware/auth');

const SALT_ROUNDS = 10;

const PERMISSION_COLS = `
  puede_crear_productos, puede_editar_productos, puede_eliminar_productos,
  puede_crear_salidas, puede_editar_salidas, puede_eliminar_salidas,
  puede_crear_entradas, puede_editar_entradas, puede_eliminar_entradas,
  puede_gestionar_usuarios, puede_ver_inventario, puede_ver_movimientos, puede_ver_dashboard
`.replace(/\s+/g, ' ').trim();

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function comparePassword(password, storedHash) {
  if (storedHash.length === 64 && /^[a-f0-9]{64}$/i.test(storedHash)) {
    const crypto = require('crypto');
    const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
    if (sha256Hash === storedHash) {
      const newHash = await hashPassword(password);
      return { match: true, upgradedHash: newHash };
    }
    return { match: false, upgradedHash: null };
  }
  const match = await bcrypt.compare(password, storedHash);
  return { match, upgradedHash: null };
}

function userResponse(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    nombreCompleto: user.nombre_completo,
    permisos: {
      puedeCrearProductos: !!user.puede_crear_productos,
      puedeEditarProductos: !!user.puede_editar_productos,
      puedeEliminarProductos: !!user.puede_eliminar_productos,
      puedeCrearSalidas: !!user.puede_crear_salidas,
      puedeEditarSalidas: !!user.puede_editar_salidas,
      puedeEliminarSalidas: !!user.puede_eliminar_salidas,
      puedeCrearEntradas: !!user.puede_crear_entradas,
      puedeEditarEntradas: !!user.puede_editar_entradas,
      puedeEliminarEntradas: !!user.puede_eliminar_entradas,
      puedeGestionarUsuarios: !!user.puede_gestionar_usuarios,
      puedeVerInventario: !!user.puede_ver_inventario,
      puedeVerMovimientos: !!user.puede_ver_movimientos,
      puedeVerDashboard: !!user.puede_ver_dashboard
    }
  };
}

router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

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
    const userRole = role && validRoles.includes(role) ? role : 'vendedor';

    const { data: existing } = await supabase
      .from('perfiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe' });
    }

    const passwordHash = await hashPassword(password);

    // Plantilla de permisos segun rol
    const plantilla = userRole === 'admin' ? {
      puede_crear_productos: true, puede_editar_productos: true, puede_eliminar_productos: true,
      puede_crear_salidas: true, puede_editar_salidas: true, puede_eliminar_salidas: true,
      puede_crear_entradas: true, puede_editar_entradas: true, puede_eliminar_entradas: true,
      puede_gestionar_usuarios: true, puede_ver_inventario: true, puede_ver_movimientos: true, puede_ver_dashboard: true
    } : {
      puede_crear_salidas: true, puede_editar_salidas: false, puede_eliminar_salidas: false,
      puede_crear_entradas: false, puede_editar_entradas: false, puede_eliminar_entradas: false,
      puede_gestionar_usuarios: false, puede_ver_inventario: true, puede_ver_movimientos: true, puede_ver_dashboard: true
    };

    const { data: user, error } = await supabase
      .from('perfiles')
      .insert({ username, password_hash: passwordHash, role: userRole, ...plantilla })
      .select('id, username, role, email, nombre_completo, ' + PERMISSION_COLS)
      .single();

    if (error) throw error;

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: { token, user: userResponse(user) }
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
      return res.status(400).json({ success: false, message: 'Usuario y contrasena requeridos' });
    }

    const { data: user, error } = await supabase
      .from('perfiles')
      .select('id, username, password_hash, role, email, nombre_completo, ' + PERMISSION_COLS)
      .eq('username', username)
      .eq('activo', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Credenciales invalidas' });
    }

    const { match, upgradedHash } = await comparePassword(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Credenciales invalidas' });
    }
    if (upgradedHash) {
      await supabase.from('perfiles').update({ password_hash: upgradedHash }).eq('id', user.id);
    }
    await supabase.from('perfiles').update({ ultimo_acceso: new Date().toISOString() }).eq('id', user.id);

    const token = generateToken(user);

    res.json({
      success: true,
      data: { token, user: userResponse(user) }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('perfiles')
      .select('id, username, role, email, nombre_completo, ' + PERMISSION_COLS)
      .eq('id', req.user.id)
      .single();
    if (error || !user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    res.json({ success: true, data: userResponse(user) });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

module.exports = router;
