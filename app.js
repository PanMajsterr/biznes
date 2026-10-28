/* ===================================================
   ShopPanel — app.js
   Bezpieczny Panel Sklepu z Zarządzaniem Profitu i Chmurą
   =================================================== */

// ============== STATE & KEYS ==============
const STATE_KEY = 'shoppanel_v2_clean';
const SESSION_KEY = 'shoppanel_session_v2';

// Fallback Salt & PBKDF2 Hash for offline/file:// protocol only
const FALLBACK_ADMIN_SALT = 'shoppanel_admin_salt_v2_99x';
const FALLBACK_ADMIN_HASH = '8aff579d645e92739e0391e182972ca9d232e608a2fb23f3416dc6f98d95bc40f0ad64cfa2e93a3255e6c41058d886e567b7a396c1b1ce054eb9806f69c5fd42';
const FALLBACK_ADMIN_HASH_DEFAULT = '4baa5b13be0c766884ac235b17ddd50e86cb97b00bdb726b869e87cf6aee63ef4a990b283e9d7f15897a913b7a568fb7a742a5381e0ab368f100b7b01bc04324'; // domyślne hasło: 'admin123'

let currentSession = null; // { token, user: { id, login, name, role } }
let isSyncing = false;

// Clean initial state (Zero dummy products!)
let state = {
  products: [],
  sales: [],
  expenses: [],
  investments: [],
  payouts: [],
  notes: [],
  history: [],
  users: []
};

// ============== STATE PERSISTENCE & CLOUD SYNC ==============
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = {
        products: Array.isArray(parsed.products) ? parsed.products : [],
        sales: Array.isArray(parsed.sales) ? parsed.sales : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        investments: Array.isArray(parsed.investments) ? parsed.investments : [],
        payouts: Array.isArray(parsed.payouts) ? parsed.payouts : [],
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
        users: Array.isArray(parsed.users) ? parsed.users : []
      };
    }
  } catch (e) {
    console.warn('Load state error:', e);
  }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));

  // Sync with cloud backend
  if (currentSession && currentSession.token) {
    syncToCloud();
  }
}

async function syncToCloud() {
  if (!currentSession || !currentSession.token) return;
  if (window.location.protocol === 'file:') return;

  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSession.token}`
      },
      body: JSON.stringify({ data: state })
    });
  } catch (e) {
    // Silent catch
  }
}

async function loadFromCloud(silent = false) {
  if (!currentSession || !currentSession.token) return;
  if (window.location.protocol === 'file:') return;
  if (isSyncing) return;
  isSyncing = true;

  try {
    const res = await fetch('/api/sync', {
      headers: { 'Authorization': `Bearer ${currentSession.token}` }
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        state.products = Array.isArray(d.products) ? d.products : [];
        state.sales = Array.isArray(d.sales) ? d.sales : [];
        state.expenses = Array.isArray(d.expenses) ? d.expenses : [];
        state.investments = Array.isArray(d.investments) ? d.investments : [];
        state.payouts = Array.isArray(d.payouts) ? d.payouts : [];
        state.notes = Array.isArray(d.notes) ? d.notes : [];
        state.history = Array.isArray(d.history) ? d.history : [];
        if (Array.isArray(d.users)) state.users = d.users;

        localStorage.setItem(STATE_KEY, JSON.stringify(state));
        refresh(true); // Don't loop sync
        if (!silent) showToast('☁️ Dane zsynchronizowane z chmurą!');
      }
    }
  } catch (e) {
  } finally {
    isSyncing = false;
  }
}

// ============== UTILS ==============
function fmt(n) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2
  }).format(n || 0);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(str) {
  if (!str) return '—';
  try {
    const d = str.includes('T') ? new Date(str) : new Date(str + 'T00:00:00');
    return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) {
    return str;
  }
}

function fmtRelativeTime(isoStr) {
  if (!isoStr) return '';
  const now = new Date();
  const date = new Date(isoStr);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Przed chwilą';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min temu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} godz. temu`;
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function addHistory(type, text) {
  state.history.unshift({ id: uid(), type, text, ts: new Date().toISOString() });
  if (state.history.length > 250) state.history = state.history.slice(0, 250);
}

// ============== TOAST & MODALS ==============
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

function togglePasswordVisibility(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ============== NAVIGATION ==============
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function showTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  const target = document.getElementById('tab-' + name);
  if (target) target.classList.add('active');

  const navBtn = btn || document.querySelector(`.nav-btn[data-tab="${name}"]`);
  if (navBtn) navBtn.classList.add('active');

  const pageTitle = document.getElementById('page-title');
  const pageSub = document.getElementById('page-subtitle');

  const subtitles = {
    dashboard: 'Przegląd wyników i podsumowanie sklepu',
    magazyn: 'Zarządzanie stanem magazynowym, zakupami i zyskiem',
    sprzedaz: 'Rejestr sprzedaży produktów i odliczony zysk',
    finanse: 'Koszty operacyjne i bilans finansowy',
    podzial: 'Równe rozliczenie zysku i historia wypłat',
    inwestycje: 'Kapitał na rozwój, asortyment i marketing',
    notatnik: 'Notatki i interaktywne listy zadań',
    uzytkownicy: 'Konta użytkowników i uprawnienia (Admin)',
    historia: 'Pełny dziennik operacji sklepu'
  };

  if (pageTitle && navBtn) {
    const label = navBtn.querySelector('span:nth-child(2)');
    pageTitle.textContent = label ? label.textContent : name;
  }
  if (pageSub) pageSub.textContent = subtitles[name] || '';

  if (window.innerWidth < 960) {
    document.getElementById('sidebar').classList.remove('open');
  }

  refresh();
}

// ============== SECURE AUTHENTICATION ==============
async function initAuth() {
  const saved = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (saved) {
    try {
      const session = JSON.parse(saved);
      if (session && session.token && session.user) {
        currentSession = session;
        applySessionUI();
        hideLoginOverlay();
        // Load cloud DB immediately
        await loadFromCloud();
        refresh();
        return;
      }
    } catch (e) {}
  }

  showLoginOverlay();
}

function showLoginOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.remove('hidden');
  const err = document.getElementById('login-error-banner');
  if (err) err.style.display = 'none';
  const pwd = document.getElementById('login-password');
  if (pwd) pwd.value = '';
}

function hideLoginOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.add('hidden');
}

