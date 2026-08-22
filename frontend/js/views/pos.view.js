import { $, escapeHtml } from '../core/dom.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal } from '../components/modal.js';
import { openDateRange, pickDate, renderCalendar, applyDateRange } from '../components/calendar.js';
import { renderTicketFromData } from '../components/ticket.js';
import { renderCategoryChart } from '../components/chart.js';
import { store } from '../core/store.js';
import { on } from '../core/events.js';

// pos.view.js
// Vista extraida de app.js en el Sub-paso 3.4 (views).
// Las delegaciones de clicks del POS (posRegisterBtn, posClearBtn)
// se registran via core/events.js al cargar este modulo.

// Persistencia del pedido en localStorage.
// El pedido sobrevive a navegaciones entre modulos y a recargas
// de pagina. Se limpia al registrar el pedido o al hacer "Limpiar".
var POS_ORDER_KEY = 'posCurrentOrder';

function persistPOSOrder() {
  try {
    if (state.posItems && state.posItems.length > 0) {
      localStorage.setItem(POS_ORDER_KEY, JSON.stringify(state.posItems));
    } else {
      localStorage.removeItem(POS_ORDER_KEY);
    }
  } catch (e) { /* localStorage no disponible */ }
}

function restorePOSOrder() {
  try {
    var raw = localStorage.getItem(POS_ORDER_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

async function loadPOS() {
  console.log('[POS] Cargando vista POS...');
  // Restaurar pedido persistido (si existe). Pero si venimos a editar
  // un pedido existente, no queremos restaurar el localStorage.
  var editingId = state.editingPOSOrderId;
  if (editingId) {
    state.posItems = [];
    state.posMesaId = null;
    try { localStorage.removeItem(POS_ORDER_KEY); } catch (e) {}
  } else {
    state.posItems = restorePOSOrder();
    state.posMesaId = null;
  }

  var allProducts = [];
  var allDishes = [];
  var mesas = [];

  try {
    var res = await API.products.list();
    allProducts = (res.data || []).filter(function (p) { return p.activo !== false && p.stock > 0; });
  } catch (e) { console.error('[POS] Error products:', e); }

  try {
    var res = await API.dishes.list();
    allDishes = (res.data || []).filter(function (d) { return d.activo; });
  } catch (e) { console.error('[POS] Error dishes:', e); }

  try {
    var res = await API.mesas.list();
    mesas = (res.data || []).filter(function (m) { return m.activa; });
  } catch (e) { console.error('[POS] Error mesas:', e); }

  console.log('[POS] Products:', allProducts.length, 'Dishes:', allDishes.length, 'Mesas:', mesas.length);

  state._posProducts = allProducts;
  state._posDishes = allDishes;
  state._posMesas = mesas;

  renderPOSCategories(allDishes, allProducts);
  renderPOSMesas(mesas);

  // Si venimos a editar un pedido, cargarlo ANTES de renderizar la orden
  if (editingId) {
    state._editingSale = null;
    try {
      var saleRes = await API.sales.get(editingId);
      var sale = saleRes.data;
      if (sale) {
        state.posItems = (sale.items || []).map(function (it) {
          var base = allProducts.find(function (p) { return p.id === (it.productId); });
          var dish = allDishes.find(function (d) { return d.id === (it.platoId); });
          if (it.platoId && dish) {
            return { id: dish.id, type: 'dish', name: dish.nombre || it.productName, price: dish.precio_venta || it.unitPrice, qty: it.quantity, platoId: dish.id, observacion: it.observacion || null };
          }
          if (it.productId && base) {
            return { id: base.id, type: 'product', name: base.name || it.productName, qty: it.quantity, unidad: base.unidad || 'unidad', observacion: it.observacion || null };
          }
          // Fallback: producto o plato que ya no existe activo
          return { id: it.productId || it.platoId || it.id, type: it.platoId ? 'dish' : 'product', name: it.productName, qty: it.quantity, price: it.unitPrice, platoId: it.platoId, observacion: it.observacion || null };
        });
        state._editingSale = sale;
        if (sale.mesaId) {
          var mSel = $('#posMesa');
          if (mSel) mSel.value = sale.mesaId;
          state.posMode = 'mesa';
        } else if (sale.paymentMethod === 'domicilio') {
          var mSel2 = $('#posMesa');
          if (mSel2) mSel2.value = '__domicilio__';
          state.posMode = 'domicilio';
        } else if (sale.paymentMethod === 'recogido') {
          var mSel3 = $('#posMesa');
          if (mSel3) mSel3.value = '__recogido__';
          state.posMode = 'recogido';
        }
        // Actualizar boton
        var btn = $('#posRegisterBtn');
        var btnText = $('#posRegisterText');
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'Actualizar Pedido';

        // Cargar campos financieros del pedido original
        var domEl = document.getElementById('posCostoDomicilio');
        var domDisplay = document.getElementById('posCostoDomicilioDisplay');
        var propEl = document.getElementById('posPropina');
        var bonoEl = document.getElementById('posBonoDescuento');
        var formaEl = document.getElementById('posFormaPago');
        if (domEl && sale.costoDomicilio) {
          domEl.value = sale.costoDomicilio;
          if (domDisplay) domDisplay.value = '$' + parseInt(sale.costoDomicilio).toLocaleString('es-CO');
        }
        if (propEl && sale.propina) propEl.value = sale.propina;
        // Cargar campos de domicilio si la venta editada era a domicilio
        if (sale.paymentMethod === 'domicilio') {
          var cliEl = document.getElementById('posClienteDomicilio');
          var dirEl = document.getElementById('posDireccionEntrega');
          var barEl = document.getElementById('posBarrioEntrega');
          var telEl = document.getElementById('posTelefonoDomicilio');
          if (cliEl && sale.clienteNombre) cliEl.value = sale.clienteNombre;
          if (dirEl && sale.direccionEntrega) dirEl.value = sale.direccionEntrega;
          if (barEl && sale.barrioEntrega) barEl.value = sale.barrioEntrega;
          // cliente_documento guarda el telefono en ventas (mismo patron que reservas)
          if (telEl && sale.cliente_documento) telEl.value = sale.cliente_documento;
        }
        if (bonoEl && sale.bonoDescuento) bonoEl.value = sale.bonoDescuento;
        if (formaEl && sale.formaPago) formaEl.value = sale.formaPago;
      }
    } catch (e) { console.error('[POS] Error loading sale for edit:', e); }
    state.editingPOSOrderId = null;
  }

  renderPOSOrder();

  // Configurar modo (mesa/domicilio/recoger)
  initPOSMode();

  // Configurar campos financieros (domicilio, propina, bono, forma_pago)
  initPOSFinanzas();

  // Re-marcar como seleccionadas las cards que ya estan en el pedido
  // (para que el check verde reaparezca al volver al POS).
  if (state.posItems.length > 0) {
    var keys = state.posItems.map(function (i) { return i.id + ':' + i.type; });
    var cards = document.querySelectorAll('.pos-card');
    cards.forEach(function (card) {
      var key = card.dataset.posId + ':' + card.dataset.posSource;
      if (keys.indexOf(key) !== -1) card.classList.add('pos-card--selected');
    });
  }

  console.log('[POS] Vista POS renderizada');
}

function renderPOSCategories(dishes, products) {
  var container = $('#posCategories');
  if (!container) return;

  // Fusionar platos, bebidas y productos en un solo array
  var allItems = [];
  dishes.forEach(function (d) {
    var efectivo = d.precio_efectivo || d.precio_venta || 0;
    var tieneDescuento = d.descuento_pct > 0 && d.precio_efectivo && d.precio_efectivo !== d.precio_venta;
    allItems.push({
      id: d.id,
      name: d.nombre,
      price: efectivo,
      originalPrice: tieneDescuento ? (d.precio_venta || 0) : null,
      descuentoPct: tieneDescuento ? d.descuento_pct : null,
      icon: d.icono || (d.tipo === 'bebida' ? '🥤' : '🍽️'),
      type: d.tipo,
      source: 'dish',
      desc: d.descripcion || '',
      maxPorciones: d.max_porciones !== undefined ? d.max_porciones : 999,
      disponible: d.disponible,
      faltantes: d.faltantes || []
    });
  });
  products.forEach(function (p) {
    allItems.push({
      id: p.id,
      name: p.name,
      price: p.price || 0,
      icon: p.icono || '📦',
      type: 'producto',
      source: 'product',
      desc: p.unidad || ''
    });
  });

  // Cache para el filtro
  state._posAllItems = allItems;

  renderPOSGrid(allItems);

  // Pill click handlers — solo toggleo de clase; el color/animacion
  // los maneja CSS (ver .pos-pill y .pos-pill--active en main.css).
  var pills = $$('.pos-pill');
  pills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      pills.forEach(function (p) { p.classList.remove('pos-pill--active'); });
      this.classList.add('pos-pill--active');
      var filter = this.dataset.filter;
      applyPOSFilter(filter);
    });
  });

  // Search handler
  var searchInput = $('#posSearch');
  if (searchInput) {
    searchInput.removeEventListener('input', posSearchHandler);
    searchInput.addEventListener('input', posSearchHandler);
  }
}

