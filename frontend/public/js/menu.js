// Corner House - Menu publico
// Flujo: Intro -> Login -> Menu con carrito + Mis Reservas + seleccion de mesa -> Reserva.

(function () {
  'use strict';

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
  function formatFechaBonita(yyyy_mm_dd) {
    var parts = String(yyyy_mm_dd).split('-');
    if (parts.length !== 3) return yyyy_mm_dd;
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    var meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return d.getDate() + ' ' + meses[d.getMonth()];
  }

  var session = null;
  var menuData = [];
  var activeCat = null;
  var cart = [];
  var searchQuery = '';
  var personas = 2;
  var mesas = [];
  var mesaSeleccionada = null;
  var misReservas = [];

  var $ = function (id) { return document.getElementById(id); };

  document.addEventListener('DOMContentLoaded', function () {
    session = loadSession();
    cart = loadCart();
    bindUI();
    setDefaultFecha();
    if (session) {
      showMenu();
      renderHeader();
      loadMenu();
      loadMisReservas();
    } else {
      showIntro();
    }
    renderCart();
  });

  // ===== Pantallas =====
  function showIntro() {
    toggle('introScreen', false); toggle('loginScreen', true); toggle('menuScreen', true); window.scrollTo(0, 0);
    // Si ya hay sesion guardada, cambiar texto del CTA
    var ctaText = $('introCtaText');
    if (ctaText) {
      ctaText.textContent = session ? 'Continuar mi reserva' : 'Explorar menu y reservar';
    }
  }
  function showLogin() { toggle('introScreen', true); toggle('loginScreen', false); toggle('menuScreen', true); window.scrollTo(0, 0); }
  function showMenu() { toggle('introScreen', true); toggle('loginScreen', true); toggle('menuScreen', false); window.scrollTo(0, 0); }
  function toggle(id, hide) { var el = $(id); if (el) el.classList.toggle('hidden', hide); }

  // ===== Session =====
  function loadSession() { try { var raw = localStorage.getItem(STORAGE_SESSION); if (!raw) return null; var s = JSON.parse(raw); if (!s || !s.token) return null; return s; } catch (e) { return null; } }
  function saveSession(s) { session = s; try { localStorage.setItem(STORAGE_SESSION, JSON.stringify(s)); } catch (e) {} renderHeader(); }
  function clearSession() { session = null; try { localStorage.removeItem(STORAGE_SESSION); } catch (e) {} renderHeader(); }
  function renderHeader() {
    if (!session || !session.usuario) return;
    var u = session.usuario;
    elHeaderSaludo.textContent = 'Hola, ' + ((u.nombre || '').split(' ')[0] || 'amigo') + '!';
    elHeaderNombre.textContent = u.nombre || '';
  }

  // ===== Cart =====
  function loadCart() { try { var raw = localStorage.getItem(STORAGE_CART); if (!raw) return []; var c = JSON.parse(raw); return Array.isArray(c) ? c : []; } catch (e) { return []; } }
  function saveCart() { try { localStorage.setItem(STORAGE_CART, JSON.stringify(cart)); } catch (e) {} }
  function cartSubtotal() { return cart.reduce(function (s, it) { return s + (it.precio * it.cantidad); }, 0); }
  function cartItemCount() { return cart.reduce(function (s, it) { return s + it.cantidad; }, 0); }
  function addToCart(plato) {
    var existing = null;
    for (var i = 0; i < cart.length; i++) if (cart[i].platoId === plato.id) { existing = cart[i]; break; }
    if (existing) existing.cantidad += 1;
    else cart.push({ platoId: plato.id, nombre: plato.nombre, precio: plato.precio, cantidad: 1, emoji: defaultEmojiFor(plato) });
    saveCart(); renderCart();
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
    saveCart(); renderCart();
  }
  function renderCart() {
    var count = cartItemCount();
    var subtotal = cartSubtotal();
    if (elCartFab) {
      if (count > 0) { elCartFab.classList.remove('hidden'); elCartFab.classList.add('flex'); elCartFabCount.textContent = count; elCartFabTotal.textContent = formatPrecio(subtotal); }
      else { elCartFab.classList.add('hidden'); elCartFab.classList.remove('flex'); }
    }
    if (elReservaBtnText) {
      elReservaBtnText.textContent = count > 0 ? 'Reservar mesa y pedir (' + formatPrecio(subtotal) + ')' : 'Reservar Mesa';
    }
    renderCartItems();
  }
  function renderCartItems() {
    if (cart.length === 0) {
      elCartItems.classList.add('hidden'); elCartTotals.classList.add('hidden'); elCartEmpty.classList.remove('hidden');
      return;
    }
    elCartEmpty.classList.add('hidden'); elCartItems.classList.remove('hidden'); elCartTotals.classList.remove('hidden');
    elCartSubtotal.textContent = formatPrecio(cartSubtotal());
    elCartItems.innerHTML = cart.map(function (it) {
      return '<div class="cart-item">'
        + '<div class="cart-item-emoji" aria-hidden="true">' + it.emoji + '</div>'
        + '<div class="cart-item-info"><p class="cart-item-name">' + escapeHtml(it.nombre) + '</p>'
        + '<p class="cart-item-price">' + formatPrecio(it.precio) + ' c/u</p></div>'
        + '<div class="cart-item-qty">'
        + '<button type="button" class="cart-qty-btn" data-qty="' + it.platoId + ':-1">−</button>'
        + '<span class="cart-qty-num">' + it.cantidad + '</span>'
        + '<button type="button" class="cart-qty-btn" data-qty="' + it.platoId + ':+1">+</button>'
        + '</div></div>';
    }).join('');
  }
  function openCart() { renderCart(); elCartSheet.classList.add('is-open'); elCartBackdrop.classList.add('is-open'); }
  function closeCart() { elCartSheet.classList.remove('is-open'); elCartBackdrop.classList.remove('is-open'); }
  function cartQtyFor(platoId) { for (var i = 0; i < cart.length; i++) if (cart[i].platoId === platoId) return cart[i].cantidad; return 0; }

  // ===== Mis Reservas =====
  function renderMisReservas() {
    if (misReservas.length === 0) {
      $('myReservasList').classList.add('hidden');
      $('myReservasEmpty').classList.remove('hidden');
      return;
    }
    $('myReservasEmpty').classList.add('hidden');
    $('myReservasList').classList.remove('hidden');
    $('myReservasList').innerHTML = misReservas.map(function (r) {
      var itemsTxt = (r.reserva_items && r.reserva_items.length > 0)
        ? '<p class="my-reserva-items">' + r.reserva_items.length + ' plato' + (r.reserva_items.length > 1 ? 's' : '') + ' · ' + formatPrecio(r.subtotal_platos) + '</p>'
        : '<p class="my-reserva-items">Solo mesa</p>';
      return '<div class="my-reserva-card" data-reserva="' + r.id + '">'
        + '<div class="my-reserva-head">'
        + '<span class="my-reserva-fecha">' + formatFechaBonita(r.fecha) + ' · ' + (r.hora || '').slice(0, 5) + '</span>'
        + '<span class="my-reserva-estado my-reserva-estado-' + r.estado + '">' + r.estado + '</span>'
        + '</div>'
        + '<p class="my-reserva-mesa">' + (r.mesa_nombre ? '<strong>' + escapeHtml(r.mesa_nombre) + '</strong> · ' : '') + r.personas + ' pers.</p>'
        + itemsTxt
        + (r.numero_venta ? '<p class="my-reserva-total">Pedido: ' + escapeHtml(r.numero_venta) + '</p>' : '')
        + '</div>';
    }).join('');
    // Click handler
    $('myReservasList').querySelectorAll('.my-reserva-card').forEach(function (c) {
      c.addEventListener('click', function () { /* TODO: ver detalle */ });
    });
  }
  function loadMisReservas() {
    if (!session) { misReservas = []; renderMisReservas(); return; }
    fetch('/api/public/mis-reservas', { headers: { 'Authorization': 'Bearer ' + session.token } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
      .then(function (res) {
        if (res.ok && res.json.success) { misReservas = res.json.data || []; renderMisReservas(); }
        else { misReservas = []; renderMisReservas(); }
      })
      .catch(function () { misReservas = []; renderMisReservas(); });
  }

  // ===== Mesas =====
  function loadMesas() {
    var fecha = elFecha.value;
    var hora = $('r-hora').value;
    if (!fecha || !hora) { mesas = []; renderMesas(); return; }
    fetch('/api/public/mesas-disponibles?fecha=' + encodeURIComponent(fecha) + '&hora=' + encodeURIComponent(hora))
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
      .then(function (res) {
        if (res.ok && res.json.success) { mesas = res.json.data || []; renderMesas(); }
        else { mesas = []; renderMesas(); }
      })
      .catch(function () { mesas = []; renderMesas(); });
  }
  function renderMesas() {
    var grid = $('mesasGrid');
    var hint = $('mesaHint');
    if (mesas.length === 0) {
      grid.innerHTML = '<p class="col-span-full text-center text-xs text-ink-400 py-3">No hay mesas registradas o cambia la fecha/hora.</p>';
      hint.textContent = 'Configura mesas en el panel admin.';
      return;
    }
    var disponibles = mesas.filter(function (m) { return m.disponible; }).length;
    hint.textContent = disponibles + ' mesa' + (disponibles !== 1 ? 's' : '') + ' libre' + (disponibles !== 1 ? 's' : '') + ' para tu horario.';
    grid.innerHTML = mesas.map(function (m) {
      var selectedClass = m.id === mesaSeleccionada ? ' is-selected' : '';
      var occupiedClass = !m.disponible ? ' is-occupied' : '';
      var disabled = !m.disponible ? 'disabled' : '';
      var estadoTxt = !m.disponible ? 'Ocupada' : (m.id === mesaSeleccionada ? 'Seleccionada' : 'Libre');
      return '<button type="button" class="mesa-btn' + selectedClass + occupiedClass + '" data-mesa="' + m.id + '" ' + disabled + '>'
        + '<span class="mesa-btn-nombre">' + escapeHtml(m.nombre) + '</span>'
        + '<span class="mesa-btn-estado">' + estadoTxt + '</span>'
        + '</button>';
    }).join('');
    grid.querySelectorAll('.mesa-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        mesaSeleccionada = b.getAttribute('data-mesa');
        $('r-mesa-id').value = mesaSeleccionada;
        renderMesas();
      });
    });
  }

  // ===== UI binding =====
  function bindUI() {
    // Form de la intro: 2 campos (nombre + WhatsApp) que disparan login
    var introForm = $('introQuickForm');
    if (introForm) {
      introForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (session) { showMenu(); loadMenu(); loadMisReservas(); return; }
        // Si no hay sesion, abrir el sheet de login con los datos pre-llenados
        showLogin();
        var name = $('intro-name').value.trim();
        var tel = $('intro-tel').value.trim();
        if (name) $('l-nombre').value = name;
        if (tel) $('l-telefono').value = tel;
      });
    }
    // Link "¿Ya tienes cuenta? Inicia sesion" (en la intro)
    var introLoginLinkBtn = $('introLoginLinkBtn');
    if (introLoginLinkBtn) {
      introLoginLinkBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (session) { showMenu(); loadMenu(); loadMisReservas(); return; }
        showLogin();
      });
    }
    $('loginBackBtn').addEventListener('click', function () { showIntro(); });
    $('loginForm').addEventListener('submit', submitLogin);
    $('headerLogoutBtn').addEventListener('click', function () {
      if (!confirm('Cerrar sesion? Tu pedido se mantendra.')) return;
      clearSession(); showIntro();
    });
    $('searchInput').addEventListener('input', function () { searchQuery = this.value.toLowerCase().trim(); renderMenu(); });
    $('retryBtn').addEventListener('click', loadMenu);
    $('refreshReservasBtn').addEventListener('click', loadMisReservas);
    $('myReservasCta').addEventListener('click', function () { openReserva(); });
    $('cartFab').addEventListener('click', openCart);
    $('closeCartBtn').addEventListener('click', closeCart);
    $('cartBackdrop').addEventListener('click', closeCart);
    $('cartEmptyCta').addEventListener('click', closeCart);
    $('cartItems').addEventListener('click', function (e) {
      var btn = e.target.closest('.cart-qty-btn');
      if (!btn) return;
      var parts = btn.getAttribute('data-qty').split(':');
      changeCartQty(parts[0], parseInt(parts[1], 10));
    });
    $('menuContent').addEventListener('click', function (e) {
      var btn = e.target.closest('.plato-add-btn');
      if (!btn) return;
      var id = btn.getAttribute('data-add');
      var plato = null;
      for (var i = 0; i < menuData.length; i++) if (menuData[i].id === id) { plato = menuData[i]; break; }
      if (plato) {
        addToCart(plato);
        var orig = btn.innerHTML;
        btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>';
        btn.classList.add('is-added');
        setTimeout(function () { btn.innerHTML = orig; btn.classList.remove('is-added'); }, 700);
      }
    });
    $('openReservaFab').addEventListener('click', openReserva);
    $('closeReservaBtn').addEventListener('click', closeReserva);
    $('reservaBackdrop').addEventListener('click', closeReserva);
    $('reservaForm').addEventListener('submit', submitReserva);
    $('reservaEditCartBtn').addEventListener('click', function () { closeReserva(); openCart(); });
    $('reloadMesasBtn').addEventListener('click', loadMesas);
    // Fecha/hora cambio -> recargar mesas
    elFecha.addEventListener('change', function () { mesaSeleccionada = null; $('r-mesa-id').value = ''; loadMesas(); });
    $('r-hora').addEventListener('change', function () { mesaSeleccionada = null; $('r-mesa-id').value = ''; loadMesas(); });
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
        if ($('reservaSheet').classList.contains('is-open')) closeReserva();
        else if ($('cartSheet').classList.contains('is-open')) closeCart();
      }
    });
  }
  function setDefaultFecha() {
    var d = new Date(); d.setDate(d.getDate() + 1);
    elFecha.value = d.toISOString().slice(0, 10);
    elFecha.min = new Date().toISOString().slice(0, 10);
  }

  // ===== Login =====
  function submitLogin(e) {
    e.preventDefault(); hideLoginError();
    var nombre = $('l-nombre').value.trim();
    var telefono = $('l-telefono').value.trim();
    var email = $('l-email').value.trim();
    if (nombre.length < 2) return showLoginError('Ingresa tu nombre completo');
    if (telefono.length < 7) return showLoginError('Ingresa un WhatsApp valido');
    setLoginLoading(true);
    fetch('/api/public/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre, telefono: telefono, email: email || undefined })
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
    .then(function (res) {
      if (!res.ok || !res.json.success) throw new Error(res.json.message || 'Error');
      saveSession(res.json.data);
      showMenu();
      loadMenu();
      loadMisReservas();
      showToast(res.json.message || 'Bienvenido', 'success');
    })
    .catch(function (err) { showLoginError(err.message || 'Error al crear la cuenta'); })
    .finally(function () { setLoginLoading(false); });
  }
  function setLoginLoading(on) {
    $('loginSubmitBtn').disabled = on;
    $('loginSubmitBtn').querySelector('.submit-label').classList.toggle('hidden', on);
    $('loginSubmitBtn').querySelector('.submit-spinner').classList.toggle('hidden', !on);
  }
  function showLoginError(msg) { var e = $('loginError'); e.textContent = msg; e.classList.remove('hidden'); }
  function hideLoginError() { $('loginError').classList.add('hidden'); }

  // ===== Menu =====
  function loadMenu() {
    $('menuSkeleton').classList.remove('hidden');
    $('menuContent').classList.add('hidden');
    $('menuError').classList.add('hidden');
    fetch('/api/public/menu').then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.json.success) throw new Error(res.json.message || 'Error');
        menuData = res.json.data || []; renderMenu();
      })
      .catch(function () { $('menuSkeleton').classList.add('hidden'); $('menuError').classList.remove('hidden'); });
  }
  function filterBySearch(p) { if (!searchQuery) return p; return p.filter(function (x) { return (x.nombre || '').toLowerCase().indexOf(searchQuery) !== -1 || (x.descripcion || '').toLowerCase().indexOf(searchQuery) !== -1; }); }
  function groupByCategoria(p) { var map = {}; CATS.forEach(function (c) { map[c.id] = []; }); p.forEach(function (x) { var cat = x.categoria || 'platos'; if (!map[cat]) map[cat] = []; map[cat].push(x); }); return map; }
  function defaultEmojiFor(p) { var map = { entradas: '🥗', platos: '🍽️', bebidas: '🥤', postres: '🍰' }; return map[p.categoria] || map[p.tipo] || '🍴'; }

  function renderMenu() {
    $('menuSkeleton').classList.add('hidden');
    $('menuContent').classList.remove('hidden');
    var filtered = filterBySearch(menuData);
    var grouped = groupByCategoria(filtered);
    var html = '', firstVisible = null;
    CATS.forEach(function (cat) {
      var items = grouped[cat.id] || [];
      if (items.length === 0) return;
      if (!firstVisible) firstVisible = cat.id;
      html += '<section id="cat-' + cat.id + '" class="categoria-section"><h2 class="categoria-title"><span>' + escapeHtml(cat.label) + '</span><span class="categoria-count">' + items.length + '</span></h2><div class="platos-grid">' + items.map(platoCard).join('') + '</div></section>';
    });
    $('menuContent').innerHTML = html || '<div class="text-center py-20 text-ink-500">' + (searchQuery ? 'No encontramos platos con "' + escapeHtml(searchQuery) + '"' : 'El menu estara disponible pronto.') + '</div>';
    renderTabs(grouped, firstVisible);
  }
  function renderTabs(grouped, firstVisible) {
    var html = '';
    CATS.forEach(function (cat) { var count = (grouped[cat.id] || []).length; if (count === 0) return;
      html += '<button class="cat-tab" role="tab" data-cat="' + cat.id + '"><span class="cat-emoji">' + cat.emoji + '</span><span>' + escapeHtml(cat.label) + '</span></button>';
    });
    $('catTabsList').innerHTML = html;
    $('catTabsList').querySelectorAll('.cat-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { var sec = document.getElementById('cat-' + tab.getAttribute('data-cat')); if (sec) { activeCat = tab.getAttribute('data-cat'); markActiveTab(); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    });
    if (firstVisible && !activeCat) { activeCat = firstVisible; markActiveTab(); }
    else if (firstVisible) { markActiveTab(); }
  }
  function markActiveTab() { $('catTabsList').querySelectorAll('.cat-tab').forEach(function (t) { t.classList.toggle('is-active', t.getAttribute('data-cat') === activeCat); }); }
  function platoCard(p) {
    var emoji = p.imagen_url ? '' : defaultEmojiFor(p);
    var imgHtml = p.imagen_url ? '<img src="' + escapeHtml(p.imagen_url) + '" alt="" loading="lazy">' : '<div class="plato-emoji" aria-hidden="true">' + emoji + '</div>';
    var inCart = cartQtyFor(p.id);
    var addBtnHtml;
    if (!p.disponible) {
      addBtnHtml = '<button class="plato-add-btn" disabled style="background:#cbd5e1;cursor:not-allowed;box-shadow:none"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg></button>';
    } else {
      addBtnHtml = '<button class="plato-add-btn' + (inCart > 0 ? ' is-added' : '') + '" data-add="' + p.id + '"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg></button>';
    }
    return '<article class="plato-card"><div class="plato-img-wrap">' + imgHtml + '</div><div class="plato-body">'
      + '<h3 class="plato-name">' + escapeHtml(p.nombre) + '</h3>'
      + '<span class="plato-rating"><svg class="star w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.05.36a.5.5 0 01.9 0L10.83 3.3a.5.5 0 00.38.27l3.24.47a.5.5 0 01.28.85l-2.34 2.28a.5.5 0 00-.15.45l.55 3.23a.5.5 0 01-.72.52L10 10.13l-2.9 1.52a.5.5 0 01-.72-.52l.55-3.23a.5.5 0 00-.15-.45L4.44 4.9a.5.5 0 01.28-.85l3.24-.47a.5.5 0 00.38-.27L10.05.36z"/></svg> ' + ratingFor(p.id).toFixed(1) + ' <span class="text-ink-400">(124)</span></span>'
      + (p.descripcion ? '<p class="plato-desc">' + escapeHtml(p.descripcion) + '</p>' : '')
      + '<div class="plato-foot"><span class="plato-precio">' + formatPrecio(p.precio) + '</span>' + addBtnHtml + '</div></div></article>';
  }

  // ===== Reserva =====
  function openReserva() {
    if (!session) { showLogin(); return; }
    mesaSeleccionada = null;
    $('r-mesa-id').value = '';
    renderReservaCartSummary();
    $('reservaSheet').classList.add('is-open');
    $('reservaBackdrop').classList.add('is-open');
    loadMesas();
  }
  function closeReserva() { $('reservaSheet').classList.remove('is-open'); $('reservaBackdrop').classList.remove('is-open'); hideReservaError(); }
  function renderReservaCartSummary() {
    if (cart.length === 0) { $('reservaCartSummary').classList.add('hidden'); return; }
    $('reservaCartSummary').classList.remove('hidden');
    $('reservaCartItems').innerHTML = cart.map(function (it) {
      return '<div class="flex items-center justify-between text-xs"><span class="text-gold-700 font-medium">' + it.cantidad + 'x ' + escapeHtml(it.nombre) + '</span><span class="text-gold-700 font-semibold">' + formatPrecio(it.precio * it.cantidad) + '</span></div>';
    }).join('');
    $('reservaCartTotal').textContent = formatPrecio(cartSubtotal());
  }
  function showReservaError(msg) { var e = $('reservaError'); e.textContent = msg; e.classList.remove('hidden'); }
  function hideReservaError() { $('reservaError').classList.add('hidden'); }

  function submitReserva(e) {
    e.preventDefault(); hideReservaError();
    if (!session) { showLogin(); return; }
    var fecha = elFecha.value;
    var hora = $('r-hora').value;
    var notas = $('r-notas').value.trim();
    var personasVal = $('r-personas').value;
    var mesaId = $('r-mesa-id').value || null;
    if (!fecha) return showReservaError('Selecciona una fecha');
    if (!hora) return showReservaError('Selecciona una hora');
    if (!personasVal) return showReservaError('Selecciona el numero de personas');

    setReservaLoading(true);
    var itemsPayload = cart.map(function (it) { return { plato_id: it.platoId, cantidad: it.cantidad }; });
    fetch('/api/public/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.token },
      body: JSON.stringify({
        nombre: session.usuario.nombre, telefono: session.usuario.telefono,
        email: session.usuario.email || undefined,
        fecha: fecha, hora: hora, personas: parseInt(personasVal, 10),
        notas: notas, mesa_id: mesaId, items: itemsPayload
      })
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
    .then(function (res) {
      if (!res.ok || !res.json.success) throw new Error(res.json.message || 'Error');
      var d = res.json.data || {};
      var itemsCount = d.items_count || 0;
      var fechaBonita = formatFechaBonita(d.fecha || fecha);
      var msg = 'Te esperamos el ' + fechaBonita + ' a las ' + (d.hora || hora).slice(0, 5)
        + ' para ' + (d.personas || personasVal) + ' persona' + ((d.personas || personasVal) === 1 ? '' : 's');
      if (d.mesa_nombre) msg += ' en ' + d.mesa_nombre;
      if (itemsCount > 0) msg += '. Plato(s): ' + itemsCount;
      msg += '.';
      $('successMsg').textContent = msg;
      showSuccess();
      cart = []; saveCart(); renderCart();
      elReservaForm.reset();
      document.querySelectorAll('.persona-pill').forEach(function (p) { p.classList.remove('is-active'); });
      var p2 = document.querySelector('.persona-pill[data-personas="2"]');
      if (p2) { p2.classList.add('is-active'); $('r-personas').value = 2; }
      setDefaultFecha();
      // Refrescar mis reservas
      setTimeout(function () { loadMisReservas(); }, 500);
    })
    .catch(function (err) { showReservaError(err.message || 'No pudimos enviar tu reserva'); })
    .finally(function () { setReservaLoading(false); });
  }
  function setReservaLoading(on) {
    $('reservaSubmitBtn').disabled = on;
    $('reservaSubmitBtn').querySelector('.submit-label').classList.toggle('hidden', on);
    $('reservaSubmitBtn').querySelector('.submit-spinner').classList.toggle('hidden', !on);
  }
  function showSuccess() {
    $('successOverlay').classList.add('is-open');
    setTimeout(function () { $('successOverlay').classList.remove('is-open'); closeReserva(); }, 3500);
  }

  // ===== Toast =====
  function showToast(msg, type) {
    var t = document.createElement('div');
    var bg = type === 'success' ? 'bg-ink-900' : (type === 'error' ? 'bg-rose-600' : 'bg-ink-800');
    t.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-xl text-sm font-semibold shadow-lg text-white ' + bg;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  // ===== DOM refs (despues de DOMContentLoaded) =====
  var elFecha = $('r-fecha');
  var elHeaderSaludo = $('headerSaludo');
  var elHeaderNombre = $('headerNombre');
  var elCartFab = $('cartFab');
  var elCartFabCount = $('cartFabCount');
  var elCartFabTotal = $('cartFabTotal');
  var elCartBackdrop = $('cartBackdrop');
  var elCartSheet = $('cartSheet');
  var elCartItems = $('cartItems');
  var elCartEmpty = $('cartEmpty');
  var elCartTotals = $('cartTotals');
  var elCartSubtotal = $('cartSubtotal');
  var elReservaBtnText = $('reservarBtnText');
})();