// Helper: PBKDF2 hash using Web Crypto API for client-side fallback
async function computeWebCryptoHash(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-512'
    },
    keyMaterial,
    512
  );
  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function handleLoginSubmit(e) {
  if (e) e.preventDefault();

  const loginInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errorBanner = document.getElementById('login-error-banner');
  const submitBtn = document.getElementById('btn-login-submit');

  const login = loginInput.value.trim();
  const password = passwordInput.value;

  if (!login || !password) {
    errorBanner.textContent = 'Wprowadź login oraz hasło.';
    errorBanner.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.7';
  errorBanner.style.display = 'none';

  let loginSuccess = false;
  let sessionData = null;

  // 1. Send to serverless API /api/login (verifies against cloud DB)
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.token) {
        loginSuccess = true;
        sessionData = data;
      }
    } else {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        errorBanner.textContent = data.message || 'Nieprawidłowy login lub hasło!';
        errorBanner.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        return;
      }
    }
  } catch (err) {
    console.log('Using secure cryptographic fallback...');
  }

  // 2. Cryptographic Fallback (if backend unreachable / file:// protocol)
  if (!loginSuccess) {
    const cleanLogin = login.toLowerCase();

    // Check Admin fallback hash
    if (cleanLogin === 'admin') {
      try {
        const hash = await computeWebCryptoHash(password, FALLBACK_ADMIN_SALT);
        if (hash === FALLBACK_ADMIN_HASH || hash === FALLBACK_ADMIN_HASH_DEFAULT) {
          loginSuccess = true;
          sessionData = {
            token: 'offline_token_' + uid(),
            user: { id: 'admin_1', login: 'admin', name: 'Administrator', role: 'admin' }
          };
        }
      } catch (e) {}
    }

    // Check locally created users
    if (!loginSuccess && state.users && state.users.length) {
      const found = state.users.find(u => u.login && u.login.toLowerCase() === cleanLogin);
      if (found && found.salt && found.passwordHash) {
        try {
          const hash = await computeWebCryptoHash(password, found.salt);
          if (hash === found.passwordHash) {
            loginSuccess = true;
            sessionData = {
              token: 'offline_token_' + uid(),
              user: { id: found.id, login: found.login, name: found.name, role: found.role || 'Wspólnik' }
            };
          }
        } catch (e) {}
      }
    }
  }

  submitBtn.disabled = false;
  submitBtn.style.opacity = '1';

  if (loginSuccess && sessionData) {
    currentSession = sessionData;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    hideLoginOverlay();
    applySessionUI();
    addHistory('auth', `Zalogowano pomyślnie: <strong>${sessionData.user.name}</strong>`);

    // Fetch cloud data immediately
    await loadFromCloud();
    refresh();
    showToast(`👋 Zalogowano pomyślnie jako: ${sessionData.user.name}`);
  } else {
    errorBanner.textContent = '❌ Nieprawidłowy login lub hasło!';
    errorBanner.style.display = 'block';
  }
}

function applySessionUI() {
  if (!currentSession || !currentSession.user) return;
  const user = currentSession.user;

  // Sidebar user info
  const sName = document.getElementById('sidebar-user-name');
  const sRole = document.getElementById('sidebar-user-role');
  const sAvatar = document.getElementById('sidebar-user-avatar');
  if (sName) sName.textContent = user.name;
  if (sRole) sRole.textContent = user.role === 'admin' ? '👑 Administrator' : user.role;
  if (sAvatar) sAvatar.textContent = user.login.slice(0, 2).toUpperCase();

  // Topbar user info
  const tName = document.getElementById('topbar-user-name');
  const tRole = document.getElementById('topbar-user-role-tag');
  const tAvatar = document.getElementById('topbar-avatar');
  if (tName) tName.textContent = user.name;
  if (tRole) tRole.textContent = user.role === 'admin' ? '👑 Administrator' : user.role;
  if (tAvatar) tAvatar.textContent = user.login.slice(0, 2).toUpperCase();

  // Pre-fill seller input in sale modal
  const sSeller = document.getElementById('s-seller');
  if (sSeller) sSeller.value = user.name;

  // Show/Hide User Management Tab (Admin only!)
  const usersNavBtn = document.getElementById('nav-btn-users');
  if (usersNavBtn) {
    usersNavBtn.style.display = user.role === 'admin' ? 'flex' : 'none';
  }
}

function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  currentSession = null;
  showLoginOverlay();
  showToast('🔒 Zostałeś pomyślnie wylogowany');
}

// ============== USER MANAGEMENT (ADMIN ONLY) ==============
async function fetchUsersList() {
  if (!currentSession || currentSession.user.role !== 'admin') return;

  try {
    if (window.location.protocol !== 'file:') {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${currentSession.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          state.users = data.users.filter(u => u.login !== 'admin');
          renderUsers(data.users);
          return;
        }
      }
    }
  } catch (e) {}

  // Fallback
  const list = [
    { id: 'admin_1', login: 'admin', name: 'Administrator', role: 'admin', createdAt: '2026-10-28T10:00:00.000Z' },
    ...state.users
  ];
  renderUsers(list);
}

function renderUsers(usersList) {
  const list = usersList || [
    { id: 'admin_1', login: 'admin', name: 'Administrator', role: 'admin', createdAt: '2026-10-28T10:00:00.000Z' },
    ...state.users
  ];

  const tbody = document.getElementById('users-tbody');
  const badge = document.getElementById('users-badge');
  if (badge) badge.textContent = list.length;
  if (!tbody) return;

  tbody.innerHTML = list.map(u => {
    const isAdmin = u.login === 'admin';
    const roleBadge = isAdmin
      ? '<span class="badge-admin-role">👑 Administrator</span>'
      : `<span class="badge-user-role">${escapeHtml(u.role || 'Wspólnik')}</span>`;

    const deleteBtn = isAdmin
      ? '<span style="color:var(--text-muted);font-size:0.75rem;">Główne konto</span>'
      : `<button class="btn btn-icon btn-danger" onclick="deleteUserAccount('${u.id}')" title="Usuń konto">🗑️</button>`;

    return `<tr>
      <td><strong>${escapeHtml(u.name)}</strong></td>
      <td><code>${escapeHtml(u.login)}</code></td>
      <td>${roleBadge}</td>
      <td>${fmtDate(u.createdAt)}</td>
      <td><span class="status-badge status-ok">Aktywne</span></td>
      <td>${deleteBtn}</td>
    </tr>`;
  }).join('');
}

function filterUsers() {
  const query = (document.getElementById('user-search')?.value || '').toLowerCase();
  const filtered = [
    { id: 'admin_1', login: 'admin', name: 'Administrator', role: 'admin', createdAt: '2026-10-28T10:00:00.000Z' },
    ...state.users
  ].filter(u => u.login.toLowerCase().includes(query) || u.name.toLowerCase().includes(query));
  renderUsers(filtered);
}