function renderPOSGrid(items) {
  var container = $('#posCategories');
  var html = '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">';

  items.forEach(function (item) {
    var desc = item.desc ? '<p class="text-xs text-slate-400 truncate mt-1">' + escapeHtml(item.desc) + '</p>' : '';
    var sinStock = item.source === 'dish' && item.maxPorciones === 0;
    var stockBajo = item.source === 'dish' && item.maxPorciones > 0 && item.maxPorciones < 5;
    var stockBadge = '';
    if (item.source === 'dish') {
      if (sinStock) {
        stockBadge = '<span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Sin stock</span>';
      } else if (stockBajo) {
        stockBadge = '<span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Solo ' + item.maxPorciones + ' porc.</span>';
      } else {
        stockBadge = '<span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">Disponible</span>';
      }
    }

    html += '<div class="pos-card bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-shadow overflow-hidden' + (sinStock ? ' opacity-60' : '') + '"'
      + ' data-pos-type="' + item.type + '"'
      + ' data-pos-id="' + item.id + '"'
      + ' data-pos-source="' + item.source + '"'
      + ' data-pos-name="' + escapeHtml(item.name) + '"'
      + ' data-pos-icon="' + escapeHtml(item.icon || '📦') + '"'
      + (item.source === 'dish' ? ' data-pos-maxp="' + item.maxPorciones + '"' : '')
      + ' data-pos-sinstock="' + (sinStock ? '1' : '0') + '"'
      + ' ondblclick="window.addPOSItem(\'' + item.id + '\', \'' + item.source + '\')">'
      + '<div class="aspect-video bg-slate-100 flex items-center justify-center text-4xl relative">' + (item.icon || '📦') + '</div>'
      + '<div class="p-3">'
      + '<p class="pos-card-name text-sm font-bold text-slate-800 truncate">' + escapeHtml(item.name) + '</p>'
      + desc
      + (item.originalPrice
        ? '<p class="mt-2"><span class="text-xs text-slate-400 line-through">' + Utils.formatCurrency(item.originalPrice) + '</span> <span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 ml-1 align-top">-' + item.descuentoPct + '%</span></p>'
          + '<p class="pos-card-price text-md font-bold text-amber-600">' + Utils.formatCurrency(item.price) + '</p>'
        : '<p class="pos-card-price text-md font-bold text-brand-600 mt-2">' + Utils.formatCurrency(item.price) + '</p>')
      + '<div class="mt-1.5">' + stockBadge + '</div>'
      + '</div>'
      + '</div>';
  });

  html += '</div>';
  container.innerHTML = html;

  // Single click: agregar con animacion fly-to-order.
  // Doble click: comportamiento original (compatibilidad).
  var cards = container.querySelectorAll('.pos-card');
  cards.forEach(function (card) {
    card.addEventListener('click', function (e) {
      // Si el doble click se dispara, evitar el click sintetico.
      if (card.dataset.suppressClick === '1') {
        card.dataset.suppressClick = '0';
        return;
      }
      var id = card.dataset.posId;
      var source = card.dataset.posSource;
      window.addPOSItemAnimated(card, id, source);
    });
    card.addEventListener('dblclick', function () {
      card.dataset.suppressClick = '1';
      setTimeout(function () { card.dataset.suppressClick = '0'; }, 350);
    });
  });
}

function renderPOSOrder() {
  var container = $('#posOrderItems');
  var total = 0;
  var btn = $('#posRegisterBtn');
  var btnText = $('#posRegisterText');

  // Mobile FAB
  var fab = $('#posMobileFab');
  var fabCount = $('#posMobileFabCount');
  var count = state.posItems.reduce(function (sum, i) { return sum + i.qty; }, 0);

  if (fab) {
    fab.classList.toggle('hidden', count === 0);
    if (fabCount) fabCount.textContent = count;
  }

  if (state.posItems.length === 0) {
    // Limpiar cualquier card marcada como seleccionada
    var sel = document.querySelectorAll('.pos-card--selected');
    sel.forEach(function (el) { el.classList.remove('pos-card--selected'); });
    container.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">Toca un producto para agregarlo</p>';
    $('#posTotal').textContent = '$0';
    if (btn) { btn.disabled = true; if (btnText) btnText.textContent = 'Agrega productos'; }
    // Limpiar pedido persistido: el array esta vacio.
    try { localStorage.removeItem('posCurrentOrder'); } catch (e) { /* noop */ }
    return;
  }

  var html = '';
  state.posItems.forEach(function (item, idx) {
    var sub = item.price * item.qty;
    total += sub;
    var obsIcon = item.observacion
      ? '<span class="text-amber-500 ml-1" title="' + escapeHtml(item.observacion) + '">📝</span>'
      : '';
    html += '<div class="flex items-center gap-2 py-2 border-b border-slate-100">'
      + '<div class="flex-1 min-w-0">'
      + '<p class="text-sm font-medium text-slate-800 truncate">' + escapeHtml(item.name) + obsIcon + '</p>'
      + '<p class="text-xs text-slate-500">' + Utils.formatCurrency(item.price) + ' c/u</p>'
      + '</div>'
      + '<div class="flex items-center gap-1">'
      + '<button class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm" onclick="window.updatePOSQty(' + idx + ', -1)">-</button>'
      + '<span class="w-7 text-center text-sm font-semibold">' + item.qty + '</span>'
      + '<button class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm" onclick="window.updatePOSQty(' + idx + ', 1)">+</button>'
      + '</div>'
      + '<button class="pos-note-btn p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" onclick="window.editPOSObservacion(' + idx + ')" title="Observacion" aria-label="Observacion">'
      + '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>'
      + '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>'
      + '</svg>'
      + '</button>'
      + '<button class="pos-remove-item-btn p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" onclick="window.removePOSItem(' + idx + ')" title="Quitar del pedido" aria-label="Quitar del pedido">'
      + '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<polyline points="3 6 5 6 21 6"></polyline>'
      + '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>'
      + '<path d="M10 11v6M14 11v6"></path>'
      + '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>'
      + '</svg>'
      + '</button>'
      + '</div>';
  });

  container.innerHTML = html;
  $('#posTotal').textContent = Utils.formatCurrency(total);
  if (btn) { btn.disabled = false; if (btnText) btnText.textContent = 'Registrar Pedido'; }

  // Actualizar total final con campos financieros
  updatePOSTotalFinal();

  // Persistir el pedido actual para que sobreviva a navegaciones.
  persistPOSOrder();
}

