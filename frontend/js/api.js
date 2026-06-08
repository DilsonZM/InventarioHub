const API = (() => {
  const BASE = '/api';
  const STORAGE_VERSION = 'v1';

  function getToken() {
    try {
      return localStorage.getItem(`token:${STORAGE_VERSION}`);
    } catch {
      return null;
    }
  }

  function setToken(token) {
    try {
      localStorage.setItem(`token:${STORAGE_VERSION}`, token);
    } catch {}
  }

  function setUser(user) {
    try {
      localStorage.setItem(`user:${STORAGE_VERSION}`, JSON.stringify(user));
    } catch {}
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(`user:${STORAGE_VERSION}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearAuth() {
    try {
      localStorage.removeItem(`token:${STORAGE_VERSION}`);
      localStorage.removeItem(`user:${STORAGE_VERSION}`);
    } catch {}
  }

  function isAuthenticated() {
    return !!getToken();
  }

  // request sin auth (para /api/config y login)
  async function publicRequest(endpoint, options = {}) {
    const url = `${BASE}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    try {
      const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
      const data = await res.json();
      if (!res.ok) {
        const error = new Error(data.message || 'Error del servidor');
        error.status = res.status;
        error.data = data;
        throw error;
      }
      return data;
    } catch (err) {
      throw err;
    }
  }

  async function request(endpoint, options = {}) {
    const url = `${BASE}${endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
      const data = await res.json();
      if (!res.ok) {
        const error = new Error(data.message || 'Error del servidor');
        error.status = res.status;
        error.data = data;
        throw error;
      }
      return data;
    } catch (err) {
      if (err.status === 401) {
        clearAuth();
        window.location.href = '/views/login.html';
      }
      throw err;
    }
  }

  const api = {
    getToken, setToken, setUser, getUser, clearAuth, isAuthenticated,

    auth: {
      login: (username, password) =>
        request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
      register: (username, password, role) =>
        request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, role }) }),
      me: () => request('/auth/me'),
    },

    config: {
      get: () => publicRequest('/config'),
      update: (data) => request('/config', { method: 'PUT', body: JSON.stringify(data) }),
    },

    users: {
      list: () => request('/users'),
      create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
      update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
      approve: (id, data) => request(`/users/${id}/aprobar`, { method: 'POST', body: JSON.stringify(data || {}) }),
      reject: (id, data) => request(`/users/${id}/rechazar`, { method: 'POST', body: JSON.stringify(data || {}) }),
    },

    products: {
      list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/products${qs ? '?' + qs : ''}`);
      },
      get: (id) => request(`/products/${id}`),
      create: (product) =>
        request('/products', { method: 'POST', body: JSON.stringify(product) }),
      update: (id, product) =>
        request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
      delete: (id) =>
        request(`/products/${id}`, { method: 'DELETE' }),
      categories: () => request('/products/categories/list'),
      suppliers: () => request('/products/suppliers/list'),
    },

    sales: {
      list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/sales${qs ? '?' + qs : ''}`);
      },
      get: (id) => request(`/sales/${id}`),
      create: (sale) =>
        request('/sales', { method: 'POST', body: JSON.stringify(sale) }),
      update: (id, sale) =>
        request(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(sale) }),
      delete: (id) =>
        request(`/sales/${id}`, { method: 'DELETE' }),
    },

    stats: (params = {}) => {
      var qs = new URLSearchParams(params).toString();
      return request('/stats' + (qs ? '?' + qs : ''));
    },

    compras: {
      list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/compras${qs ? '?' + qs : ''}`);
      },
      get: (id) => request(`/compras/${id}`),
      create: (compra) =>
        request('/compras', { method: 'POST', body: JSON.stringify(compra) }),
      update: (id, compra) =>
        request(`/compras/${id}`, { method: 'PUT', body: JSON.stringify(compra) }),
      delete: (id) =>
        request(`/compras/${id}`, { method: 'DELETE' }),
    },

    reportes: {
      movimientos: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/reportes/movimientos${qs ? '?' + qs : ''}`);
      },
      indicadores: () => request('/reportes/indicadores'),
    },
  };

  window.API = api;
  return api;
})();
