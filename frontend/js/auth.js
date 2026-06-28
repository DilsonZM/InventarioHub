document.addEventListener('DOMContentLoaded', async () => {
  if (API.isAuthenticated()) {
    window.location.href = '/index.html';
    return;
  }

  // Mostrar link de visitante si modo publico esta activo
  try {
    const cfg = await API.config.get();
    if (cfg.data && cfg.data.modoPublico) {
      const visitorLink = document.getElementById('visitorLink');
      if (visitorLink) visitorLink.classList.remove('hidden');
    }
  } catch (e) {}

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotForm');
  const panelHeader = document.getElementById('panelHeader');
  const views = {
    login: document.querySelector('[data-view="login"]'),
    register: document.querySelector('[data-view="register"]'),
    forgot: document.querySelector('[data-view="forgot"]')
  };

  const HEADER_CONTENT = {
    login: {
      kicker: 'Bienvenido',
      title: 'Accede a tu panel',
      subtitle: 'Ingresa con tu usuario para empezar a gestionar la operacion del restaurante.'
    },
    register: {
      kicker: 'Crear cuenta',
      title: 'Solicita tu acceso',
      subtitle: 'Completa el formulario y un administrador aprobara tu solicitud.'
    },
    forgot: {
      kicker: 'Recuperar acceso',
      title: 'Restablecer contrasena',
      subtitle: 'Te enviamos un enlace al correo asociado a tu cuenta.'
    }
  };

  function setHeader(name) {
    const c = HEADER_CONTENT[name] || HEADER_CONTENT.login;
    if (!panelHeader) return;
    panelHeader.querySelector('[data-header-kicker]').textContent = c.kicker;
    panelHeader.querySelector('[data-header-title]').textContent = c.title;
    panelHeader.querySelector('[data-header-subtitle]').textContent = c.subtitle;
  }

  function switchView(name) {
    if (!views[name]) return;
    Object.keys(views).forEach(function (k) {
      views[k].classList.toggle('hidden', k !== name);
    });
    setHeader(name);
    document.querySelectorAll('[id$="Error"], #forgotSuccess').forEach(function (el) {
      el.classList.add('hidden');
    });
    setTimeout(function () {
      var firstInput = views[name].querySelector('input:not([type=hidden])');
      if (firstInput) firstInput.focus();
    }, 50);
  }

  // Switchers (login <-> register, forgot, etc.)
  document.querySelectorAll('[data-switch]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchView(btn.getAttribute('data-switch'));
    });
  });

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    var spinner = btn.querySelector('[data-spinner]');
    if (spinner) spinner.classList.toggle('hidden', !loading);
    var label = btn.querySelector('[data-label]') || btn.querySelector('span');
    if (loading) {
      if (label) {
        btn.setAttribute('data-original-label', label.textContent);
        label.textContent = btn.getAttribute('data-loading-text') || 'Procesando...';
      }
    } else if (label && btn.getAttribute('data-original-label')) {
      label.textContent = btn.getAttribute('data-original-label');
    }
  }

  function showError(containerId, message) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!message) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden', 'bg-emerald-500/10', 'border-emerald-500/20');
    el.classList.add('bg-red-500/10', 'border-red-500/20');
    var p = el.querySelector('p');
    if (p) {
      p.classList.remove('text-emerald-300');
      p.classList.add('text-red-300');
      p.textContent = message;
    }
  }

  function showSuccess(containerId, message) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.classList.remove('hidden');
    var p = el.querySelector('p');
    if (p) p.textContent = message;
  }

  function animateExit(callback) {
    var container = document.querySelector('.login-shell');
    if (container) {
      container.style.transition = 'opacity 0.25s ease-out, transform 0.25s ease-out';
      container.style.opacity = '0';
      container.style.transform = 'scale(0.96)';
    }
    // Ocultar hamburguesa / menu toggle durante la transicion
    var menuToggle = document.querySelector('button[aria-label="Alternar menú"]');
    if (menuToggle) menuToggle.style.display = 'none';

    setTimeout(function () {
      showLoginLoading(['Bienvenido!', 'Cargando tu espacio...'], callback);
    }, 250);
  }

  function showLoginLoading(steps, callback) {
    if (typeof Swal === 'undefined') { callback(); return; }
    var s = 0;
    Swal.fire({
      title: steps[0],
      html: '<div class="pos-loading"><div class="pos-loading-ring"></div><div class="pos-loading-dots"><span></span><span></span><span></span></div></div>',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      backdrop: 'rgba(0,0,0,0.55)',
      customClass: { popup: 'pos-loading-popup', title: 'pos-loading-title', container: 'swal2-backdrop-show' },
      didOpen: function () {
        function next() {
          s++;
          if (s >= steps.length) {
            setTimeout(function () { Swal.close(); if (callback) callback(); }, 400);
            return;
          }
          var titleEl = document.querySelector('.swal2-title');
          if (titleEl) {
            titleEl.style.opacity = '0';
            titleEl.style.transition = 'opacity 0.3s ease';
            setTimeout(function () {
              titleEl.textContent = steps[s];
              titleEl.style.opacity = '1';
            }, 300);
          }
          setTimeout(next, 1500);
        }
        setTimeout(next, 1500);
      }
    });
  }

  // === LOGIN ===
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var username = document.getElementById('loginUsername').value.trim();
      var password = document.getElementById('loginPassword').value;
      var btn = document.getElementById('loginBtn');

      if (!username || !password) {
        showError('loginError', 'Completa usuario y contrasena');
        return;
      }

      setLoading(btn, true);
      try {
        var res = await API.auth.login(username, password);
        API.setToken(res.data.token);
        API.setUser(res.data.user);
        animateExit(function () { window.location.href = '/index.html'; });
      } catch (err) {
        showError('loginError', err.message);
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // === REGISTER ===
  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var username = document.getElementById('regUsername').value.trim();
      var password = document.getElementById('regPassword').value;
      var nombreCompleto = (document.getElementById('regNombreCompleto') || {}).value || '';
      var email = (document.getElementById('regEmail') || {}).value || '';
      var btn = document.getElementById('registerBtn');

      if (!username || !password) {
        showError('registerError', 'Completa usuario y contrasena');
        return;
      }
      if (!email) {
        showError('registerError', 'El correo electronico es obligatorio');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        showError('registerError', 'El correo no tiene un formato valido');
        return;
      }

      setLoading(btn, true);
      try {
        var res = await API.auth.register(username, password, nombreCompleto, email);
        var okMsg = (res.data && res.data.message) || 'Solicitud enviada. Un administrador la revisara.';
        var okEl = document.getElementById('registerError');
        okEl.classList.remove('hidden', 'bg-red-500/10', 'border-red-500/20');
        okEl.classList.add('bg-emerald-500/10', 'border-emerald-500/20');
        var p = okEl.querySelector('p');
        p.classList.remove('text-red-300');
        p.classList.add('text-emerald-300');
        p.textContent = okMsg;
        registerForm.reset();
      } catch (err) {
        showError('registerError', err.message);
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // === FORGOT PASSWORD ===
  if (forgotForm) {
    forgotForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = (document.getElementById('forgotEmail') || {}).value || '';
      var btn = document.getElementById('forgotBtn');

      if (!email) {
        showError('forgotError', 'Ingresa tu correo electronico');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        showError('forgotError', 'El correo no tiene un formato valido');
        return;
      }

      setLoading(btn, true);
      try {
        var res = await API.request('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim().toLowerCase() })
        });
        showSuccess('forgotSuccess', (res.data && res.data.message) || 'Si el correo coincide, te enviamos las instrucciones.');
        showError('forgotError', '');
        forgotForm.reset();
      } catch (err) {
        showError('forgotError', err.message);
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // Autologin: Enter dentro de un input del form dispara el submit.
  // (Por defecto un <form> con <button type=submit> ya hace esto, pero lo
  // dejamos explicito para inputs de password y para que cualquier Enter
  // en el login funcione aunque el foco no este en el boton).
  ['loginUsername', 'loginPassword'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (loginForm) {
        if (typeof loginForm.requestSubmit === 'function') loginForm.requestSubmit();
        else loginForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });
  });
});
