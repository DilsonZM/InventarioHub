// services/sales.js
// Capa de servicio para ventas (pedidos).

import { store } from '../core/store.js';

function normalizeItem(it) {
  if (!it) return null;
  return {
    productId: it.producto_id || it.productId,
    productName: it.producto_nombre || it.productName,
    quantity: it.cantidad,
    cantidadBase: it.cantidad,
    cantidadPresentacion: it.cantidad_presentacion || null,
    unitPrice: it.precio_unitario,
    subtotal: it.subtotal,
    unidadPresentacion: it.unidad_presentacion || null,
    unidadPresentacionLabel: it.unidad_presentacion || null,
    factorConversion: it.factor_conversion || 1
  };
}

function normalizeSale(s) {
  if (!s) return null;
  return {
    id: s.id,
    numero_venta: s.numero_venta,
    total: s.total,
    subtotal: s.subtotal,
    impuesto: s.impuesto,
    paymentMethod: s.metodo_pago || s.paymentMethod,
    estado: s.estado,
    estadoCocina: s.estadoCocina || s.estado_cocina || 'pendiente',
    mesaId: s.mesaId || s.mesa_id || null,
    mesaNombre: s.mesaNombre || s.mesa_nombre || null,
    userId: s.usuario_id,
    username: s.perfiles?.username || s.username || 'Desconocido',
    clienteNombre: s.cliente_nombre,
    createdAt: s.creado_en,
    items: Array.isArray(s.venta_detalles) ? s.venta_detalles.map(normalizeItem) : (s.items || []).map(normalizeItem)
  };
}

export async function list(params) {
  const res = await window.API.sales.list(params || {});
  return Object.assign({}, res, { data: (res.data || []).map(normalizeSale) });
}

export async function get(id) {
  const res = await window.API.sales.get(id);
  return Object.assign({}, res, { data: res.data ? normalizeSale(res.data) : null });
}

export async function create(payload) {
  return window.API.sales.create(payload);
}

export async function update(id, payload) {
  return window.API.sales.update(id, payload);
}

export async function remove(id) {
  return window.API.sales.delete(id);
}

export async function advanceEstado(id, estado) {
  return window.API.sales.advanceEstado(id, estado);
}

export async function loadSalesIntoState(params) {
  const res = await list(params);
  store.state.sales = res.data || [];
  return res;
}

// Calcula el total de una venta a partir de sus items.
// Utilizado en varias vistas (POS preview, dashboard, etc).
export function computeTotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce(function (acc, it) {
    var sub = (it.subtotal != null) ? it.subtotal : ((it.unitPrice || 0) * (it.quantity || 0));
    return acc + sub;
  }, 0);
}

if (typeof window !== 'undefined') {
  window.ServicesSales = {
    list: list,
    get: get,
    create: create,
    update: update,
    remove: remove,
    advanceEstado: advanceEstado,
    loadIntoState: loadSalesIntoState,
    normalize: normalizeSale,
    computeTotal: computeTotal
  };
}
