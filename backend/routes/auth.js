const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const supabaseAuth = require('../lib/supabase-auth');
const { generateToken, authMiddleware } = require('../middleware/auth');

const SALT_ROUNDS = 10;
const APP_URL = process.env.APP_URL || 'https://inventory-app-one-azure.vercel.app';

// RBAC: el usuario hereda los permisos de su rol
const USER_SELECT = 'id, username, role, role_id, roles(id, name, permissions), email, nombre_completo, estado_aprobacion, auth_id';

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
  const role = user.roles || null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    roleId: user.role_id,
    roleName: role ? role.name : null,
    email: user.email,
    nombreCompleto: user.nombre_completo,
    estadoAprobacion: user.estado_aprobacion || 'aprobado',
    permissions: role && Array.isArray(role.permissions) ? role.permissions : []
  };
}

router.post('/register', async (req, res) => {
  try {
    const { username, password, nombreCompleto, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ success: false, message: 'Usuario, contrasena y correo son obligatorios' });
    }
    if (username.length < 3) {
      return res.status(400).json({ success: false, message: 'El usuario debe tener al menos 3 caracteres' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contrasena debe tener al menos 6 caracteres' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ success: false, message: 'El correo no tiene un formato valido' });
    }

    const { data: existing } = await supabase
      .from('perfiles')
      .select('id, estado_aprobacion')
      .eq('username', username)
      .single();

    if (existing) {
      return res.status(400).json({
        success: false,
        message: existing.estado_aprobacion === 'pendiente'
          ? 'Ya tienes una solicitud pendiente. Espera la aprobacion del administrador.'
          : 'El nombre de usuario ya existe'
      });
    }

    // Verificar que el correo no este ya registrado
    const { data: emailExists } = await supabase
      .from('perfiles')
      .select('id')
      .eq('email', emailNorm)
      .single();

    if (emailExists) {
      return res.status(400).json({ success: false, message: 'Ya existe una cuenta registrada con ese correo' });
    }

    const passwordHash = await hashPassword(password);

    // 1) Crear el usuario en Supabase Auth (credenciales)
    let authUser;
    try {
      authUser = await supabaseAuth.adminCreateUser({
        email: emailNorm,
        password: password,
        email_confirm: true,
        user_metadata: { username: username, nombre_completo: nombreCompleto || null }
      });
    } catch (authErr) {
      if (/already|registered|exists/i.test(authErr.message)) {
        return res.status(400).json({ success: false, message: 'Ya existe una cuenta registrada con ese correo' });
      }
      throw authErr;
    }

    // 2) Crear el perfil (rol/RBAC), pendiente de aprobacion
    const { data: user, error } = await supabase
      .from('perfiles')
      .insert({
        username,
        password_hash: passwordHash,
        auth_id: authUser.id,
        role: 'vendedor',
        role_id: 'vendedor',
        email: emailNorm,
        nombre_completo: nombreCompleto || null,
        estado_aprobacion: 'pendiente',
        solicitado_en: new Date().toISOString()
      })
      .select('id, username, role, email, nombre_completo, estado_aprobacion')
      .single();

    if (error) {
      // Rollback del usuario de Auth para no dejar cuentas huerfanas
      try { await supabaseAuth.adminDeleteUser(authUser.id); } catch (e) { /* noop */ }
      throw error;
    }

    res.status(201).json({
      success: true,
      data: {
        pendiente: true,
        message: 'Solicitud enviada. Un administrador debe aprobarla antes de que puedas iniciar sesion.',
        username: user.username
      }
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
      .select('password_hash, ' + USER_SELECT)
      .eq('username', username)
      .eq('activo', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Credenciales invalidas' });
    }

    if (user.estado_aprobacion === 'pendiente') {
      return res.status(403).json({ success: false, message: 'Tu solicitud de registro esta pendiente de aprobacion por un administrador.' });
    }
    if (user.estado_aprobacion === 'rechazado') {
      return res.status(403).json({ success: false, message: 'Tu solicitud de registro fue rechazada. Contacta al administrador.' });
    }

    // Credenciales: Supabase Auth si el perfil esta vinculado;
    // fallback local (bcrypt) para perfiles sin vincular.
    let match = false;
    let upgradedHash = null;
    if (user.auth_id) {
      try {
        await supabaseAuth.signInWithPassword(user.email, password);
        match = true;
      } catch (authErr) {
        match = false;
      }
    } else {
      const result = await comparePassword(password, user.password_hash);
      match = result.match;
      upgradedHash = result.upgradedHash;
    }

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

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: 'Ingresa tu correo electronico' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ success: false, message: 'El correo no tiene un formato valido' });
    }

    const { data: user } = await supabase
      .from('perfiles')
      .select('id, username, email, activo, estado_aprobacion')
      .eq('email', emailNorm)
      .single();

    // Por seguridad, no exponemos si el correo existe.
    // El correo de recuperacion lo envia Supabase Auth.
    if (user) {
      console.log('[forgot-password] Solicitud de recuperacion para:', user.username, '<-', user.email);
      try {
        await supabaseAuth.sendRecovery(user.email, APP_URL + '/views/reset-password.html');
      } catch (mailErr) {
        console.error('[forgot-password] error enviando correo:', mailErr.message);
      }
      // Aviso interno (auditoria) al grupo de Telegram
      const safeUser = String(user.username || '').replace(/[<>&]/g, '');
      const safeEmail = String(user.email || '').replace(/[<>&]/g, '');
      try {
        const { sendTelegramMessage } = require('../lib/telegram');
        sendTelegramMessage(
          '🔑 <b>Solicitud de restablecimiento</b>\n\n'
          + 'Usuario: <b>' + safeUser + '</b>\n'
          + 'Correo: ' + safeEmail + '\n\n'
          + 'Se envió el enlace de recuperación por correo.',
          { html: true }
        ).catch(function () { /* no bloqueante */ });
      } catch (e) { /* no bloqueante */ }
    }

    res.json({
      success: true,
      data: {
        message: 'Si el correo coincide con una cuenta activa, enviaremos instrucciones para restablecer tu contrasena.'
      }
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// POST /api/auth/reset-password
// Recibe el access_token del enlace de recuperacion (Supabase) y la nueva
// contrasena. Actualiza la credencial en Supabase Auth y el hash local.
router.post('/reset-password', async (req, res) => {
  try {
    const { access_token, token_hash, type, password } = req.body || {};
    if (!password) {
      return res.status(400).json({ success: false, message: 'La nueva contrasena es requerida' });
    }
    if (!access_token && !token_hash) {
      return res.status(400).json({ success: false, message: 'Token de recuperacion requerido' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contrasena debe tener al menos 6 caracteres' });
    }

    // Flujo token_hash: se valida recien ahora (no al abrir el enlace)
    let accessToken = access_token;
    if (!accessToken && token_hash) {
      try {
        const session = await supabaseAuth.verifyOtp(type || 'recovery', token_hash);
        accessToken = session.access_token;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'El enlace expiro o es invalido. Solicita uno nuevo.'
        });
      }
    }

    let authUser;
    try {
      authUser = await supabaseAuth.updateUserPassword(accessToken, password);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'El enlace expiro o es invalido. Solicita uno nuevo.'
      });
    }

    // Mantener el hash local (respaldo) en sincronia
    try {
      const passwordHash = await hashPassword(password);
      await supabase.from('perfiles').update({ password_hash: passwordHash }).eq('auth_id', authUser.id);
    } catch (e) { /* no bloqueante */ }

    res.json({ success: true, data: { message: 'Contrasena actualizada. Ya puedes iniciar sesion.' } });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('perfiles')
      .select(USER_SELECT)
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
