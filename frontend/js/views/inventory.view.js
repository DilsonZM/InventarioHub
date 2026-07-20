import { $, escapeHtml } from '../core/dom.js';
import { updateClearBtn, initFilters } from '../components/filters.js';
import { openModal, closeModal, showError } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { formatCurrency } from '../utils.js';
import { store } from '../core/store.js';
import { UNIDADES_POR_CATEGORIA, UNIDAD_LABELS } from '../services/units.js';

// inventory.view.js
// Vista extraida de app.js en el Sub-paso 3.4 (views).

async function initInventory() {
  try {
    var catRes = await API.products.categories();
    store.state.categories = catRes.data || [];
    populateCategoryFilters();
  } catch (e) {}

  $('#productCategory').addEventListener('change', updateUnidadesByCategory);

  $('#searchProducts').addEventListener('input', debounce(function () { loadProducts(); }, 300));
  $('#filterCategory').addEventListener('change', function () { loadProducts(); });

  // Dropdown de filtro multiple de estado
  var trigger = document.getElementById('filterStatusTrigger');
  var menu = document.getElementById('filterStatusMenu');
  var label = document.getElementById('filterStatusLabel');
  var checkboxes = document.querySelectorAll('.status-checkbox');

  if (trigger && menu) {
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target) && e.target !== trigger) menu.classList.add('hidden');
    });
    checkboxes.forEach(function (cb) {
      cb.addEventListener('change', function () {
        var sel = [];
        checkboxes.forEach(function (c) { if (c.checked) sel.push(c.value); });
        $('#filterStatus').value = sel.join(',');
        // Actualizar label del trigger
        if (sel.length === 0) label.textContent = 'Estado';
        else if (sel.length === 1) label.textContent = sel[0].replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
        else label.textContent = sel.length + ' filtros';
        loadProducts();
      });
    });
  }

  $('#addProductBtn').addEventListener('click', function () { openProductModal(); });

  // Merma
  var mermaBtn = $('#addMermaBtn');
  if (mermaBtn) mermaBtn.addEventListener('click', function () { openMermaModal(); });

  // Export CSV
  var exportBtn = $('#exportInventoryBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportInventoryCSV);

  var mermaSubmit = $('#mermaSubmitBtn');
  if (mermaSubmit) mermaSubmit.addEventListener('click', function () { submitMerma(); });

  // Autocomplete de producto en merma
  var mermaSearch = document.getElementById('mermaSearchProducto');
  var mermaDropdown = document.getElementById('mermaProductDropdown');
  if (mermaSearch && mermaDropdown) {
    mermaSearch.addEventListener('input', function () {
      filterMermaProductos(mermaSearch.value);
    });
    mermaSearch.addEventListener('focus', function () {
      if ((state._mermaProducts || []).length > 0) filterMermaProductos(mermaSearch.value);
    });
    document.addEventListener('click', function (e) {
      if (!mermaSearch.contains(e.target) && !mermaDropdown.contains(e.target)) {
        mermaDropdown.classList.add('hidden');
      }
    });
  }

  // Dirty tracking para el modal de producto
  var form = document.getElementById('productForm');
  if (form) {
    form.addEventListener('input', function () { store.state.productDirty = true; });
    form.addEventListener('change', function () { store.state.productDirty = true; });
  }

  if (state.user && state.user.role !== 'admin') {
    $('#addProductBtn').classList.add('hidden');
  }
}

function populateCategoryFilters() {
  var cats = store.state.categories || [];
  var opts = cats.map(function (c) { 
    var name = typeof c === 'string' ? c : (c.nombre || c.name || '');
    return '<option value="' + name + '">' + name + '</option>';
  }).join('');

  var filterCat = $('#filterCategory');
  if (filterCat) filterCat.innerHTML = '<option value="">Todas las categorías</option>' + opts;

  var modalCat = $('#productCategory');
  if (modalCat) modalCat.innerHTML = '<option value="">Seleccionar</option>' + opts;
}

async function loadProducts() {
  var search = $('#searchProducts').value.trim();
  var category = $('#filterCategory').value;
  var statusFilter = $('#filterStatus').value;
  var params = {};
  if (search) params.search = search;
  if (category) params.category = category;

  try {
    var res = await API.products.list(params);
    var data = res.data;
    // Filtrado por estado (cliente) — soporta multiples valores separados por coma
    if (statusFilter) {
      var statuses = statusFilter.split(',').filter(Boolean);
      if (statuses.length > 0) {
        data = data.filter(function (p) {
          return statuses.some(function (s) {
            if (s === 'agotado') return p.stock <= 0;
            if (s === 'stock_bajo') return p.stock > 0 && p.stock <= p.minStock;
            if (s === 'disponible') return p.stock > p.minStock;
            return true;
          });
        });
      }
    }
    state.products = data;
    renderProductsTable();
  } catch (err) {
    showToast('Error al cargar productos', 'error');
  }
}