function renderPOSMesas(mesas) {
  var sel = $('#posMesa');
  if (!sel) return;
  sel.innerHTML = ''
    + mesas.map(function (m) {
      return '<option value="' + m.id + '" data-tipo="mesa">' + escapeHtml(m.nombre) + '</option>';
    }).join('')
    + '<option disabled>──────────</option>'
    + '<option value="__domicilio__" data-tipo="domicilio">🛵 Domicilio</option>'
    + '<option value="__recogido__" data-tipo="recogido">🏠 Para recoger</option>';
}

function initPOSMode() {
  var sel = $('#posMesa');
  if (sel) {
    sel.addEventListener('change', function () {
      var opt = sel.options[sel.selectedIndex];
      var tipo = opt ? opt.getAttribute('data-tipo') || 'mesa' : 'mesa';
      state.posMode = tipo;
      updatePOSModeBadge();
      // Forzar mostrar/ocultar domicilio directamente (fallback robusto)
      var domRow = document.getElementById('posDomicilioRow');
      if (domRow) {
        if (tipo === 'domicilio') {
          domRow.style.display = 'block';
          var details = document.getElementById('posFinanzas');
          if (details) details.setAttribute('open', '');
          var domHidden = document.getElementById('posCostoDomicilio');
          var domDisplay = document.getElementById('posCostoDomicilioDisplay');
          if (domHidden && domDisplay && !domDisplay.value) {
            domDisplay.value = '$' + parseInt(domHidden.value || 3000).toLocaleString('es-CO');
          }
          updatePOSTotalFinal();
        } else {
          domRow.style.display = 'none';
        }
      }
    });
  }
  state.posMode = state.posMode || 'mesa';
  updatePOSModeBadge();
}

function setPOSMode(mode) {
  state.posMode = mode;
  var sel = $('#posMesa');
  if (sel) {
    if (mode === 'domicilio') sel.value = '__domicilio__';
    else if (mode === 'recogido') sel.value = '__recogido__';
    else sel.value = '';
  }
  updatePOSModeBadge();
}

function updatePOSModeBadge() {
  var el = document.getElementById('posModeBadge');
  if (!el) return;
  var labels = { mesa: 'Mesa', domicilio: '🛵 Domicilio', recogido: '🏠 Recoger' };
  el.textContent = labels[state.posMode || 'mesa'] || 'Mesa';
  // Mostrar/ocultar campo costo domicilio segun modo (uso getElementById directo)
  var domRow = document.getElementById('posDomicilioRow');
  if (domRow) {
    if (state.posMode === 'domicilio') {
      domRow.style.display = 'block';
      var details = document.getElementById('posFinanzas');
      if (details) details.setAttribute('open', '');
      var domHidden = document.getElementById('posCostoDomicilio');
      var domDisplay = document.getElementById('posCostoDomicilioDisplay');
      if (domHidden && domDisplay && !domDisplay.value) {
        domDisplay.value = '$' + parseInt(domHidden.value || 3000).toLocaleString('es-CO');
      }
      updatePOSTotalFinal();
    } else {
      domRow.style.display = 'none';
    }
  }
}

// ============================================
// Campos financieros del POS
// ============================================
function initPOSFinanzas() {
  var inputs = ['posCostoDomicilio', 'posPropina', 'posBonoDescuento'];
  inputs.forEach(function (id) {
    var el = document.getElementById(id);
    if (el && !el._finanzasWired) {
      el._finanzasWired = true;
      el.addEventListener('input', function () {
        // Marcar que el usuario edito manualmente la propina
        if (id === 'posPropina') el._userEdited = true;
        updatePOSTotalFinal();
      });
    }
  });

  // Wire domicilio con formato de pesos colombianos
  var domDisplay = document.getElementById('posCostoDomicilioDisplay');
  if (domDisplay) {
    domDisplay.addEventListener('input', function () {
      var raw = this.value.replace(/[^0-9]/g, '');
      var num = parseInt(raw, 10) || 0;
      document.getElementById('posCostoDomicilio').value = num;
      this.value = num > 0 ? '$' + num.toLocaleString('es-CO') : '';
      updatePOSTotalFinal();
    });
    domDisplay.addEventListener('focus', function () {
      var num = parseInt(document.getElementById('posCostoDomicilio').value, 10) || 0;
      this.value = num > 0 ? String(num) : '';
    });
    domDisplay.addEventListener('blur', function () {
      var num = parseInt(document.getElementById('posCostoDomicilio').value, 10) || 0;
      this.value = num > 0 ? '$' + num.toLocaleString('es-CO') : '';
    });
  }

  updatePOSTotalFinal();
}

function getPOSFinanzas() {
  var dom = parseFloat((document.getElementById('posCostoDomicilio') || {}).value) || 0;
  var prop = parseFloat((document.getElementById('posPropina') || {}).value) || 0;
  var bono = parseFloat((document.getElementById('posBonoDescuento') || {}).value) || 0;
  return { costoDomicilio: dom, propina: prop, bonoDescuento: bono };
}

function updatePOSTotalFinal() {
  var subtotal = 0;
  state.posItems.forEach(function (item) { subtotal += (item.price || 0) * item.qty; });

  // Auto-calcular propina al 10% del subtotal (el usuario puede editarla)
  var propinaEl = document.getElementById('posPropina');
  if (propinaEl && subtotal > 0) {
    var autoPropina = Math.round(subtotal * 0.10);
    // Solo auto-rellenar si el campo esta vacio o si el usuario no lo ha editado manualmente
    if (!propinaEl._userEdited) {
      propinaEl.value = autoPropina;
    }
  }

  var fin = getPOSFinanzas();
  var total = subtotal + fin.costoDomicilio - fin.bonoDescuento + fin.propina;
  var row = document.getElementById('posTotalFinal');
  var val = document.getElementById('posTotalFinalValue');
  var hasExtras = fin.costoDomicilio > 0 || fin.propina > 0 || fin.bonoDescuento > 0;
  if (row && val) {
    if (hasExtras && state.posItems.length > 0) {
      row.classList.remove('hidden');
      val.textContent = Utils.formatCurrency(total);
    } else {
      row.classList.add('hidden');
    }
  }
}

function resetPOSFinanzas() {
  ['posCostoDomicilio', 'posPropina', 'posBonoDescuento'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.value = ''; el._userEdited = false; }
  });
  var domDisplay = document.getElementById('posCostoDomicilioDisplay');
  if (domDisplay) domDisplay.value = '';
  var fp = document.getElementById('posFormaPago');
  if (fp) fp.value = '';
  // Limpiar campos de domicilio (cliente, direccion, barrio, telefono)
  ['posClienteDomicilio', 'posDireccionEntrega', 'posBarrioEntrega', 'posTelefonoDomicilio'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  updatePOSTotalFinal();
}

function applyPOSFilter(filter) {
  state._posFilter = filter;
  refreshPOSVisibility();
}

function refreshPOSVisibility() {
  var filter = state._posFilter || 'todos';
  var searchQ = ($('#posSearch') ? ($('#posSearch').value || '').toLowerCase().trim() : '');

  var cards = $$('.pos-card');
  var visibleCount = 0;
  cards.forEach(function (card) {
    var typeMatch = filter === 'todos' || card.dataset.posType === filter;
    var searchMatch = !searchQ || (card.textContent || '').toLowerCase().includes(searchQ);
    var show = typeMatch && searchMatch;
    card.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });

  // Mostrar mensaje si la categoria esta vacia
  var emptyMsg = $('#posEmptyMsg');
  if (emptyMsg) {
    emptyMsg.style.display = visibleCount === 0 ? '' : 'none';
    if (filter !== 'todos') {
      var labels = { plato: 'Platos', bebida: 'Bebidas', producto: 'Ingredientes' };
      emptyMsg.textContent = 'No hay ' + (labels[filter] || 'productos') + ' disponibles';
    } else if (searchQ) {
      emptyMsg.textContent = 'Sin resultados para "' + searchQ + '"';
    } else {
      emptyMsg.textContent = 'No hay productos disponibles';
    }
  }
}

