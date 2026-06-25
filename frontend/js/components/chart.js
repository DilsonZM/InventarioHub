// components/chart.js
// Encapsula la creacion/destruccion de charts Chart.js. Antes el codigo
// original tenia `let categoryChart = null;` y al re-renderizar llamaba
// `categoryChart.destroy()` que fallaba porque `null.destroy()` no existe.
// Aqui centralizamos la referencia y verificamos tipo antes de destruir.

const charts = new Map(); // id -> instancia Chart.js

function destroyChart(id) {
  var ch = charts.get(id);
  if (ch && typeof ch.destroy === 'function') {
    try { ch.destroy(); } catch (e) { console.warn('[chart] destroy error:', e); }
  }
  charts.delete(id);
}

export function renderCategoryChart(movimientos, products) {
  var canvas = document.getElementById('categoryChart');
  if (!canvas) return;
  var container = canvas.parentElement;
  if (!container) return;

  // Recalcular agrupando salidas por producto
  var prodMap = {};
  (movimientos || []).forEach(function (m) {
    if (m.movimiento === 'salida' && m.cantidad_salida > 0) {
      prodMap[m.producto] = (prodMap[m.producto] || 0) + m.cantidad_salida;
    }
  });

  var labels = Object.keys(prodMap);
  var data = Object.values(prodMap);
  var colors = ['#059669', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

  // Restaurar canvas si fue removido en una iteracion previa
  if (!document.getElementById('categoryChart')) {
    container.innerHTML = '<canvas id="categoryChart"></canvas>';
    canvas = document.getElementById('categoryChart');
  }

  if (labels.length === 0) {
    if (canvas) canvas.style.display = 'none';
    var existingEmpty = container.querySelector('.chart-empty');
    if (!existingEmpty) {
      var div = document.createElement('div');
      div.className = 'chart-empty flex flex-col items-center justify-center h-full py-12 text-center';
      div.innerHTML = '<div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">'
        + '<svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>'
        + '</div>'
        + '<p class="text-sm font-medium text-slate-600">Sin salidas registradas</p>'
        + '<p class="text-xs text-slate-400 mt-1">Aun no se han registrado salidas en el periodo</p>';
      container.appendChild(div);
    }
    return;
  }

  // Hay datos: ocultar empty state y mostrar canvas
  if (canvas) canvas.style.display = '';
  var prevEmpty = container.querySelector('.chart-empty');
  if (prevEmpty) prevEmpty.remove();

  // Destruir el chart anterior si existe (FIX bug categoryChart.destroy)
  destroyChart('categoryChart');

  // Crear el nuevo chart
  if (typeof Chart === 'undefined') {
    console.warn('[chart] Chart.js no esta cargado');
    return;
  }
  var instance = new Chart(canvas, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' } }
      }
    }
  });
  charts.set('categoryChart', instance);
}

// Alias para compatibilidad con el codigo heredado
if (typeof window !== 'undefined') {
  window.renderCategoryChart = renderCategoryChart;
  window.destroyChart = destroyChart;
  window.getChart = function (id) { return charts.get(id); };
  window.setChart = function (id, instance) { charts.set(id, instance); };
}
