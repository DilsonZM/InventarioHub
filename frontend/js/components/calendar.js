// components/calendar.js
// Calendario dual para seleccionar rangos de fechas (filtros de sales,
// entradas, movimientos, dashboard). Reemplaza a calendarState, renderCalendar,
// renderCalGrid y los listeners sueltos que vivian en app.js.

import { $ } from '../core/dom.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { store } from '../core/store.js';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Estado del calendario, expuesto para que openDateRange() lo configure.
export const calendarState = {
  monthOffset: 0,
  start: null,
  end: null,
  picking: 'start', // 'start' | 'end' | 'done'
  view: '',
  fromId: '',
  toId: '',
  periodId: '',
  callback: null
};

export function openDateRange(view, fromId, toId, periodId, callback) {
  calendarState.view = view;
  calendarState.fromId = fromId;
  calendarState.toId = toId;
  calendarState.periodId = periodId;
  calendarState.callback = callback;

  var fromEl = $(fromId);
  var toEl = $(toId);
  calendarState.start = (fromEl && fromEl.value) || null;
  calendarState.end = (toEl && toEl.value) || null;
  calendarState.picking = (calendarState.start && calendarState.end) ? 'done' : 'start';
  calendarState.monthOffset = 0;

  var calRangeText = $('#calRangeText');
  if (calRangeText) {
    calRangeText.textContent = (calendarState.start && calendarState.end)
      ? calendarState.start + ' → ' + calendarState.end
      : 'Toca una fecha de inicio';
  }
  renderCalendar();
  openModal('dateRangeModal');
}

export function renderCalendar() {
  var today = new Date();
  var base = new Date(today.getFullYear(), today.getMonth() + calendarState.monthOffset, 1);
  var m1 = base.getMonth();
  var y1 = base.getFullYear();
  var m2 = m1 + 1;
  var y2 = y1;
  if (m2 > 11) { m2 = 0; y2++; }
  var calMonth1 = $('#calMonth1');
  var calMonth2 = $('#calMonth2');
  if (calMonth1) calMonth1.textContent = MONTHS[m1] + ' ' + y1;
  if (calMonth2) calMonth2.textContent = MONTHS[m2] + ' ' + y2;
  renderCalGrid('calGrid1', y1, m1, today);
  renderCalGrid('calGrid2', y2, m2, today);
}

function renderCalGrid(gridId, year, month, today) {
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var firstDow = new Date(year, month, 0).getDate();
  var startDow = new Date(year, month, 1).getDay();
  var html = '';
  for (var d = startDow - 1; d >= 0; d--) {
    var dayNum = firstDow - d;
    html += '<div class="cal-day other-month">' + dayNum + '</div>';
  }
  for (var i = 1; i <= daysInMonth; i++) {
    var cls = 'cal-day';
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === i) cls += ' today';
    if (calendarState.start === dateStr) cls += ' range-start';
    if (calendarState.end === dateStr) cls += ' range-end';
    if (calendarState.start && calendarState.end && dateStr > calendarState.start && dateStr < calendarState.end) cls += ' in-range';
    html += '<div class="' + cls + '" data-cal-date="' + dateStr + '">' + i + '</div>';
  }
  var remaining = 7 - ((startDow + daysInMonth) % 7);
  if (remaining < 7) {
    for (var j = 1; j <= remaining; j++) {
      html += '<div class="cal-day other-month">' + j + '</div>';
    }
  }
  var grid = $('#' + gridId);
  if (grid) grid.innerHTML = html;
}

export function pickDate(dateStr) {
  if (calendarState.picking === 'start' || calendarState.picking === 'done') {
    calendarState.start = dateStr;
    calendarState.end = null;
    calendarState.picking = 'end';
    var t1 = $('#calRangeText');
    if (t1) t1.textContent = 'Desde: ' + dateStr + ' — Toca fecha final';
  } else {
    if (dateStr < calendarState.start) {
      calendarState.end = calendarState.start;
      calendarState.start = dateStr;
    } else {
      calendarState.end = dateStr;
    }
    calendarState.picking = 'done';
    var t2 = $('#calRangeText');
    if (t2) t2.textContent = calendarState.start + ' → ' + calendarState.end;
  }
  renderCalendar();
}

