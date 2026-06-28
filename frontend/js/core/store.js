// core/store.js
// Estado global unico de la aplicacion. Concentra los `var` sueltos que
// antes vivian en app.js (state, categoryChart, calendarState, etc.) para
// que el resto de modulos no dependa de variables globales implicitas.
// Aun expone `window.state` para mantener compatibilidad con el codigo
// heredado de app.js durante la migracion gradual.

export const store = {
  // Estado serializable (se persiste / se renderea en vistas)
  state: {
    products: [],
    sales: [],
    categories: [],
    saleItems: [],
    dishes: [],
    saleDishItems: [],
    posItems: [],
    currentView: 'dashboard',
    user: null,
    editingSaleId: null,
    editingCompraId: null,
    editingPOSOrderId: null,
    modoPublico: false,
    activeFilters: [],
    saleType: 'productos',
    saleDirty: false,
    compraDirty: false,
    productDirty: false,
    posMesaId: null
  },

  // Estado no serializable (referencias a Chart.js, timers, caches)
  refs: {
    categoryChart: null,
    dashboardAutoRefreshId: null,
    calendar: { monthOffset: 0, start: null, end: null, picking: 'start', view: '', fromId: '', toId: '', periodId: '', callback: null }
  },

  // Datos internos del POS (cache para no recargar)
  cache: {
    posProducts: [],
    posDishes: [],
    posMesas: [],
    posAllItems: []
  },

  // Ultimo ticket generado (referencia al modal)
  ui: {
    lastTicketSale: null
  },

  listeners: new Set(),

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  set(patch) {
    Object.assign(this.state, patch);
    this.listeners.forEach((fn) => {
      try { fn(this.state); } catch (e) { console.error('[store] listener error', e); }
    });
  },

  // Helpers para acceder a refs con semantica
  setRef(key, value) { this.refs[key] = value; },
  getRef(key) { return this.refs[key]; }
};

// Compatibilidad con app.js (usa `state.products`, `state.sales`, etc. y
// `window.state` ademas). Mantenemos los nombres historicos.
if (typeof window !== 'undefined') {
  window.state = store.state;
  // Las vistas heredadas leen `state.saleItems`, `state.dishes`, etc.
  // y `state.user`, `state.currentView`. El proxy via window.state asegura
  // que `app.js` y los modulos nuevos compartan exactamente el mismo objeto.
  window.store = store;
}
