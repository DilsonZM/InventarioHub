// Utilidades con cache para optimización de rendimiento
// Basado en: js-cache-function-results, js-cache-storage

const STORAGE_VERSION = 'v1';

// Timezone del proyecto (UTC-5)
const APP_TIMEZONE = 'America/Bogota';

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
  const result = new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: APP_TIMEZONE
  });
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
  const result = new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short',
    timeZone: APP_TIMEZONE
  });
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

function nowInAppTZ() {
  // Devuelve la fecha/hora actual en la timezone de la app (UTC-5),
  // robusta al timezone del navegador: extrae los componentes
  // directamente del timezone objetivo y construye un Date local.
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const get = (type) => (parts.find(p => p.type === type) || {}).value || '0';
  return new Date(
    parseInt(get('year'), 10),
    parseInt(get('month'), 10) - 1,
    parseInt(get('day'), 10),
    parseInt(get('hour'), 10) % 24, // 24:00 a 0
    parseInt(get('minute'), 10),
    parseInt(get('second'), 10)
  );
}

function todayInAppTZ() {
  // Devuelve un string YYYY-MM-DD con la fecha actual en la timezone de la app
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return formatter.format(now); // en-CA da formato YYYY-MM-DD
}

window.Utils = {
  APP_TIMEZONE,
  formatCurrency,
  formatDate,
  formatDateShort,
  nowInAppTZ,
  todayInAppTZ,
  saveStorage,
  loadStorage,
  clearStorage,
  debounce,
  throttle,
  escapeHtml,
};
