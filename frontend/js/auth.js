document.addEventListener('DOMContentLoaded', () => {
  if (API.isAuthenticated()) {
    window.location.href = '/index.html';
    return;
  }

  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  function switchTab(tab) {
    const isLogin = tab === 'login';
    tabLogin.classList.toggle('bg-gradient-to-r', isLogin);
    tabLogin.classList.toggle('from-blue-600', isLogin);
    tabLogin.classList.toggle('to-blue-500', isLogin);
    tabLogin.classList.toggle('text-white', isLogin);
    tabLogin.classList.toggle('shadow-lg', isLogin);
    tabLogin.classList.toggle('shadow-blue-500/20', isLogin);
    tabLogin.classList.toggle('text-slate-400', !isLogin);

    tabRegister.classList.toggle('bg-gradient-to-r', !isLogin);
    tabRegister.classList.toggle('from-emerald-600', !isLogin);
    tabRegister.classList.toggle('to-emerald-500', !isLogin);
    tabRegister.classList.toggle('text-white', !isLogin);
    tabRegister.classList.toggle('shadow-lg', !isLogin);
    tabRegister.classList.toggle('shadow-emerald-500/20', !isLogin);
    tabRegister.classList.toggle('text-slate-400', isLogin);

    loginForm.classList.toggle('hidden', !isLogin);
    registerForm.classList.toggle('hidden', isLogin);

    document.querySelectorAll('[id$="Error"]').forEach(el => el.classList.add('hidden'));
  }

  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));

  function setLoading(btn, loading) {
    btn.disabled = loading;
    const spinner = btn.querySelector('[data-spinner]');
    if (spinner) spinner.classList.toggle('hidden', !loading);
  }

  function showError(containerId, message) {
    const el = document.getElementById(containerId);
    el.classList.remove('hidden');
    el.querySelector('p').textContent = message;
  }

  function animateExit(callback) {
    const container = document.querySelector('.min-h-\\[100dvh\\]');
    if (container) {
      container.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      container.style.opacity = '0';
      container.style.transform = 'scale(0.98)';
      setTimeout(callback, 280);
    } else {
      callback();
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');

    if (!username || !password) {
      showError('loginError', 'Completa todos los campos');
      return;
    }

    setLoading(btn, true);
    try {
      const res = await API.auth.login(username, password);
      API.setToken(res.data.token);
      API.setUser(res.data.user);
      animateExit(() => { window.location.href = '/index.html'; });
    } catch (err) {
      showError('loginError', err.message);
    } finally {
      setLoading(btn, false);
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    const btn = document.getElementById('registerBtn');

    if (!username || !password) {
      showError('registerError', 'Completa todos los campos');
      return;
    }

    setLoading(btn, true);
    try {
      const res = await API.auth.register(username, password, role);
      API.setToken(res.data.token);
      API.setUser(res.data.user);
      animateExit(() => { window.location.href = '/index.html'; });
    } catch (err) {
      showError('registerError', err.message);
    } finally {
      setLoading(btn, false);
    }
  });
});
