import { $, escapeHtml } from '../core/dom.js';
import { updateClearBtn, initFilters } from '../components/filters.js';
import { openModal, closeModal, showError, markSaleDirty, closeModalWithGuard } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { formatCurrency } from '../utils.js';
import { store } from '../core/store.js';

// dishes.view.js
// Vista extraida de app.js en el Sub-paso 3.4 (views).

function initDishes() {
  var addBtn = $('#addDishBtn');
  if (addBtn) addBtn.addEventListener('click', function () { openDishModal(); });

  var form = $('#dishForm');
  if (form) {
    form.addEventListener('submit', saveDish);
    // Dirty tracking
    form.addEventListener('input', function () { state.dishDirty = true; });
    form.addEventListener('change', function () { state.dishDirty = true; });
  }

  var search = $('#searchDishes');
  if (search) search.addEventListener('input', Utils.debounce(loadDishes, 300));

  var typeFilter = $('#filterDishType');
  if (typeFilter) typeFilter.addEventListener('change', loadDishes);

  var statusFilter = $('#filterDishStatus');
  if (statusFilter) statusFilter.addEventListener('change', loadDishes);

  var toggleBtn = $('#toggleArchivedBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      var content = $('#dishesArchivedContent');
      var chevron = $('#archivedChevron');
      if (!content) return;
      var isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';
      if (isOpen) {
        content.style.maxHeight = '0';
        if (chevron) chevron.style.transform = '';
      } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      }
    });
  }
}

async function loadDishes() {
  try {
    var search = ($('#searchDishes') ? $('#searchDishes').value : '').trim();
    var tipo = $('#filterDishType') ? $('#filterDishType').value : '';
    var statusFilter = $('#filterDishStatus') ? $('#filterDishStatus').value : '';
    var params = {};
    if (tipo) params.tipo = tipo;

    var res = await API.dishes.list(params);
    var dishes = res.data || [];

    if (search) {
      var s = search.toLowerCase();
      dishes = dishes.filter(function (d) { return d.nombre.toLowerCase().includes(s); });
    }

    if (statusFilter === 'con_stock') {
      dishes = dishes.filter(function (d) { return d.disponible; });
    } else if (statusFilter === 'sin_stock') {
      dishes = dishes.filter(function (d) { return !d.disponible; });
    }

    state.dishes = dishes;
    renderDishesTable();
  } catch (err) {
    console.error('loadDishes error:', err);
  }
}

function renderDishesTable() {
  var tbody = $('#dishesTable');
  var cards = $('#dishesCards');
  var all = state.dishes;
  var activos = all.filter(function (d) { return d.activo; });
  var archivados = all.filter(function (d) { return !d.activo; });

  // === ACTIVOS ===
  if (!activos.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-16 text-center"><div class="flex flex-col items-center gap-3"><div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center"><svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></div><p class="text-sm font-medium text-slate-600">No se encontraron platos</p><p class="text-xs text-slate-400">Ajustá los filtros o creá un nuevo plato</p></div></td></tr>';
    if (cards) cards.innerHTML = '<div class="text-center py-12"><div class="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-3"><svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg></div><p class="text-sm font-medium text-slate-600">No se encontraron platos</p><p class="text-xs text-slate-400">Ajustá los filtros o creá un nuevo plato</p></div>';
  } else {
    tbody.innerHTML = activos.map(function (d) { return renderDishRow(d, true); }).join('');
    if (cards) cards.innerHTML = activos.map(function (d) { return renderDishCard(d, true); }).join('');
  }

  // === ARCHIVADOS ===
  var archSection = $('#dishesArchivedSection');
  var archTable = $('#dishesArchivedTable');
  var archCards = $('#dishesArchivedCards');
  var archCount = $('#dishesArchivedCount');
  var archLabel = $('#dishesArchivedLabel');
  var archContent = $('#dishesArchivedContent');
  var archChevron = $('#archivedChevron');

  if (archivados.length > 0) {
    if (archSection) archSection.classList.remove('hidden');
    if (archCount) archCount.textContent = ' (' + archivados.length + ')';
    if (archLabel) archLabel.textContent = 'Platos archivados (' + archivados.length + ')';
    if (archTable) archTable.innerHTML = archivados.map(function (d) { return renderDishRow(d, false); }).join('');
    if (archCards) archCards.innerHTML = archivados.map(function (d) { return renderDishCard(d, false); }).join('');
    // Siempre colapsados por defecto
    if (archContent) { archContent.style.maxHeight = '0'; }
    if (archChevron) { archChevron.style.transform = ''; }
  } else {
    if (archSection) archSection.classList.add('hidden');
  }
}

