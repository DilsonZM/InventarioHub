// Corner House - Menu publico
// Carga el menu desde /api/public/menu (sin auth) y maneja el flujo de
// reserva via /api/public/reservas. Sin dependencias externas.

(function () {
  'use strict';

  // ===== Config =====
  var CATS = [
    { id: 'entradas', label: 'Entradas', emoji: '🥗' },
    { id: 'platos',   label: 'Platos',   emoji: '🍽️' },
    { id: 'bebidas',  label: 'Bebidas',  emoji: '🥤' },
    { id: 'postres',  label: 'Postres',  emoji: '🍰' }
  ];
  var DEFAULT_EMOJI = {
    entradas: '🥗', platos: '🍽️', bebidas: '🥤', postres: '🍰'
  };

  // ===== State =====
  var menuData = [];
  var activeCat = null;
  var personas = 2;

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

  // ===== Init =====
  document.addEventListener('DOMContentLoaded', function () {
    setDefaultFecha();
    bindUI();
    loadMenu();
  });

  function setDefaultFecha() {
    var d = new Date();
    d.setDate(d.getDate() + 1); // manana
    elFecha.value = d.toISOString().slice(0, 10);
    elFecha.min = new Date().toISOString().slice(0, 10);
  }

  function bindUI() {
    elFab.addEventListener('click', openSheet);
    elClose.addEventListener('click', closeSheet);
    elBackdrop.addEventListener('click', closeSheet);
    elForm.addEventListener('submit', submitReserva);

    // Pills de personas
    document.querySelectorAll('.persona-pill').forEach(function (p) {
      p.addEventListener('click', function () {
        document.querySelectorAll('.persona-pill').forEach(function (x) { x.classList.remove('is-active'); });
        p.classList.add('is-active');
        personas = p.getAttribute('data-personas') === '8' ? 8 : parseInt(p.getAttribute('data-personas'), 10);
        $('r-personas').value = personas;
      });
    });
    // Marcar 2 como default
    var pillDefault = document.querySelector('.persona-pill[data-personas="2"]');
    if (pillDefault) { pillDefault.classList.add('is-active'); $('r-personas').value = 2; }

    elRetry.addEventListener('click', loadMenu);

    // Cerrar sheet con ESC
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

  // Agrupa por categoria preservando el orden de CATS
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

  // ===== Render del menu =====
  function renderMenu() {
    elSkeleton.classList.add('hidden');
    elContent.classList.remove('hidden');

    var grouped = groupByCategoria(menuData);
    var html = '';

    CATS.forEach(function (cat) {
      var items = grouped[cat.id] || [];
      if (items.length === 0) return; // ocultar categorias vacias
      html += ''
        + '<section id="cat-' + cat.id + '" class="categoria-section">'
        + '  <h2 class="categoria-title">'
        + '    <span>' + cat.emoji + '</span>'
        + '    <span>' + escapeHtml(cat.label) + '</span>'
        + '    <span class="text-white/40 text-sm font-sans font-normal">(' + items.length + ')</span>'
        + '  </h2>'
        + '  <p class="categoria-subtitle">' + subtitleFor(cat.id) + '</p>'
        + '  <div class="platos-grid">'
        + items.map(platoCard).join('')
        + '  </div>'
        + '</section>';
    });

    if (!html) {
      elContent.innerHTML = '<div class="text-center py-20 text-white/60">El menu estara disponible pronto.</div>';
    } else {
      elContent.innerHTML = html;
    }

    renderTabs(grouped);
  }

  function renderTabs(grouped) {
    var html = '';
    var firstVisible = null;
    CATS.forEach(function (cat) {
      var count = (grouped[cat.id] || []).length;
      if (count === 0) return;
      if (!firstVisible) firstVisible = cat.id;
      html += ''
        + '<button class="cat-tab" role="tab" data-cat="' + cat.id + '">'
        + '  <span>' + cat.emoji + '</span>'
        + '  <span>' + escapeHtml(cat.label) + '</span>'
        + '  <span class="cat-count">' + count + '</span>'
        + '</button>';
    });
    elTabs.innerHTML = html;
    elTabs.querySelectorAll('.cat-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { scrollToCat(tab.getAttribute('data-cat')); });
    });
    if (firstVisible && !activeCat) {
      activeCat = firstVisible;
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

  function subtitleFor(catId) {
    var subs = {
      entradas: 'Para empezar',
      platos:   'Lo fuerte de la casa',
      bebidas:  'Refrescate',
      postres:  'El final perfecto'
    };
    return subs[catId] || '';
  }

  function platoCard(p) {
    var emoji = p.imagen_url ? '' : (DEFAULT_EMOJI[p.categoria] || '🍴');
    var imgHtml = p.imagen_url
      ? '<img class="plato-img" src="' + escapeHtml(p.imagen_url) + '" alt="" loading="lazy">'
      : '<div class="plato-img" aria-hidden="true">' + emoji + '</div>';

    var tagHtml = p.disponible
      ? ''
      : '<span class="plato-tag">Agotado</span>';

    return ''
      + '<article class="plato-card' + (p.disponible ? '' : ' plato-no-disponible') + '">'
      + '  ' + imgHtml
      + '  <div class="plato-body">'
      + '    <h3 class="plato-name">' + escapeHtml(p.nombre) + '</h3>'
      + (p.descripcion ? '    <p class="plato-desc">' + escapeHtml(p.descripcion) + '</p>' : '')
      + '    <div class="plato-foot">'
      + '      <span class="plato-precio">$' + formatPrecio(p.precio) + '</span>'
      + '      ' + tagHtml
      + '    </div>'
      + '  </div>'
      + '</article>';
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

  // ===== Bottom sheet reserva =====
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
      // reset pills
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