function posSearchHandler() {
  refreshPOSVisibility();
}

async function submitPOSOrder() {
  if (state.posItems.length === 0) return;

  var editingSale = state._editingSale;
  var sel = $('#posMesa');
  var selectedOpt = sel ? sel.options[sel.selectedIndex] : null;
  var mode = selectedOpt ? (selectedOpt.getAttribute('data-tipo') || 'mesa') : 'mesa';
  var mesaId = null;
  if (mode === 'mesa' && sel) mesaId = sel.value;

  if (mode === 'mesa' && !mesaId) {
    showToast('Selecciona una mesa o elige Domicilio / Recoger', 'warning');
    return;
  }

  // Validacion de domicilio: nombre, direccion y telefono son obligatorios.
  var domicilioData = null;
  if (mode === 'domicilio') {
    var cli = (document.getElementById('posClienteDomicilio') || {}).value || '';
    var dir = (document.getElementById('posDireccionEntrega') || {}).value || '';
    var bar = (document.getElementById('posBarrioEntrega') || {}).value || '';
    var tel = (document.getElementById('posTelefonoDomicilio') || {}).value || '';
    if (!cli.trim() || cli.trim().length < 2) {
      showToast('Ingresa el nombre del cliente para el domicilio', 'warning');
      return;
    }
    if (dir.trim().length < 5) {
      showToast('La direccion de entrega es obligatoria para domicilios', 'warning');
      return;
    }
    if (!tel.trim() || tel.trim().length < 7) {
      showToast('Ingresa un telefono de contacto valido para el domicilio', 'warning');
      return;
    }
    domicilioData = {
      clienteNombre: cli.trim(),
      direccionEntrega: dir.trim(),
      barrioEntrega: bar.trim(),
      telefono: tel.trim()
    };
  }

  var btn = $('#posRegisterBtn');
  var btnText = $('#posRegisterText');
  if (btn) { btn.disabled = true; if (btnText) btnText.textContent = 'Procesando...'; }

  var platos = [];
  var items = [];

  state.posItems.forEach(function (item) {
    if (item.type === 'dish') {
      platos.push({
        plato_id: item.platoId,
        cantidad: item.qty,
        precioUnitario: item.price,
        observacion: item.observacion || null
      });
    } else {
      items.push({
        productId: item.id,
        quantity: item.qty,
        observacion: item.observacion || null
      });
    }
  });

  var fin = getPOSFinanzas();
  var mesaId = $('#posMesa').value || null;
  var payload = {
    paymentMethod: mode === 'mesa' ? 'cocina' : mode,
    mesa_id: mode === 'mesa' ? mesaId : null,
    platos: platos.length > 0 ? platos : undefined,
    items: items.length > 0 ? items : undefined,
    costoDomicilio: fin.costoDomicilio,
    propina: fin.propina,
    bonoDescuento: fin.bonoDescuento
    // formaPago NO se envia: se captura al final, al editar el pedido
  };
  if (domicilioData) {
    payload.clienteNombre = domicilioData.clienteNombre;
    payload.direccionEntrega = domicilioData.direccionEntrega;
    payload.barrioEntrega = domicilioData.barrioEntrega;
    payload.cliente_documento = domicilioData.telefono;
  }

  // Loading overlay con animacion energetica.
  // Muestra 3 pasos visuales para que el usuario vea que el sistema
  // esta trabajando: procesando -> generando -> imprimiendo (opcional).
  var step = 0;
  var steps = ['Procesando pedido...', 'Generando ticket...', 'Enviando a cocina...'];
  var showLoading = function () {
    if (typeof Swal === 'undefined') return null;
    return Swal.fire({
      title: steps[step],
      html: '<div class="pos-loading"><div class="pos-loading-ring"></div>'
        + '<div class="pos-loading-dots"><span></span><span></span><span></span></div></div>',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      backdrop: 'rgba(15, 23, 42, 0.55)',
      customClass: { popup: 'pos-loading-popup', title: 'pos-loading-title' }
    });
  };
  var advance = function () {
    step = Math.min(step + 1, steps.length - 1);
    if (typeof Swal === 'undefined') return;
    var titleEl = document.querySelector('.swal2-title');
    if (titleEl) titleEl.textContent = steps[step];
  };
  var hideLoading = function () {
    if (typeof Swal !== 'undefined') Swal.close();
  };

  showLoading();

  try {
    // Paso 1: ya estamos en "Procesando pedido..." — el await del create
    //         cubre la fase de validacion/registro en el backend.
    var res;
    if (editingSale) {
      res = await API.sales.update(editingSale.id, payload);
    } else {
      res = await API.sales.create(payload);
    }

    if (res.success) {
      // Paso 2: ticket generado
      advance();

      state.posItems = [];
      state._editingSale = null;
      // Limpiar pedido persistido al registrar con exito.
      try { localStorage.removeItem(POS_ORDER_KEY); } catch (e) { /* noop */ }
      state._lastTicketSale = res.data;
      resetPOSFinanzas();
      renderPOSOrder();
      renderTicketFromData(res.data, false);

      // Configurar visibilidad de botones del modal segun printer_kind
      try {
        if (typeof configureTicketButtons === 'function') {
          setTimeout(configureTicketButtons, 50);
        }
      } catch (e) { /* noop */ }

      // Paso 3: comanda a cocina (SIEMPRE activa)
      var sendsComanda = false;
      var posAutoRedirect = true;
      try {
        var cfg = await window.ServicesConfig.get();
        posAutoRedirect = cfg.data.posRedirectAuto !== false;
        // Comanda siempre se envia, sin importar config
        advance();
        sendsComanda = true;
        printThermalKitchen(res.data);
      } catch (e) {
        console.warn('No se pudo verificar comanda_enabled:', e.message);
        // Fallback: enviar comanda igual
        advance();
        sendsComanda = true;
        printThermalKitchen(res.data);
      }

      // Cerrar loading y mostrar exito
      setTimeout(function () {
        hideLoading();
        showToast(editingSale ? 'Pedido actualizado' : 'Pedido registrado correctamente', 'success');
        if (editingSale) { renderPOSCategories(state._posDishes, state._posProducts); }
        if (!editingSale && posAutoRedirect) location.hash = '#sales';
      }, sendsComanda ? 800 : 500);
    } else {
      hideLoading();
      showToast(res.message || 'Error al registrar', 'error');
    }
  } catch (err) {
    hideLoading();
    showToast(err.message || 'Error al registrar', 'error');
  }

  if (btn) { btn.disabled = false; if (btnText) btnText.textContent = editingSale ? 'Actualizar Pedido' : 'Registrar Pedido'; }
}