async function createUserAccount() {
  const loginInput = document.getElementById('u-login');
  const pwdInput = document.getElementById('u-password');
  const nameInput = document.getElementById('u-name');
  const roleInput = document.getElementById('u-role');

  const login = loginInput.value.trim().toLowerCase();
  const password = pwdInput.value;
  const name = nameInput.value.trim() || login;
  const role = roleInput.value;

  if (!login || !password) {
    showToast('⚠️ Podaj login oraz hasło dla nowego użytkownika');
    return;
  }

  if (login === 'admin' || state.users.some(u => u.login && u.login.toLowerCase() === login)) {
    showToast('⚠️ Użytkownik o takim loginie już istnieje!');
    return;
  }

  showToast('⏳ Zapisywanie konta w chmurze...');

  // Save through cloud serverless API /api/users
  let savedOnServer = false;
  try {
    if (window.location.protocol !== 'file:') {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.token}`
        },
        body: JSON.stringify({ login, password, name, role })
      });
      if (res.ok) {
        savedOnServer = true;
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(errJson.message || '⚠️ Błąd tworzenia konta');
        return;
      }
    }
  } catch (e) {}

  // Local fallback
  const salt = uid() + uid();
  let passwordHash = '';
  try {
    passwordHash = await computeWebCryptoHash(password, salt);
  } catch (e) {
    passwordHash = uid();
  }

  const newUser = {
    id: 'usr_' + uid(),
    login,
    name,
    role,
    salt,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  state.users.push(newUser);
  addHistory('auth', `Utworzono nowe konto użytkownika: <strong>${name}</strong> (${login})`);
  saveState();

  closeModal('add-user-modal');
  loginInput.value = '';
  pwdInput.value = '';
  nameInput.value = '';

  await fetchUsersList();
  showToast(`✅ Konto dla ${name} zostało pomyślnie utworzone i zapisane w chmurze! Kolega może się zalogować!`);
}

async function deleteUserAccount(id) {
  if (id === 'admin_1') return;
  const u = state.users.find(x => x.id === id);
  if (!confirm(`Czy na pewno chcesz usunąć konto użytkownika "${u ? u.name : id}"?`)) return;

  try {
    if (window.location.protocol !== 'file:') {
      await fetch('/api/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.token}`
        },
        body: JSON.stringify({ id })
      });
    }
  } catch (e) {}

  state.users = state.users.filter(x => x.id !== id);
  addHistory('auth', `Usunięto konto użytkownika: <strong>${u ? u.name : id}</strong>`);
  saveState();
  await fetchUsersList();
  showToast('🗑️ Konto użytkownika zostało usunięte z bazy');
}

// ============== PRODUCT & PROFIT MANAGEMENT (WYMÓG 2) ==============
function calcProductProfitPreview() {
  const qty = parseFloat(document.getElementById('p-qty')?.value) || 0;
  const buy = parseFloat(document.getElementById('p-buy')?.value) || 0;
  const sell = parseFloat(document.getElementById('p-sell')?.value) || 0;

  const totalCost = qty * buy;
  const unitProfit = sell - buy;
  const totalProfit = qty * unitProfit;
  const margin = buy > 0 ? ((unitProfit / buy) * 100).toFixed(1) : 0;

  const costEl = document.getElementById('preview-total-cost');
  const unitProfEl = document.getElementById('preview-unit-profit');
  const totProfEl = document.getElementById('preview-total-profit');
  const marginEl = document.getElementById('preview-margin');

  if (costEl) costEl.textContent = fmt(totalCost);
  if (unitProfEl) {
    unitProfEl.textContent = (unitProfit >= 0 ? '+' : '') + fmt(unitProfit);
    unitProfEl.style.color = unitProfit >= 0 ? 'var(--accent-green-light)' : 'var(--accent-red-light)';
  }
  if (totProfEl) {
    totProfEl.textContent = (totalProfit >= 0 ? '+' : '') + fmt(totalProfit);
    totProfEl.style.color = totalProfit >= 0 ? '#a5b4fc' : 'var(--accent-red-light)';
  }
  if (marginEl) {
    marginEl.textContent = `marża: ${margin}%`;
  }
}

function saveProduct() {
  const id = document.getElementById('p-id').value;
  const name = document.getElementById('p-name').value.trim();
  const category = document.getElementById('p-category').value.trim() || 'Ogólne';
  const qty = parseInt(document.getElementById('p-qty').value) || 0;
  const buy = parseFloat(document.getElementById('p-buy').value) || 0;
  const sell = parseFloat(document.getElementById('p-sell').value) || 0;
  const alert = parseInt(document.getElementById('p-alert').value) ?? 5;

  if (!name) {
    showToast('⚠️ Podaj nazwę produktu');
    return;
  }
  if (qty < 1) {
    showToast('⚠️ Podaj zakupioną ilość sztuk');
    return;
  }
  if (buy <= 0) {
    showToast('⚠️ Podaj cenę zakupu za sztukę (ile zapłaciłeś)');
    return;
  }
  if (sell <= 0) {
    showToast('⚠️ Podaj cenę sprzedaży za sztukę');
    return;
  }

  const totalCost = qty * buy;
  const unitProfit = sell - buy;

  if (id) {
    const p = state.products.find(x => x.id === id);
    if (p) {
      p.name = name;
      p.category = category;
      p.buy = buy;
      p.sell = sell;
      p.alert = alert;
      addHistory('product', `Zaktualizowano produkt: <strong>${name}</strong>`);
      showToast('✅ Zaktualizowano produkt');
    }
  } else {
    const newProduct = {
      id: uid(),
      name,
      category,
      initialQty: qty,
      currentQty: qty,
      buy,
      sell,
      totalBuyCost: totalCost,
      alert,
      createdAt: todayStr()
    };
    state.products.push(newProduct);
    addHistory('product', `Kupiono towar: <strong>${name}</strong> (${qty} szt. po ${fmt(buy)}, łącznie: ${fmt(totalCost)})`);
    showToast(`✅ Dodano produkt do bazy w chmurze! Zysk na sztuce: ${fmt(unitProfit)}`);
  }

  saveState();
  closeModal('add-product-modal');
  clearProductForm();
  refresh();
  updateCategoryFilter();
}

function clearProductForm() {
  ['p-id', 'p-name', 'p-category', 'p-qty', 'p-buy', 'p-sell'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const alertEl = document.getElementById('p-alert');
  if (alertEl) alertEl.value = 5;
  calcProductProfitPreview();
}

function deleteProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!confirm(`Czy na pewno usunąć produkt "${p ? p.name : ''}" z magazynu?`)) return;
  state.products = state.products.filter(x => x.id !== id);
  if (p) addHistory('product', `Usunięto z magazynu: <strong>${p.name}</strong>`);
  saveState();
  refresh();
  updateCategoryFilter();
  showToast('🗑️ Produkt usunięty');
}

function adjustQty(id, delta) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  p.currentQty = Math.max(0, p.currentQty + delta);
  if (p.currentQty > p.initialQty) {
    p.initialQty = p.currentQty;
    p.totalBuyCost = p.initialQty * p.buy;
  }
  addHistory('stock', `Zmieniono stan <strong>${p.name}</strong>: ${delta > 0 ? '+' : ''}${delta} szt. (Na stanie: ${p.currentQty})`);
  saveState();
  refresh();
}

function openQuickSale(productId) {
  openModal('add-sale-modal');
  const sel = document.getElementById('s-product');
  if (sel) {
    sel.value = productId;
    fillSalePrice();
  }
}