function renderProductsTable() {
  var tbody = $('#productsTable');
  var cards = $('#productsCards');

  if (state.products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-12 text-center"><p class="text-slate-400 text-sm">No se encontraron productos</p></td></tr>';
    cards.innerHTML = '<p class="text-slate-400 text-sm text-center py-8">No se encontraron productos</p>';
    return;
  }

  var isAdmin = state.user && state.user.role === 'admin';

  var desktopRows = state.products.map(function (p) {
    var stockBadge, statusBadge;
    if (p.stock <= 0) {
      stockBadge = 'inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold text-red-600 stock-badge-red';
      statusBadge = '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium items-center bg-red-100 text-red-700 estado-badge-red">Agotado</span>';
    } else if (p.stock <= p.minStock) {
      stockBadge = 'inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold text-orange-500 stock-badge-orange';
      statusBadge = '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium items-center bg-orange-100 text-orange-700 estado-badge-orange">Stock bajo</span>';
    } else {
      stockBadge = 'inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold text-green-600 stock-badge-green';
      statusBadge = '<span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium items-center bg-green-100 text-green-700 estado-badge-green">Disponible</span>';
    }

    return '<tr class="hover:bg-slate-50 transition-colors">'
      + '<td class="px-6 py-4">'
      + '<div class="flex items-center gap-3">'
      + '<div class="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">'
      + '<svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>'
      + '</div>'
      + '<div>'
      + '<p class="text-sm font-semibold text-slate-800">' + escapeHtml(p.name) + '</p>'
      + '<p class="text-xs text-slate-400 truncate max-w-[200px]">' + escapeHtml(p.description || '') + '</p>'
      + '</div>'
      + '</div>'
      + '</td>'
      + '<td class="px-6 py-4 text-sm font-mono text-slate-600">' + escapeHtml(p.sku) + '</td>'
      + '<td class="px-6 py-4"><span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">' + escapeHtml(p.category) + '</span></td>'
      + '<td class="px-6 py-4 text-sm font-semibold text-slate-800 text-right">' + formatCurrency(p.cost) + '</td>'
      + '<td class="px-6 py-4 text-center"><span class="' + stockBadge + '">' + p.stock + '</span></td>'
      + '<td class="px-6 py-4 text-center text-sm text-slate-500">' + p.minStock + '</td>'
      + '<td class="px-6 py-4 text-sm text-slate-600"><span class="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">' + escapeHtml(p.unidad || 'unidad') + '</span></td>'
      + '<td class="px-6 py-4 text-center">' + statusBadge + '</td>'
      + '<td class="px-6 py-4 text-right">'
      + (isAdmin ? '<div class="flex items-center justify-end gap-1">'
        + '<button onclick="window.editProduct(\'' + p.id + '\')" class="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-100 rounded-lg transition-colors" title="Editar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'
        + '</button>'
        + '<button onclick="window.deleteProduct(\'' + p.id + '\')" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Eliminar">'
        + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
        + '</button>'
        + '</div>' : '<span class="text-xs text-slate-400">Solo lectura</span>')
      + '</td>'
      + '</tr>';
  }).join('');

  tbody.innerHTML = desktopRows;

  var mobileCards = state.products.map(function (p) {
    var stockColor = p.stock <= 0 ? 'text-red-600 stock-badge-red' : p.stock <= p.minStock ? 'text-orange-500 stock-badge-orange' : 'text-green-600 stock-badge-green';
    return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3">'
      + '<div class="flex items-start justify-between">'
      + '<div class="flex items-center gap-3">'
      + '<div class="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">'
      + '<svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>'
      + '</div>'
      + '<div>'
      + '<p class="font-semibold text-slate-800">' + escapeHtml(p.name) + '</p>'
      + '<p class="text-xs font-mono text-slate-400">' + escapeHtml(p.sku) + '</p>'
      + '</div>'
      + '</div>'
      + '<span class="text-lg font-bold ' + stockColor + '">' + p.stock + '<span class="text-xs text-slate-400 font-normal ml-1">' + escapeHtml(p.unidad || 'unidad') + '</span></span>'
      + '</div>'
      + '<div class="flex items-center gap-2 flex-wrap">'
      + '<span class="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-700">' + escapeHtml(p.category) + '</span>'
      + '<span class="text-sm font-semibold text-slate-800">' + formatCurrency(p.cost) + '</span>'
      + '</div>'
      + '<div class="text-xs text-slate-500">Stock min.: ' + p.minStock + ' ' + escapeHtml(p.unidad || 'unidad') + '</div>'
      + (isAdmin ? '<div class="flex gap-2 pt-2 border-t border-slate-100">'
        + '<button onclick="window.editProduct(\'' + p.id + '\')" class="flex-1 py-2.5 text-sm font-medium text-brand-600 bg-brand-100 hover:bg-brand-100 rounded-lg transition-colors touch-target">Editar</button>'
        + '<button onclick="window.deleteProduct(\'' + p.id + '\')" class="flex-1 py-2.5 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-100 rounded-lg transition-colors touch-target">Eliminar</button>'
        + '</div>' : '')
      + '</div>';
  }).join('');

  cards.innerHTML = mobileCards;
}

