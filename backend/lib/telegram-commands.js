// lib/telegram-commands.js
// Menus de comandos de Telegram (setMyCommands) por scope y por usuario.
//
//   - default / all_private_chats: publicos + privados marcados "(privado)"
//   - chat_administrators (nuestro grupo): notificaciones/estado sin marca
//   - chat por usuario vinculado: sus comandos usables sin marca, el resto
//     con "(privado)" (asi todos saben que existen)
//
// El menu solo controla lo que se ve en el autocompletado "/"; la
// ejecucion la sigue validando el RBAC del bot.

require('dotenv').config();
const supabase = require('./supabase');

// Preferir IPv4 (la red hacia Telegram es intermitente en IPv6)
try { require('dns').setDefaultResultOrder('ipv4first'); } catch (e) { /* noop */ }

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GROUP_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const PRIVATE_SUFFIX = ' (privado)';

// Catalogo unico de comandos: permiso null = publico.
// groupOk = se puede usar en el grupo (admins de Telegram).
const CATALOG = [
  { command: 'ayuda', description: 'Lista y guia de comandos', perm: null },
  { command: 'id', description: 'Ver tu Telegram ID', perm: null },
  { command: 'cancelar', description: 'Cancelar la operacion en curso', perm: null },
  { command: 'notificaciones', description: 'Activar o silenciar avisos', perm: 'users.manage', groupOk: true },
  { command: 'estado', description: 'Ver estado y conexion del bot', perm: 'users.manage', groupOk: true },
  { command: 'stockbajos', description: 'Insumos en o bajo el stock minimo', perm: 'products.view' },
  { command: 'inventario', description: 'Descargar reportes en PDF', perm: 'products.view' },
  { command: 'hoy', description: 'Ventas, facturacion y margen de hoy', perm: 'finance.view' },
  { command: 'rango', description: 'Resumen de ventas por rango de fechas', perm: 'finance.view' },
  { command: 'finanzas', description: 'Ingresos, egresos y balance contable', perm: 'finance.view' },
  { command: 'gasto', description: 'Registrar un gasto operativo', perm: 'finance.gastos' },
  { command: 'gestionusers', description: 'Vincular usuarios con Telegram', perm: 'users.manage' },
  { command: 'syncmenu', description: 'Actualizar menus de comandos', perm: 'users.manage' }
];

// Menu para un set de permisos: usables sin marca; el resto "(privado)"
function menuForPermissions(perms) {
  const list = Array.isArray(perms) ? perms : [];
  return CATALOG.map(function (c) {
    if (!c.perm) return { command: c.command, description: c.description };
    const can = list.indexOf(c.perm) !== -1;
    return { command: c.command, description: c.description + (can ? '' : PRIVATE_SUFFIX) };
  });
}

// Menu default (todos): publicos + privados marcados
function defaultMenu() {
  return menuForPermissions([]);
}

// Menu de admins del grupo: publicos y comandos groupOk sin marca
function groupAdminMenu() {
  return CATALOG.map(function (c) {
    if (!c.perm || c.groupOk) return { command: c.command, description: c.description };
    return { command: c.command, description: c.description + PRIVATE_SUFFIX };
  });
}

async function tgApi(method, body) {
  if (!BOT_TOKEN) throw new Error('sin bot token');
  let lastError = null;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/' + method, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000)
      });
      const data = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        const err = new Error((data && data.description) || 'Telegram API error');
        err.data = data;
        throw err;
      }
      return data;
    } catch (err) {
      lastError = err;
      // Los errores 400/403 de Telegram no se reintentan
      if (err.data) throw err;
      if (i < 2) await new Promise(function (r) { setTimeout(r, 1200); });
    }
  }
  throw lastError || new Error('Telegram API error');
}

async function setCommands(commands, scope) {
  const body = { commands: commands };
  if (scope) body.scope = scope;
  return tgApi('setMyCommands', body);
}

// Scopes globales: default, privados y admins del grupo.
// Reintenta los scopes que fallaron (la red a Telegram es intermitente).
async function syncGlobalCommands() {
  const results = { default: false, private: false, groupAdmins: false };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (results.default !== true) {
      try { await setCommands(defaultMenu()); results.default = true; } catch (e) { results.default = e.message; }
    }
    if (results.private !== true) {
      try { await setCommands(defaultMenu(), { type: 'all_private_chats' }); results.private = true; } catch (e) { results.private = e.message; }
    }
    if (GROUP_CHAT_ID && results.groupAdmins !== true) {
      try {
        await setCommands(groupAdminMenu(), { type: 'chat_administrators', chat_id: Number(GROUP_CHAT_ID) || GROUP_CHAT_ID });
        results.groupAdmins = true;
      } catch (e) { results.groupAdmins = e.message; }
    }
    const allOk = results.default === true && results.private === true && (results.groupAdmins === true || !GROUP_CHAT_ID);
    if (allOk) break;
    await new Promise(function (r) { setTimeout(r, 1500); });
  }
  return results;
}

// Menu privado de un usuario (falla si nunca inicio el bot: se ignora)
async function setUserCommands(userId, permissions) {
  if (!userId) return false;
  try {
    await setCommands(menuForPermissions(permissions || []), { type: 'chat', chat_id: Number(userId) });
    return true;
  } catch (e) {
    return false;
  }
}

async function clearUserCommands(userId) {
  if (!userId) return false;
  try {
    await tgApi('deleteMyCommands', { scope: { type: 'chat', chat_id: Number(userId) } });
    return true;
  } catch (e) {
    return false;
  }
}

// Recalcula el menu privado de todos los usuarios vinculados
async function syncAllUserCommands() {
  const { data } = await supabase
    .from('perfiles')
    .select('telegram_user_id, roles(permissions)')
    .not('telegram_user_id', 'is', null);
  const users = data || [];
  let ok = 0, fail = 0;
  for (const u of users) {
    const perms = (u.roles && Array.isArray(u.roles.permissions)) ? u.roles.permissions : [];
    const done = await setUserCommands(u.telegram_user_id, perms);
    if (done) ok++; else fail++;
  }
  return { total: users.length, ok: ok, fail: fail };
}

// Sync global con TTL (para no llamar en cada webhook)
let _lastSync = 0;
async function ensureCommandsSynced(maxAgeMs) {
  const ttl = maxAgeMs || 6 * 60 * 60 * 1000;
  const age = Date.now() - _lastSync;
  if (_lastSync && age < ttl) return;
  try {
    const results = await syncGlobalCommands();
    const allOk = results.default === true && results.private === true && (results.groupAdmins === true || !GROUP_CHAT_ID);
    // Si algo fallo, reintentar en 2 minutos
    _lastSync = allOk ? Date.now() : Date.now() - ttl + 2 * 60 * 1000;
    return results;
  } catch (e) {
    _lastSync = Date.now() - ttl + 2 * 60 * 1000;
  }
}

module.exports = {
  CATALOG,
  menuForPermissions,
  defaultMenu,
  groupAdminMenu,
  syncGlobalCommands,
  setUserCommands,
  clearUserCommands,
  syncAllUserCommands,
  ensureCommandsSynced
};
