// services/purchases.js
// Capa de servicio para compras (entradas de inventario).

import { store } from '../core/store.js';

function normalizeCompra(c) {
  if (!c) return null;
  return {
    id: c.id,
    fecha: c.fecha,
    producto_id: c.producto_id,
    productId: c.producto_id,
    productName: c.producto_nombre || c.productName,
    cantidad: c.cantidad,
    cantidadBase: c.cantidad,
    cantidadPresentacion: c.cantidad_presentacion || null,
    valorUnitario: c.valor_unitario,
    valorTotal: c.valor_total,
    unidadPresentacion: c.unidad_presentacion || null,
    unidadPresentacionLabel: c.unidad_presentacion || null,
    factorConversion: c.factor_conversion || 1,
    userId: c.usuario_id,
    username: c.perfiles?.username || c.username || 'Desconocido',
    createdAt: c.creado_en
  };
}

export async function list(params) {
  const res = await window.API.compras.list(params || {});
  return Object.assign({}, res, { data: (res.data || []).map(normalizeCompra) });
}

export async function get(id) {
  const res = await window.API.compras.get(id);
  return Object.assign({}, res, { data: res.data ? normalizeCompra(res.data) : null });
}

export async function create(payload) {
  return window.API.compras.create(payload);
}

export async function update(id, payload) {
  return window.API.compras.update(id, payload);
}

export async function remove(id) {
  return window.API.compras.delete(id);
}

export async function loadPurchasesIntoState(params) {
  const res = await list(params);
  store.state.compras = res.data || [];
  return res;
}

if (typeof window !== 'undefined') {
  window.ServicesPurchases = {
    list: list,
    get: get,
    create: create,
    update: update,
    remove: remove,
    loadIntoState: loadPurchasesIntoState,
    normalize: normalizeCompra
  };
}
