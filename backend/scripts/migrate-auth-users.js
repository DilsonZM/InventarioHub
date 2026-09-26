// scripts/migrate-auth-users.js
// Migracion one-time: crea los usuarios de Supabase Auth para cada perfil
// existente, conservando la contrasena actual (se copia el hash bcrypt).
//
//   node scripts/migrate-auth-users.js
//
// Los perfiles sin email reciben uno placeholder <usuario>@cornerhouse.local
// (el admin puede cambiarlo despues desde Usuarios y Roles).

require('dotenv').config();
const supabase = require('../lib/supabase');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLACEHOLDER_DOMAIN = 'cornerhouse.local';

async function gotrue(path, options) {
  const res = await fetch(SUPABASE_URL + '/auth/v1' + path, {
    method: (options && options.method) || 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    body: options && options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(function () { return {}; });
  if (!res.ok) {
    const err = new Error(data.msg || data.message || data.error_description || 'GoTrue error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function findAuthUserByEmail(email) {
  const data = await gotrue('/admin/users?per_page=200', { method: 'GET' });
  const users = (data && data.users) || [];
  return users.find(function (u) { return (u.email || '').toLowerCase() === email.toLowerCase(); }) || null;
}

async function main() {
  const { data: perfiles, error } = await supabase
    .from('perfiles')
    .select('id, username, email, nombre_completo, password_hash, auth_id')
    .order('creado_en', { ascending: true });
  if (error) throw error;

  let creados = 0, vinculados = 0, omitidos = 0;

  for (const p of perfiles) {
    if (p.auth_id) { omitidos++; continue; }

    const email = (p.email && String(p.email).trim())
      ? String(p.email).trim().toLowerCase()
      : (p.username.toLowerCase() + '@' + PLACEHOLDER_DOMAIN);

    let authUser = null;
    try {
      authUser = await gotrue('/admin/users', {
        body: {
          email: email,
          password_hash: p.password_hash,
          email_confirm: true,
          user_metadata: { username: p.username, nombre_completo: p.nombre_completo || null }
        }
      });
      creados++;
      console.log('  + auth user creado:', p.username, '<-', email);
    } catch (e) {
      if (/already|registered|exists/i.test(e.message)) {
        authUser = await findAuthUserByEmail(email);
        if (authUser) {
          vinculados++;
          console.log('  = auth user ya existia, vinculado:', p.username, '<-', email);
        }
      }
      if (!authUser) {
        console.error('  ! ERROR con', p.username, ':', e.message);
        continue;
      }
    }

    const update = { auth_id: authUser.id };
    if (!p.email) update.email = email;
    const { error: updError } = await supabase.from('perfiles').update(update).eq('id', p.id);
    if (updError) {
      console.error('  ! ERROR actualizando perfil', p.username, ':', updError.message);
      continue;
    }
  }

  console.log('\nResumen: creados=' + creados + ', vinculados=' + vinculados + ', ya tenian auth_id=' + omitidos);
  const { count } = await supabase.from('perfiles').select('id', { count: 'exact', head: true }).not('auth_id', 'is', null);
  console.log('Perfiles con auth_id:', count);
}

main().catch(function (e) {
  console.error('Migracion fallo:', e);
  process.exit(1);
});
