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

    html += '<div class="pos-card bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-shadow overflow-hidden"'
      + ' data-pos-type="' + item.type + '"'
      + ' data-pos-id="' + item.id + '"'
      + ' data-pos-source="' + item.source + '"'
      + ' data-pos-name="' + escapeHtml(item.name) + '"'
      + ' data-pos-icon="' + escapeHtml(item.icon || '📦') + '"'
      + ' ondblclick="window.addPOSItem(\'' + item.id + '\', \'' + item.source + '\')">'
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
      // Configurar visibilidad de botones del modal segun printer_kind
      try {
        if (typeof configureTicketButtons === 'function') {
          // Esperar a que el DOM se actualice
          setTimeout(configureTicketButtons, 50);
        }
      } catch (e) { /* noop */ }
      // Si comanda_enabled esta activo, enviar comanda automaticamente a la termica
      try {
        var cfg = await window.ServicesConfig.get();
        if (cfg && cfg.data && cfg.data.comandaEnabled) {
          printThermalKitchen(res.data);
        }
      } catch (e) {
        console.warn('No se pudo verificar comanda_enabled:', e.message);
      }
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

// addPOSItemAnimated: igual que addPOSItem pero dispara la animacion
// "fly to order" desde la card clickeada hasta el panel de pedido
// (desktop) o el FAB del carrito (mobile). Tambien marca la card
// como seleccionada con un check verde hasta que el item se quite.
window.addPOSItemAnimated = function (cardEl, id, type) {
  if (!cardEl) { window.addPOSItem(id, type); return; }

  // 1) Marcar como seleccionada (badge check verde)
  cardEl.classList.add('pos-card--selected');

  // 2) Crear el ghost que vuela hacia el destino
  try {
    var rect = cardEl.getBoundingClientRect();
    var ghost = document.createElement('div');
    ghost.className = 'pos-fly-ghost';
    var label = cardEl.dataset.posName || '';
    var icon = cardEl.dataset.posIcon || '🛒';
    ghost.innerHTML = '<span style="font-size:18px;line-height:1;">' + icon + '</span>';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    document.body.appendChild(ghost);

    // Animar via keyframes CSS: el destino depende del viewport
    var isMobile = window.innerWidth < 1024;
    var dest = isMobile ? document.getElementById('posMobileFab') : document.getElementById('posOrderPanel');
    if (dest) {
      var dRect = dest.getBoundingClientRect();
      // Forzar end-state via CSS variables / inline transform al final
      var dx = (dRect.left + dRect.width / 2) - (rect.left + rect.width / 2);
      var dy = (dRect.top + dRect.height / 2) - (rect.top + rect.height / 2);
      ghost.style.setProperty('--fly-dx', dx + 'px');
      ghost.style.setProperty('--fly-dy', dy + 'px');
      // Reescribir animation para incluir translate final
      ghost.style.animation = 'none';
      // Forzar reflow
      void ghost.offsetWidth;
      ghost.style.animation = 'posFlyToOrder 0.55s cubic-bezier(0.55, 0.05, 0.4, 1) forwards';
      // Aplicar transform final al keyframe final via clase
      setTimeout(function () {
        ghost.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0.18) rotate(-20deg)';
        ghost.style.opacity = '0';
      }, 0);

      // Pulse en el destino
      dest.classList.remove('pos-destination-pulse');
      void dest.offsetWidth;
      dest.classList.add('pos-destination-pulse');
      setTimeout(function () { dest.classList.remove('pos-destination-pulse'); }, 500);
    }

    // Limpiar el ghost despues de la animacion
    setTimeout(function () {
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }, 600);
  } catch (e) { /* noop */ }

  // 3) Agregar al pedido
  window.addPOSItem(id, type);
};

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
    html += '<div class="center" style="font-size:11px;margin-bottom:4px">' + escapeHtml(sale.paymentMethod || 'cocina') + '</div>';
    html += '<div class="sep-double"></div>';
    html += '<div class="row bold"><span>Pedido:</span><span>' + escapeHtml(sale.numero_venta || '') + '</span></div>';
    html += '<div class="row"><span>Fecha:</span><span>' + escapeHtml(fechaStr) + '</span></div>';
    if (sale.mesa_nombre) {
      html += '<div class="row bold"><span>Mesa:</span><span>' + escapeHtml(sale.mesa_nombre) + '</span></div>';
    }
    html += '<div class="sep-double"></div>';
    items.forEach(function (it) {
      var qty = it.cantidadPresentacion && it.factorConversion !== 1 ? it.cantidadPresentacion : it.quantity;
      var unit = it.unidadPresentacion || '';
      var platoTag = it.esPlato ? ' <span class="item-meta">[PLATO]</span>' : '';
      html += '<div class="kitchen-item">'
        + '<span class="kitchen-qty">' + qty + 'x</span>'
        + '<span class="item-name">' + escapeHtml(it.productName) + '</span>' + platoTag;
      if (it.nota) html += '<div class="item-meta">Nota: ' + escapeHtml(it.nota) + '</div>';
      if (it.ingredientesConsumidos && it.ingredientesConsumidos.length > 0) {
        html += '<div class="item-meta" style="font-size:10px;color:#444">'
          + it.ingredientesConsumidos.map(function (ing) {
            return escapeHtml(ing.nombre) + ' (' + ing.cantidad + ' ' + (ing.unidad || '') + ')';
          }).join(', ')
          + '</div>';
      }
      html += '</div>';
    });
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
    html += '<tr><td>Cocina:</td><td>' + escapeHtml(sale.paymentMethod || '') + '</td></tr>';
    if (sale.mesa_nombre) html += '<tr><td>Mesa:</td><td>' + escapeHtml(sale.mesa_nombre) + '</td></tr>';
    html += '<tr><td>Cliente:</td><td>' + escapeHtml(sale.cliente_nombre || 'Consumidor final') + '</td></tr>';
    html += '<tr><td>Cajero:</td><td>' + escapeHtml(sale.usuario_nombre || '') + '</td></tr>';
    html += '</table>';

    html += '<div class="sep-double"></div>';

    html += '<table>';
    html += '<thead><tr><th>Descripcion</th><th>Cant</th><th>Vlr Unit</th><th>Total</th></tr></thead><tbody>';
    var subtotal = 0;
    items.forEach(function (it) {
      var qty = it.cantidadPresentacion && it.factorConversion !== 1 ? it.cantidadPresentacion : it.quantity;
      var unit = it.unidadPresentacion || '';
      var unitPrice = it.unitPrice || 0;
      var sub = it.subtotal != null ? it.subtotal : (unitPrice * (it.quantity || 0));
      subtotal += sub;
      var nameLine = escapeHtml(it.productName) + (it.esPlato ? ' *' : '');
      if (unit) nameLine += ' <span class="item-meta">(' + escapeHtml(unit) + ')</span>';
      html += '<tr>';
      html += '<td>' + nameLine + '</td>';
      html += '<td style="text-align:right">' + qty + '</td>';
      html += '<td style="text-align:right">' + window.Utils.formatCurrency(unitPrice) + '</td>';
      html += '<td style="text-align:right">' + window.Utils.formatCurrency(sub) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';

    html += '<div class="sep"></div>';
    html += '<div class="row"><span>Subtotal:</span><span class="bold">' + window.Utils.formatCurrency(subtotal) + '</span></div>';
    var tip = Math.round(subtotal * 0.1 * 100) / 100;
    var totalConPropina = subtotal + tip;
    html += '<div class="row meta"><span>Propina Voluntaria (10%):</span><span>' + window.Utils.formatCurrency(tip) + '</span></div>';
    html += '<div class="sep-double"></div>';
    html += '<div class="row total"><span>TOTAL (Sin propina):</span><span>' + window.Utils.formatCurrency(subtotal) + '</span></div>';
    html += '<div class="row total"><span>TOTAL (Con propina):</span><span>' + window.Utils.formatCurrency(totalConPropina) + '</span></div>';
    html += '<div class="sep-double"></div>';

    // Texto legal: propina voluntaria
    html += '<div class="center" style="font-size:10px;font-style:italic;margin:6px 4px;color:#222">';
    html += '* La propina es voluntaria y sugerida. Usted decide el valor a pagar. *';
    html += '</div>';
    html += '<div class="sep"></div>';

    html += '<div class="center meta" style="margin-top:8px">Forma de pago: ' + escapeHtml(sale.paymentMethod || 'efectivo') + '</div>';
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
  return store.state._lastTicketSale || window._lastTicketSale || null;
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
    var enabled = !!(cfg && cfg.data && cfg.data.printerEnabled);
    var thermalBtn = document.getElementById('printThermalBtn');
    if (!thermalBtn) return;
    if (kind === 'thermal' || (kind === 'both' && enabled)) {
      thermalBtn.classList.remove('hidden');
      thermalBtn.classList.add('flex');
    } else {
      thermalBtn.classList.add('hidden');
      thermalBtn.classList.remove('flex');
    }
  } catch (e) {
    // Mantener solo navegador en caso de error
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
  state.posItems = [];
  renderPOSOrder();
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
}
