// Corner House - Menu publico
// Flujo: Intro -> Login (nombre+WhatsApp+email) -> Menu con carrito -> Reserva.
// Persistencia: localStorage (session, cart).

(function () {
  'use strict';

  // ===== Config =====
  var CATS = [
    { id: 'entradas', label: 'Entradas', emoji: '🥗' },
    { id: 'platos',   label: 'Platos',   emoji: '🍽️' },
    { id: 'bebidas',  label: 'Bebidas',  emoji: '🥤' },
    { id: 'postres',  label: 'Postres',  emoji: '🍰' }
  ];
  var STORAGE_SESSION = 'ch_public_user_v1';
  var STORAGE_CART = 'ch_public_cart_v1';

  function ratingFor(id) {
    var n = 0, s = String(id || '');
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) & 0xffff;
    return 4.4 + (n % 7) * 0.1;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatPrecio(n) {
    return '$' + (parseFloat(n) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }

  // ===== State =====
  var session = null;
  var menuData = [];
  var activeCat = null;
  var cart = []; // { platoId, nombre, precio, cantidad, emoji }
  var searchQuery = '';
  var personas = 2;

  // ===== Elementos =====
  var $ = function (id) { return document.getElementById(id); };
  var elIntro = $('introScreen');
  var elLogin = $('loginScreen');
  var elMenu = $('menuScreen');
  var elCatTabs = $('catTabsList');
  var elMenuContent = $('menuContent');
  var elMenuSkeleton = $('menuSkeleton');
  var elMenuError = $('menuError');
  var elRetryBtn = $('retryBtn');
  var elSearch = $('searchInput');
  var elCartFab = $('cartFab');
  var elCartFabCount = $('cartFabCount');
  var elCartFabTotal = $('cartFabTotal');
  var elCartBackdrop = $('cartBackdrop');
  var elCartSheet = $('cartSheet');
  var elCartItems = $('cartItems');
  var elCartEmpty = $('cartEmpty');
  var elCartTotals = $('cartTotals');
  var elCartSubtotal = $('cartSubtotal');
  var elCloseCartBtn = $('closeCartBtn');
  var elCartEmptyCta = $('cartEmptyCta');
  var elReservaFab = $('openReservaFab');
  var elReservaBtnText = $('reservarBtnText');
  var elReservaBackdrop = $('reservaBackdrop');
  var elReservaSheet = $('reservaSheet');
  var elReservaForm = $('reservaForm');
  var elCloseReservaBtn = $('closeReservaBtn');
  var elFecha = $('r-fecha');
  var elReservaSubmit = $('reservaSubmitBtn');
  var elReservaError = $('reservaError');
  var elReservaCartSummary = $('reservaCartSummary');
  var elReservaCartItems = $('reservaCartItems');
  var elReservaCartTotal = $('reservaCartTotal');
  var elReservaEditCartBtn = $('reservaEditCartBtn');
  var elSuccess = $('successOverlay');
  var elSuccessMsg = $('successMsg');
  var elHeaderSaludo = $('headerSaludo');
  var elHeaderNombre = $('headerNombre');
  var elHeaderLogout = $('headerLogoutBtn');
  var elLoginBack = $('loginBackBtn');
  var elIntroStart = $('introStartBtn');
  var elLoginForm = $('loginForm');
  var elLoginSubmit = $('loginSubmitBtn');
  var elLoginError = $('loginError');

  // ===== Init =====
  document.addEventListener('DOMContentLoaded', function () {
    session = loadSession();
    cart = loadCart();
    bindUI();
    setDefaultFecha();
    // Decidir pantalla inicial
    if (session) {
      // Ya logueado: ir directo al menu
      showMenu();
      renderHeader();
      loadMenu();
    } else {
      showIntro();
    }
    renderCart();
  });

  // ===== Pantallas =====
  function showIntro() {
    elIntro.classList.remove('hidden');
    elLogin.classList.add('hidden');
    elMenu.classList.add('hidden');
    window.scrollTo(0, 0);
  }
  function showLogin() {
    elIntro.classList.add('hidden');
    elLogin.classList.remove('hidden');
    elMenu.classList.add('hidden');
    window.scrollTo(0, 0);
  }
  function showMenu() {
    elIntro.classList.add('hidden');
    elLogin.classList.add('hidden');
    elMenu.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  // ===== Session =====
  function loadSession() {
    try { var raw = localStorage.getItem(STORAGE_SESSION); if (!raw) return null;
      var s = JSON.parse(raw); if (!s || !s.token) return null; return s; }
    catch (e) { return null; }
  }
  function saveSession(s) {
    session = s;
    try { localStorage.setItem(STORAGE_SESSION, JSON.stringify(s)); } catch (e) {}
    renderHeader();
  }
  function clearSession() {
    session = null;
    try { localStorage.removeItem(STORAGE_SESSION); } catch (e) {}
    renderHeader();
  }
  function renderHeader() {
    if (!session || !session.usuario) return;
    var u = session.usuario;
    var first = (u.nombre || '').split(' ')[0] || 'amigo';
    elHeaderSaludo.textContent = 'Hola, ' + first + '!';
    elHeaderNombre.textContent = u.nombre || '';
  }

  // ===== Cart =====
  function loadCart() {
    try { var raw = localStorage.getItem(STORAGE_CART); if (!raw) return [];
      var c = JSON.parse(raw); return Array.isArray(c) ? c : []; }
    catch (e) { return []; }
  }
  function saveCart() {
    try { localStorage.setItem(STORAGE_CART, JSON.stringify(cart)); } catch (e) {}
  }
  function cartSubtotal() {
    return cart.reduce(function (s, it) { return s + (it.precio * it.cantidad); }, 0);
  }
  function cartItemCount() {
    return cart.reduce(function (s, it) { return s + it.cantidad; }, 0);
  }
  function addToCart(plato) {
    var existing = null;
    for (var i = 0; i < cart.length; i++) if (cart[i].platoId === plato.id) { existing = cart[i]; break; }
    if (existing) {
      existing.cantidad += 1;
    } else {
      cart.push({
        platoId: plato.id,
        nombre: plato.nombre,
        precio: plato.precio,
        cantidad: 1,
        emoji: defaultEmojiFor(plato)
      });
    }
    saveCart();
    renderCart();
    showToast('Anadido al pedido', 'success');
  }
  function changeCartQty(platoId, delta) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].platoId === platoId) {
        cart[i].cantidad += delta;
        if (cart[i].cantidad <= 0) cart.splice(i, 1);
        break;
      }
    }
    saveCart();
    renderCart();
  }
  function renderCart() {
    var count = cartItemCount();
    var subtotal = cartSubtotal();
    if (elCartFab) {
      if (count > 0) {
        elCartFab.classList.remove('hidden');
        elCartFab.classList.add('flex');
        elCartFabCount.textContent = count;
        elCartFabTotal.textContent = formatPrecio(subtotal);
      } else {
        elCartFab.classList.add('hidden');
        elCartFab.classList.remove('flex');
      }
    }
    // Texto del boton reservar
    if (elReservaBtnText) {
      elReservaBtnText.textContent = count > 0
        ? 'Reservar mesa y pedir (' + formatPrecio(subtotal) + ')'
        : 'Reservar Mesa';
    }
    // Render de items en el sheet de carrito
    renderCartItems();
  }
  function renderCartItems() {
    if (cart.length === 0) {
      elCartItems.classList.add('hidden');
      elCartTotals.classList.add('hidden');
      elCartEmpty.classList.remove('hidden');
      return;
    }
    elCartEmpty.classList.add('hidden');
    elCartItems.classList.remove('hidden');
    elCartTotals.classList.remove('hidden');
    elCartSubtotal.textContent = formatPrecio(cartSubtotal());
    elCartItems.innerHTML = cart.map(function (it) {
      return ''
        + '<div class="cart-item">'
        + '  <div class="cart-item-emoji" aria-hidden="true">' + it.emoji + '</div>'
        + '  <div class="cart-item-info">'
        + '    <p class="cart-item-name">' + escapeHtml(it.nombre) + '</p>'
        + '    <p class="cart-item-price">' + formatPrecio(it.precio) + ' c/u</p>'
        + '  </div>'
        + '  <div class="cart-item-qty">'
        + '    <button type="button" class="cart-qty-btn" data-qty="' + it.platoId + ':-1" aria-label="Quitar uno">−</button>'
        + '    <span class="cart-qty-num">' + it.cantidad + '</span>'
        + '    <button type="button" class="cart-qty-btn" data-qty="' + it.platoId + ':+1" aria-label="Anadir uno">+</button>'
        + '  </div>'
        + '</div>';
    }).join('');
  }
  function openCart() {
    renderCart();
    elCartSheet.classList.add('is-open');
    elCartBackdrop.classList.add('is-open');
    elCartSheet.setAttribute('aria-hidden', 'false');
  }
  function closeCart() {
    elCartSheet.classList.remove('is-open');
    elCartBackdrop.classList.remove('is-open');
    elCartSheet.setAttribute('aria-hidden', 'true');
  }

  // ===== UI binding =====
  function bindUI() {
    // Intro
    elIntroStart.addEventListener('click', function () {
      // Si ya tiene sesion, ir directo al menu
      if (session) { showMenu(); loadMenu(); return; }
      showLogin();
    });
    // Login back
    elLoginBack.addEventListener('click', function () { showIntro(); });
    // Login form
    elLoginForm.addEventListener('submit', submitLogin);
    // Header logout
    elHeaderLogout.addEventListener('click', function () {
      if (!confirm('Cerrar sesion? Tu pedido se mantendra.')) return;
      clearSession();
      showIntro();
    });
    // Search
    elSearch.addEventListener('input', function () {
      searchQuery = this.value.toLowerCase().trim();
      renderMenu();
    });
    // Retry
    elRetryBtn.addEventListener('click', loadMenu);
    // Cart FAB
    elCartFab.addEventListener('click', openCart);
    // Cart close
    elCloseCartBtn.addEventListener('click', closeCart);
    elCartBackdrop.addEventListener('click', closeCart);
    elCartEmptyCta.addEventListener('click', closeCart);
    // Cart qty buttons (delegation)
    elCartItems.addEventListener('click', function (e) {
      var btn = e.target.closest('.cart-qty-btn');
      if (!btn) return;
      var parts = btn.getAttribute('data-qty').split(':');
      changeCartQty(parts[0], parseInt(parts[1], 10));
    });
    // Add to cart buttons (delegation en menuContent)
    elMenuContent.addEventListener('click', function (e) {
      var btn = e.target.closest('.plato-add-btn');
      if (!btn) return;
      var id = btn.getAttribute('data-add');
      var plato = null;
      for (var i = 0; i < menuData.length; i++) if (menuData[i].id === id) { plato = menuData[i]; break; }
      if (plato) {
        addToCart(plato);
        // Animacion: cambiar a check brevemente
        var orig = btn.innerHTML;
        btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>';
        btn.classList.add('is-added');
        setTimeout(function () {
          btn.innerHTML = orig;
          btn.classList.remove('is-added');
        }, 700);
      }
    });
    // Reserva FAB
    elReservaFab.addEventListener('click', openReserva);
    elCloseReservaBtn.addEventListener('click', closeReserva);
    elReservaBackdrop.addEventListener('click', closeReserva);
    elReservaForm.addEventListener('submit', submitReserva);
    elReservaEditCartBtn.addEventListener('click', function () { closeReserva(); openCart(); });
    // Personas
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
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (elReservaSheet.classList.contains('is-open')) closeReserva();
        else if (elCartSheet.classList.contains('is-open')) closeCart();
      }
    });
  }
  function setDefaultFecha() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    elFecha.value = d.toISOString().slice(0, 10);
    elFecha.min = new Date().toISOString().slice(0, 10);
  }

  // ===== Login flow =====
  function submitLogin(e) {
    e.preventDefault();
    hideLoginError();
    var nombre = $('l-nombre').value.trim();
    var telefono = $('l-telefono').value.trim();
    var email = $('l-email').value.trim();
    if (nombre.length < 2) return showLoginError('Ingresa tu nombre completo');
    if (telefono.length < 7) return showLoginError('Ingresa un WhatsApp valido (min 7 digitos)');
    setLoginLoading(true);
    fetch('/api/public/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre, telefono: telefono, email: email || undefined })
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
    .then(function (res) {
      if (!res.ok || !res.json.success) throw new Error(res.json.message || 'Error');
      saveSession(res.json.data);
      showMenu();
      loadMenu();
      showToast(res.json.message || 'Bienvenido', 'success');
    })
    .catch(function (err) { showLoginError(err.message || 'Error al crear la cuenta'); })
    .finally(function () { setLoginLoading(false); });
  }
  function setLoginLoading(on) {
    elLoginSubmit.disabled = on;
    elLoginSubmit.querySelector('.submit-label').classList.toggle('hidden', on);
    elLoginSubmit.querySelector('.submit-spinner').classList.toggle('hidden', !on);
  }
  function showLoginError(msg) { elLoginError.textContent = msg; elLoginError.classList.remove('hidden'); }
  function hideLoginError() { elLoginError.classList.add('hidden'); }

  // ===== Menu =====
  function loadMenu() {
    elMenuSkeleton.classList.remove('hidden');
    elMenuContent.classList.add('hidden');
    elMenuError.classList.add('hidden');
    fetch('/api/public/menu', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.json.success) throw new Error(res.json.message || 'Error');
        menuData = res.json.data || [];
        renderMenu();
      })
      .catch(function (err) {
        console.error('[menu] error:', err);
        elMenuSkeleton.classList.add('hidden');
        elMenuError.classList.remove('hidden');
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
  function defaultEmojiFor(p) {
    var map = { entradas: '🥗', platos: '🍽️', bebidas: '🥤', postres: '🍰' };
    return map[p.categoria] || map[p.tipo] || '🍴';
  }
  function cartQtyFor(platoId) {
    for (var i = 0; i < cart.length; i++) if (cart[i].platoId === platoId) return cart[i].cantidad;
    return 0;
  }
  function renderMenu() {
    elMenuSkeleton.classList.add('hidden');
    elMenuContent.classList.remove('hidden');
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
      elMenuContent.innerHTML = '<div class="text-center py-20 text-ink-500">'
        + (searchQuery ? 'No encontramos platos con "' + escapeHtml(searchQuery) + '"' : 'El menu estara disponible pronto.')
        + '</div>';
    } else {
      elMenuContent.innerHTML = html;
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
    elCatTabs.innerHTML = html;
    elCatTabs.querySelectorAll('.cat-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { scrollToCat(tab.getAttribute('data-cat')); });
    });
    if (firstVisible && !activeCat) { activeCat = firstVisible; markActiveTab(); }
    else if (firstVisible) { markActiveTab(); }
  }
  function markActiveTab() {
    elCatTabs.querySelectorAll('.cat-tab').forEach(function (t) {
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
    var rating = ratingFor(p.id);
    var inCart = cartQtyFor(p.id);
    var addBtnHtml;
    if (!p.disponible) {
      addBtnHtml = '<button class="plato-add-btn" disabled style="background:#cbd5e1;cursor:not-allowed;box-shadow:none" aria-label="No disponible"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg></button>';
    } else {
      addBtnHtml = '<button class="plato-add-btn' + (inCart > 0 ? ' is-added' : '') + '" data-add="' + p.id + '" aria-label="Anadir al pedido"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg></button>';
    }
    return ''
      + '<article class="plato-card">'
      + '  <div class="plato-img-wrap">' + imgHtml + '</div>'
      + '  <div class="plato-body">'
      + '    <h3 class="plato-name">' + escapeHtml(p.nombre) + '</h3>'
      + '    <span class="plato-rating">'
      + '      <svg class="star w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.05.36a.5.5 0 01.9 0L10.83 3.3a.5.5 0 00.38.27l3.24.47a.5.5 0 01.28.85l-2.34 2.28a.5.5 0 00-.15.45l.55 3.23a.5.5 0 01-.72.52L10 10.13l-2.9 1.52a.5.5 0 01-.72-.52l.55-3.23a.5.5 0 00-.15-.45L4.44 4.9a.5.5 0 01.28-.85l3.24-.47a.5.5 0 00.38-.27L10.05.36z"/></svg>'
      + '      ' + rating.toFixed(1) + ' <span class="text-ink-400">(124)</span></span>'
      + (p.descripcion ? '<p class="plato-desc">' + escapeHtml(p.descripcion) + '</p>' : '')
      + '    <div class="plato-foot">'
      + '      <span class="plato-precio">' + formatPrecio(p.precio) + '</span>'
      + '      ' + addBtnHtml
      + '    </div>'
      + '  </div>'
      + '</article>';
  }

  // ===== Reserva flow =====
  function openReserva() {
    // Si no hay sesion, ir a login primero
    if (!session) { showLogin(); return; }
    renderReservaCartSummary();
    elReservaSheet.classList.add('is-open');
    elReservaBackdrop.classList.add('is-open');
    elReservaSheet.setAttribute('aria-hidden', 'false');
  }
  function closeReserva() {
    elReservaSheet.classList.remove('is-open');
    elReservaBackdrop.classList.remove('is-open');
    elReservaSheet.setAttribute('aria-hidden', 'true');
    hideReservaError();
  }
  function renderReservaCartSummary() {
    if (cart.length === 0) {
      elReservaCartSummary.classList.add('hidden');
      return;
    }
    elReservaCartSummary.classList.remove('hidden');
    elReservaCartItems.innerHTML = cart.map(function (it) {
      return '<div class="flex items-center justify-between text-xs">'
        + '<span class="text-brand-900 font-medium">' + it.cantidad + 'x ' + escapeHtml(it.nombre) + '</span>'
        + '<span class="text-brand-700 font-semibold">' + formatPrecio(it.precio * it.cantidad) + '</span>'
        + '</div>';
    }).join('');
    elReservaCartTotal.textContent = formatPrecio(cartSubtotal());
  }
  function showReservaError(msg) { elReservaError.textContent = msg; elReservaError.classList.remove('hidden'); }
  function hideReservaError() { elReservaError.classList.add('hidden'); }

  function submitReserva(e) {
    e.preventDefault();
    hideReservaError();
    if (!session) { showLogin(); return; }
    var fecha = elFecha.value;
    var hora = $('r-hora').value;
    var notas = $('r-notas').value.trim();
    var personasVal = $('r-personas').value;
    if (!fecha) return showReservaError('Selecciona una fecha');
    if (!hora) return showReservaError('Selecciona una hora');
    if (!personasVal) return showReservaError('Selecciona el numero de personas');

    setReservaLoading(true);

    var itemsPayload = cart.map(function (it) {
      return { plato_id: it.platoId, cantidad: it.cantidad };
    });

    fetch('/api/public/reservas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + session.token
      },
      body: JSON.stringify({
        nombre: session.usuario.nombre,
        telefono: session.usuario.telefono,
        email: session.usuario.email || undefined,
        fecha: fecha,
        hora: hora,
        personas: parseInt(personasVal, 10),
        notas: notas,
        items: itemsPayload
      })
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
    .then(function (res) {
      if (!res.ok || !res.json.success) throw new Error(res.json.message || 'Error al enviar');
      var d = res.json.data || {};
      var itemsCount = d.items_count || 0;
      var fechaBonita = formatFechaBonita(d.fecha || fecha);
      var msg = 'Te esperamos el ' + fechaBonita + ' a las ' + (d.hora || hora).slice(0, 5)
        + ' para ' + (d.personas || personasVal) + ' persona' + ((d.personas || personasVal) === 1 ? '' : 's');
      if (itemsCount > 0) msg += '. Plato(s): ' + itemsCount;
      msg += '.';
      elSuccessMsg.textContent = msg;
      showSuccess();
      // Limpiar carrito
      cart = [];
      saveCart();
      renderCart();
      elReservaForm.reset();
      document.querySelectorAll('.persona-pill').forEach(function (p) { p.classList.remove('is-active'); });
      var p2 = document.querySelector('.persona-pill[data-personas="2"]');
      if (p2) { p2.classList.add('is-active'); $('r-personas').value = 2; }
      setDefaultFecha();
    })
    .catch(function (err) { showReservaError(err.message || 'No pudimos enviar tu reserva'); })
    .finally(function () { setReservaLoading(false); });
  }
  function setReservaLoading(on) {
    elReservaSubmit.disabled = on;
    elReservaSubmit.querySelector('.submit-label').classList.toggle('hidden', on);
    elReservaSubmit.querySelector('.submit-spinner').classList.toggle('hidden', !on);
  }
  function showSuccess() {
    elSuccess.classList.add('is-open');
    setTimeout(function () {
      elSuccess.classList.remove('is-open');
      closeReserva();
    }, 3200);
  }
  function formatFechaBonita(yyyy_mm_dd) {
    var parts = String(yyyy_mm_dd).split('-');
    if (parts.length !== 3) return yyyy_mm_dd;
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return d.getDate() + ' de ' + meses[d.getMonth()];
  }

  // ===== Toast simple =====
  function showToast(msg, type) {
    var t = document.createElement('div');
    var bg = type === 'success' ? 'bg-brand-600' : (type === 'error' ? 'bg-rose-600' : 'bg-ink-800');
    t.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-xl text-sm font-semibold shadow-lg text-white ' + bg;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }
})();