// Handlers expuestos en window (compatibilidad con onclick inline)
window.addPOSItem = function (id, type) {
  // Buscar en cache
  var item;
  if (type === 'dish') {
    item = (state._posDishes || []).find(function (d) { return d.id === id; });
  } else {
    item = (state._posProducts || []).find(function (p) { return p.id === id; });
  }
  if (!item) return;

  // Validar max_porciones para platos
  if (type === 'dish' && item.max_porciones !== undefined && item.max_porciones < 999) {
    var existing = state.posItems.find(function (i) { return i.id === id && i.type === type; });
    var currentQty = existing ? existing.qty : 0;
    if (currentQty >= item.max_porciones) {
      showToast('Solo hay stock para ' + item.max_porciones + ' ' + item.nombre + '. Ya tienes ' + currentQty + ' en el pedido.', 'warning');
      return;
    }
  }

  var name = item.nombre || item.name;
  var price = (type === 'dish') ? (item.precio_venta || 0) : (item.price || 0);

  // Buscar si ya existe en el pedido
  var existing = state.posItems.find(function (i) { return i.id === id && i.type === type; });
  if (existing) {
    existing.qty += 1;
  } else {
    state.posItems.push({
      id: id,
      type: type,
      name: name,
      price: price,
      qty: 1,
      platoId: type === 'dish' ? id : null
    });
  }

  // Marcar la card correspondiente como seleccionada (check verde)
  // para que el usuario tenga feedback visual de que se agrego.
  var key = id + ':' + type;
  var cards = document.querySelectorAll('.pos-card');
  cards.forEach(function (card) {
    if ((card.dataset.posId + ':' + card.dataset.posSource) === key) {
      card.classList.add('pos-card--selected');
    }
  });

  renderPOSOrder();
}

// addPOSItemAnimated: igual que addPOSItem pero dispara la animacion
// "fly to order" desde la card clickeada hasta el panel de pedido
// (desktop) o el FAB del carrito (mobile). El unico movimiento visible
// es el ghost volando: ni la card se hunde ni el destino pulsa.
//
// Implementacion: Web Animations API (element.animate). Esto evita
// el problema de que un `transform` inline en el siguiente frame
// anule la animacion CSS, y permite interpolar translate + scale +
// rotate de forma suave desde la posicion de la card hasta el destino.
window.addPOSItemAnimated = function (cardEl, id, type) {
  if (!cardEl) { window.addPOSItem(id, type); return; }

  // 1) Crear el ghost en la posicion exacta de la card.
  try {
    var rect = cardEl.getBoundingClientRect();
    var ghost = document.createElement('div');
    ghost.className = 'pos-fly-ghost';
    var icon = cardEl.dataset.posIcon || '🛒';
    ghost.innerHTML = '<span style="font-size:18px;line-height:1;">' + icon + '</span>';
    // Posicionar el ghost exactamente encima de la card.
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.transform = 'translate(0, 0) scale(1) rotate(0deg)';
    ghost.style.opacity = '1';
    document.body.appendChild(ghost);

    // 2) Calcular destino (panel en desktop, FAB en mobile).
    var isMobile = window.innerWidth < 1024;
    var dest = isMobile ? document.getElementById('posMobileFab') : document.getElementById('posOrderPanel');
    if (dest) {
      var dRect = dest.getBoundingClientRect();
      var dx = (dRect.left + dRect.width / 2) - (rect.left + rect.width / 2);
      var dy = (dRect.top + dRect.height / 2) - (rect.top + rect.height / 2);

      // 3) Animar con Web Animations API: un solo keyframe que va
      //    desde la posicion inicial (translate 0) hasta el destino.
      if (ghost.animate) {
        ghost.animate(
          [
            { transform: 'translate(0, 0) scale(1) rotate(0deg)',     opacity: 1,    offset: 0   },
            { transform: 'translate(' + (dx * 0.6) + 'px, ' + (dy * 0.6) + 'px) scale(0.7) rotate(-6deg)', opacity: 0.95, offset: 0.5 },
            { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(0.2) rotate(-18deg)', opacity: 0,    offset: 1   }
          ],
          {
            duration: 550,
            easing: 'cubic-bezier(0.55, 0.05, 0.4, 1)',
            fill: 'forwards'
          }
        ).onfinish = function () {
          if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        };
      } else {
        // Fallback para navegadores sin Web Animations API.
        var start = null;
        function step(ts) {
          if (!start) start = ts;
          var t = Math.min((ts - start) / 550, 1);
          // ease-in-out cubic
          var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          var x = dx * e;
          var y = dy * e;
          var s = 1 - 0.8 * e;
          var r = -18 * e;
          ghost.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + s + ') rotate(' + r + 'deg)';
          ghost.style.opacity = String(1 - e);
          if (t < 1) requestAnimationFrame(step);
          else if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        }
        requestAnimationFrame(step);
      }
    } else {
      // Sin destino visible: quitar el ghost a los 300ms.
      setTimeout(function () {
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      }, 300);
    }
  } catch (e) { /* noop */ }

  // 4) Agregar al pedido (esto actualiza el panel/FAB sin animacion
  //    extra: solo aparece el item con la transicion existente).
  window.addPOSItem(id, type);
};

window.removePOSItem = function (idx) {
  var item = state.posItems[idx];
  state.posItems.splice(idx, 1);
  // Quitar el check verde de la card correspondiente (si existe)
  if (item) {
    var key = item.id + ':' + (item.type === 'dish' ? 'dish' : 'product');
    var cards = document.querySelectorAll('.pos-card');
    cards.forEach(function (card) {
      if ((card.dataset.posId + ':' + card.dataset.posSource) === key) {
        card.classList.remove('pos-card--selected');
      }
    });
  }
  renderPOSOrder();
}

// clearPOSOrder: vacia el pedido por completo. Usado por el handler
// de "Limpiar pedido" despues de la confirmacion del usuario.
window.clearPOSOrder = function () {
  state.posItems = [];
  state._editingSale = null;
  // Quitar TODAS las cards seleccionadas (porque el pedido se vacio)
  var sel = document.querySelectorAll('.pos-card--selected');
  sel.forEach(function (el) { el.classList.remove('pos-card--selected'); });
  // Limpiar persistencia
  try { localStorage.removeItem('posCurrentOrder'); } catch (e) { /* noop */ }
  // Resetear boton
  var btn = $('#posRegisterBtn');
  var btnText = $('#posRegisterText');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Agrega productos';
  renderPOSOrder();
  if (typeof showToast === 'function') showToast('Pedido limpiado');
};

window.updatePOSQty = function (idx, delta) {
  var item = state.posItems[idx];
  if (!item) return;
  // Validar max_porciones para platos al incrementar
  if (delta > 0 && item.type === 'dish') {
    var dish = (state._posDishes || []).find(function (d) { return d.id === item.id; });
    if (dish && dish.max_porciones !== undefined && dish.max_porciones < 999) {
      if (item.qty >= dish.max_porciones) {
        showToast('Solo hay stock para ' + dish.max_porciones + ' ' + (dish.nombre || item.name) + '. Ya tienes ' + item.qty + ' en el pedido.', 'warning');
        return;
      }
    }
  }
  item.qty += delta;
  if (item.qty <= 0) {
    state.posItems.splice(idx, 1);
    // Quitar el check verde de la card correspondiente
    var key = item.id + ':' + (item.type === 'dish' ? 'dish' : 'product');
    var cards = document.querySelectorAll('.pos-card');
    cards.forEach(function (card) {
      if ((card.dataset.posId + ':' + card.dataset.posSource) === key) {
        card.classList.remove('pos-card--selected');
      }
    });
  }
  renderPOSOrder();
}

// editPOSObservacion: abre un prompt para añadir/editar la observacion
// de un item del pedido (ej. "sin cebolla", "termino medio", etc.)
window.editPOSObservacion = function (idx) {
  var item = state.posItems[idx];
  if (!item) return;
  var current = item.observacion || '';
  var obs = prompt('Observacion para "' + item.name + '":', current);
  if (obs === null) return; // cancelado
  item.observacion = obs.trim() || null;
  renderPOSOrder();
  persistPOSOrder();
}

window.openPOS = function () {
  location.hash = '#pos';
}

window.openPOSOrder = function () {
  var panel = $('#posOrderPanel');
  if (panel) {
    panel.classList.remove('hidden');
    panel.classList.add('fixed', 'inset-0', 'z-40');
    panel.classList.remove('lg:flex');
  }
}

window.closePOSOrder = function () {
  var panel = $('#posOrderPanel');
  if (panel) {
    if (window.innerWidth < 1024) {
      panel.classList.add('hidden');
      panel.classList.remove('fixed', 'inset-0', 'z-40');
      panel.classList.add('lg:flex');
    }
  }
}

window.imprimirComanda = async function (pedido) {
  if (!pedido || !pedido.items) {
    showToast('Sin datos del pedido para imprimir', 'error');
    return;
  }

  var cfg = cargarConfigImpresora();
  var LINE_WIDTH = 32;

  try {
    // 1. Conectar QZ Tray
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
    }

    // 2. Configurar impresora
    var config = qz.configs.create({ host: cfg.host, port: cfg.port });

    // 3. Comandos ESC/POS
    var data = [];
    data.push('\x1B\x40');                      // 1. Inicializar impresora

    // 2. Encabezado (Centrado)
    data.push('\x1B\x61\x01');
    data.push('Corner House\n');
    data.push('Sabores que unen\n\n');

    // 3. Info del pedido (Alineado a la izquierda)
    data.push('\x1B\x61\x00');
    data.push('Pedido: ' + (pedido.numero_venta || '') + '\n');
    data.push('Cocina: ' + (pedido.paymentMethod || '') + '\n');
    data.push('Fecha: ' + Utils.formatDate(pedido.createdAt) + '\n');
    data.push('-'.repeat(LINE_WIDTH) + '\n');

    // 4. Productos (Izquierda con precios justificados a la derecha)
    var items = pedido.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var nombre = item.productName || '';
      var cantidad = 'x' + (item.quantity || 1);
      var precio = Utils.formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)));

      var textoDerecha = cantidad + ' ' + precio;

      // Verificar si todo cabe en una sola línea (Nombre + Cantidad + Precio + espacios)
      if ((nombre.length + textoDerecha.length + 1) <= LINE_WIDTH) {
        var espacios = LINE_WIDTH - nombre.length - textoDerecha.length;
        data.push(nombre + ' '.repeat(espacios) + textoDerecha + '\n');
      } else {
        // El nombre es largo: Se imprime el nombre en una línea
        data.push(nombre + '\n');
        // Y en la siguiente línea se empuja la cantidad y el precio a la derecha
        var espacios = LINE_WIDTH - textoDerecha.length;
        data.push(' '.repeat(espacios) + textoDerecha + '\n');
      }
    }

    // 5. Total
    data.push('-'.repeat(LINE_WIDTH) + '\n');
    var totalLabel = 'TOTAL';
    var totalVal = Utils.formatCurrency(pedido.total || 0);
    var paddingTotal = Math.max(1, LINE_WIDTH - totalLabel.length - totalVal.length);

    data.push('\x1B\x45\x01');                  // Activar Negrita
    data.push(totalLabel + ' '.repeat(paddingTotal) + totalVal + '\n');
    data.push('\x1B\x45\x00');                  // Desactivar Negrita

    // 6. Corte de papel
    data.push('\x0A\x0A\x0A');
    data.push('\x1D\x56\x00');

    // 4. Imprimir
    await qz.print(config, data);
    showToast('Comanda enviada a cocina', 'success');
  } catch (err) {
    console.error('QZ Print error:', err);
    showToast('Error de impresion: ' + (err.message || 'Verifica QZ Tray'), 'error');
  }
}


