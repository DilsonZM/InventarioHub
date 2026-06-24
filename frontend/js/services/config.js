// services/config.js
// Capa de servicio para configuracion global (modo publico, impresora, etc).

const PRINTER_KEY = 'config:impresora';

export async function getConfig() {
  return window.API.config.get();
}

export async function updateConfig(data) {
  return window.API.config.update(data);
}

export async function getPublicMode() {
  const res = await getConfig();
  return !!(res.data && res.data.modoPublico);
}

export async function setPublicMode(value) {
  return updateConfig({ modoPublico: !!value });
}

export function getPrinterConfig() {
  try {
    var raw = localStorage.getItem(PRINTER_KEY);
    if (!raw) return { host: '127.0.0.1', port: 9100 };
    return JSON.parse(raw);
  } catch (e) {
    return { host: '127.0.0.1', port: 9100 };
  }
}

export function setPrinterConfig(cfg) {
  try {
    localStorage.setItem(PRINTER_KEY, JSON.stringify(cfg));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadPrinterConfigUI() {
  var hostEl = document.getElementById('printerHost');
  var portEl = document.getElementById('printerPort');
  if (!hostEl || !portEl) return;
  var cfg = getPrinterConfig();
  hostEl.value = cfg.host;
  portEl.value = cfg.port;
}

export function savePrinterConfigUI() {
  var hostEl = document.getElementById('printerHost');
  var portEl = document.getElementById('printerPort');
  if (!hostEl || !portEl) return false;
  var host = (hostEl.value || '').trim() || '127.0.0.1';
  var port = parseInt(portEl.value) || 9100;
  return setPrinterConfig({ host: host, port: port });
}

if (typeof window !== 'undefined') {
  window.ServicesConfig = {
    get: getConfig,
    update: updateConfig,
    getPublicMode: getPublicMode,
    setPublicMode: setPublicMode,
    getPrinterConfig: getPrinterConfig,
    setPrinterConfig: setPrinterConfig,
    loadPrinterConfigUI: loadPrinterConfigUI,
    savePrinterConfigUI: savePrinterConfigUI
  };
}
