// Theme Manager - Light/Dark mode toggle with localStorage persistence
// Based on theme-factory skill: Tech Innovation + Modern Minimalist palettes

(function () {
  'use strict';

  var THEME_KEY = 'theme:v1';
  var THEME_LIGHT = 'light';

  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function setStoredTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateButton(theme) {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    var sunIcon = btn.querySelector('.theme-icon-sun');
    var moonIcon = btn.querySelector('.theme-icon-moon');

    if (theme === 'dark') {
      if (sunIcon) sunIcon.classList.remove('hidden');
      if (moonIcon) moonIcon.classList.add('hidden');
      btn.setAttribute('title', 'Modo claro');
    } else {
      if (sunIcon) sunIcon.classList.add('hidden');
      if (moonIcon) moonIcon.classList.remove('hidden');
      btn.setAttribute('title', 'Modo oscuro');
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateButton(theme);
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || THEME_LIGHT;
    var next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setStoredTheme(next);
  }

  function attachClickHandler() {
    var btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', toggleTheme);
  }

  function init() {
    var theme = getStoredTheme() || getSystemTheme();
    applyTheme(theme);
    attachClickHandler();

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (!getStoredTheme()) {
          applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ThemeManager = {
    toggle: toggleTheme,
    getCurrent: function () {
      return document.documentElement.getAttribute('data-theme') || THEME_LIGHT;
    },
    set: function (theme) {
      applyTheme(theme);
      setStoredTheme(theme);
    }
  };
})();