// Handler global para botones inline en index.html
window.showTicket = async function (saleId) {
  try {
    const res = await window.API.sales.get(saleId);
    if (res && res.success && res.data) {
      window.renderTicketFromData(res.data, false);
    } else {
      window.showToast('No se pudo cargar el pedido', 'error');
    }
  } catch (err) {
    window.showToast(err.message || 'Error al cargar pedido', 'error');
  }
};


// ============================================
// Impresion (Sub-paso pulido final)
// Estilo factura/comanda para guardar como PDF via window.print().
// printTicket = factura detallada con datos fiscales
// printKitchen = comanda simplificada para cocina
// ============================================

function buildPrintDocument(opts) {
  var sale = opts.sale || {};
  var kind = opts.kind || 'ticket';   // 'ticket' (factura) o 'kitchen' (comanda)
  var items = sale.items || [];
  var fecha = sale.createdAt ? new Date(sale.createdAt) : new Date();
  var fechaStr = fecha.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

  var html = '';
  html += '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">';
  html += '<title>' + (kind === 'kitchen' ? 'Comanda' : 'Factura') + ' ' + (sale.numero_venta || sale.id || '') + '</title>';
  html += '<style>'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:"Courier New",monospace;color:#000;background:#fff;padding:16px;max-width:80mm;margin:0 auto;font-size:12px;line-height:1.4}'
    + '.center{text-align:center}'
    + '.right{text-align:right}'
    + '.bold{font-weight:700}'
    + '.sep{border-top:1px dashed #000;margin:6px 0}'
    + '.sep-double{border-top:2px solid #000;margin:6px 0}'
    + '.row{display:flex;justify-content:space-between;gap:8px;margin:1px 0}'
    + '.item{margin:4px 0}'
    + '.item-name{font-weight:600}'
    + '.item-meta{font-size:10px;color:#333;margin-left:4px}'
    + 'h1{font-size:14px;letter-spacing:1px;margin-bottom:2px}'
    + 'h2{font-size:11px;margin:2px 0;font-weight:500}'
    + '.meta{font-size:10px;color:#222}'
    + 'table{width:100%;border-collapse:collapse;margin:4px 0;font-size:11px}'
    + 'th,td{padding:2px 0;text-align:left}'
    + 'th:last-child,td:last-child{text-align:right}'
    + '.total{font-size:13px;font-weight:700}'
    + '.kitchen-item{padding:6px 0;border-bottom:1px solid #000}'
    + '.kitchen-item:last-child{border-bottom:none}'
    + '.kitchen-qty{font-size:18px;font-weight:700;margin-right:6px}'
    + '@media print{body{padding:0;margin:0}@page{margin:8mm;size:80mm auto}}'
    + '</style></head><body>';

  if (kind === 'kitchen') {
    // ============ COMANDA DE COCINA ============
    html += '<div class="center bold" style="font-size:16px;margin-bottom:4px">COMANDA</div>';
    var destinoLabel = sale.paymentMethod || 'cocina';
    if (destinoLabel === 'domicilio') destinoLabel = '🛵 DOMICILIO';
    else if (destinoLabel === 'recogido') destinoLabel = '🏠 PARA RECOGER';
    else if (sale.mesaNombre) destinoLabel = sale.mesaNombre;
    html += '<div class="center" style="font-size:11px;margin-bottom:4px">' + escapeHtml(destinoLabel) + '</div>';
    html += '<div class="sep-double"></div>';
    html += '<div class="row bold"><span>Pedido:</span><span>' + escapeHtml(sale.numero_venta || '') + '</span></div>';
    html += '<div class="row"><span>Fecha:</span><span>' + escapeHtml(fechaStr) + '</span></div>';
    if (sale.mesaNombre) {
      html += '<div class="row bold"><span>Mesa:</span><span>' + escapeHtml(sale.mesaNombre) + '</span></div>';
    }
    html += '<div class="sep-double"></div>';
    items.forEach(function (it) {
      var qty = it.cantidadPresentacion && it.factorConversion !== 1 ? it.cantidadPresentacion : it.quantity;
      var unit = it.unidadPresentacion || '';
      var platoTag = it.esPlato ? ' <span class="item-meta">[PLATO]</span>' : '';
      html += '<div class="kitchen-item">'
        + '<span class="kitchen-qty">' + qty + 'x</span>'
        + '<span class="item-name">' + escapeHtml(it.productName) + '</span>' + platoTag;
      if (it.observacion) html += '<div class="item-meta" style="font-weight:700">Obs: ' + escapeHtml(it.observacion) + '</div>';
      html += '</div>';
    });
    // Ingredientes consumidos (del nivel sale, no del item)
    if (sale.ingredientesConsumidos && sale.ingredientesConsumidos.length > 0) {
      html += '<div class="sep"></div>';
      html += '<div class="item-meta" style="font-size:10px;font-weight:700">Ingredientes:</div>';
      sale.ingredientesConsumidos.forEach(function (ing) {
        html += '<div class="item-meta" style="font-size:10px">'
          + escapeHtml(ing.nombre) + ' (' + ing.cantidad + ' ' + (ing.unidad || '') + ') - ' + escapeHtml(ing.por || '')
          + '</div>';
      });
    }
    html += '<div class="sep-double"></div>';
    html += '<div class="center meta">Impreso: ' + escapeHtml(new Date().toLocaleString('es-CO')) + '</div>';
  } else {
    // ============ FACTURA DETALLADA ============
    html += '<div class="center">';
    html += '<h1>CORNER HOUSE</h1>';
    html += '<h2>Sabores que unen</h2>';
    html += '<div class="meta">NIT 900.000.000-1</div>';
    html += '<div class="meta">Calle 123 #45-67, Bogota</div>';
    html += '<div class="meta">Tel: (601) 555-0100</div>';
    html += '</div>';
    html += '<div class="sep-double"></div>';

    html += '<div class="bold center" style="font-size:14px;margin:4px 0">FACTURA DE VENTA</div>';
    html += '<div class="sep"></div>';

    html += '<table>';
    html += '<tr><td>Pedido:</td><td class="bold">' + escapeHtml(sale.numero_venta || '') + '</td></tr>';
    html += '<tr><td>Fecha:</td><td>' + escapeHtml(fechaStr) + '</td></tr>';
    var destino = sale.paymentMethod || '';
    if (destino === 'domicilio') destino = '🛵 Domicilio';
    else if (destino === 'recogido') destino = '🏠 Recoger';
    else if (sale.mesaNombre) destino = sale.mesaNombre;
    html += '<tr><td>Destino:</td><td>' + escapeHtml(destino) + '</td></tr>';
    if (sale.mesaNombre) html += '<tr><td>Mesa:</td><td>' + escapeHtml(sale.mesaNombre) + '</td></tr>';
    html += '<tr><td>Cliente:</td><td>' + escapeHtml(sale.clienteNombre || 'Consumidor final') + '</td></tr>';
    html += '<tr><td>Atendido por:</td><td>' + escapeHtml(sale.usuario_nombre || sale.username || '') + '</td></tr>';
    html += '</table>';

    html += '<div class="sep-double" style="margin-bottom:8px"></div>';

    var subtotal = 0;
    items.forEach(function (it) {
      var qty = it.cantidadPresentacion && it.factorConversion !== 1 ? it.cantidadPresentacion : it.quantity;
      var unitPrice = it.unitPrice || 0;
      var sub = it.subtotal != null ? it.subtotal : (unitPrice * (it.quantity || 0));
      subtotal += sub;
      var nameLine = escapeHtml(it.productName) + (it.esPlato ? ' *' : '');
      html += '<div class="item" style="margin-bottom:6px">';
      html += '<div class="row"><span class="item-name">' + nameLine + '</span><span class="bold">' + window.Utils.formatCurrency(sub) + '</span></div>';
      html += '<div class="item-meta">x' + qty + ' &middot; ' + window.Utils.formatCurrency(unitPrice) + ' c/u</div>';
      // Observacion del item
      if (it.observacion) {
        html += '<div class="item-meta" style="font-style:italic">  Obs: ' + escapeHtml(it.observacion) + '</div>';
      }
      html += '</div>';
    });

    html += '<div class="sep"></div>';

    // Desglose financiero
    var costoDom = parseFloat(sale.costoDomicilio) || 0;
    var bonoDesc = parseFloat(sale.bonoDescuento) || 0;
    var propinaReal = parseFloat(sale.propina) || 0;
    var totalFinal = parseFloat(sale.total) || subtotal;

    html += '<div class="row"><span>Subtotal:</span><span class="bold">' + window.Utils.formatCurrency(subtotal) + '</span></div>';
    if (costoDom > 0) {
      html += '<div class="row"><span>🛵 Domicilio:</span><span>' + window.Utils.formatCurrency(costoDom) + '</span></div>';
    }
    if (bonoDesc > 0) {
      html += '<div class="row"><span>🎁 Bono/Descuento:</span><span>-' + window.Utils.formatCurrency(bonoDesc) + '</span></div>';
    }
    if (propinaReal > 0) {
      html += '<div class="row"><span>💰 Propina:</span><span>' + window.Utils.formatCurrency(propinaReal) + '</span></div>';
    }
    html += '<div class="sep-double"></div>';
    html += '<div class="row total"><span>TOTAL:</span><span>' + window.Utils.formatCurrency(totalFinal) + '</span></div>';
    html += '<div class="sep-double"></div>';

    // Forma de pago real
    var formaPagoLabel = sale.formaPago || 'Sin definir';
    html += '<div class="center meta" style="margin-top:8px">Forma de pago: ' + escapeHtml(formaPagoLabel) + '</div>';
    html += '<div class="center meta">Resolucion DIAN No. 18760000000001</div>';
    html += '<div class="center meta">Fecha: 2026-01-01  Vigencia: 24 meses</div>';
    html += '<div class="center meta">Prefijo: CH  Rango: 1 - 999999</div>';

    html += '<div class="sep"></div>';
    html += '<div class="center meta">Gracias por su compra</div>';
    html += '<div class="center meta" style="font-size:9px">www.cornerhouse.co</div>';
    html += '<div class="center meta" style="font-size:9px;margin-top:4px">Impreso: ' + escapeHtml(new Date().toLocaleString('es-CO')) + '</div>';
  }

  html += '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},150)});<\/script>';
  html += '</body></html>';
  return html;
}

