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

async function loadPOS() {
  console.log('[POS] Cargando vista POS...');
  state.posItems = [];
  state.posMesaId = null;

  var allProducts = [];
  var allDishes = [];
  var mesas = [];

  try {
    var res = await API.products.list();
    allProducts = (res.data || []).filter(function (p) { return p.activo !== false && p.stock > 0; });
  } catch (e) { console.error('[POS] Error products:', e); }

  try {
    var res = await API.dishes.list();
    allDishes = (res.data || []).filter(function (d) { return d.activo && d.disponible !== false; });
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
  renderPOSOrder();
  renderPOSMesas(mesas);
  console.log('[POS] Vista POS renderizada');
}

function renderPOSCategories(dishes, products) {
  var container = $('#posCategories');
  if (!container) return;

  // Fusionar platos, bebidas y productos en un solo array
  var allItems = [];
  dishes.forEach(function (d) {
    allItems.push({
      id: d.id,
      name: d.nombre,
      price: d.precio_venta || 0,
      icon: d.icono || (d.tipo === 'bebida' ? '🥤' : '🍽️'),
      type: d.tipo, // 'plato' o 'bebida'
      source: 'dish',
      desc: d.descripcion || ''
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

  // Pill click handlers
  var pills = $$('.pos-pill');
  pills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      pills.forEach(function (p) {
        p.classList.remove('pos-pill--active');
        p.style.background = '';
        p.style.color = '';
        p.style.boxShadow = '';
      });
      this.classList.add('pos-pill--active');
      this.style.background = '#0d6b4e';
      this.style.color = '#fff';
      this.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
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

    html += '<div class="pos-card bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-shadow overflow-hidden" data-pos-type="' + item.type + '" ondblclick="window.addPOSItem(\'' + item.id + '\', \'' + item.source + '\')">'
      + '<div class="aspect-video bg-slate-100 flex items-center justify-center text-4xl">' + (item.icon || '📦') + '</div>'
      + '<div class="p-3">'
      + '<p class="text-sm font-bold text-slate-800 truncate">' + escapeHtml(item.name) + '</p>'
      + desc
      + '<p class="text-md font-bold text-brand-600 mt-2">' + Utils.formatCurrency(item.price) + '</p>'
      + '</div>'
      + '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
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
    container.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">Toca un producto para agregarlo</p>';
    $('#posTotal').textContent = '$0';
    if (btn) { btn.disabled = true; if (btnText) btnText.textContent = 'Agrega productos'; }
    return;
  }

  var html = '';
  state.posItems.forEach(function (item, idx) {
    var sub = item.price * item.qty;
    total += sub;
    html += '<div class="flex items-center gap-2 py-2 border-b border-slate-100">'
      + '<div class="flex-1 min-w-0">'
      + '<p class="text-sm font-medium text-slate-800 truncate">' + escapeHtml(item.name) + '</p>'
      + '<p class="text-xs text-slate-500">' + Utils.formatCurrency(item.price) + ' c/u</p>'
      + '</div>'
      + '<div class="flex items-center gap-1">'
      + '<button class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm" onclick="window.updatePOSQty(' + idx + ', -1)">-</button>'
      + '<span class="w-7 text-center text-sm font-semibold">' + item.qty + '</span>'
      + '<button class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm" onclick="window.updatePOSQty(' + idx + ', 1)">+</button>'
      + '</div>'
      + '<button class="p-1 text-slate-300 hover:text-red-500" onclick="window.removePOSItem(' + idx + ')">×</button>'
      + '</div>';
  });

  container.innerHTML = html;
  $('#posTotal').textContent = Utils.formatCurrency(total);
  if (btn) { btn.disabled = false; if (btnText) btnText.textContent = 'Registrar Pedido'; }
}

function renderPOSMesas(mesas) {
  var sel = $('#posMesa');
  if (!sel) return;
  sel.innerHTML = '<option value="">Sin mesa</option>'
    + mesas.map(function (m) {
      return '<option value="' + m.id + '">' + escapeHtml(m.nombre) + '</option>';
    }).join('');
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

  var btn = $('#posRegisterBtn');
  var btnText = $('#posRegisterText');
  if (btn) { btn.disabled = true; if (btnText) btnText.textContent = 'Registrando...'; }

  var platos = [];
  var items = [];

  state.posItems.forEach(function (item) {
    if (item.type === 'dish') {
      platos.push({
        plato_id: item.platoId,
        cantidad: item.qty,
        precioUnitario: item.price
      });
    } else {
      items.push({
        productId: item.id,
        quantity: item.qty
      });
    }
  });

  var mesaId = $('#posMesa').value || null;
  var payload = {
    paymentMethod: 'cocina',
    mesa_id: mesaId,
    platos: platos.length > 0 ? platos : undefined,
    items: items.length > 0 ? items : undefined
  };

  try {
    var res = await API.sales.create(payload);
    if (res.success) {
      showToast('Pedido registrado correctamente');
      state.posItems = [];
      state._lastTicketSale = res.data;
      renderPOSOrder();
      renderTicketFromData(res.data, false);
    } else {
      showToast(res.message || 'Error al registrar', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Error al registrar', 'error');
  }

  if (btn) { btn.disabled = false; if (btnText) btnText.textContent = 'Registrar Pedido'; }
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

  renderPOSOrder();
}

window.removePOSItem = function (idx) {
  state.posItems.splice(idx, 1);
  renderPOSOrder();
}

window.updatePOSQty = function (idx, delta) {
  var item = state.posItems[idx];
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    state.posItems.splice(idx, 1);
  }
  renderPOSOrder();
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
// Delegacion de clicks (Sub-paso 3.5)
// Antes: `document.addEventListener('click', ...)` suelto en app.js.
// Ahora: handlers via core/events.js. Se registran al cargar el modulo.
// ============================================
on('#posRegisterBtn', function (e, target) {
  if (target.disabled) return;
  submitPOSOrder();
});

on('#posClearBtn', function () {
  state.posItems = [];
  renderPOSOrder();
});


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
}