async function openDishModal(dishId) {
  var isEdit = !!dishId;
  state.dishDirty = false;
  var title = $('#dishModalTitle');
  title.textContent = isEdit ? 'Editar Plato' : 'Nuevo Plato';
  $('#dishId').value = isEdit ? dishId : '';
  $('#dishName').value = '';
  $('#dishDescription').value = '';
  $('#dishType').value = '';
  $('#dishPrice').value = '0';
  $('#dishIngredients').innerHTML = '<p id="noIngredientsMsg" class="text-sm text-slate-400 text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">Sin ingredientes. Agregá productos del inventario para armar la receta.</p>';
  $('#dishFormError').classList.add('hidden');

  // Cargar productos para los selectores de ingredientes
  window._dishProducts = [];
  try {
    var res = await API.products.list();
    window._dishProducts = res.data || [];
  } catch (e) {
    window._dishProducts = [];
  }

  if (isEdit) {
    try {
      var res = await API.dishes.get(dishId);
      var d = res.data;
      $('#dishName').value = d.nombre || '';
      $('#dishDescription').value = d.descripcion || '';
      $('#dishType').value = d.tipo || '';
      $('#dishPrice').value = d.precio_venta || 0;
      if (d.ingredientes && d.ingredientes.length > 0) {
        renderIngredientList(d.ingredientes);
      }
    } catch (e) {
      showToast('Error al cargar plato', 'error');
      return;
    }
  }

  // Bindear el boton de agregar ingrediente
  var addIngBtn = $('#addIngredientBtn');
  if (addIngBtn) {
    addIngBtn.onclick = function () { openIngredientSelector(); };
  }

  openModal('dishModal');
}

function openIngredientSelector(productoIdPreset, cantidadPreset, unidadPreset, editIndex) {
  var html = '<div class="dish-ingredient-row bg-slate-50 border border-slate-100 rounded-xl">'
    + '<div class="flex items-end gap-3 p-3">'
    + '<div class="flex-1 min-w-0">'
    + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Producto</label>'
    + '<select class="ing-product w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all">'
    + '<option value="">Seleccionar producto</option>'
    + (window._dishProducts || []).map(function (p) {
      var stockInfo = ' (' + (p.stock || 0) + ' ' + (p.unidad || 'unid') + ')';
      return '<option value="' + p.id + '" data-unidad="' + (p.unidad || '') + '"' + (productoIdPreset === p.id ? ' selected' : '') + '>' + escapeHtml(p.name) + stockInfo + '</option>';
    }).join('')
    + '</select>'
    + '</div>'
    + '<div class="w-24 shrink-0">'
    + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Cantidad</label>'
    + '<input type="number" class="ing-qty w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all" placeholder="1" min="0.001" step="0.001" value="' + (cantidadPreset || '') + '">'
    + '</div>'
    + '<div class="w-28 shrink-0">'
    + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Unidad</label>'
    + '<select class="ing-unit w-full px-2 py-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all">'
    + '<option value="">--</option>'
    + '</select>'
    + '</div>'
    + '<div class="shrink-0 pb-0.5">'
    + '<button type="button" class="ing-remove p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-lg transition-colors touch-target" title="Quitar ingrediente">'
    + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
    + '</button>'
    + '</div>'
    + '</div>'
    + '</div>';

  if (editIndex !== undefined) {
    var existingRow = document.querySelector('#ingredientRow_' + editIndex);
    if (existingRow) existingRow.outerHTML = html.replace('ingredientRowNew', 'ingredientRow_' + editIndex);
  } else {
    var container = $('#dishIngredients');
    var noMsg = $('#noIngredientsMsg');
    if (noMsg) noMsg.remove();
    var temp = document.createElement('div');
    temp.innerHTML = html;
    // Insertar al inicio (arriba)
    if (container.firstChild) {
      container.insertBefore(temp.firstElementChild, container.firstChild);
    } else {
      container.appendChild(temp.firstElementChild);
    }
    // Re-indexar filas
    var rows = container.querySelectorAll('.dish-ingredient-row');
    rows.forEach(function (r, i) { r.id = 'ingredientRow_' + i; });
  }

  bindIngredientEvents();
}