window.printTicket = function (sale) {
  try {
    var w = window.open('', 'cornerhouse_ticket', 'width=420,height=720,scrollbars=yes');
    if (!w) { showToast('Permite ventanas emergentes para imprimir', 'error'); return; }
    w.document.open();
    w.document.write(buildPrintDocument({ sale: sale, kind: 'ticket' }));
    w.document.close();
    showToast('Generando factura...', 'success');
  } catch (err) {
    console.error('printTicket error:', err);
    showToast('No se pudo generar la factura: ' + err.message, 'error');
  }
};

window.printKitchen = function (sale) {
  try {
    var w = window.open('', 'cornerhouse_kitchen', 'width=420,height=720,scrollbars=yes');
    if (!w) { showToast('Permite ventanas emergentes para imprimir', 'error'); return; }
    w.document.open();
    w.document.write(buildPrintDocument({ sale: sale, kind: 'kitchen' }));
    w.document.close();
    showToast('Generando comanda...', 'success');
  } catch (err) {
    console.error('printKitchen error:', err);
    showToast('No se pudo generar la comanda: ' + err.message, 'error');
  }
};

// Helper: obtiene la venta actual (la del ultimo ticket) para reimprimir
function getCurrentSale() {
  var sale = store.state._lastTicketSale || window._lastTicketSale || null;
  if (!sale) return null;

  // Sincronizar valores del formulario del ticket (si estan visibles)
  var formaEl = document.getElementById('ticketFormaPago');
  var propEl = document.getElementById('ticketPropina');
  var bonoEl = document.getElementById('ticketBono');
  if (formaEl || propEl || bonoEl) {
    var saleClone = JSON.parse(JSON.stringify(sale));
    if (formaEl && formaEl.value) saleClone.formaPago = formaEl.value;
    if (propEl) saleClone.propina = parseFloat(propEl.value) || 0;
    if (bonoEl) saleClone.bonoDescuento = parseFloat(bonoEl.value) || 0;
    // Recalcular total
    var subtotal = saleClone.subtotal || 0;
    var domicilio = saleClone.costoDomicilio || 0;
    saleClone.total = subtotal + domicilio - (saleClone.bonoDescuento || 0) + (saleClone.propina || 0);
    return saleClone;
  }
  return sale;
}


