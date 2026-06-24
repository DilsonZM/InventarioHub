// services/products.js
// Capa de servicio para productos (inventario). Antes las llamadas estaban
// dispersas en app.js como `API.products.list(...)` etc. Aqui centralizamos:
// - Normalizacion de campos (snake_case de la API -> camelCase del cliente)
// - Helpers de mapeo (factor de conversion, unidad por defecto)
// - Cache en memoria de categorias/proveedores

import { store } from '../core/store.js';

// Cache ligera: categorias y proveedores no cambian seguido durante la sesion
const cache = {
  categories: null,
  categoriesAt: 0,
  suppliers: null,
  suppliersAt: 0
};

const CACHE_TTL_MS = 60 * 1000; // 1 minuto

function fresh(entry) { return entry && (Date.now() - entry) < CACHE_TTL_MS; }

// Normaliza un producto de la API al formato camelCase que usa app.js.
function normalizeProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.nombre || p.name,
    description: p.descripcion || p.description,
    sku: p.sku,
    codigo_barras: p.codigo_barras,
    price: p.precio_venta,
    cost: p.precio_compra,
    stock: p.stock_actual,
    minStock: p.stock_minimo,
    unidad: p.unidad_medida || p.unidad || 'unidad',
    category: p.categorias?.nombre || p.category || 'Sin categoria',
    category_id: p.categoria_id,
    proveedor_id: p.proveedor_id,
    active: p.activo !== false,
    createdAt: p.creado_en,
    updatedAt: p.actualizado_en
  };
}

function normalizeProducts(list) {
  return (list || []).map(normalizeProduct).filter(Boolean);
}

export async function list(params) {
  const res = await window.API.products.list(params || {});
  return Object.assign({}, res, { data: normalizeProducts(res.data) });
}

export async function get(id) {
  const res = await window.API.products.get(id);
  return Object.assign({}, res, { data: res.data ? normalizeProduct(res.data) : null });
}

export async function create(product) {
  // El backend espera snake_case; pasamos lo que la vista ya construyo
  // (que es snake_case) y no transformamos.
  return window.API.products.create(product);
}

export async function update(id, product) {
  return window.API.products.update(id, product);
}

export async function remove(id) {
  return window.API.products.delete(id);
}

export async function getCategories(force) {
  if (!force && fresh(cache.categoriesAt)) return cache.categories;
  const res = await window.API.products.categories();
  const list = (res.data || []).map(function (c) {
    return typeof c === 'string' ? c : c.nombre;
  });
  cache.categories = list;
  cache.categoriesAt = Date.now();
  return list;
}

export async function getSuppliers(force) {
  if (!force && fresh(cache.suppliersAt)) return cache.suppliers;
  const res = await window.API.products.suppliers();
  cache.suppliers = res.data || [];
  cache.suppliersAt = Date.now();
  return cache.suppliers;
}

// Carga + normalizacion + cache de productos al estado global.
// Las vistas de app.js leen `state.products` directamente.
export async function loadProductsIntoState(params) {
  const res = await list(params);
  store.state.products = res.data || [];
  store.state.totalProducts = res.total || 0;
  return res;
}

// Compatibilidad con codigo heredado
if (typeof window !== 'undefined') {
  window.ServicesProducts = {
    list: list,
    get: get,
    create: create,
    update: update,
    remove: remove,
    getCategories: getCategories,
    getSuppliers: getSuppliers,
    loadIntoState: loadProductsIntoState,
    normalize: normalizeProduct
  };
  // Alias: para que las vistas en app.js que llaman `API.products.*`
  // directamente sigan funcionando, no las reasignamos. Esto es solo
  // una fachada adicional.
}