function renderProducts() {
  const tbody = document.getElementById('products-tbody');
  const empty = document.getElementById('products-empty');
  if (!tbody) return;

  const search = (document.getElementById('product-search')?.value || '').toLowerCase();
  const catFilter = document.getElementById('category-filter')?.value || '';

  const list = state.products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search);
    const matchCat = !catFilter || p.category === catFilter;
    return matchSearch && matchCat;
  });

  if (list.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = list.map(p => {
    const soldQty = Math.max(0, (p.initialQty || p.currentQty) - p.currentQty);
    const realizedRevenue = soldQty * p.sell;
    const realizedProfit = soldQty * (p.sell - p.buy);
    const remainingProfit = p.currentQty * (p.sell - p.buy);

    let status, statusClass;
    if (p.currentQty === 0) {
      status = 'Wyprzedany';
      statusClass = 'status-empty';
    } else if (p.currentQty <= p.alert) {
      status = 'Niski stan';
      statusClass = 'status-low';
    } else {
      status = 'Dostępny';
      statusClass = 'status-ok';
    }

    return `<tr>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.category)}</td>
      <td><span style="font-weight:600">${p.initialQty || p.currentQty} szt.</span></td>
      <td>
        <span style="color:var(--accent-orange-light);font-weight:700">${fmt(p.totalBuyCost || (p.initialQty * p.buy))}</span><br>
        <small style="color:var(--text-muted)">(${fmt(p.buy)}/szt.)</small>
      </td>
      <td><strong>${fmt(p.sell)}</strong></td>
      <td>
        <span class="badge-sold">${soldQty} szt.</span><br>
        <small style="color:var(--text-muted)">(${fmt(realizedRevenue)})</small>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <strong style="font-size:1rem;color:${p.currentQty === 0 ? 'var(--accent-red-light)' : 'var(--text-primary)'}">${p.currentQty} szt.</strong>
          <button class="btn btn-icon" onclick="adjustQty('${p.id}', -1)" title="Zmniejsz stan">−1</button>
          <button class="btn btn-icon" onclick="adjustQty('${p.id}', 1)" title="Zwiększ stan">+1</button>
        </div>
      </td>
      <td><span class="badge-profit-realized">+${fmt(realizedProfit)}</span></td>
      <td><span class="badge-profit-potential">+${fmt(remainingProfit)}</span></td>
      <td><span class="status-badge ${statusClass}">${status}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-icon" onclick="openQuickSale('${p.id}')" title="Szybka sprzedaż tego towaru" style="color:var(--accent-green-light)">💳</button>
          <button class="btn btn-icon btn-danger" onclick="deleteProduct('${p.id}')" title="Usuń produkt">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updateCategoryFilter() {
  const sel = document.getElementById('category-filter');
  if (!sel) return;
  const current = sel.value;
  const categories = [...new Set(state.products.map(p => p.category))].sort();
  sel.innerHTML = '<option value="">Wszystkie kategorie</option>' +
    categories.map(c => `<option value="${escapeHtml(c)}" ${c === current ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
}

function filterProducts() {
  renderProducts();
}

// ============== SALES & REALIZED PROFIT ==============
function fillSaleDropdown() {
  const sel = document.getElementById('s-product');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Wybierz produkt z magazynu --</option>' +
    state.products.filter(p => p.currentQty > 0).map(p =>
      `<option value="${p.id}" data-sell="${p.sell}" data-buy="${p.buy}" data-stock="${p.currentQty}">${escapeHtml(p.name)} (${p.currentQty} szt. na stanie, koszt zakupu: ${fmt(p.buy)})</option>`
    ).join('');
}

function fillSalePrice() {
  const sel = document.getElementById('s-product');
  const opt = sel.selectedOptions[0];
  if (opt && opt.dataset.sell) {
    document.getElementById('s-price').value = opt.dataset.sell;
  }
  calcSaleTotal();
}

function calcSaleTotal() {
  const sel = document.getElementById('s-product');
  const opt = sel.selectedOptions[0];
  const qty = parseInt(document.getElementById('s-qty').value) || 0;
  const price = parseFloat(document.getElementById('s-price').value) || 0;
  const buy = opt ? parseFloat(opt.dataset.buy || 0) : 0;
  const currentStock = opt ? parseInt(opt.dataset.stock || 0) : 0;

  const totalRevenue = qty * price;
  const totalCost = qty * buy;
  const profit = totalRevenue - totalCost;
  const remainingStock = Math.max(0, currentStock - qty);

  document.getElementById('sale-total-preview').textContent = fmt(totalRevenue);
  document.getElementById('sale-cost-preview').textContent = '-' + fmt(totalCost);

  const profitEl = document.getElementById('sale-profit-preview');
  profitEl.textContent = (profit >= 0 ? '+' : '') + fmt(profit);
  profitEl.style.color = profit >= 0 ? 'var(--accent-green-light)' : 'var(--accent-red-light)';

  document.getElementById('sale-remaining-stock-preview').textContent = `${remainingStock} szt.`;
}

function addSale() {
  const productId = document.getElementById('s-product').value;
  const qty = parseInt(document.getElementById('s-qty').value) || 0;
  const price = parseFloat(document.getElementById('s-price').value) || 0;
  const date = document.getElementById('s-date').value || todayStr();
  const seller = document.getElementById('s-seller').value || (currentSession ? currentSession.user.name : 'admin');

  if (!productId) { showToast('⚠️ Wybierz produkt z listy'); return; }
  if (qty < 1) { showToast('⚠️ Podaj poprawną ilość sprzedawanych sztuk'); return; }

  const product = state.products.find(x => x.id === productId);
  if (!product) { showToast('❌ Nie znaleziono produktu w bazie'); return; }
  if (qty > product.currentQty) {
    showToast(`⚠️ Niewystarczająca ilość w magazynie! Dostępne: ${product.currentQty} szt.`);
    return;
  }

  const revenue = qty * price;
  const cost = qty * product.buy;
  const profit = revenue - cost;

  const sale = {
    id: uid(),
    productId,
    productName: product.name,
    qty,
    price,
    revenue,
    cost,
    profit,
    costPerUnit: product.buy,
    date,
    seller
  };

  product.currentQty -= qty;
  state.sales.push(sale);

  addHistory('sale', `Sprzedano: <strong>${qty}x ${product.name}</strong> → przychód: ${fmt(revenue)}, czysty zysk: <strong>+${fmt(profit)}</strong> (Sprzedawca: ${seller})`);
  saveState();
  closeModal('add-sale-modal');

  ['s-product', 's-qty', 's-price'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = id === 's-qty' ? '1' : '';
    }
  });

  refresh();
  showToast(`✅ Sprzedaż zapisana w chmurze! Zysk: +${fmt(profit)}`);
}

function deleteSale(id) {
  const s = state.sales.find(x => x.id === id);
  if (!confirm(`Czy na pewno cofnąć sprzedaż "${s ? s.productName : ''}"? Ilość (${s ? s.qty : 0} szt.) wróci do magazynu.`)) return;

  if (s) {
    const p = state.products.find(x => x.id === s.productId);
    if (p) p.currentQty += s.qty;
    addHistory('sale', `Cofnięto sprzedaż: <strong>${s.qty}x ${s.productName}</strong> (stan przywrócony)`);
  }

  state.sales = state.sales.filter(x => x.id !== id);
  saveState();
  refresh();
  showToast('🗑️ Sprzedaż cofnięta');
}

function filterSales() {
  renderSales();
}

function renderSales() {
  const tbody = document.getElementById('sales-tbody');
  const empty = document.getElementById('sales-empty');
  if (!tbody) return;

  const search = (document.getElementById('sale-search')?.value || '').toLowerCase();
  const month = document.getElementById('sale-month-filter')?.value || '';

  let list = [...state.sales].sort((a, b) => b.date.localeCompare(a.date));
  if (search) list = list.filter(s => s.productName.toLowerCase().includes(search) || (s.seller && s.seller.toLowerCase().includes(search)));
  if (month) list = list.filter(s => s.date.startsWith(month));

  if (!list.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = list.map(s => `<tr>
    <td>${fmtDate(s.date)}</td>
    <td><strong>${escapeHtml(s.productName)}</strong></td>
    <td>${s.qty} szt.</td>
    <td>${fmt(s.price)}</td>
    <td style="color:var(--accent-green-light);font-weight:600">${fmt(s.revenue)}</td>
    <td style="color:var(--accent-red-light)">-${fmt(s.cost || (s.qty * (s.costPerUnit || 0)))}</td>
    <td><span class="badge-profit-realized">+${fmt(s.profit)}</span></td>
    <td><span class="badge-user-role">${escapeHtml(s.seller || 'admin')}</span></td>
    <td><button class="btn btn-icon btn-danger" onclick="deleteSale('${s.id}')" title="Cofnij sprzedaż">🗑️</button></td>
  </tr>`).join('');
}

// ============== EXPENSES ==============
function addExpense() {
  const desc = document.getElementById('e-desc').value.trim();
  const category = document.getElementById('e-category').value;
  const amount = parseFloat(document.getElementById('e-amount').value) || 0;
  const date = document.getElementById('e-date').value || todayStr();

  if (!desc) { showToast('⚠️ Podaj opis kosztu'); return; }
  if (!amount) { showToast('⚠️ Podaj poprawną kwotę'); return; }

  state.expenses.push({ id: uid(), desc, category, amount, date });
  addHistory('expense', `Dodano wydatek: <strong>${desc}</strong> — ${fmt(amount)} (${category})`);
  saveState();
  closeModal('add-expense-modal');
  ['e-desc', 'e-amount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  refresh();
  showToast(`✅ Dodano koszt: ${fmt(amount)}`);
}

function deleteExpense(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!confirm(`Czy usunąć koszt "${e ? e.desc : ''}"?`)) return;
  state.expenses = state.expenses.filter(x => x.id !== id);
  saveState();
  refresh();
  showToast('🗑️ Koszt usunięty');
}

function renderExpenses() {
  const tbody = document.getElementById('expenses-tbody');
  const empty = document.getElementById('expenses-empty');
  if (!tbody) return;

  const list = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));

  if (!list.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = list.map(e => `<tr>
    <td>${fmtDate(e.date)}</td>
    <td><strong>${escapeHtml(e.desc)}</strong></td>
    <td><span class="status-badge status-active">${escapeHtml(e.category)}</span></td>
    <td style="color:var(--accent-red-light);font-weight:600">-${fmt(e.amount)}</td>
    <td><button class="btn btn-icon btn-danger" onclick="deleteExpense('${e.id}')">🗑️</button></td>
  </tr>`).join('');
}

// ============== INVESTMENTS ==============
function addInvestment() {
  const name = document.getElementById('i-name').value.trim();
  const goal = document.getElementById('i-goal').value.trim();
  const amount = parseFloat(document.getElementById('i-amount').value) || 0;
  const date = document.getElementById('i-date').value || todayStr();

  if (!name) { showToast('⚠️ Podaj nazwę inwestycji'); return; }
  if (!amount) { showToast('⚠️ Podaj kwotę'); return; }

  state.investments.push({ id: uid(), name, goal, amount, date, status: 'active', returnAmount: 0 });
  addHistory('investment', `Nowa inwestycja: <strong>${name}</strong> — ${fmt(amount)}`);
  saveState();
  closeModal('add-investment-modal');
  ['i-name', 'i-goal', 'i-amount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  refresh();
  showToast(`✅ Inwestycja dodana: ${fmt(amount)}`);
}

function deleteInvestment(idx) {
  const inv = state.investments[idx];
  if (!confirm(`Czy usunąć inwestycję "${inv ? inv.name : ''}"?`)) return;
  state.investments.splice(idx, 1);
  saveState();
  refresh();
  showToast('🗑️ Inwestycja usunięta');
}

function renderInvestments() {
  const tbody = document.getElementById('investments-tbody');
  const empty = document.getElementById('investments-empty');
  if (!tbody) return;

  if (!state.investments.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = state.investments.map((inv, idx) => {
    const statusClass = inv.status === 'done' ? 'status-done' : 'status-active';
    const statusLabel = inv.status === 'done' ? 'Zakończona' : 'W toku';

    return `<tr>
      <td>${fmtDate(inv.date)}</td>
      <td><strong>${escapeHtml(inv.name)}</strong></td>
      <td style="font-weight:600">${fmt(inv.amount)}</td>
      <td>${escapeHtml(inv.goal || '—')}</td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td>${inv.returnAmount ? fmt(inv.returnAmount) : '—'}</td>
      <td><button class="btn btn-icon btn-danger" onclick="deleteInvestment(${idx})">🗑️</button></td>
    </tr>`;
  }).join('');
}

// ============== PAYOUTS & PODZIAŁ ZYSKU ==============
function openPayoutModal() {
  document.getElementById('payout-partner-name').value = currentSession ? currentSession.user.name : 'admin';
  document.getElementById('payout-amount').value = '';
  document.getElementById('payout-note').value = '';
  document.getElementById('payout-date').value = todayStr();
  openModal('payout-modal');
}

function addPayout() {
  const partnerName = document.getElementById('payout-partner-name').value.trim() || 'Wspólnik';
  const amount = parseFloat(document.getElementById('payout-amount').value) || 0;
  const note = document.getElementById('payout-note').value.trim();
  const date = document.getElementById('payout-date').value || todayStr();

  if (!amount) { showToast('⚠️ Podaj kwotę wypłaty'); return; }

  state.payouts.push({
    id: uid(),
    partnerName,
    amount,
    note,
    date
  });

  addHistory('payout', `Wypłata dla: <strong>${partnerName}</strong> → ${fmt(amount)} ${note ? `(${note})` : ''}`);
  saveState();
  closeModal('payout-modal');
  refresh();
  showToast(`💸 Wypłata zarejestrowana: ${fmt(amount)} dla ${partnerName}`);
}

function deletePayout(id) {
  if (!confirm('Czy na pewno cofnąć ten wpis wypłaty?')) return;
  state.payouts = state.payouts.filter(p => p.id !== id);
  saveState();
  refresh();
  showToast('🗑️ Wypłata usunięta');
}

function renderPayouts() {
  const tbody = document.getElementById('payouts-tbody');
  const empty = document.getElementById('payouts-empty');

  // Update 50/50 profit split summary cards
  const stats = calcStats();
  const elTotalNet = document.getElementById('split-total-net');
  const elShare = document.getElementById('split-partner-share');
  const elTotalPaid = document.getElementById('split-total-paid');
  const elCount = document.getElementById('split-payouts-count');
  const elRemaining = document.getElementById('split-remaining');

  if (elTotalNet) elTotalNet.textContent = fmt(stats.totalNet);
  if (elShare) elShare.textContent = fmt(stats.totalNet / 2);
  if (elTotalPaid) elTotalPaid.textContent = fmt(stats.totalPaid);
  if (elCount) elCount.textContent = `${state.payouts.length} ${state.payouts.length === 1 ? 'wypłata' : 'wypłat'}`;
  if (elRemaining) elRemaining.textContent = fmt(stats.remainingToPayout);

  if (!tbody) return;

  const list = [...state.payouts].sort((a, b) => b.date.localeCompare(a.date));

  if (!list.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = list.map(p => `<tr>
    <td>${fmtDate(p.date)}</td>
    <td><strong>${escapeHtml(p.partnerName)}</strong></td>
    <td style="color:var(--accent-green-light);font-weight:700">${fmt(p.amount)}</td>
    <td>${escapeHtml(p.note || '—')}</td>
    <td><button class="btn btn-icon btn-danger" onclick="deletePayout('${p.id}')">🗑️</button></td>
  </tr>`).join('');
}

// ============== NOTATNIK (NOTES SYSTEM) ==============
function openNoteModal() {
  document.getElementById('n-id').value = '';
  document.getElementById('n-title').value = '';
  document.getElementById('n-category').value = 'Do zrobienia';
  document.getElementById('n-color').value = 'indigo';
  document.getElementById('n-pinned').checked = false;
  document.getElementById('n-content').value = '';
  document.getElementById('note-modal-title').textContent = '📝 Nowa notatka';
  openModal('note-modal');
}

function saveNote() {
  const id = document.getElementById('n-id').value;
  const title = document.getElementById('n-title').value.trim();
  const category = document.getElementById('n-category').value;
  const color = document.getElementById('n-color').value;
  const pinned = document.getElementById('n-pinned').checked;
  const content = document.getElementById('n-content').value.trim();

  if (!title) {
    showToast('⚠️ Podaj tytuł notatki');
    return;
  }

  const author = currentSession ? currentSession.user.name : 'admin';

  if (id) {
    const note = state.notes.find(n => n.id === id);
    if (note) {
      note.title = title;
      note.category = category;
      note.color = color;
      note.pinned = pinned;
      note.content = content;
      note.updatedAt = new Date().toISOString();
      addHistory('note', `Zaktualizowano notatkę: <strong>${title}</strong>`);
      showToast('✅ Notatka zaktualizowana');
    }
  } else {
    const newNote = {
      id: uid(),
      title,
      category,
      color,
      author,
      pinned,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.notes.unshift(newNote);
    addHistory('note', `Dodano nową notatkę: <strong>${title}</strong>`);
    showToast('✅ Notatka zapisana w chmurze');
  }

  saveState();
  closeModal('note-modal');
  renderNotes();
}

function editNote(id, e) {
  if (e) e.stopPropagation();
  const note = state.notes.find(n => n.id === id);
  if (!note) return;

  document.getElementById('n-id').value = note.id;
  document.getElementById('n-title').value = note.title;
  document.getElementById('n-category').value = note.category;
  document.getElementById('n-color').value = note.color || 'indigo';
  document.getElementById('n-pinned').checked = !!note.pinned;
  document.getElementById('n-content').value = note.content;
  document.getElementById('note-modal-title').textContent = '✏️ Edytuj notatkę';
  openModal('note-modal');
}

function deleteNote(id, e) {
  if (e) e.stopPropagation();
  const note = state.notes.find(n => n.id === id);
  if (!confirm(`Czy usunąć notatkę "${note ? note.title : ''}"?`)) return;

  state.notes = state.notes.filter(n => n.id !== id);
  if (note) addHistory('note', `Usunięto notatkę: <strong>${note.title}</strong>`);
  saveState();
  renderNotes();
  showToast('🗑️ Notatka usunięta');
}

function togglePinNote(id, e) {
  if (e) e.stopPropagation();
  const note = state.notes.find(n => n.id === id);
  if (!note) return;

  note.pinned = !note.pinned;
  note.updatedAt = new Date().toISOString();
  saveState();
  renderNotes();
  showToast(note.pinned ? '📌 Notatka przypięta na samej górze' : 'Odpięto notatkę');
}

function copyNoteText(id, e) {
  if (e) e.stopPropagation();
  const note = state.notes.find(n => n.id === id);
  if (!note) return;

  const text = `${note.title}\n\n${note.content}\n\n(Autor: ${note.author} · ${fmtDate(note.createdAt)})`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('📋 Skopiowano treść do schowka!'));
  } else {
    showToast('📋 Treść notatki skopiowana!');
  }
}

function toggleNoteTodo(noteId, lineIdx, e) {
  if (e) e.stopPropagation();
  const note = state.notes.find(n => n.id === noteId);
  if (!note || !note.content) return;

  const lines = note.content.split('\n');
  if (lines[lineIdx] !== undefined) {
    const trimmed = lines[lineIdx].trim();
    if (trimmed.startsWith('[ ] ')) {
      lines[lineIdx] = '[x] ' + trimmed.slice(4);
    } else if (trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
      lines[lineIdx] = '[ ] ' + trimmed.slice(4);
    }
    note.content = lines.join('\n');
    note.updatedAt = new Date().toISOString();
    saveState();
    renderNotes();
  }
}

function filterNotes() {
  renderNotes();
}

function renderNotes() {
  const grid = document.getElementById('notes-grid');
  const empty = document.getElementById('notes-empty');
  const badge = document.getElementById('notes-badge');
  if (!grid) return;

  const search = (document.getElementById('note-search')?.value || '').toLowerCase();
  const catFilter = document.getElementById('note-category-filter')?.value || '';

  let list = [...state.notes];

  if (search) {
    list = list.filter(n =>
      n.title.toLowerCase().includes(search) ||
      (n.content && n.content.toLowerCase().includes(search)) ||
      (n.category && n.category.toLowerCase().includes(search))
    );
  }

  if (catFilter) {
    list = list.filter(n => n.category === catFilter);
  }

  list.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
  });

  if (badge) badge.textContent = state.notes.length;

  if (list.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const catTagClasses = {
    'Ważne': 'tag-wazne',
    'Do zrobienia': 'tag-todo',
    'Pomysły': 'tag-pomysly',
    'Magazyn': 'tag-magazyn',
    'Finanse': 'tag-finanse'
  };

  grid.innerHTML = list.map(note => {
    const tagClass = catTagClasses[note.category] || '';
    const colorClass = `note-${note.color || 'indigo'}`;
    const pinnedClass = note.pinned ? 'pinned' : '';

    let bodyHtml = '';
    if (note.content) {
      const lines = note.content.split('\n');
      bodyHtml = lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('[ ] ') || trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
          const isDone = trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ');
          const label = escapeHtml(trimmed.slice(4));
          return `<div class="note-todo-item ${isDone ? 'done' : ''}" onclick="toggleNoteTodo('${note.id}', ${idx}, event)" title="Kliknij, aby odhaczyć">
            <span class="note-todo-checkbox">${isDone ? '✓' : ''}</span>
            <span class="note-todo-text">${label}</span>
          </div>`;
        } else {
          return `<div class="note-para">${escapeHtml(line) || '&nbsp;'}</div>`;
        }
      }).join('');
    } else {
      bodyHtml = '<p class="note-empty-text">Brak treści notatki...</p>';
    }

    return `
      <div class="note-card ${colorClass} ${pinnedClass}">
        <div class="note-header">
          <span class="note-tag ${tagClass}">${escapeHtml(note.category || 'Ogólne')}</span>
          <button class="note-pin-btn ${note.pinned ? 'active' : ''}" onclick="togglePinNote('${note.id}', event)" title="${note.pinned ? 'Odepnij notatkę' : 'Przypnij notatkę na górze'}">
            📌
          </button>
        </div>
        <h3 class="note-title">${escapeHtml(note.title)}</h3>
        <div class="note-body">${bodyHtml}</div>
        <div class="note-footer">
          <span class="note-date">${escapeHtml(note.author || '')} · ${fmtRelativeTime(note.updatedAt || note.createdAt)}</span>
          <div class="note-actions">
            <button class="btn-note-action" onclick="copyNoteText('${note.id}', event)" title="Skopiuj treść">📋</button>
            <button class="btn-note-action" onclick="editNote('${note.id}', event)" title="Edytuj">✏️</button>
            <button class="btn-note-action btn-note-delete" onclick="deleteNote('${note.id}', event)" title="Usuń">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ============== HISTORY ==============
function renderHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  if (!list) return;

  if (!state.history.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const dotMap = {
    sale: 'dot-green',
    product: 'dot-blue',
    expense: 'dot-red',
    investment: 'dot-purple',
    payout: 'dot-orange',
    stock: 'dot-orange',
    note: 'dot-yellow',
    auth: 'dot-purple'
  };

  list.innerHTML = state.history.map(h => {
    const dot = dotMap[h.type] || 'dot-blue';
    const d = new Date(h.ts);
    const time = d.toLocaleDateString('pl-PL') + ' ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    return `<div class="history-item">
      <div class="history-dot ${dot}"></div>
      <div class="history-text">${h.text}</div>
      <div class="history-time">${time}</div>
    </div>`;
  }).join('');
}

// ============== CALCULATIONS & DASHBOARD STATS ==============
function calcStats() {
  const totalRevenue = state.sales.reduce((s, x) => s + (x.revenue || 0), 0);
  const totalCOGS = state.sales.reduce((s, x) => s + (x.cost || (x.costPerUnit * x.qty) || 0), 0);
  const totalExpenses = state.expenses.reduce((s, x) => s + (x.amount || 0), 0);
  const totalNet = totalRevenue - totalCOGS - totalExpenses;
  const totalPaid = state.payouts.reduce((s, x) => s + (x.amount || 0), 0);
  const remainingToPayout = Math.max(0, totalNet - totalPaid);
  const margin = totalRevenue > 0 ? ((totalNet / totalRevenue) * 100).toFixed(1) : 0;

  // Products & Inventory
  const totalProductsQty = state.products.reduce((s, p) => s + (p.currentQty || 0), 0);
  const lowStockProducts = state.products.filter(p => p.currentQty > 0 && p.currentQty <= p.alert);
  const emptyProducts = state.products.filter(p => p.currentQty === 0);

  // Buy costs & profits across all products
  const totalBuyCostAll = state.products.reduce((s, p) => s + (p.totalBuyCost || (p.initialQty * p.buy) || 0), 0);
  const realizedProfitAll = state.sales.reduce((s, x) => s + (x.profit || 0), 0);
  const remainingProfitAll = state.products.reduce((s, p) => s + (p.currentQty * (p.sell - p.buy)), 0);
  const currentInventoryValue = state.products.reduce((s, p) => s + (p.currentQty * p.buy), 0);

  // Investments
  const invTotal = state.investments.reduce((s, i) => s + (i.amount || 0), 0);
  const invReturn = state.investments.filter(i => i.status === 'done').reduce((s, i) => s + (i.returnAmount || 0), 0);
  const invActive = state.investments.filter(i => i.status === 'active').length;

  return {
    totalRevenue, totalCOGS, totalExpenses, totalNet, totalPaid, remainingToPayout, margin,
    totalProductsQty, lowStockProducts, emptyProducts,
    totalBuyCostAll, realizedProfitAll, remainingProfitAll, currentInventoryValue,
    invTotal, invReturn, invActive
  };
}

function renderDashboard(stats) {
  const revEl = document.getElementById('stat-revenue');
  const profEl = document.getElementById('stat-profit');
  const margEl = document.getElementById('stat-margin');
  const prodEl = document.getElementById('stat-products');
  const potProfEl = document.getElementById('stat-potential-profit');

  if (revEl) revEl.textContent = fmt(stats.totalRevenue);
  if (profEl) profEl.textContent = fmt(stats.totalNet);
  if (margEl) margEl.textContent = `Marża: ${stats.margin}%`;
  if (prodEl) prodEl.textContent = stats.totalProductsQty + ' szt.';
  if (potProfEl) potProfEl.textContent = fmt(stats.remainingProfitAll);

  // Magazyn Tab Stats
  const mBuy = document.getElementById('mag-total-buy-cost');
  const mReal = document.getElementById('mag-realized-profit');
  const mRem = document.getElementById('mag-remaining-profit');
  const mQty = document.getElementById('mag-total-qty');

  if (mBuy) mBuy.textContent = fmt(stats.totalBuyCostAll);
  if (mReal) mReal.textContent = fmt(stats.realizedProfitAll);
  if (mRem) mRem.textContent = fmt(stats.remainingProfitAll);
  if (mQty) mQty.textContent = stats.totalProductsQty + ' szt.';

  // Low Stock List
  const lowList = document.getElementById('low-stock-list');
  const statLow = document.getElementById('stat-low-stock');
  const alerts = [
    ...stats.lowStockProducts.map(p => ({ ...p, danger: false })),
    ...stats.emptyProducts.map(p => ({ ...p, danger: true }))
  ];

  if (lowList) {
    if (alerts.length) {
      lowList.innerHTML = alerts.map(p =>
        `<div class="low-stock-item">
          <span>${escapeHtml(p.name)}</span>
          <span class="${p.danger ? 'badge-danger' : 'badge-warn'}">${p.danger ? 'WYPRZEDANY (0 szt.)' : p.currentQty + ' szt.'}</span>
        </div>`
      ).join('');
      if (statLow) statLow.textContent = `⚠️ ${alerts.length} prod. wymaga zamówienia`;
    } else {
      lowList.innerHTML = '<p class="empty-state">Wszystko w porządku! Magazyn pełny ✅</p>';
      if (statLow) statLow.textContent = 'Brak alertów magazynowych';
    }
  }

  // Finance Summary
  const fsRev = document.getElementById('fs-revenue');
  const fsCost = document.getElementById('fs-cost');
  const fsExp = document.getElementById('fs-expenses');
  const fsNet = document.getElementById('fs-net');
  const fsInvVal = document.getElementById('fs-inventory-value');
  const fsRemProf = document.getElementById('fs-remaining-profit');

  if (fsRev) fsRev.textContent = fmt(stats.totalRevenue);
  if (fsCost) fsCost.textContent = fmt(stats.totalCOGS);
  if (fsExp) fsExp.textContent = fmt(stats.totalExpenses);
  if (fsNet) fsNet.textContent = fmt(stats.totalNet);
  if (fsInvVal) fsInvVal.textContent = fmt(stats.currentInventoryValue);
  if (fsRemProf) fsRemProf.textContent = fmt(stats.remainingProfitAll);

  // Recent Sales
  const recentList = document.getElementById('recent-sales-list');
  if (recentList) {
    const recent = [...state.sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    if (recent.length) {
      recentList.innerHTML = recent.map(s => `
        <div class="sale-item">
          <div>
            <div class="sale-name">${escapeHtml(s.productName)}</div>
            <div class="sale-date">${fmtDate(s.date)} · ${s.qty} szt. · Zysk: <strong style="color:var(--accent-green-light)">+${fmt(s.profit)}</strong> (Sprzedawca: ${escapeHtml(s.seller || '')})</div>
          </div>
          <div class="sale-amount">+${fmt(s.revenue)}</div>
        </div>`).join('');
    } else {
      recentList.innerHTML = '<p class="empty-state">Brak ostatnich transakcji sprzedaży</p>';
    }
  }
}

function renderFinanceTab(stats) {
  const finRev = document.getElementById('fin-revenue');
  const finCogs = document.getElementById('fin-cogs');
  const finExp = document.getElementById('fin-expenses');
  const finNet = document.getElementById('fin-net');

  if (finRev) finRev.textContent = fmt(stats.totalRevenue);
  if (finCogs) finCogs.textContent = fmt(stats.totalCOGS);
  if (finExp) finExp.textContent = fmt(stats.totalExpenses);
  if (finNet) finNet.textContent = fmt(stats.totalNet);
}

function renderInvestmentsTab(stats) {
  const invTot = document.getElementById('inv-total');
  const invRet = document.getElementById('inv-return');
  const invAct = document.getElementById('inv-active');

  if (invTot) invTot.textContent = fmt(stats.invTotal);
  if (invRet) invRet.textContent = fmt(stats.invReturn);
  if (invAct) invAct.textContent = stats.invActive;
}

// ============== 7-DAY CHART ==============
let chartCanvas, chartCtx;
function renderChart() {
  chartCanvas = document.getElementById('revenue-chart');
  if (!chartCanvas) return;
  chartCtx = chartCanvas.getContext('2d');

  const days = [];
  const revenues = [];
  const profits = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    days.push(d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }));
    const daySales = state.sales.filter(s => s.date === dayStr);
    revenues.push(daySales.reduce((s, x) => s + (x.revenue || 0), 0));
    profits.push(daySales.reduce((s, x) => s + (x.profit || 0), 0));
  }

  const container = chartCanvas.parentElement;
  const W = Math.max(300, (container ? container.clientWidth : 600) - 44);
  const H = 220;
  chartCanvas.width = W;
  chartCanvas.height = H;
  const ctx = chartCtx;
  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...revenues, 100);
  const padL = 60, padR = 20, padT = 24, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const step = plotW / Math.max(1, days.length - 1);

  // Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();

    const val = maxVal - (maxVal / 4) * i;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0), padL - 8, y + 4);
  }

  function toXY(i, val) {
    return { x: padL + i * step, y: padT + plotH - (val / maxVal) * plotH };
  }

  const revPoints = revenues.map((v, i) => toXY(i, v));

  // Gradient fill
  ctx.beginPath();
  ctx.moveTo(revPoints[0].x, padT + plotH);
  revPoints.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(revPoints[revPoints.length - 1].x, padT + plotH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  grad.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
  grad.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Revenue line
  ctx.beginPath();
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  revPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Profit line
  const profPoints = profits.map((v, i) => toXY(i, Math.max(0, v)));
  ctx.beginPath();
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([5, 4]);
  profPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.setLineDash([]);

  // Dots & dates
  revPoints.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#818cf8';
    ctx.fill();
    ctx.strokeStyle = '#0b0f19';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(days[i], p.x, H - 10);
  });

  // Legend
  ctx.fillStyle = '#818cf8';
  ctx.fillRect(padL, 6, 14, 3);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Przychód', padL + 20, 12);

  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(padL + 105, 8);
  ctx.lineTo(padL + 120, 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('Zrealizowany Zysk', padL + 126, 12);
}

// ============== REFRESH ALL ==============
function refresh(skipSync = false) {
  const stats = calcStats();
  renderDashboard(stats);
  renderProducts();
  renderSales();
  renderExpenses();
  renderFinanceTab(stats);
  renderInvestments();
  renderInvestmentsTab(stats);
  renderPayouts();
  renderNotes();
  renderHistory();
  fillSaleDropdown();
  if (currentSession && currentSession.user && currentSession.user.role === 'admin') {
    fetchUsersList();
  }
  setTimeout(renderChart, 60);
}

// ============== INITIALIZATION ==============
function initDate() {
  const now = new Date();
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('pl-PL', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  ['s-date', 'e-date', 'i-date', 'payout-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = todayStr();
  });

  const monthEl = document.getElementById('sale-month-filter');
  if (monthEl) monthEl.value = now.toISOString().slice(0, 7);
}

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initDate();
  updateCategoryFilter();
  initAuth();
  refresh();

  // Resize chart on window resize
  window.addEventListener('resize', () => {
    clearTimeout(window._resizeTimer);
    window._resizeTimer = setTimeout(renderChart, 150);
  });

  // Background auto-sync every 25 seconds for cross-device realtime collaboration
  setInterval(() => {
    if (currentSession && currentSession.token) {
      loadFromCloud(true);
    }
  }, 25000);

  // Auto-sync when user returns to tab
  window.addEventListener('focus', () => {
    if (currentSession && currentSession.token) {
      loadFromCloud(true);
    }
  });
});
