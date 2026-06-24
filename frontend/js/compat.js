// compat.js
// Shim de compatibilidad: reexpone en `window.*` las funciones y objetos
// que el codigo HTML inline (`onclick="window.foo()"`) y modulos
// externos (por ejemplo, plugins de terceros o tests E2E) esperan
// encontrar como globales.
//
// Todas las vistas, componentes y servicios ya hacen su propia
// reexposicion a `window.*` al final de su modulo. Este archivo es
// solo una red de seguridad: garantiza que las APIs publicas minimas
// esten disponibles incluso si una vista no se cargo.
//
// Cargado como <script type="module"> desde index.html, despues de
// las vistas y antes de main.js.

import { showToast } from './components/toast.js';
import { openModal, closeModal, showError, closeModalWithGuard, markSaleDirty, markCompraDirty } from './components/modal.js';
import { can, applyPermissionsToUI } from './core/permissions.js';
import { setCurrentDate } from './shell/header.js';
import { initSidebar, initSidebarGroups } from './shell/sidebar.js';
import { initUser, initLogout } from './shell/user.js';
import { navigate, initNavigation } from './core/router.js';
import { initEvents, on, off, emit } from './core/events.js';
import { $, $$, escapeHtml, debounce } from './core/dom.js';
import { initFilters, openMobileFiltersModal, applyMobileFilters, updateClearBtn } from './components/filters.js';
import { initCalendar, applyDateRange, renderCalendar } from './components/calendar.js';
import { renderCategoryChart } from './components/chart.js';
import { renderTicketFromData } from './components/ticket.js';
import { renderPermsGrid, setPermsChecked, readPermsChecked, initPermsGridHandlers, PERM_LABELS, buildPermsObj, plantillaPorRolFrontend } from './components/permissions-grid.js';
import { renderEmptyState, renderLoading, movimientoBadge, stockBadge, renderPagination } from './components/table.js';

// Fachadas de servicios (cada services/*.js ya expone window.ServicesX,
// pero aqui hacemos un fallback por si no se cargo)
import * as Products from './services/products.js';
import * as Dishes from './services/dishes.js';
import * as Sales from './services/sales.js';
import * as Purchases from './services/purchases.js';
import * as Users from './services/users.js';
import * as Config from './services/config.js';
import * as Reports from './services/reports.js';
import * as Units from './services/units.js';

if (typeof window !== 'undefined') {
  // Core
  window.can = can;
  window.applyPermissionsToUI = applyPermissionsToUI;
  window.setCurrentDate = setCurrentDate;
  window.initSidebar = initSidebar;
  window.initSidebarGroups = initSidebarGroups;
  window.initUser = initUser;
  window.initLogout = initLogout;
  window.navigate = navigate;
  window.initNavigation = initNavigation;
  window.initEvents = initEvents;
  window.on = on;
  window.off = off;
  window.emit = emit;

  // DOM utils
  window.$ = $;
  window.$$ = $$;
  window.escapeHtml = escapeHtml;
  window.debounce = debounce;

  // Modal
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.showError = showError;
  window.closeModalWithGuard = closeModalWithGuard;
  window.markSaleDirty = markSaleDirty;
  window.markCompraDirty = markCompraDirty;
  window.showToast = showToast;

  // Componentes
  window.initFilters = initFilters;
  window.openMobileFiltersModal = openMobileFiltersModal;
  window.applyMobileFilters = applyMobileFilters;
  window.updateClearBtn = updateClearBtn;
  window.initCalendar = initCalendar;
  window.applyDateRange = applyDateRange;
  window.renderCalendar = renderCalendar;
  window.renderCategoryChart = renderCategoryChart;
  window.renderTicketFromData = renderTicketFromData;
  window.renderPermsGrid = renderPermsGrid;
  window.setPermsChecked = setPermsChecked;
  window.readPermsChecked = readPermsChecked;
  window.initPermsGridHandlers = initPermsGridHandlers;
  window.PERM_LABELS = PERM_LABELS;
  window.buildPermsObj = buildPermsObj;
  window.plantillaPorRolFrontend = plantillaPorRolFrontend;
  window.renderEmptyState = renderEmptyState;
  window.renderLoading = renderLoading;
  window.movimientoBadge = movimientoBadge;
  window.stockBadge = stockBadge;
  window.renderPagination = renderPagination;

  // Servicios: fallback si el modulo no se cargo
  if (!window.ServicesProducts) window.ServicesProducts = Products;
  if (!window.ServicesDishes) window.ServicesDishes = Dishes;
  if (!window.ServicesSales) window.ServicesSales = Sales;
  if (!window.ServicesPurchases) window.ServicesPurchases = Purchases;
  if (!window.ServicesUsers) window.ServicesUsers = Users;
  if (!window.ServicesConfig) window.ServicesConfig = Config;
  if (!window.ServicesReports) window.ServicesReports = Reports;
  if (!window.ServicesUnits) window.ServicesUnits = Units;
}
