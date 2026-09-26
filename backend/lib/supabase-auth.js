// lib/supabase-auth.js
// Puente con Supabase Auth (GoTrue):
//   - credenciales y contrasenas viven en auth.users
//   - los correos de recuperacion los envia Supabase
//   - el perfil (rol/RBAC) sigue en la tabla perfiles
//
// La sesion de la app sigue siendo el JWT propio (no cambia el resto del
// sistema): Supabase Auth se usa para validar credenciales y gestionar
// contrasenas/correos.

require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function gotrue(path, options) {
  const opts = options || {};
  const key = opts.useService ? SERVICE_KEY : ANON_KEY;
  const bearer = opts.token || key;
  const res = await fetch(SUPABASE_URL + '/auth/v1' + path, {
    method: opts.method || 'POST',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + bearer,
      'Content-Type': 'application/json'
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    const err = new Error(data.msg || data.message || data.error_description || 'Error de autenticacion');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// --- Administracion de usuarios (service role) ---

function adminCreateUser(payload) {
  return gotrue('/admin/users', { body: payload, useService: true });
}

function adminUpdateUser(authId, payload) {
  return gotrue('/admin/users/' + authId, { method: 'PUT', body: payload, useService: true });
}

function adminDeleteUser(authId) {
  return gotrue('/admin/users/' + authId, { method: 'DELETE', useService: true });
}

async function findAuthUserByEmail(email) {
  if (!email) return null;
  const data = await gotrue('/admin/users?per_page=200', { method: 'GET', useService: true });
  const users = (data && data.users) || [];
  const target = String(email).toLowerCase();
  return users.find(function (u) { return (u.email || '').toLowerCase() === target; }) || null;
}

// --- Sesion / contrasenas ---

// Valida usuario+contrasena contra Supabase Auth. Devuelve la sesion.
function signInWithPassword(email, password) {
  return gotrue('/token?grant_type=password', { body: { email: email, password: password } });
}

// Envia el correo de recuperacion (Supabase usa su SMTP configurado).
function sendRecovery(email, redirectTo) {
  const qs = redirectTo ? ('?redirect_to=' + encodeURIComponent(redirectTo)) : '';
  return gotrue('/recover' + qs, { body: { email: email } });
}

// Cambia la contrasena usando el token de recuperacion (access_token del link).
function updateUserPassword(accessToken, password) {
  return gotrue('/user', { method: 'PUT', token: accessToken, body: { password: password } });
}

// Verifica un token_hash (flujo scanner-proof: el token no se consume al
// abrir el enlace, solo al validarlo aqui). Devuelve una sesion.
function verifyOtp(type, tokenHash) {
  return gotrue('/verify', { body: { type: type || 'recovery', token_hash: tokenHash } });
}

module.exports = {
  gotrue,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  findAuthUserByEmail,
  signInWithPassword,
  sendRecovery,
  updateUserPassword,
  verifyOtp
};
