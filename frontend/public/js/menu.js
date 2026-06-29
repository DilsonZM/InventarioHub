// Corner House - Menu publico (Light theme, app nativa)
// - Carga menu desde /api/public/menu
// - Login/registro con nombre + WhatsApp (token guardado en localStorage)
// - Reserva de mesa, vinculada al usuario si esta logueado.

(function () {
  'use strict';

  // ===== Config =====
  var CATS = [
    { id: 'entradas', label: 'Entradas', emoji: '🥗' },
    { id: 'platos',   label: 'Platos',   emoji: '🍽️' },
    { id: 'bebidas',  label: 'Bebidas',  emoji: '🥤' },
    { id: 'postres',  label: 'Postres',  emoji: '🍰' }
  ];
  var STORAGE_KEY = 'ch_public_user_v1';
  function ratingFor(id) {
    var n = 0, s = String(id || '');
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) & 0xffff;
    return 4.4 + (n % 7) * 0.1;
  }

  // ===== State =====
  var menuData = [];
  var activeCat = null;
  var personas = 2;
  var searchQuery = '';
  var session = loadSession(); // { token, usuario } o null

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
  var elUserChip = $('userChip');
  var elUserGreeting = $('userGreeting');

  // ===== Init =====
  document.addEventListener('DOMContentLoaded', function () {
    setDefaultFecha();
    bindUI();
    renderUserChip();
    loadMenu();
  });

  // ===== Session =====
  function loadSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.token) return null;
      return s;
    } catch (e) { return null; }
  }
  function saveSession(s) {
    session = s;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
    renderUserChip();
  }
  function clearSession() {
    session = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    renderUserChip();
  }
  function renderUserChip() {
    if (!elUserChip) return;
    if (session && session.usuario) {
      var u = session.usuario;
      var first = (u.nombre || '').split(' ')[0] || 'amigo';
      elUserGreeting.textContent = 'Hola, ' + first + ' 👋';
      elUserChip.classList.remove('hidden');
      elUserChip.classList.add('flex');
    } else {
      elUserChip.classList.add('hidden');
      elUserChip.classList.remove('flex');
    }
  }

  // ===== UI =====
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

    // Logout chip
    var logoutBtn = $('userChipLogout');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
      clearSession();
      showToast('Sesion cerrada', 'info');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && elSheet.classList.contains('is-open')) closeSheet();
    });
  }

  // ===== Menu =====
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

  function renderMenu() {
    elSkeleton.classList.add('hidden');
    elContent.classList.remove('hidden');
    var filtered = filterBySearch(menuData);
    var grouped = groupByCategoria(filtered);
    var html = '', firstVisible = null;
    CATS.forEach(function (cat) {
      var items = grouped[cat.id] || [];
      if (items.length === 0) return;
      if (!firstVisible) firstVisible = cat.id;
      html += ''
        + '<section id="cat-' + cat.id + '" class="categoria-section">'
        + '  <h2 class="categoria-title"><span>' + escapeHtml(cat.label) + '</span>'
        + '    <span class="categoria-count">' + items.length + '</span></h2>'
        + '  <div class="platos-grid">' + items.map(platoCard).join('') + '</div>'
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
      html += '<button class="cat-tab" role="tab" data-cat="' + cat.id + '">'
        + '<span class="cat-emoji">' + cat.emoji + '</span>'
        + '<span>' + escapeHtml(cat.label) + '</span></button>';
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
    var badgeHtml = p.disponible ? '' : '<span class="plato-badge is-out">Agotado</span>';
    var rating = ratingFor(p.id);
    return ''
      + '<article class="plato-card' + (p.disponible ? '' : ' plato-no-disponible') + '">'
      + '  <div class="plato-img-wrap">' + imgHtml + badgeHtml + '</div>'
      + '  <div class="plato-body">'
      + '    <h3 class="plato-name">' + escapeHtml(p.nombre) + '</h3>'
      + '    <span class="plato-rating">'
      + '      <svg class="star w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.05.36a.5.5 0 01.9 0L10.83 3.3a.5.5 0 00.38.27l3.24.47a.5.5 0 01.28.85l-2.34 2.28a.5.5 0 00-.15.45l.55 3.23a.5.5 0 01-.72.52L10 10.13l-2.9 1.52a.5.5 0 01-.72-.52l.55-3.23a.5.5 0 00-.15-.45L4.44 4.9a.5.5 0 01.28-.85l3.24-.47a.5.5 0 00.38-.27L10.05.36z"/></svg>'
      + '      ' + rating.toFixed(1) + ' <span class="text-ink-400">(124)</span></span>'
      + (p.descripcion ? '<p class="plato-desc">' + escapeHtml(p.descripcion) + '</p>' : '')
      + '    <div class="plato-foot">'
      + '      <span class="plato-precio">$' + formatPrecio(p.precio) + '</span>'
      + '    </div></div></article>';
  }
  function defaultEmojiFor(p) {
    var map = { entradas: '🥗', platos: '🍽️', bebidas: '🥤', postres: '🍰' };
    return map[p.categoria] || map[p.tipo] || '🍴';
  }
  function formatPrecio(n) {
    return (parseFloat(n) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ===== Bottom sheet =====
  function openSheet() {
    elSheet.classList.add('is-open');
    elBackdrop.classList.add('is-open');
    elSheet.setAttribute('aria-hidden', 'false');
    // Pre-rellenar con datos del usuario si esta logueado
    if (session && session.usuario) {
      $('r-nombre').value = session.usuario.nombre || '';
      $('r-telefono').value = session.usuario.telefono || '';
      // Mostrar nota informativa
      var note = $('loggedInNote');
      if (note) note.classList.remove('hidden');
    } else {
      var note = $('loggedInNote');
      if (note) note.classList.add('hidden');
    }
    setTimeout(function () { $('r-nombre').focus(); }, 320);
  }
  function closeSheet() {
    elSheet.classList.remove('is-open');
    elBackdrop.classList.remove('is-open');
    elSheet.setAttribute('aria-hidden', 'true');
    hideError();
  }
  function showError(msg) { elErrorBox.textContent = msg; elErrorBox.classList.remove('hidden'); }
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
    if (telefono.length < 7) return showError('Ingresa un WhatsApp valido (min 7 digitos)');
    if (!fecha) return showError('Selecciona una fecha');
    if (!hora) return showError('Selecciona una hora');
    if (!personasVal) return showError('Selecciona el numero de personas');

    setLoading(true);

    // Paso 1: login/registro (upsert del usuario)
    var authHeader = '';
    fetch('/api/public/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ nombre: nombre, telefono: telefono })
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
    .then(function (loginRes) {
      if (!loginRes.ok || !loginRes.json.success) throw new Error(loginRes.json.message || 'Error en login');
      saveSession(loginRes.json.data);
      authHeader = loginRes.json.data.token;
      // Paso 2: enviar la reserva con el token
      return fetch('/api/public/reservas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + authHeader
        },
        body: JSON.stringify({
          nombre: nombre, telefono: telefono, fecha: fecha, hora: hora,
          personas: parseInt(personasVal, 10), notas: notas
        })
      }).then(function (r2) { return r2.json().then(function (j) { return { ok: r2.ok, json: j }; }); });
    })
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

  // ===== Toast simple (sin SweetAlert para mantener la pagina ligera) =====
  function showToast(msg, type) {
    var t = document.createElement('div');
    t.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg ' +
      (type === 'info' ? 'bg-ink-800 text-white' : 'bg-leaf-600 text-white');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
})();
