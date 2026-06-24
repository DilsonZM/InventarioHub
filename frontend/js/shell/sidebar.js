// shell/sidebar.js
// Sidebar: drawer en mobile, pin en desktop, hover-expand, grupos con
// persistencia y estado colapsado.
// Antes: initSidebar() e initSidebarGroups() en app.js (4146 lineas).

import { $ } from '../core/dom.js';

const COLLAPSE_KEY = 'sidebar:collapsed';
const GROUPS_KEY = 'sidebar:groups';

export function initSidebar() {
  var sidebar = $('#sidebar');
  var overlay = $('#sidebarOverlay');
  var body = document.body;
  if (!sidebar) return;

  // Restaurar estado en desktop
  try {
    if (window.innerWidth >= 1024) {
      if (localStorage.getItem(COLLAPSE_KEY) === '1') {
        sidebar.classList.add('collapsed');
        body.classList.add('sidebar-collapsed');
        sidebar.style.setProperty('width', '5rem', 'important');
      } else {
        sidebar.classList.add('pinned');
      }
    }
  } catch (e) {}

  var menuToggle = $('#menuToggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      if (window.innerWidth < 1024) {
        // Mobile: drawer
        sidebar.classList.toggle('-translate-x-full');
        if (overlay) overlay.classList.toggle('hidden');
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', function () {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    });
  }

  // Reset al cruzar breakpoint
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 1024) {
      sidebar.classList.remove('-translate-x-full');
      if (overlay) overlay.classList.add('hidden');
    } else {
      sidebar.classList.remove('collapsed');
      body.classList.remove('sidebar-collapsed');
      if (!sidebar.classList.contains('-translate-x-full')) {
        if (overlay) overlay.classList.remove('hidden');
      }
    }
  });

  // Boton de pin (fijar menu expandido en desktop)
  var pinBtn = document.getElementById('sidebarPinBtn');
  if (pinBtn) {
    pinBtn.addEventListener('click', function () {
      var isPinned = sidebar.classList.contains('pinned');
      if (isPinned) {
        // Unpin: colapsar
        sidebar.classList.remove('pinned');
        sidebar.classList.add('collapsed');
        body.classList.add('sidebar-collapsed');
        sidebar.style.setProperty('width', '5rem', 'important');
        try { localStorage.setItem(COLLAPSE_KEY, '1'); } catch (e) {}
      } else {
        // Pin: expandir
        sidebar.classList.add('pinned');
        sidebar.classList.remove('collapsed');
        body.classList.remove('sidebar-collapsed');
        sidebar.style.removeProperty('width');
        try { localStorage.setItem(COLLAPSE_KEY, '0'); } catch (e) {}
      }
    });
  }

  // Hover expand (solo si no esta pinned)
  if (sidebar) {
    sidebar.addEventListener('mouseenter', function () {
      if (!sidebar.classList.contains('pinned')
          && sidebar.classList.contains('collapsed')
          && window.innerWidth >= 1024) {
        sidebar.style.setProperty('width', '18rem', 'important');
      }
    });
    sidebar.addEventListener('mouseleave', function () {
      if (!sidebar.classList.contains('pinned')
          && sidebar.classList.contains('collapsed')
          && window.innerWidth >= 1024) {
        sidebar.style.setProperty('width', '5rem', 'important');
      }
    });
  }
}

export function initSidebarGroups() {
  var groups = document.querySelectorAll('.sidebar-group');

  // Restaurar estado de expansion por grupo
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(GROUPS_KEY)) || {}; } catch (e) {}

  groups.forEach(function (group) {
    var groupName = group.dataset.group;
    var header = group.querySelector('.sidebar-group-header');
    var items = group.querySelector('.sidebar-group-items');
    if (!header || !items) return;

    if (saved[groupName] !== false) {
      group.classList.add('expanded');
    }

    header.addEventListener('click', function () {
      var isExpanded = group.classList.toggle('expanded');
      saved[groupName] = isExpanded;
      try { localStorage.setItem(GROUPS_KEY, JSON.stringify(saved)); } catch (e) {}
    });
  });

  // Auto-expandir el grupo del link activo
  function expandActiveGroup() {
    var activeLink = document.querySelector('.nav-link.active');
    if (activeLink) {
      var group = activeLink.closest('.sidebar-group');
      if (group) {
        group.classList.add('expanded');
        var groupName = group.dataset.group;
        if (groupName) {
          saved[groupName] = true;
          try { localStorage.setItem(GROUPS_KEY, JSON.stringify(saved)); } catch (e) {}
        }
      }
    }
  }
  expandActiveGroup();
  window.addEventListener('hashchange', function () {
    setTimeout(expandActiveGroup, 100);
  });
}

if (typeof window !== 'undefined') {
  window.initSidebar = initSidebar;
  window.initSidebarGroups = initSidebarGroups;
}
