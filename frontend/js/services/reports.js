// services/reports.js
// Capa de servicio para reportes y estadisticas (movimientos, indicadores, stats).

import { store } from '../core/store.js';

function normalizeMovimiento(m) {
  if (!m) return null;
  return {
    id: m.id,
    fecha: m.creado_en || m.fecha,
    producto: m.producto || m.producto_nombre,
    productId: m.producto_id,
    sku: m.sku,
    movimiento: m.movimiento || m.tipo, // 'entrada' / 'salida' / 'ajuste'
    tipo: m.movimiento || m.tipo,
    cantidad: m.cantidad,
    cantidad_entrada: m.cantidad_entrada || 0,
    cantidad_salida: m.cantidad_salida || 0,
    cantidad_stock: m.cantidad_stock,
    stock_anterior: m.stock_anterior,
    stock_nuevo: m.stock_nuevo,
    motivo: m.motivo,
    usuario: m.usuario || m.username
  };
}

export async function getStats(params) {
  return window.API.stats(params || {});
}

export async function getIndicadores() {
  return window.API.reportes.indicadores();
}

export async function listMovimientos(params) {
  const res = await window.API.reportes.movimientos(params || {});
  return Object.assign({}, res, { data: (res.data || []).map(normalizeMovimiento) });
}

export async function loadMovimientosIntoState(params) {
  const res = await listMovimientos(params);
  store.state.movimientos = res.data || [];
  return res;
}

if (typeof window !== 'undefined') {
  window.ServicesReports = {
    getStats: getStats,
    getIndicadores: getIndicadores,
    listMovimientos: listMovimientos,
    loadMovimientosIntoState: loadMovimientosIntoState,
    normalize: normalizeMovimiento
  };
}
