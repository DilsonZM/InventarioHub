// services/dishes.js
// Capa de servicio para platos y bebidas (recetas con ingredientes).

function normalizeIngredient(it) {
  if (!it) return null;
  return {
    id: it.id,
    plato_id: it.plato_id,
    producto_id: it.producto_id,
    productName: it.producto_nombre || it.productName,
    cantidad: it.cantidad,
    cantidadBase: it.cantidad,
    cantidadPresentacion: it.cantidad_presentacion || null,
    unidad: it.unidad,
    unidadBase: it.unidad || it.unidad_base,
    unidadPresentacion: it.unidad_presentacion || null,
    unidadPresentacionLabel: it.unidad_presentacion || null,
    factorConversion: it.factor_conversion || 1
  };
}

function normalizeDish(d) {
  if (!d) return null;
  return {
    id: d.id,
    nombre: d.nombre,
    descripcion: d.descripcion,
    tipo: d.tipo, // 'plato' o 'bebida'
    precio_venta: d.precio_venta,
    precio_costo: d.precio_costo,
    activo: d.activo,
    disponible: d.disponible !== false,
    ingredientes: Array.isArray(d.ingredientes) ? d.ingredientes.map(normalizeIngredient) : [],
    createdAt: d.creado_en,
    updatedAt: d.actualizado_en
  };
}

export async function list(params) {
  const res = await window.API.dishes.list(params || {});
  return Object.assign({}, res, { data: (res.data || []).map(normalizeDish) });
}

export async function get(id) {
  const res = await window.API.dishes.get(id);
  return Object.assign({}, res, { data: res.data ? normalizeDish(res.data) : null });
}

export async function create(dish) {
  return window.API.dishes.create(dish);
}

export async function update(id, dish) {
  return window.API.dishes.update(id, dish);
}

export async function remove(id) {
  return window.API.dishes.delete(id);
}

export async function archive(id) {
  return window.API.dishes.update(id, { activo: false });
}

export async function reactivate(id) {
  return window.API.dishes.update(id, { activo: true });
}

// Carga + cache en el state
export async function loadDishesIntoState(params) {
  const res = await list(params);
  store.state.dishes = res.data || [];
  return res;
}

import { store } from '../core/store.js';

if (typeof window !== 'undefined') {
  window.ServicesDishes = {
    list: list,
    get: get,
    create: create,
    update: update,
    remove: remove,
    archive: archive,
    reactivate: reactivate,
    loadIntoState: loadDishesIntoState,
    normalize: normalizeDish,
    normalizeIngredient: normalizeIngredient
  };
}