function bindIngredientEvents() {
  var rows = document.querySelectorAll('#dishIngredients .dish-ingredient-row');
  rows.forEach(function (row) {
    var removeBtn = row.querySelector('.ing-remove');
    if (removeBtn && !removeBtn._bound) {
      removeBtn._bound = true;
      removeBtn.addEventListener('click', function () {
        row.remove();
        var remaining = document.querySelectorAll('#dishIngredients .dish-ingredient-row');
        if (remaining.length === 0) {
          $('#dishIngredients').innerHTML = '<p id="noIngredientsMsg" class="text-sm text-slate-400 text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">Sin ingredientes. Agregá productos del inventario para armar la receta.</p>';
        }
      });
    }

    // Producto → llenar unidades
    var prodSelect = row.querySelector('.ing-product');
    var unitSelect = row.querySelector('.ing-unit');
    if (prodSelect && unitSelect && !prodSelect._unitBound) {
      prodSelect._unitBound = true;
      prodSelect.addEventListener('change', function () {
        var opt = this.options[this.selectedIndex];
        var unidad = opt ? opt.getAttribute('data-unidad') || '' : '';
        var pres = window.getPresentaciones(unidad);
        unitSelect.innerHTML = pres.map(function (p) {
          return '<option value="' + p.value + '"' + (p.factor === 1 ? ' selected' : '') + '>' + escapeHtml(p.label) + '</option>';
        }).join('');
      });
      // Disparar cambio inicial si ya hay producto seleccionado
      if (prodSelect.value) {
        prodSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
}

function renderIngredientList(ingredientes) {
  var container = $('#dishIngredients');
  container.innerHTML = '';
  ingredientes.forEach(function (ing, i) {
    var row = document.createElement('div');
    row.innerHTML = '<div class="dish-ingredient-row bg-slate-50 border border-slate-100 rounded-xl" id="ingredientRow_' + i + '">'
      + '<div class="flex items-end gap-3 p-3">'
      + '<div class="flex-1 min-w-0">'
      + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Producto</label>'
      + '<select class="ing-product w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all">'
      + '<option value="">Seleccionar producto</option>'
      + (window._dishProducts || []).map(function (pr) {
        var info = ' (' + (pr.stock || 0) + ' ' + (pr.unidad || 'unid') + ')';
        return '<option value="' + pr.id + '" data-unidad="' + (pr.unidad || '') + '"' + (ing.producto_id === pr.id ? ' selected' : '') + '>' + escapeHtml(pr.name) + info + '</option>';
      }).join('')
      + '</select>'
      + '</div>'
      + '<div class="w-24 shrink-0">'
      + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Cantidad</label>'
      + '<input type="number" class="ing-qty w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all" placeholder="1" min="0.001" step="0.001" value="' + ing.cantidad + '">'
      + '</div>'
      + '<div class="w-28 shrink-0">'
      + '<label class="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Unidad</label>'
      + '<select class="ing-unit w-full px-2 py-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all">'
      + '<option value="">--</option>'
      + '</select>'
      + '</div>'
      + '<div class="shrink-0 pb-0.5">'
      + '<button type="button" class="ing-remove p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-lg transition-colors touch-target" title="Quitar ingrediente">'
      + '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '</button>'
      + '</div>'
      + '</div>'
      + '</div>';
    container.appendChild(row.firstElementChild);
  });
  bindIngredientEvents();
  // Pre-seleccionar unidad guardada
  ingredientes.forEach(function (ing, idx) {
    var row = document.getElementById('ingredientRow_' + idx);
    if (row && ing.unidad) {
      var unitSel = row.querySelector('.ing-unit');
      if (unitSel) {
        setTimeout(function () {
          for (var o = 0; o < unitSel.options.length; o++) {
            if (unitSel.options[o].value === ing.unidad) {
              unitSel.value = ing.unidad;
              break;
            }
          }
        }, 50);
      }
    }
  });
}

async function saveDish(e) {
  e.preventDefault();
  var id = $('#dishId').value;
  var isEdit = !!id;
  var errorEl = $('#dishFormError');

  var nombre = ($('#dishName').value || '').trim();
  var tipo = $('#dishType').value;
  var precio = parseFloat($('#dishPrice').value) || 0;

  if (!nombre) {
    errorEl.querySelector('p').textContent = 'El nombre es obligatorio';
    errorEl.classList.remove('hidden');
    return;
  }
  if (!tipo) {
    errorEl.querySelector('p').textContent = 'Seleccioná el tipo (plato o bebida)';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');

  // Recolectar ingredientes
  var ingredients = [];
  var rows = document.querySelectorAll('#dishIngredients .dish-ingredient-row');
  rows.forEach(function (row) {
    var prodSelect = row.querySelector('.ing-product');
    var qtyInput = row.querySelector('.ing-qty');
    var unitInput = row.querySelector('.ing-unit');
    if (prodSelect && prodSelect.value && qtyInput && parseFloat(qtyInput.value) > 0) {
      ingredients.push({
        producto_id: prodSelect.value,
        cantidad: parseFloat(qtyInput.value),
        unidad: (unitInput ? unitInput.value : '').trim() || 'g'
      });
    }
  });

  var payload = {
    nombre: nombre,
    descripcion: ($('#dishDescription').value || '').trim(),
    tipo: tipo,
    precio_venta: precio,
    ingredientes: ingredients
  };

  try {
    var res;
    if (isEdit) {
      res = await API.dishes.update(id, payload);
    } else {
      res = await API.dishes.create(payload);
    }
    if (res.success) {
      showToast(isEdit ? 'Plato actualizado' : 'Plato creado', 'success');
      state.dishDirty = false;
      closeModal('dishModal');
      loadDishes();
    } else {
      errorEl.querySelector('p').textContent = res.message || 'Error al guardar';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('saveDish error:', err);
    errorEl.querySelector('p').textContent = 'Error de conexion';
    errorEl.classList.remove('hidden');
  }
}

function estadoBadge(estado) {
  if (estado === 'pendiente') return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">'
    + '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/></svg>'
    + 'Pendiente</span>';
  if (estado === 'rechazado') return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">'
    + '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/></svg>'
    + 'Rechazado</span>';
  return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800">'
    + '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>'
    + 'Aprobado</span>';
}

function renderDishRow(d, isActive) {
  var badge = d.tipo === 'bebida'
    ? '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">Bebida</span>'
    : '<span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Plato</span>';

  var ingsHtml = '';
  if (d.ingredientes && d.ingredientes.length > 0) {
    ingsHtml = '<div class="text-[11px] text-slate-400 mt-0.5 space-y-0.5">'
      + d.ingredientes.map(function (ing) {
        return '<div>· ' + escapeHtml(ing.nombre) + ' ' + ing.cantidad + ing.unidad + (ing.costo > 0 ? ' <span class="text-slate-500">' + Utils.formatCurrency(ing.costo) + '</span>' : '') + '</div>';
      }).join('')
      + '</div>';
  }

  var actions;
  if (isActive) {
    actions = '<button onclick="window.editDish(\'' + d.id + '\')" class="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-100 rounded-lg transition-colors touch-target" title="Editar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>'
      + '<button onclick="window.archiveDish(\'' + d.id + '\', \'' + escapeHtml(d.nombre) + '\')" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors touch-target" title="Archivar"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg></button>';
  } else {
    actions = '<button onclick="window.reactivateDish(\'' + d.id + '\', \'' + escapeHtml(d.nombre) + '\')" class="px-2.5 py-1 text-xs font-medium text-brand-600 bg-brand-100 hover:bg-brand-100 rounded-lg transition-colors touch-target" title="Reactivar">Reactivar</button>';
  }

  var stockBadge = d.disponible
    ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Con stock</span>'
    : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Sin stock</span>';

  return '<tr class="hover:bg-slate-50 transition-colors">'
    + '<td class="px-6 py-3"><span class="text-sm font-semibold text-slate-800">' + escapeHtml(d.nombre) + '</span>' + ingsHtml + '</td>'
    + '<td class="px-6 py-3">' + badge + '</td>'
    + '<td class="px-6 py-3 text-center"><span class="text-sm text-slate-600">' + (d.num_ingredientes || 0) + '</span></td>'
    + '<td class="px-6 py-3 text-right"><span class="text-sm font-semibold text-slate-800">' + Utils.formatCurrency(d.precio_venta) + '</span></td>'
    + '<td class="px-6 py-3 text-right"><span class="text-sm ' + ((d.costo || 0) > 0 ? 'text-slate-600' : 'text-slate-400') + '">' + ((d.costo || 0) > 0 ? Utils.formatCurrency(d.costo) : '—') + '</span></td>'
    + '<td class="px-6 py-3 text-center">' + (isActive ? stockBadge : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Archivado</span>') + '</td>'
    + '<td class="px-6 py-3 text-right"><div class="flex items-center justify-end gap-1">' + actions + '</div></td>'
    + '</tr>';
}

function renderDishCard(d, isActive) {
  var stockBadge = d.disponible
    ? '<span class="shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">Con stock</span>'
    : '<span class="shrink-0 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">Sin stock</span>';

  if (!isActive) stockBadge = '<span class="shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Archivado</span>';

  return '<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-3' + (isActive ? '' : ' opacity-75') + '">'
    + '<div class="flex items-start justify-between gap-2">'
    + '<div class="min-w-0 flex-1">'
    + '<p class="font-semibold text-slate-800 truncate">' + escapeHtml(d.nombre) + '</p>'
    + (d.ingredientes && d.ingredientes.length > 0 ? '<div class="text-[11px] text-slate-400 mt-0.5 space-y-0.5">' + d.ingredientes.map(function(ing) { return '<div>· ' + escapeHtml(ing.nombre) + ' ' + ing.cantidad + ing.unidad + (ing.costo > 0 ? ' — ' + Utils.formatCurrency(ing.costo) : '') + '</div>'; }).join('') + '</div>' : '')
    + '<p class="text-xs text-slate-500 mt-0.5">' + (d.tipo === 'bebida' ? 'Bebida' : 'Plato') + ' · Venta: ' + Utils.formatCurrency(d.precio_venta) + ((d.costo || 0) > 0 ? ' · Costo: ' + Utils.formatCurrency(d.costo) : '') + '</p>'
    + '</div>'
    + stockBadge
    + '</div>'
    + '<div class="flex items-center justify-end gap-1">'
    + (isActive
      ? '<button onclick="window.editDish(\'' + d.id + '\')" class="p-1.5 text-brand-600 hover:bg-brand-100 rounded-lg transition-colors touch-target"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button><button onclick="window.archiveDish(\'' + d.id + '\', \'' + escapeHtml(d.nombre) + '\')" class="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors touch-target"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg></button>'
      : '<button onclick="window.reactivateDish(\'' + d.id + '\', \'' + escapeHtml(d.nombre) + '\')" class="px-3 py-1.5 text-xs font-semibold text-brand-600 bg-brand-100 hover:bg-brand-100 rounded-lg transition-colors touch-target">Reactivar</button>')
    + '</div>'
    + '</div>';
}



// Handlers expuestos en window (compatibilidad con onclick inline)
window.editDish = async function (dishId) {
  await openDishModal(dishId);
}

window.archiveDish = function (dishId, dishName) {
  if (!window.can('puedeEditarProductos')) { showToast('Sin permiso', 'error'); return; }
  showConfirm({
    title: '¿Archivar plato?',
    message: '"' + dishName + '" dejará de estar disponible para ventas. Podés reactivarlo cuando quieras.',
    confirmText: 'Archivar',
    variant: 'warning',
    icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>'
  }, async function () {
    try {
      var res = await API.dishes.update(dishId, { activo: false });
      if (res.success) { showToast('Plato archivado', 'success'); loadDishes(); }
      else showToast(res.message || 'Error al archivar', 'error');
    } catch (err) { showToast('Error de conexion', 'error'); }
  });
}

window.reactivateDish = async function (dishId, dishName) {
  if (!window.can('puedeEditarProductos')) { showToast('Sin permiso', 'error'); return; }
  try {
    var res = await API.dishes.update(dishId, { activo: true });
    if (res.success) { showToast('Plato reactivado', 'success'); loadDishes(); }
    else showToast(res.message || 'Error al reactivar', 'error');
  } catch (err) { showToast('Error de conexion', 'error'); }
}

window.deleteDish = function (dishId, dishName) {
  if (!window.can('puedeEliminarProductos')) { showToast('Sin permiso', 'error'); return; }
  showConfirm({
    title: '¿Eliminar plato?',
    message: '"' + dishName + '" será desactivado. Dejará de estar disponible en el punto de venta.',
    confirmText: 'Eliminar',
    variant: 'danger',
    icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
  }, async function () {
    try {
      var res = await API.dishes.delete(dishId);
      if (res.success) {
        showToast('Plato eliminado', 'success');
        loadDishes();
      } else {
        showToast(res.message || 'Error al eliminar', 'error');
      }
    } catch (err) {
      showToast('Error de conexion', 'error');
    }
  });
}



// Compatibilidad con codigo heredado (window.*)
if (typeof window !== "undefined") {
  if (typeof initDishes === "function") window.initDishes = initDishes;
  if (typeof loadDishes === "function") window.loadDishes = loadDishes;
  if (typeof renderDishesTable === "function") window.renderDishesTable = renderDishesTable;
  if (typeof openDishModal === "function") window.openDishModal = openDishModal;
  if (typeof openIngredientSelector === "function") window.openIngredientSelector = openIngredientSelector;
  if (typeof bindIngredientEvents === "function") window.bindIngredientEvents = bindIngredientEvents;
  if (typeof renderIngredientList === "function") window.renderIngredientList = renderIngredientList;
  if (typeof saveDish === "function") window.saveDish = saveDish;
  if (typeof estadoBadge === "function") window.estadoBadge = estadoBadge;
  if (typeof editDish === "function") window.editDish = editDish;
  if (typeof archiveDish === "function") window.archiveDish = archiveDish;
  if (typeof reactivateDish === "function") window.reactivateDish = reactivateDish;
  if (typeof deleteDish === "function") window.deleteDish = deleteDish;
  if (typeof renderDishRow === "function") window.renderDishRow = renderDishRow;
  if (typeof renderDishCard === "function") window.renderDishCard = renderDishCard;
}