/**
 * Ajusta la visibilidad de los botones del modal segun el printer_kind
 * configurado:
 *   - 'browser'  -> solo Imprimir (Navegador)
 *   - 'thermal'  -> solo Imprimir (Termico)
 *   - 'both'     -> ambos
 */
async function configureTicketButtons() {
  try {
    var cfg = await window.ServicesConfig.get();
    var kind = (cfg && cfg.data && cfg.data.printerKind) || 'browser';
    var thermalBtn = document.getElementById('printThermalBtn');
    if (!thermalBtn) return;
    // Mostrar boton termico si la config no es 'browser' (es 'thermal' o 'both')
    if (kind !== 'browser') {
      thermalBtn.classList.remove('hidden');
      thermalBtn.classList.add('flex');
    } else {
      thermalBtn.classList.add('hidden');
      thermalBtn.classList.remove('flex');
    }
  } catch (e) {
    // Fallback: ocultar termico
  }
}


/**
 * Impresion HIBRIDA: envia el pedido al backend para que lo imprima
 * la impresora termica via TCP/ESC/POS. Si la BD no tiene IP/port
 * configurados, devuelve un error claro.
 */
async function printThermal(sale) {
  if (!sale) {
    showToast('No hay un pedido activo para imprimir', 'error');
    return;
  }
  showToast('Enviando a impresora termica...', 'success');
  try {
    var res = await window.API.print.send({ sale: sale, kind: 'ticket' });
    if (res && res.success) {
      showToast('Factura enviada: ' + (res.data && res.data.message || 'OK'), 'success');
    } else {
      showToast('Error: ' + (res.message || 'No se pudo imprimir'), 'error');
    }
  } catch (err) {
    console.error('printThermal error:', err);
    var msg = (err && err.message) || 'Error desconocido';
    if (err && err.hint) msg += '. ' + err.hint;
    showToast('No se pudo imprimir: ' + msg, 'error');
  }
}


/**
 * Envia una comanda simplificada (solo items + cantidades) a la impresora
 * termica. Se invoca automaticamente despues de confirmar el pedido si
 * comanda_enabled esta activo.
 */
async function printThermalKitchen(sale) {
  if (!sale) return;
  try {
    await window.API.print.send({ sale: sale, kind: 'kitchen' });
  } catch (err) {
    console.warn('Comanda auto: error (no bloqueante):', err.message || err);
  }
}


// ============================================
// Delegacion de clicks (Sub-paso 3.5)
// Antes: `document.addEventListener('click', ...)` suelto en app.js.
// Ahora: handlers via core/events.js. Se registran al cargar el modulo.
// ============================================
on('#posRegisterBtn', function (e, target) {
  if (target.disabled) return;
  submitPOSOrder();
});

on('#posClearBtn', function () {
  if (state.posItems.length === 0) return;
  // Preguntar antes de borrar para que un click accidental
  // no descarte el pedido. Usamos showConfirm con la variante
  // 'warning' (pastel ambar) y textos amigables.
  var count = state.posItems.reduce(function (sum, i) { return sum + i.qty; }, 0);
  var msg = count === 1
    ? 'Tienes 1 producto en el pedido. ¿Quieres limpiarlo?'
    : 'Tienes ' + count + ' productos en el pedido. ¿Quieres limpiarlos?';
  if (typeof showConfirm === 'function') {
    showConfirm({
      title: '¿Limpiar pedido?',
      message: msg,
      confirmText: 'Sí, limpiar',
      cancelText: 'Cancelar',
      variant: 'warning'
    }, function () { clearPOSOrder(); });
  } else {
    // Fallback: limpiar directamente si showConfirm no esta disponible
    clearPOSOrder();
  }
});

// Botones del modal de ticket (impresion hibrida)
// Imprimir en navegador (window.print): dialogo nativo, guardar como PDF, etc.
on('#printBrowserBtn', function () {
  var sale = getCurrentSale();
  if (!sale) {
    showToast('No hay un pedido activo para imprimir', 'error');
    return;
  }
  printTicket(sale);
});

// Imprimir en termica LAN: envia al backend /api/print
on('#printThermalBtn', function () {
  var sale = getCurrentSale();
  if (!sale) {
    showToast('No hay un pedido activo para imprimir', 'error');
    return;
  }
  printThermal(sale);
});

// Configurar visibilidad de los botones al abrir el ticket
on('[data-close-ticket]', function () { /* handled by modal.js */ });

// Hook: cada vez que se abre el ticket, ajustamos los botones segun config
if (typeof window !== 'undefined') {
  // Guardamos la funcion para que renderTicketFromData la pueda invocar
  window.__configureTicketButtons = configureTicketButtons;
  window.__printThermalKitchen = printThermalKitchen;
}


// Compatibilidad con codigo heredado (window.*)
if (typeof window !== "undefined") {
  if (typeof loadPOS === "function") window.loadPOS = loadPOS;
  if (typeof renderPOSCategories === "function") window.renderPOSCategories = renderPOSCategories;
  if (typeof renderPOSGrid === "function") window.renderPOSGrid = renderPOSGrid;
  if (typeof renderPOSOrder === "function") window.renderPOSOrder = renderPOSOrder;
  if (typeof renderPOSMesas === "function") window.renderPOSMesas = renderPOSMesas;
  if (typeof applyPOSFilter === "function") window.applyPOSFilter = applyPOSFilter;
  if (typeof refreshPOSVisibility === "function") window.refreshPOSVisibility = refreshPOSVisibility;
  if (typeof posSearchHandler === "function") window.posSearchHandler = posSearchHandler;
  if (typeof submitPOSOrder === "function") window.submitPOSOrder = submitPOSOrder;
  if (typeof addPOSItem === "function") window.addPOSItem = addPOSItem;
  if (typeof removePOSItem === "function") window.removePOSItem = removePOSItem;
  if (typeof updatePOSQty === "function") window.updatePOSQty = updatePOSQty;
  if (typeof openPOS === "function") window.openPOS = openPOS;
  if (typeof openPOSOrder === "function") window.openPOSOrder = openPOSOrder;
  if (typeof closePOSOrder === "function") window.closePOSOrder = closePOSOrder;
  if (typeof showTicket === "function") window.showTicket = showTicket;
  if (typeof printTicket === "function") window.printTicket = printTicket;
  if (typeof printKitchen === "function") window.printKitchen = printKitchen;
  if (typeof imprimirComanda === "function") window.imprimirComanda = imprimirComanda;
  if (typeof printThermal === "function") window.printThermal = printThermal;
  if (typeof printThermalKitchen === "function") window.printThermalKitchen = printThermalKitchen;
  if (typeof configureTicketButtons === "function") window.configureTicketButtons = configureTicketButtons;
  if (typeof setPOSMode === "function") window.setPOSMode = setPOSMode;
  if (typeof initPOSMode === "function") window.initPOSMode = initPOSMode;
}
