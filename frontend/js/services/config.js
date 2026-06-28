// services/config.js
// Capa de servicio para configuracion global: modo publico, impresora termica, comanda.
// A partir del Sub-paso de "Impresion Hibrida", la config de la impresora
// se guarda en la BD (tabla app_config) para que el backend pueda leerla
// al ejecutar POST /api/print.

const PRINTER_KEY = 'config:impresora'; // legacy: fallback a localStorage

// Cache en memoria de la config para no hacer fetch en cada lectura
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 5000; // 5 segundos

function getCachedConfig() {
  if (_cache && (Date.now() - _cacheTs) < CACHE_TTL) return _cache;
  return null;
}

function setCachedConfig(cfg) {
  _cache = cfg;
  _cacheTs = Date.now();
}

function invalidateCache() {
  _cache = null;
  _cacheTs = 0;
}

// ============================================================
// Config general
// ============================================================

export async function getConfig() {
  const cached = getCachedConfig();
  if (cached) return { success: true, data: cached };
  try {
    const res = await window.API.config.get();
    if (res && res.success && res.data) {
      // Normalizar campos que pueden no existir en la BD
      const cfg = {
        modoPublico: !!res.data.modoPublico,
        tituloPublico: res.data.tituloPublico || 'InventarioHub',
        printerHost: res.data.printerHost || '127.0.0.1',
        printerPort: res.data.printerPort || 9100,
        printerEnabled: !!res.data.printerEnabled,
        comandaEnabled: !!res.data.comandaEnabled,
        printerKind: res.data.printerKind || 'browser',
        posRedirectAuto: res.data.posRedirectAuto !== false
      };
      setCachedConfig(cfg);
      return { success: true, data: cfg };
    }
    return res;
  } catch (err) {
    console.warn('getConfig: usando defaults por error:', err.message);
    return {
      success: true,
      data: {
        modoPublico: false,
        tituloPublico: 'InventarioHub',
        printerHost: '127.0.0.1',
        printerPort: 9100,
        printerEnabled: false,
        comandaEnabled: false,
        printerKind: 'browser',
        posRedirectAuto: true
      }
    };
  }
}

export async function updateConfig(data) {
  invalidateCache();
  return window.API.config.update(data);
}

export async function getPublicMode() {
  const res = await getConfig();
  return !!(res.data && res.data.modoPublico);
}

export async function setPublicMode(value) {
  return updateConfig({ modoPublico: !!value });
}

// ============================================================
// Config de impresora
// ============================================================

/**
 * Devuelve la config de la impresora. Intenta primero la BD, y si falla
 * usa el fallback de localStorage (legacy).
 */
export async function getPrinterConfig() {
  try {
    const res = await getConfig();
    if (res && res.success && res.data) {
      return {
        host: res.data.printerHost || '127.0.0.1',
        port: res.data.printerPort || 9100,
        enabled: !!res.data.printerEnabled,
        comandaEnabled: !!res.data.comandaEnabled,
        kind: res.data.printerKind || 'browser'
      };
    }
  } catch (e) {
    console.warn('getPrinterConfig: usando localStorage fallback:', e.message);
  }
  // Legacy fallback
  return getPrinterConfigLocal();
}

function getPrinterConfigLocal() {
  try {
    var raw = localStorage.getItem(PRINTER_KEY);
    if (!raw) return { host: '127.0.0.1', port: 9100, enabled: false, comandaEnabled: false, kind: 'browser' };
    const obj = JSON.parse(raw);
    return {
      host: obj.host || '127.0.0.1',
      port: obj.port || 9100,
      enabled: !!obj.enabled,
      comandaEnabled: !!obj.comandaEnabled,
      kind: obj.kind || 'browser'
    };
  } catch (e) {
    return { host: '127.0.0.1', port: 9100, enabled: false, comandaEnabled: false, kind: 'browser' };
  }
}

/**
 * Guarda la config de impresora en la BD. Si la BD falla, hace fallback a localStorage.
 */
export async function setPrinterConfig(cfg) {
  invalidateCache();
  try {
    const res = await window.API.config.update({
      printerHost: cfg.host,
      printerPort: cfg.port,
      printerEnabled: !!cfg.enabled,
      comandaEnabled: !!cfg.comandaEnabled,
      printerKind: cfg.kind || 'browser'
    });
    if (res && res.success) return true;
    throw new Error(res.message || 'Error guardando config');
  } catch (e) {
    console.warn('setPrinterConfig: fallback a localStorage:', e.message);
    try {
      localStorage.setItem(PRINTER_KEY, JSON.stringify(cfg));
      return true;
    } catch (err) {
      return false;
    }
  }
}

// ============================================================
// UI helpers (compatibles con el codigo heredado)
// ============================================================

export function loadPrinterConfigUI() {
  // Carga async desde la BD
  getConfig().then((res) => {
    if (!res || !res.success || !res.data) return;
    const d = res.data;
    const hostEl = document.getElementById('printerHost');
    const portEl = document.getElementById('printerPort');
    if (hostEl) hostEl.value = d.printerHost || '127.0.0.1';
    if (portEl) portEl.value = d.printerPort || 9100;

    const enabledEl = document.getElementById('printerEnabled');
    if (enabledEl) enabledEl.checked = !!d.printerEnabled;

    const comandaEl = document.getElementById('comandaEnabled');
    if (comandaEl) comandaEl.checked = !!d.comandaEnabled;

    const kindEl = document.getElementById('printerKind');
    if (kindEl) kindEl.value = d.printerKind || 'browser';
  });
}

export function savePrinterConfigUI() {
  const hostEl = document.getElementById('printerHost');
  const portEl = document.getElementById('printerPort');
  const enabledEl = document.getElementById('printerEnabled');
  const comandaEl = document.getElementById('comandaEnabled');
  const kindEl = document.getElementById('printerKind');

  const host = (hostEl && hostEl.value || '').trim() || '127.0.0.1';
  const port = parseInt(portEl && portEl.value) || 9100;
  const enabled = !!(enabledEl && enabledEl.checked);
  const comandaEnabled = !!(comandaEl && comandaEl.checked);
  const kind = (kindEl && kindEl.value) || 'browser';

  return setPrinterConfig({ host, port, enabled, comandaEnabled, kind });
}

// Compatibilidad: window.* exposures
if (typeof window !== 'undefined') {
  window.ServicesConfig = {
    get: getConfig,
    update: updateConfig,
    getPublicMode: getPublicMode,
    setPublicMode: setPublicMode,
    getPrinterConfig: getPrinterConfig,
    setPrinterConfig: setPrinterConfig,
    loadPrinterConfigUI: loadPrinterConfigUI,
    savePrinterConfigUI: savePrinterConfigUI,
    invalidateCache: invalidateCache
  };
}