function openProductModal(product) {
  var form = $('#productForm');
  form.reset();
  $('#productId').value = '';
  $('#productModalTitle').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
  $('#productFormError').classList.add('hidden');
  store.state.productDirty = false;
  updateUnidadesByCategory();

  if (product) {
    $('#productId').value = product.id;
    $('#productName').value = product.name;
    $('#productSku').value = product.sku;
    $('#productCategory').value = product.category;
    $('#productCost').value = product.cost;
    $('#productStock').value = product.stock;
    $('#productMinStock').value = product.minStock;
    $('#productUnidad').value = product.unidad || 'unidad';
    $('#productDescription').value = product.description || '';
  }
  openModal('productModal');
}

function updateUnidadesByCategory() {
  var cat = $('#productCategory').value;
  var sel = $('#productUnidad');
  var hint = $('#productUnidadHint');
  var currentVal = sel.value;

  if (!cat) {
    hint.textContent = '';
    Array.from(sel.options).forEach(function (opt) {
      opt.hidden = false;
    });
    return;
  }

  var permitidas = UNIDADES_POR_CATEGORIA[cat] || [];
  hint.textContent = 'sugeridas: ' + permitidas.map(function (u) { return UNIDAD_LABELS[u] || u; }).slice(0, 3).join(', ');

  Array.from(sel.options).forEach(function (opt) {
    if (!opt.value) return;
    opt.hidden = permitidas.indexOf(opt.value) === -1;
  });

  if (currentVal && permitidas.indexOf(currentVal) !== -1) {
    sel.value = currentVal;
  } else if (permitidas.length > 0) {
    sel.value = '';
  }
}

async function loadTopDishes() {
  try {
    var token = API.getToken();
    var resp = await fetch('/api/stats/dishes', { headers: { 'Authorization': 'Bearer ' + token } });
    var res = await resp.json();
    if (!res.success || !res.data || res.data.length === 0) return;
    var section = $('#topDishesSection');
    if (section) section.classList.remove('hidden');
    var tbody = $('#topDishesTable');
    if (!tbody) return;
    tbody.innerHTML = res.data.map(function (d) {
      var margen = (d.precio_venta || 0) - (d.costo || 0);
      var margenColor = margen >= 0 ? 'text-brand-600' : 'text-red-600';
      return '<tr>'
        + '<td class="py-2 font-medium text-slate-700">' + escapeHtml(d.nombre) + '</td>'
        + '<td class="py-2 text-center text-slate-600">' + d.cantidad + '</td>'
        + '<td class="py-2 text-right text-slate-700">' + Utils.formatCurrency(d.precio_venta * d.cantidad) + '</td>'
        + '<td class="py-2 text-right text-slate-500">' + Utils.formatCurrency(d.costo * d.cantidad) + '</td>'
        + '<td class="py-2 text-right font-medium ' + margenColor + '">' + Utils.formatCurrency(margen * d.cantidad) + '</td>'
        + '</tr>';
    }).join('');
  } catch (e) {}
}



// Handlers expuestos en window (compatibilidad con onclick inline)
window.editProduct = async function (id) {
  try {
    var res = await API.products.get(id);
    openProductModal(res.data);
  } catch (err) {
    showToast('Error al cargar producto', 'error');
  }
}

