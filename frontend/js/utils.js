// Utilidades con cache para optimización de rendimiento
// Basado en: js-cache-function-results, js-cache-storage

const STORAGE_VERSION = 'v1';

const formatCache = new Map();

function formatCurrency(n) {
  const key = `currency:${n}`;
  if (formatCache.has(key)) return formatCache.get(key);
  const num = Number(n);
  let result;
  if (Number.isFinite(num) && Number.isInteger(num)) {
    result = '$' + num.toLocaleString('en-US');
  } else {
    result = '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  formatCache.set(key, result);
  if (formatCache.size > 1000) {
    const firstKey = formatCache.keys().next().value;
    formatCache.delete(firstKey);
  }
  return result;
}

function formatDate(iso) {
  const key = `date:${iso}`;
  if (formatCache.has(key)) return formatCache.get(key);
  const result = new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  formatCache.set(key, result);
  if (formatCache.size > 1000) {
    const firstKey = formatCache.keys().next().value;
    formatCache.delete(firstKey);
  }
  return result;
}

function formatDateShort(iso) {
  const key = `dateShort:${iso}`;
  if (formatCache.has(key)) return formatCache.get(key);
  const result = new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  formatCache.set(key, result);
  return result;
}

function saveStorage(key, data) {
  try {
    localStorage.setItem(`${key}:${STORAGE_VERSION}`, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function loadStorage(key) {
  try {
    const raw = localStorage.getItem(`${key}:${STORAGE_VERSION}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearStorage(key) {
  try {
    localStorage.removeItem(`${key}:${STORAGE_VERSION}`);
  } catch {}
}

function debounce(fn, ms) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

function throttle(fn, ms) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.Utils = {
  formatCurrency,
  formatDate,
  formatDateShort,
  saveStorage,
  loadStorage,
  clearStorage,
  debounce,
  throttle,
  escapeHtml,
};
