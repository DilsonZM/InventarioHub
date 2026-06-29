// Corner House - Menu publico (Light theme, app nativa)
// Carga el menu desde /api/public/menu y maneja reservas via /api/public/reservas.
// Sin dependencias externas.

(function () {
  'use strict';

  // ===== Config =====
  var CATS = [
    { id: 'entradas', label: 'Entradas',    emoji: '🥗' },
    { id: 'platos',   label: 'Platos',      emoji: '🍽️' },
    { id: 'bebidas',  label: 'Bebidas',     emoji: '🥤' },
    { id: 'postres',  label: 'Postres',     emoji: '🍰' }
  ];
  // Rating pseudo-aleatorio pero estable por plato (mismo plato = mismo rating)
  function ratingFor(id) {
    var n = 0;
    var s = String(id || '');
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) & 0xffff;
    return 4.4 + (n % 7) * 0.1; // 4.4 - 5.0
  }

  // ===== State =====
  var menuData = [];
  var activeCat = null;
  var personas = 2;
  var searchQuery = '';

  // ===== Elementos DOM =====
  var $ = function (id) { return document.getElementById(id); };
  var elTabs = $('catTabsList');
  var elContent = $('menuContent');
  var elSkeleton = $('menuSkeleton');
  var elError = $('menuError');
  var elRetry = $('retryBtn');
  var elFab = $('openReservaFab');
  var elBackdrop = $('reservaBackdrop');
  var elSheet = $('reservaSheet');
  var elForm = $('reservaForm');
  var elClose = $('closeReservaBtn');
  var elFecha = $('r-fecha');
  var elSubmit = $('reservaSubmitBtn');
  var elErrorBox = $('reservaError');
  var elSuccess = $('successOverlay');
  var elSuccessMsg = $('successMsg');
  var elSearch = $('searchInput');

  // ===== Init =====
  document.addEventListener('DOMContentLoaded', function () {
    setDefaultFecha();
    bindUI();
    loadMenu();
  });

  function setDefaultFecha() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    elFecha.value = d.toISOString().slice(0, 10);
    elFecha.min = new Date().toISOString().slice(0, 10);
  }

  function bindUI() {
    elFab.addEventListener('click', openSheet);
    elClose.addEventListener('click', closeSheet);
    elBackdrop.addEventListener('click', closeSheet);
    elForm.addEventListener('submit', submitReserva);

    document.querySelectorAll('.persona-pill').forEach(function (p) {
      p.addEventListener('click', function () {
        document.querySelectorAll('.persona-pill').forEach(function (x) { x.classList.remove('is-active'); });
        p.classList.add('is-active');
        personas = p.getAttribute('data-personas') === '8' ? 8 : parseInt(p.getAttribute('data-personas'), 10);
        $('r-personas').value = personas;
      });
    });
    var pillDefault = document.querySelector('.persona-pill[data-personas="2"]');
    if (pillDefault) { pillDefault.classList.add('is-active'); $('r-personas').value = 2; }

    elRetry.addEventListener('click', loadMenu);

    elSearch.addEventListener('input', function () {
      searchQuery = this.value.toLowerCase().trim();
      renderMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && elSheet.classList.contains('is-open')) closeSheet();
    });
  }

  // ===== Carga del menu =====
  function loadMenu() {
    elSkeleton.classList.remove('hidden');
    elContent.classList.add('hidden');
    elError.classList.add('hidden');

    fetch('/api/public/menu', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.json.success) throw new Error(res.json.message || 'Error');
        menuData = res.json.data || [];
        renderMenu();
      })
      .catch(function (err) {
        console.error('[menu] error:', err);
        elSkeleton.classList.add('hidden');
        elError.classList.remove('hidden');
      });
  }

  // ===== Filtrado por busqueda =====
  function filterBySearch(platos) {
    if (!searchQuery) return platos;
    return platos.filter(function (p) {
      return (p.nombre || '').toLowerCase().indexOf(searchQuery) !== -1
          || (p.descripcion || '').toLowerCase().indexOf(searchQuery) !== -1;
    });
  }

  function groupByCategoria(platos) {
    var map = {};
    CATS.forEach(function (c) { map[c.id] = []; });
    platos.forEach(function (p) {
      var cat = p.categoria || 'platos';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    return map;
  }

  // ===== Render =====
  function renderMenu() {
    elSkeleton.classList.add('hidden');
    elContent.classList.remove('hidden');

    var filtered = filterBySearch(menuData);
    var grouped = groupByCategoria(filtered);
    var html = '';
    var firstVisible = null;

    CATS.forEach(function (cat) {
      var items = grouped[cat.id] || [];
      if (items.length === 0) return;
      if (!firstVisible) firstVisible = cat.id;
      html += ''
        + '<section id="cat-' + cat.id + '" class="categoria-section">'
        + '  <h2 class="categoria-title">'
        + '    <span>' + escapeHtml(cat.label) + '</span>'
        + '    <span class="categoria-count">' + items.length + '</span>'
        + '  </h2>'
        + '  <div class="platos-grid">'
        + items.map(platoCard).join('')
        + '  </div>'
        + '</section>';
    });

    if (!html) {
      elContent.innerHTML = '<div class="text-center py-20 text-ink-500">'
        + (searchQuery ? 'No encontramos platos con "' + escapeHtml(searchQuery) + '"' : 'El menu estara disponible pronto.')
        + '</div>';
    } else {
      elContent.innerHTML = html;
    }

    renderTabs(grouped, firstVisible);
  }

  function renderTabs(grouped, firstVisible) {
    var html = '';
    CATS.forEach(function (cat) {
      var count = (grouped[cat.id] || []).length;
      if (count === 0) return;
      html += ''
        + '<button class="cat-tab" role="tab" data-cat="' + cat.id + '">'
        + '  <span class="cat-emoji">' + cat.emoji + '</span>'
        + '  <span>' + escapeHtml(cat.label) + '</span>'
        + '</button>';
    });
    elTabs.innerHTML = html;
    elTabs.querySelectorAll('.cat-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { scrollToCat(tab.getAttribute('data-cat')); });
    });
    if (firstVisible && !activeCat) {
      activeCat = firstVisible;
      markActiveTab();
    } else if (firstVisible) {
      markActiveTab();
    }
  }

  function markActiveTab() {
    elTabs.querySelectorAll('.cat-tab').forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-cat') === activeCat);
    });
  }

  function scrollToCat(catId) {
    var sec = document.getElementById('cat-' + catId);
    if (sec) {
      activeCat = catId;
      markActiveTab();
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function platoCard(p) {
    var emoji = p.imagen_url ? '' : defaultEmojiFor(p);
    var imgHtml = p.imagen_url
      ? '<img src="' + escapeHtml(p.imagen_url) + '" alt="" loading="lazy">'
      : '<div class="plato-emoji" aria-hidden="true">' + emoji + '</div>';

    var badgeHtml = p.disponible
      ? ''
      : '<span class="plato-badge is-out">Agotado</span>';

    var rating = ratingFor(p.id);

    return ''
      + '<article class="plato-card' + (p.disponible ? '' : ' plato-no-disponible') + '">'
      + '  <div class="plato-img-wrap">'
      +     imgHtml
      +     badgeHtml
      + '  </div>'
      + '  <div class="plato-body">'
      + '    <h3 class="plato-name">' + escapeHtml(p.nombre) + '</h3>'
      + '    <span class="plato-rating">'
      + '      <svg class="star w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.05.36a.5.5 0 01.9 0L10.83 3.3a.5.5 0 00.38.27l3.24.47a.5.5 0 01.28.85l-2.34 2.28a.5.5 0 00-.15.45l.55 3.23a.5.5 0 01-.72.52L10 10.13l-2.9 1.52a.5.5 0 01-.72-.52l.55-3.23a.5.5 0 00-.15-.45L4.44 4.9a.5.5 0 01.28-.85l3.24-.47a.5.5 0 00.38-.27L10.05.36z"/></svg>'
      + '      ' + rating.toFixed(1) + ' <span class="text-ink-400">(124)</span>'
      + '    </span>'
      + (p.descripcion ? '    <p class="plato-desc">' + escapeHtml(p.descripcion) + '</p>' : '')
      + '    <div class="plato-foot">'
      + '      <span class="plato-precio">$' + formatPrecio(p.precio) + '</span>'
      + '    </div>'
      + '  </div>'
      + '</article>';
  }

  function defaultEmojiFor(p) {
    var map = { entradas: '🥗', platos: '🍽️', bebidas: '🥤', postres: '🍰' };
    return map[p.categoria] || map[p.tipo] || '🍴';
  }

  function formatPrecio(n) {
    var v = parseFloat(n) || 0;
    return v.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ===== Bottom sheet =====
  function openSheet() {
    elSheet.classList.add('is-open');
    elBackdrop.classList.add('is-open');
    elSheet.setAttribute('aria-hidden', 'false');
    setTimeout(function () { $('r-nombre').focus(); }, 320);
  }
  function closeSheet() {
    elSheet.classList.remove('is-open');
    elBackdrop.classList.remove('is-open');
    elSheet.setAttribute('aria-hidden', 'true');
    hideError();
  }
  function showError(msg) {
    elErrorBox.textContent = msg;
    elErrorBox.classList.remove('hidden');
  }
  function hideError() { elErrorBox.classList.add('hidden'); }

  function submitReserva(e) {
    e.preventDefault();
    hideError();

    var nombre = $('r-nombre').value.trim();
    var telefono = $('r-telefono').value.trim();
    var fecha = $('r-fecha').value;
    var hora = $('r-hora').value;
    var notas = $('r-notas').value.trim();
    var personasVal = $('r-personas').value;

    if (nombre.length < 2) return showError('Ingresa tu nombre completo');
    if (telefono.length < 7) return showError('Ingresa un WhatsApp valido');
    if (!fecha) return showError('Selecciona una fecha');
    if (!hora) return showError('Selecciona una hora');
    if (!personasVal) return showError('Selecciona el numero de personas');

    setLoading(true);
    fetch('/api/public/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        nombre: nombre, telefono: telefono, fecha: fecha, hora: hora,
        personas: parseInt(personasVal, 10), notas: notas
      })
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
    .then(function (res) {
      if (!res.ok || !res.json.success) throw new Error(res.json.message || 'Error al enviar');
      var d = res.json.data || {};
      var fechaBonita = formatFechaBonita(d.fecha || fecha);
      elSuccessMsg.textContent = 'Te esperamos el ' + fechaBonita + ' a las ' + (d.hora || hora) + ' para ' + (d.personas || personasVal) + ' persona' + ((d.personas || personasVal) === 1 ? '' : 's') + '.';
      showSuccess();
      elForm.reset();
      document.querySelectorAll('.persona-pill').forEach(function (p) { p.classList.remove('is-active'); });
      var p2 = document.querySelector('.persona-pill[data-personas="2"]');
      if (p2) { p2.classList.add('is-active'); $('r-personas').value = 2; }
      setDefaultFecha();
    })
    .catch(function (err) {
      showError(err.message || 'No pudimos enviar tu reserva. Intenta de nuevo.');
    })
    .finally(function () { setLoading(false); });
  }

  function setLoading(on) {
    elSubmit.disabled = on;
    elSubmit.querySelector('.submit-label').classList.toggle('hidden', on);
    elSubmit.querySelector('.submit-spinner').classList.toggle('hidden', !on);
  }

  function showSuccess() {
    elSuccess.classList.add('is-open');
    setTimeout(function () {
      elSuccess.classList.remove('is-open');
      closeSheet();
    }, 2800);
  }

  function formatFechaBonita(yyyy_mm_dd) {
    var parts = String(yyyy_mm_dd).split('-');
    if (parts.length !== 3) return yyyy_mm_dd;
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return d.getDate() + ' de ' + meses[d.getMonth()];
  }
})();