window.deleteProduct = async function (id) {
  var product = state.products.find(function (p) { return p.id === id; });
  if (!product) return;
  if (!confirm('Eliminar "' + product.name + '"? Esta accion no se puede deshacer.')) return;

  try {
    await API.products.delete(id);
    showToast('Producto eliminado correctamente');
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}


// Handler del submit del formulario de producto
async function saveProduct(e) {
  e.preventDefault();
  var id = $('#productId').value;
  var payload = {
    name: $('#productName').value,
    sku: $('#productSku').value,
    category: $('#productCategory').value,
    cost: parseFloat($('#productCost').value) || 0,
    stock: parseFloat($('#productStock').value) || 0,
    minStock: parseFloat($('#productMinStock').value) || 0,
    unidad: $('#productUnidad').value || 'unidad',
    description: $('#productDescription').value
  };
  var btn = $('#productForm button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    if (id) {
      await window.ServicesProducts.update(id, payload);
      window.showToast('Producto actualizado correctamente');
    } else {
      await window.ServicesProducts.create(payload);
      window.showToast('Producto creado correctamente');
    }
    window.closeModal('productModal');
    window.loadProducts();
  } catch (err) {
    window.showError('productFormError', err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
  }
}

// Conectar el handler al formulario (en el initInventory)
if (typeof document !== 'undefined') {
  var productForm = document.getElementById('productForm');
  if (productForm) productForm.addEventListener('submit', saveProduct);
}


// ============================================
// Export PDF
// ============================================

function exportInventoryCSV() {
  var products = state.products;
  if (!products || products.length === 0) {
    showToast('No hay productos para exportar', 'warning');
    return;
  }
  if (typeof Swal === 'undefined') {
    Utils.printStockReport(products, 'Inventario');
    return;
  }
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var swalBg = isDark ? '#1e293b' : '#ffffff';
  var swalColor = isDark ? '#e2e8f0' : '#0f172a';
  var swalSubColor = isDark ? '#94a3b8' : '#475569';
  var swalMuted = isDark ? '#64748b' : '#94a3b8';
  var swalBoldColor = isDark ? '#f1f5f9' : '#0f172a';

  var statusFilter = $('#filterStatus').value;
  var filterLabel = '';
  if (statusFilter) {
    var labels = statusFilter.split(',').map(function (s) {
      return s.replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
    }).join(' + ');
    filterLabel = '<br><span style="color:#d97706;font-size:12px">Filtro: ' + labels + '</span>';
  }

  Swal.fire({
    title: 'Exportar reporte',
    html: '<p style="color:' + swalSubColor + '">Se generará un reporte de <b style="color:' + swalBoldColor + '">' + products.length + ' productos</b>.'
      + filterLabel
      + '</p>'
      + '<p style="color:' + swalMuted + ';font-size:12px;margin-top:6px">Se abrirá en una ventana para imprimir o guardar como PDF.</p>',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Exportar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#073626',
    cancelButtonColor: isDark ? '#475569' : '#94a3b8',
    background: swalBg,
    color: swalColor,
    customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl', cancelButton: 'rounded-xl' }
  }).then(function (result) {
    if (result.isConfirmed) Utils.printStockReport(products, 'Inventario');
  });
}

// ============================================
// Merma (perdida operativa)
// ============================================

async function openMermaModal() {
  try {
    var res = await API.products.list();
    var productos = (res.data || []).filter(function (p) { return p.stock > 0; });
    state._mermaProducts = productos;

    // Limpiar campos
    var searchEl = document.getElementById('mermaSearchProducto');
    var labelEl = document.getElementById('mermaProductLabel');
    var dropdown = document.getElementById('mermaProductDropdown');
    var cant = $('#mermaCantidad');
    var motivo = $('#mermaMotivo');
    var info = $('#mermaStockInfo');
    if (searchEl) searchEl.value = '';
    if (labelEl) labelEl.classList.add('hidden');
    if (dropdown) dropdown.classList.add('hidden');
    if (cant) cant.value = '';
    if (motivo) motivo.value = '';
    if (info) info.textContent = '';
    $('#mermaProduct').value = '';
    var unitSel = document.getElementById('mermaUnidad');
    if (unitSel) unitSel.innerHTML = '<option value="">Base</option>';

    openModal('mermaModal');
  } catch (err) {
    showToast('Error al cargar productos: ' + (err.message || ''), 'error');
  }
}

function filterMermaProductos(query) {
  var all = state._mermaProducts || [];
  var q = (query || '').toLowerCase().trim();
  var dropdown = document.getElementById('mermaProductDropdown');
  if (!dropdown) return;

  var items = q ? all.filter(function (p) {
    return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
  }) : all.slice(0, 20);

  if (items.length === 0) {
    dropdown.innerHTML = '<div class="px-3 py-3 text-sm text-slate-400 text-center">Sin resultados</div>';
  } else {
    dropdown.innerHTML = items.map(function (p) {
      var selected = $('#mermaProduct').value === p.id;
      return '<div class="merma-result flex items-center gap-2 px-3 py-2.5 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-0 ' + (selected ? 'bg-amber-50' : '') + '"'
        + ' data-id="' + p.id + '"'
        + ' data-name="' + escapeHtml(p.name) + '"'
        + ' data-sku="' + escapeHtml(p.sku || '') + '"'
        + ' data-stock="' + p.stock + '"'
        + ' data-unidad="' + escapeHtml(p.unidad || 'unidad') + '">'
        + '<div class="flex-1 min-w-0">'
        + '<p class="text-sm font-medium text-slate-800 truncate">' + escapeHtml(p.name) + '</p>'
        + '<p class="text-xs text-slate-400 truncate">' + escapeHtml(p.sku || '') + ' · Stock: ' + p.stock + ' ' + escapeHtml(p.unidad || 'unidad') + '</p>'
        + '</div>'
        + '</div>';
    }).join('');

    dropdown.querySelectorAll('.merma-result').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        selectMermaProducto(el.dataset.id, el.dataset.name, el.dataset.sku, el.dataset.stock, el.dataset.unidad);
        dropdown.classList.add('hidden');
      });
    });
  }
  dropdown.classList.remove('hidden');
}