// Aplica el rango seleccionado a los inputs y dispara el callback.
export function applyDateRange() {
  if (!calendarState.start || !calendarState.end) {
    showToast('Selecciona un rango de fechas', 'error');
    return;
  }
  var from = calendarState.start;
  var to = calendarState.end;
  if (calendarState.fromId) {
    var fromEl = $(calendarState.fromId);
    if (fromEl) fromEl.value = from;
  }
  if (calendarState.toId) {
    var toEl = $(calendarState.toId);
    if (toEl) toEl.value = to;
  }
  if (calendarState.periodId) {
    var pEl = $(calendarState.periodId);
    if (pEl) pEl.value = '';
  }
  var modal = $('#dateRangeModal');
  if (modal) modal.classList.add('hidden');
  // Guardar en state para persistencia
  store.state.activeDateFrom = from;
  store.state.activeDateTo = to;
  if (calendarState.callback) calendarState.callback();
}

// Aplica un preset rapido (Hoy, Esta semana, Este mes, Limpiar).
export function applyPreset(preset) {
  var today = new Date();
  var tzToday = window.Utils ? window.Utils.todayInAppTZ() : today.toISOString().split('T')[0];
  if (preset === 'today') {
    calendarState.start = tzToday;
    calendarState.end = tzToday;
    calendarState.picking = 'done';
  } else if (preset === 'week') {
    var dow = today.getDay();
    var start = new Date(today);
    start.setDate(today.getDate() - dow);
    calendarState.start = start.toISOString().split('T')[0];
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    calendarState.end = end.toISOString().split('T')[0];
    calendarState.picking = 'done';
  } else if (preset === 'month') {
    var first = new Date(today.getFullYear(), today.getMonth(), 1);
    calendarState.start = first.toISOString().split('T')[0];
    var last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    calendarState.end = last.toISOString().split('T')[0];
    calendarState.picking = 'done';
  } else if (preset === 'clear') {
    calendarState.start = null;
    calendarState.end = null;
    calendarState.picking = 'start';
  }
  if (calendarState.picking === 'done') {
    var t = $('#calRangeText');
    if (t) t.textContent = calendarState.start + ' → ' + calendarState.end;
  } else {
    var tt = $('#calRangeText');
    if (tt) tt.textContent = 'Toca una fecha de inicio';
  }
  renderCalendar();
}

// Inicializa los listeners del calendario. Se llama una sola vez al boot.
export function initCalendar() {
  // Click en celdas del calendario (delegado)
  document.addEventListener('click', function (e) {
    var cell = e.target.closest && e.target.closest('[data-cal-date]');
    if (cell) {
      pickDate(cell.getAttribute('data-cal-date'));
      return;
    }
    var nav = e.target.closest && e.target.closest('[data-cal-nav]');
    if (nav) {
      calendarState.monthOffset += nav.getAttribute('data-cal-nav') === 'next' ? 1 : -1;
      renderCalendar();
      return;
    }
    var preset = e.target.closest && e.target.closest('[data-preset]');
    if (preset) {
      applyPreset(preset.getAttribute('data-preset'));
      return;
    }
  });

  // Boton Aplicar del modal
  var applyBtn = document.getElementById('applyDateRange');
  if (applyBtn) applyBtn.addEventListener('click', applyDateRange);
}

// Compatibilidad con codigo heredado
if (typeof window !== 'undefined') {
  window.openDateRange = openDateRange;
  window.pickDate = pickDate;
  window.renderCalendar = renderCalendar;
  window.calendarState = calendarState;
  window.initDateRangePicker = initCalendar;
  window.applyDateRange = applyDateRange;
  window.applyPreset = applyPreset;
}
