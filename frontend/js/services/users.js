// services/users.js
// Capa de servicio para usuarios (gestion de cuentas, aprobaciones).

function normalizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    email: u.email,
    nombreCompleto: u.nombre_completo || u.nombreCompleto,
    nombre_completo: u.nombre_completo,
    estado: u.estado_aprobacion || u.estado,
    activo: u.activo !== false,
    ultimoAcceso: u.ultimo_acceso,
    creadoEn: u.creado_en,
    solicitadoEn: u.solicitado_en,
    motivo: u.motivo,
    permisos: u.permisos || {}
  };
}

export async function list() {
  const res = await window.API.users.list();
  return Object.assign({}, res, { data: (res.data || []).map(normalizeUser) });
}

export async function create(payload) {
  return window.API.users.create(payload);
}

export async function update(id, payload) {
  return window.API.users.update(id, payload);
}

export async function remove(id) {
  return window.API.users.delete(id);
}

export async function approveUser(id, data) {
  return window.API.users.approve(id, data);
}

export async function rejectUser(id, data) {
  return window.API.users.reject(id, data);
}

if (typeof window !== 'undefined') {
  window.ServicesUsers = {
    list: list,
    create: create,
    update: update,
    remove: remove,
    approve: approveUser,
    reject: rejectUser,
    normalize: normalizeUser
  };
}