function selectMermaProducto(id, name, sku, stock, unidad) {
  $('#mermaProduct').value = id;
  var searchEl = document.getElementById('mermaSearchProducto');
  var labelEl = document.getElementById('mermaProductLabel');
  var info = $('#mermaStockInfo');
  if (searchEl) searchEl.value = name + ' · ' + sku;
  if (labelEl) {
    labelEl.textContent = name + ' (' + sku + ' · ' + escapeHtml(unidad) + ')';
    labelEl.classList.remove('hidden');
  }
  if (info) info.textContent = 'Stock actual: ' + stock + ' ' + escapeHtml(unidad);

  // Poblar selector de unidad de presentacion
  var pres = window.getPresentaciones ? window.getPresentaciones(unidad) : [{ value: '', label: 'Misma unidad base', factor: 1 }];
  var unitSel = document.getElementById('mermaUnidad');
  if (unitSel) {
    unitSel.innerHTML = pres.map(function (p) {
      return '<option value="' + p.value + '" data-factor="' + p.factor + '">' + escapeHtml(p.label) + '</option>';
    }).join('');
  }
}

async function submitMerma() {
  var productId = ($('#mermaProduct') || {}).value;
  var cantidad = parseFloat(($('#mermaCantidad') || {}).value);
  var motivo = (($('#mermaMotivo') || {}).value || '').trim();

  // Aplicar factor de conversion de la unidad de presentacion
  var unitSel = document.getElementById('mermaUnidad');
  if (unitSel && unitSel.value) {
    var selectedOpt = unitSel.options[unitSel.selectedIndex];
    var factor = parseFloat(selectedOpt.dataset.factor) || 1;
    cantidad = cantidad * factor;
  }

  if (!productId) {
    showToast('Selecciona un producto', 'warning');
    return;
  }
  if (!cantidad || cantidad <= 0) {
    showToast('Ingresa una cantidad valida', 'warning');
    return;
  }

  var btn = $('#mermaSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Registrando...'; }

  try {
    var res = await API.products.merma({ productId: productId, cantidad: cantidad, motivo: motivo || undefined });
    if (res.success) {
      showToast(res.message || 'Merma registrada', 'success');
      closeModal('mermaModal');
      loadProducts(); // Recargar tabla con stock actualizado
    } else {
      showToast(res.message || 'Error al registrar merma', 'error');
    }
  } catch (err) {
    showToast('Error: ' + (err.message || ''), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Registrar Merma'; }
  }
}

// Compatibilidad con codigo heredado (window.*)
if (typeof window !== "undefined") {
  if (typeof initInventory === "function") window.initInventory = initInventory;
  if (typeof loadProducts === "function") window.loadProducts = loadProducts;
  if (typeof renderProductsTable === "function") window.renderProductsTable = renderProductsTable;
  if (typeof openProductModal === "function") window.openProductModal = openProductModal;
  if (typeof editProduct === "function") window.editProduct = editProduct;
  if (typeof deleteProduct === "function") window.deleteProduct = deleteProduct;
  if (typeof saveProduct === "function") window.saveProduct = saveProduct;
  if (typeof updateUnidadesByCategory === "function") window.updateUnidadesByCategory = updateUnidadesByCategory;
  if (typeof loadTopDishes === "function") window.loadTopDishes = loadTopDishes;
  if (typeof openMermaModal === "function") window.openMermaModal = openMermaModal;
  if (typeof submitMerma === "function") window.submitMerma = submitMerma;
  if (typeof populateCategoryFilters === "function") window.populateCategoryFilters = populateCategoryFilters;
}
