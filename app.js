/* ===================================================
   ShopPanel — app.js
   Wspólny panel sklepu: Ja & Patryk (50/50)
   Persistence: localStorage
   =================================================== */

// ============== STATE & KEYS ==============
const STATE_KEY = 'shoppanel_v1';
const AUTH_KEY = 'shoppanel_auth_user';

// Profile definitions
const USERS = {
  ja: {
    id: 'ja',
    name: 'Ja',
    fullName: 'Ja (Wspólnik 1)',
    avatar: 'JA',
    role: 'Wspólnik 1 (50%)',
    color: '#6366f1',
    partnerIdx: 0,
    defaultPin: '1234'
  },
  patryk: {
    id: 'patryk',
    name: 'Patryk',
    fullName: 'Patryk (Wspólnik 2)',
    avatar: 'PA',
    role: 'Wspólnik 2 (50%)',
    color: '#f59e0b',
    partnerIdx: 1,
    defaultPin: '1234'
  }
};

let currentAuthUser = null;
let selectedLoginUserId = null;
let enteredPin = '';

let state = {
  products: [],
  sales: [],
  expenses: [],
  investments: [],
  payouts: [],
  notes: [],
  history: [],
  userPins: { ja: '1234', patryk: '1234' }
};

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
        userPins: parsed.userPins || { ja: '1234', patryk: '1234' }
      };
    }
  } catch (e) {
    console.warn('Load state error:', e);
  }

  if (!Array.isArray(state.notes)) state.notes = [];
  if (!state.userPins) state.userPins = { ja: '1234', patryk: '1234' };
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
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

// ============== TOAST ==============
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ============== MODAL ==============
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// Close on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ============== SIDEBAR & NAVIGATION ==============
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
    magazyn: 'Zarządzanie stanem magazynowym i marżą',
    sprzedaz: 'Rejestr transakcji sprzedaży dla obu wspólników',
    finanse: 'Koszty operacyjne i bilans sklepu',
    podzial: 'Równe rozliczenie zysku 50/50 i wypłaty',
    inwestycje: 'Kapitał na rozwój, towar i marketing',
    notatnik: 'Wspólne notatki, listy zadań i pomysły',
    historia: 'Dziennik operacji w systemie'
  };

  if (pageTitle && navBtn) {
    const label = navBtn.querySelector('span:nth-child(2)');
    pageTitle.textContent = label ? label.textContent : name;
  }
  if (pageSub) {
    pageSub.textContent = subtitles[name] || '';
  }

  // Close sidebar on mobile
  if (window.innerWidth < 960) {
    document.getElementById('sidebar').classList.remove('open');
  }

  refresh();
}

// ============== AUTHENTICATION (JA & PATRYK) ==============
function initAuth() {
  const savedUserId = localStorage.getItem(AUTH_KEY);
  if (savedUserId && USERS[savedUserId]) {
    loginAs(USERS[savedUserId], false);
  } else {
    showLoginOverlay();
  }
}

function showLoginOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  // Show profiles, hide PIN
  document.getElementById('login-step-profiles').style.display = 'block';
  document.getElementById('login-step-pin').style.display = 'none';

  selectedLoginUserId = null;
  enteredPin = '';
}

function hideLoginOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function selectLoginProfile(userId) {
  if (!USERS[userId]) return;
  selectedLoginUserId = userId;
  const user = USERS[userId];

  document.getElementById('login-step-profiles').style.display = 'none';
  document.getElementById('login-step-pin').style.display = 'block';

  // Update banner
  const avatarEl = document.getElementById('pin-display-avatar');
  avatarEl.textContent = user.avatar;
  avatarEl.className = 'pin-avatar ' + (user.id === 'patryk' ? 'avatar-patryk' : 'avatar-ja');

  document.getElementById('pin-display-name').textContent = user.name;
  document.getElementById('pin-display-role').textContent = user.role;

  enteredPin = '';
  updatePinDots();
  document.getElementById('pin-error-msg').textContent = '';
}

function backToProfiles() {
  document.getElementById('login-step-profiles').style.display = 'block';
  document.getElementById('login-step-pin').style.display = 'none';
  selectedLoginUserId = null;
  enteredPin = '';
  document.getElementById('pin-error-msg').textContent = '';
}

function pressPin(digit) {
  if (enteredPin.length >= 4) return;
  enteredPin += String(digit);
  updatePinDots();

  if (enteredPin.length === 4) {
    setTimeout(verifyAndLogin, 120);
  }
}

function deletePin() {
  if (enteredPin.length > 0) {
    enteredPin = enteredPin.slice(0, -1);
    updatePinDots();
  }
}

function clearPin() {
  enteredPin = '';
  updatePinDots();
  document.getElementById('pin-error-msg').textContent = '';
}

function updatePinDots() {
  const dots = document.querySelectorAll('#pin-dots .pin-dot');
  const isPatryk = selectedLoginUserId === 'patryk';
  const fillClass = isPatryk ? 'filled-patryk' : 'filled';

  dots.forEach((dot, index) => {
    if (index < enteredPin.length) {
      dot.className = `pin-dot ${fillClass}`;
    } else {
      dot.className = 'pin-dot';
    }
  });
}

function quickLogin() {
  enteredPin = '1234';
  updatePinDots();
  setTimeout(verifyAndLogin, 150);
}

function verifyAndLogin() {
  if (!selectedLoginUserId || !USERS[selectedLoginUserId]) return;
  const expectedPin = state.userPins[selectedLoginUserId] || USERS[selectedLoginUserId].defaultPin;

  if (enteredPin === expectedPin) {
    loginAs(USERS[selectedLoginUserId], true);
  } else {
    // PIN Error
    const errMsg = document.getElementById('pin-error-msg');
    errMsg.textContent = '❌ Niepoprawny PIN! (Domyślny to 1234)';
    const dotsContainer = document.getElementById('pin-dots');
    dotsContainer.classList.add('shake');

    setTimeout(() => {
      dotsContainer.classList.remove('shake');
      enteredPin = '';
      updatePinDots();
    }, 600);
  }
}

function loginAs(user, isInteractive = false) {
  currentAuthUser = user;
  localStorage.setItem(AUTH_KEY, user.id);
  hideLoginOverlay();
  updateAuthUI();

  if (isInteractive) {
    addHistory('auth', `Zalogowano do panelu: <strong>${user.name}</strong> (${user.role})`);
    saveState();
    showToast(`👋 Witaj w panelu, ${user.name}!`);
  }

  refresh();
}

function updateAuthUI() {
  if (!currentAuthUser) return;

  // Sidebar current user
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  const sidebarName = document.getElementById('sidebar-user-name');
  if (sidebarAvatar) {
    sidebarAvatar.textContent = currentAuthUser.avatar;
    sidebarAvatar.className = 'partner-avatar user-avatar-current ' + (currentAuthUser.id === 'patryk' ? 'avatar-patryk' : 'avatar-ja');
  }
  if (sidebarName) sidebarName.textContent = currentAuthUser.name;

  // Topbar user badge
  const topbarAvatar = document.getElementById('topbar-avatar');
  const topbarName = document.getElementById('topbar-user-name');
  if (topbarAvatar) {
    topbarAvatar.textContent = currentAuthUser.avatar;
    topbarAvatar.className = 'topbar-user-avatar ' + (currentAuthUser.id === 'patryk' ? 'avatar-patryk' : 'avatar-ja');
  }
  if (topbarName) topbarName.textContent = currentAuthUser.name;

  // Pre-select seller in sale modal
  const sellerSel = document.getElementById('s-seller');
  if (sellerSel) sellerSel.value = currentAuthUser.name;

  // Pre-select author in note modal
  const authorSel = document.getElementById('n-author');
  if (authorSel) authorSel.value = currentAuthUser.name;

  // Highlight active user card in Podział Zysku
  const cardJa = document.getElementById('podzial-card-ja');
  const cardPatryk = document.getElementById('podzial-card-patryk');
  const badgeJa = document.getElementById('badge-active-ja');
  const badgePatryk = document.getElementById('badge-active-patryk');

  if (cardJa && cardPatryk) {
    if (currentAuthUser.id === 'ja') {
      cardJa.classList.add('active-user-card');
      cardPatryk.classList.remove('active-user-card');
      if (badgeJa) badgeJa.style.display = 'inline-block';
      if (badgePatryk) badgePatryk.style.display = 'none';
    } else {
      cardPatryk.classList.add('active-user-card');
      cardJa.classList.remove('active-user-card');
      if (badgePatryk) badgePatryk.style.display = 'inline-block';
      if (badgeJa) badgeJa.style.display = 'none';
    }
  }

  // Update stat share label
  const statShareLabel = document.getElementById('stat-share-label');
  if (statShareLabel) {
    statShareLabel.textContent = `Działka: ${currentAuthUser.name} (50%)`;
  }
}

function openUserSwitchModal() {
  if (!currentAuthUser) {
    showLoginOverlay();
    return;
  }

  const modalAvatar = document.getElementById('switch-modal-avatar');
  const modalName = document.getElementById('switch-modal-name');
  const modalRole = document.getElementById('switch-modal-role');
  const toggleBtn = document.getElementById('btn-toggle-partner');

  if (modalAvatar) {
    modalAvatar.textContent = currentAuthUser.avatar;
    modalAvatar.className = 'partner-big-avatar ' + (currentAuthUser.id === 'patryk' ? 'avatar-patryk' : 'avatar-ja');
  }
  if (modalName) modalName.textContent = currentAuthUser.name;
  if (modalRole) modalRole.textContent = currentAuthUser.role;

  const targetPartner = currentAuthUser.id === 'ja' ? 'Patryk' : 'Ja';
  if (toggleBtn) {
    toggleBtn.innerHTML = `⇄ Przełącz profil na: <strong>${targetPartner}</strong>`;
  }

  openModal('user-switch-modal');
}

function quickSwitchPartner() {
  closeModal('user-switch-modal');
  const targetId = currentAuthUser && currentAuthUser.id === 'ja' ? 'patryk' : 'ja';
  loginAs(USERS[targetId], true);
}

function logoutUser() {
  closeModal('user-switch-modal');
  localStorage.removeItem(AUTH_KEY);
  currentAuthUser = null;
  showLoginOverlay();
  showToast('🔒 Wylogowano z panelu sklepu');
}

// Physical keyboard support for PIN
window.addEventListener('keydown', e => {
  const pinStep = document.getElementById('login-step-pin');
  if (pinStep && pinStep.style.display !== 'none') {
    if (e.key >= '0' && e.key <= '9') {
      pressPin(e.key);
    } else if (e.key === 'Backspace') {
      deletePin();
    } else if (e.key === 'Escape') {
      backToProfiles();
    } else if (e.key === 'Enter') {
      if (enteredPin.length === 4) verifyAndLogin();
    }
  }
});

// ============== DATE INIT ==============
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

// ============== NOTATNIK (NOTES SYSTEM) ==============
function seedDemoNotes() {
  if (state.notes && state.notes.length > 0) return;

  state.notes = [
    {
      id: uid(),
      title: '📦 Odbiór nowej dostawy i inwentaryzacja',
      category: 'Do zrobienia',
      color: 'amber',
      pinned: true,
      author: 'Patryk',
      authorId: 'patryk',
      content: '[x] Opłacenie faktury u dostawcy towaru\n[ ] Sprawdzenie paczki z powerbankami 20000mAh\n[ ] Naklejenie kodów kreskowych na etui\n[ ] Wprowadzenie nowej partii do magazynu ShopPanel',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: uid(),
      title: '💡 Zestaw promocyjny: Etui + Szkło 9H',
      category: 'Pomysły',
      color: 'indigo',
      pinned: true,
      author: 'Ja',
      authorId: 'ja',
      content: 'Stworzyć ofertę wiązaną: Etui skórzane + Szkło hartowane 9H z rabatem -20% na drugi produkt.\nMarża łączna nadal wyniesie ponad 65%, a mocno podbijemy średnią wartość koszyka (AOV). Patryk, daj znać jak to widzisz!',
      createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: uid(),
      title: '⚠️ Zmiana cennika nadań Paczkomatów InPost',
      category: 'Ważne',
      color: 'rose',
      pinned: false,
      author: 'Ja',
      authorId: 'ja',
      content: 'Od 1 listopada wchodzi nowy cennik gabarytu B (+0.60 zł netto za przesyłkę).\nTrzeba zaktualizować szablon wysyłki na platformie lub wliczyć ten koszt w cenę jednostkową.',
      createdAt: new Date(Date.now() - 3600000 * 40).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: uid(),
      title: '🤝 Kontakt do hurtowni akcesoriów GSM',
      category: 'Magazyn',
      color: 'emerald',
      pinned: false,
      author: 'Patryk',
      authorId: 'patryk',
      content: 'Hurtownia TechTrade - opiekun p. Krzysztof\nEmail: b2b@techtrade-gsm.example.pl\nTel: +48 601 234 567\nWarunek: minimum logistyczne 800 zł, rabat handlowy 12% od drugiego zamówienia.',
      createdAt: new Date(Date.now() - 3600000 * 70).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

function openNoteModal() {
  document.getElementById('n-id').value = '';
  document.getElementById('n-title').value = '';
  document.getElementById('n-category').value = 'Do zrobienia';
  document.getElementById('n-color').value = 'indigo';
  document.getElementById('n-author').value = currentAuthUser ? currentAuthUser.name : 'Ja';
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
  const author = document.getElementById('n-author').value;
  const pinned = document.getElementById('n-pinned').checked;
  const content = document.getElementById('n-content').value.trim();

  if (!title) {
    showToast('⚠️ Podaj tytuł notatki');
    return;
  }

  const authorId = author.toLowerCase() === 'patryk' ? 'patryk' : 'ja';

  if (id) {
    // Edit existing note
    const note = state.notes.find(n => n.id === id);
    if (note) {
      note.title = title;
      note.category = category;
      note.color = color;
      note.author = author;
      note.authorId = authorId;
      note.pinned = pinned;
      note.content = content;
      note.updatedAt = new Date().toISOString();
      addHistory('note', `Zaktualizowano notatkę: <strong>${title}</strong> (${author})`);
      showToast('✅ Notatka zaktualizowana');
    }
  } else {
    // New note
    const newNote = {
      id: uid(),
      title,
      category,
      color,
      author,
      authorId,
      pinned,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.notes.unshift(newNote);
    addHistory('note', `Dodano nową notatkę: <strong>${title}</strong> (${author})`);
    showToast('✅ Notatka zapisana');
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
  document.getElementById('n-author').value = note.author;
  document.getElementById('n-pinned').checked = !!note.pinned;
  document.getElementById('n-content').value = note.content;
  document.getElementById('note-modal-title').textContent = '✏️ Edytuj notatkę';
  openModal('note-modal');
}

function deleteNote(id, e) {
  if (e) e.stopPropagation();
  const note = state.notes.find(n => n.id === id);
  if (!confirm(`Czy na pewno usunąć notatkę "${note ? note.title : ''}"?`)) return;

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
    navigator.clipboard.writeText(text)
      .then(() => showToast('📋 Skopiowano treść do schowka!'))
      .catch(() => showToast('✅ Notatka skopiowana!'));
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
  const authorFilter = document.getElementById('note-author-filter')?.value || '';
  const sortFilter = document.getElementById('note-sort-filter')?.value || 'pinned';

  let list = [...state.notes];

  // Filtering
  if (search) {
    list = list.filter(n =>
      n.title.toLowerCase().includes(search) ||
      (n.content && n.content.toLowerCase().includes(search)) ||
      (n.category && n.category.toLowerCase().includes(search)) ||
      (n.author && n.author.toLowerCase().includes(search))
    );
  }

  if (catFilter) {
    list = list.filter(n => n.category === catFilter);
  }

  if (authorFilter) {
    list = list.filter(n => n.author === authorFilter);
  }

  // Sorting
  if (sortFilter === 'pinned') {
    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
    });
  } else if (sortFilter === 'newest') {
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } else if (sortFilter === 'oldest') {
    list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }

  // Update badge count
  if (badge) {
    badge.textContent = state.notes.length;
  }

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
    'Finanse': 'tag-finanse',
    'Ustalenia': 'tag-ustalenia'
  };

  grid.innerHTML = list.map(note => {
    const isPatryk = note.author && note.author.toLowerCase() === 'patryk';
    const authorAvatarClass = isPatryk ? 'avatar-patryk' : 'avatar-ja';
    const authorInitials = isPatryk ? 'PA' : 'JA';
    const tagClass = catTagClasses[note.category] || '';
    const colorClass = `note-${note.color || 'indigo'}`;
    const pinnedClass = note.pinned ? 'pinned' : '';

    // Render body with checklist support
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
          <span class="note-tag ${tagClass}">${note.category || 'Ogólne'}</span>
          <button class="note-pin-btn ${note.pinned ? 'active' : ''}" onclick="togglePinNote('${note.id}', event)" title="${note.pinned ? 'Odepnij notatkę' : 'Przypnij notatkę na górze'}">
            📌
          </button>
        </div>
        <h3 class="note-title">${escapeHtml(note.title)}</h3>
        <div class="note-body">${bodyHtml}</div>
        <div class="note-footer">
          <div class="note-author-pill">
            <div class="note-author-avatar ${authorAvatarClass}">${authorInitials}</div>
            <div class="note-author-details">
              <span class="note-author-name">${escapeHtml(note.author)}</span>
              <span class="note-date">${fmtRelativeTime(note.updatedAt || note.createdAt)}</span>
            </div>
          </div>
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

// ============== PRODUCTS ==============
function addProduct() {
  const name = document.getElementById('p-name').value.trim();
  const category = document.getElementById('p-category').value.trim() || 'Ogólne';
  const qty = parseInt(document.getElementById('p-qty').value) || 0;
  const buy = parseFloat(document.getElementById('p-buy').value) || 0;
  const sell = parseFloat(document.getElementById('p-sell').value) || 0;
  const alert = parseInt(document.getElementById('p-alert').value) ?? 5;

  if (!name) { showToast('⚠️ Podaj nazwę produktu'); return; }
  if (sell < buy) { showToast('⚠️ Uwaga: Cena sprzedaży jest niższa niż zakupu!'); }

  const product = { id: uid(), name, category, qty, buy, sell, alert, createdAt: todayStr() };
  state.products.push(product);
  addHistory('product', `Dodano produkt: <strong>${name}</strong> (${qty} szt. po ${fmt(sell)})`);
  saveState();
  closeModal('add-product-modal');
  clearProductForm();
  refresh();
  updateCategoryFilter();
  showToast(`✅ Dodano produkt: ${name}`);
}

function clearProductForm() {
  ['p-name', 'p-category', 'p-qty', 'p-buy', 'p-sell'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const alertEl = document.getElementById('p-alert');
  if (alertEl) alertEl.value = 5;
}

function deleteProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!confirm(`Czy na pewno usunąć produkt "${p ? p.name : ''}"?`)) return;
  state.products = state.products.filter(x => x.id !== id);
  if (p) addHistory('product', `Usunięto produkt: <strong>${p.name}</strong>`);
  saveState();
  refresh();
  updateCategoryFilter();
  showToast('🗑️ Produkt usunięty');
}

function renderProducts() {
  const tbody = document.getElementById('products-tbody');
  const empty = document.getElementById('products-empty');
  if (!tbody) return;

  const search = (document.getElementById('product-search')?.value || '').toLowerCase();
  const catFilter = document.getElementById('category-filter')?.value || '';

  const products = state.products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search);
    const matchCat = !catFilter || p.category === catFilter;
    return matchSearch && matchCat;
  });

  if (products.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = products.map(p => {
    const margin = p.buy > 0 ? (((p.sell - p.buy) / p.buy) * 100).toFixed(1) : '—';
    let status, statusClass;
    if (p.qty === 0) { status = 'Brak'; statusClass = 'status-empty'; }
    else if (p.qty <= p.alert) { status = 'Niski'; statusClass = 'status-low'; }
    else { status = 'OK'; statusClass = 'status-ok'; }

    return `<tr>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${escapeHtml(p.category)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <strong>${p.qty}</strong>
          <button class="btn btn-icon" onclick="adjustQty('${p.id}', -1)" title="Zmniejsz stan">−1</button>
          <button class="btn btn-icon" onclick="adjustQty('${p.id}', 1)" title="Zwiększ stan">+1</button>
        </div>
      </td>
      <td>${fmt(p.buy)}</td>
      <td><strong>${fmt(p.sell)}</strong></td>
      <td style="color:${p.sell >= p.buy ? 'var(--accent-green-light)' : 'var(--accent-red-light)'}">${margin}%</td>
      <td><span class="status-badge ${statusClass}">${status}</span></td>
      <td>
        <button class="btn btn-icon btn-danger" onclick="deleteProduct('${p.id}')" title="Usuń produkt">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function adjustQty(id, delta) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  p.qty = Math.max(0, p.qty + delta);
  addHistory('stock', `Zmieniono stan <strong>${p.name}</strong>: ${delta > 0 ? '+' : ''}${delta} szt. (Aktualnie: ${p.qty})`);
  saveState();
  refresh();
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

// ============== SALES ==============
function fillSaleDropdown() {
  const sel = document.getElementById('s-product');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Wybierz produkt z magazynu --</option>' +
    state.products.filter(p => p.qty > 0).map(p =>
      `<option value="${p.id}" data-sell="${p.sell}" data-buy="${p.buy}">${escapeHtml(p.name)} (${p.qty} szt. dostępne)</option>`
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
  const qty = parseFloat(document.getElementById('s-qty').value) || 0;
  const price = parseFloat(document.getElementById('s-price').value) || 0;
  const buy = opt ? parseFloat(opt.dataset.buy || 0) : 0;

  const total = qty * price;
  const profit = qty * (price - buy);

  document.getElementById('sale-total-preview').textContent = fmt(total);
  const profitEl = document.getElementById('sale-profit-preview');
  profitEl.textContent = fmt(profit);
  profitEl.style.color = profit >= 0 ? 'var(--accent-green-light)' : 'var(--accent-red-light)';
}

function addSale() {
  const productId = document.getElementById('s-product').value;
  const qty = parseInt(document.getElementById('s-qty').value) || 0;
  const price = parseFloat(document.getElementById('s-price').value) || 0;
  const date = document.getElementById('s-date').value || todayStr();
  const seller = document.getElementById('s-seller').value;

  if (!productId) { showToast('⚠️ Wybierz produkt'); return; }
  if (qty < 1) { showToast('⚠️ Podaj poprawną ilość'); return; }

  const product = state.products.find(x => x.id === productId);
  if (!product) { showToast('❌ Nie znaleziono produktu'); return; }
  if (qty > product.qty) { showToast(`⚠️ Brak na stanie (dostępne: ${product.qty} szt.)`); return; }

  const revenue = qty * price;
  const profit = qty * (price - product.buy);

  const sale = {
    id: uid(),
    productId,
    productName: product.name,
    qty,
    price,
    revenue,
    profit,
    costPerUnit: product.buy,
    date,
    seller
  };

  state.sales.push(sale);
  product.qty -= qty;

  addHistory('sale', `Sprzedano <strong>${qty}x ${product.name}</strong> → ${fmt(revenue)} (zysk: ${fmt(profit)}) — sprzedawca: ${seller}`);
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
  showToast(`✅ Sprzedaż zarejestrowana! Zysk: ${fmt(profit)}`);
}

function deleteSale(id) {
  const s = state.sales.find(x => x.id === id);
  if (!confirm(`Czy na pewno cofnąć sprzedaż "${s ? s.productName : ''}"? Stan magazynowy zostanie zwrócony.`)) return;

  if (s) {
    const p = state.products.find(x => x.id === s.productId);
    if (p) p.qty += s.qty;
    addHistory('sale', `Anulowano sprzedaż: <strong>${s.qty}x ${s.productName}</strong> (przywrócono stan)`);
  }

  state.sales = state.sales.filter(x => x.id !== id);
  saveState();
  refresh();
  showToast('🗑️ Sprzedaż anulowana');
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

  let sales = [...state.sales].sort((a, b) => b.date.localeCompare(a.date));
  if (search) sales = sales.filter(s => s.productName.toLowerCase().includes(search));
  if (month) sales = sales.filter(s => s.date.startsWith(month));

  if (!sales.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = sales.map(s => {
    const isPatryk = s.seller && s.seller.toLowerCase() === 'patryk';
    const sellerBadge = isPatryk
      ? '<span class="badge badge-orange">Patryk</span>'
      : '<span class="badge badge-purple">Ja</span>';

    return `<tr>
      <td>${fmtDate(s.date)}</td>
      <td><strong>${escapeHtml(s.productName)}</strong></td>
      <td>${s.qty} szt.</td>
      <td>${fmt(s.price)}</td>
      <td style="color:var(--accent-green-light);font-weight:600">${fmt(s.revenue)}</td>
      <td style="color:${s.profit >= 0 ? 'var(--accent-green-light)' : 'var(--accent-red-light)'};font-weight:600">${fmt(s.profit)}</td>
      <td>${sellerBadge}</td>
      <td><button class="btn btn-icon btn-danger" onclick="deleteSale('${s.id}')" title="Cofnij sprzedaż">🗑️</button></td>
    </tr>`;
  }).join('');
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
  addHistory('expense', `Dodano koszt: <strong>${desc}</strong> — ${fmt(amount)} (${category})`);
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

  const expenses = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));

  if (!expenses.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = expenses.map(e => `<tr>
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
  if (!amount) { showToast('⚠️ Podaj kwotę inwestycji'); return; }

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

function openInvReturnModal(idx) {
  document.getElementById('inv-return-idx').value = idx;
  document.getElementById('inv-return-amount').value = '';
  openModal('inv-return-modal');
}

function markInvestmentReturn() {
  const idx = parseInt(document.getElementById('inv-return-idx').value);
  const amount = parseFloat(document.getElementById('inv-return-amount').value) || 0;
  const inv = state.investments[idx];
  if (!inv) return;

  inv.returnAmount = amount;
  inv.status = 'done';
  addHistory('investment', `Rozliczono inwestycję: <strong>${inv.name}</strong> — zwrot ${fmt(amount)}`);
  saveState();
  closeModal('inv-return-modal');
  refresh();
  showToast(`✅ Inwestycja oznaczona jako zakończona`);
}

function deleteInvestment(idx) {
  const inv = state.investments[idx];
  if (!confirm(`Czy usunąć inwestycję "${inv ? inv.name : ''}"?`)) return;
  addHistory('investment', `Usunięto inwestycję: <strong>${inv.name}</strong>`);
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
    const roi = inv.status === 'done' && inv.amount > 0
      ? (((inv.returnAmount - inv.amount) / inv.amount) * 100).toFixed(1)
      : '—';
    const statusClass = inv.status === 'done' ? 'status-done' : 'status-active';
    const statusLabel = inv.status === 'done' ? 'Zakończona' : 'W toku';

    return `<tr>
      <td>${fmtDate(inv.date)}</td>
      <td><strong>${escapeHtml(inv.name)}</strong></td>
      <td style="font-weight:600">${fmt(inv.amount)}</td>
      <td>${escapeHtml(inv.goal || '—')}</td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td style="color:${roi !== '—' && parseFloat(roi) >= 0 ? 'var(--accent-green-light)' : 'var(--accent-red-light)'}">
        ${inv.returnAmount ? fmt(inv.returnAmount) : '—'} ${roi !== '—' ? `<strong>(${roi}%)</strong>` : ''}
      </td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        ${inv.status !== 'done' ? `<button class="btn btn-icon" onclick="openInvReturnModal(${idx})" title="Zatwierdź zwrot">💹</button>` : ''}
        <button class="btn btn-icon btn-danger" onclick="deleteInvestment(${idx})" title="Usuń">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

// ============== PODZIAŁ ZYSKU & PAYOUTS ==============
function openPayoutModal(partnerIdx) {
  const partnerNames = ['Ja (Wspólnik 1)', 'Patryk (Wspólnik 2)'];
  document.getElementById('payout-partner-idx').value = partnerIdx;
  document.getElementById('payout-partner-name').value = partnerNames[partnerIdx];
  document.getElementById('payout-amount').value = '';
  document.getElementById('payout-note').value = '';
  document.getElementById('payout-date').value = todayStr();
  openModal('payout-modal');
}

function addPayout() {
  const partnerIdx = parseInt(document.getElementById('payout-partner-idx').value);
  const amount = parseFloat(document.getElementById('payout-amount').value) || 0;
  const note = document.getElementById('payout-note').value.trim();
  const date = document.getElementById('payout-date').value || todayStr();

  if (!amount) { showToast('⚠️ Podaj kwotę wypłaty'); return; }

  const shortNames = ['Ja', 'Patryk'];
  const pName = shortNames[partnerIdx];

  state.payouts.push({
    id: uid(),
    partnerIdx,
    partnerName: pName,
    amount,
    note,
    date
  });

  addHistory('payout', `Wypłata dla: <strong>${pName}</strong> → ${fmt(amount)} ${note ? `(${note})` : ''}`);
  saveState();
  closeModal('payout-modal');
  refresh();
  showToast(`💸 Wypłata zarejestrowana: ${fmt(amount)} dla ${pName}`);
}

function renderPayouts() {
  const tbody = document.getElementById('payouts-tbody');
  const empty = document.getElementById('payouts-empty');
  if (!tbody) return;

  const payouts = [...state.payouts].sort((a, b) => b.date.localeCompare(a.date));

  if (!payouts.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = payouts.map(p => {
    const isPatryk = p.partnerName === 'Patryk';
    const badge = isPatryk
      ? '<span class="badge badge-orange">Patryk</span>'
      : '<span class="badge badge-purple">Ja</span>';

    return `<tr>
      <td>${fmtDate(p.date)}</td>
      <td>${badge}</td>
      <td style="color:var(--accent-green-light);font-weight:700">${fmt(p.amount)}</td>
      <td style="color:var(--text-secondary)">${escapeHtml(p.note || '—')}</td>
    </tr>`;
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

// ============== STATS & DASHBOARD ==============
function calcStats() {
  const totalRevenue = state.sales.reduce((s, x) => s + x.revenue, 0);
  const totalCOGS = state.sales.reduce((s, x) => s + (x.costPerUnit * x.qty), 0);
  const totalExpenses = state.expenses.reduce((s, x) => s + x.amount, 0);
  const totalNet = totalRevenue - totalCOGS - totalExpenses;
  const totalPaid = state.payouts.reduce((s, x) => s + x.amount, 0);
  const remaining = Math.max(0, totalNet - totalPaid);
  const margin = totalRevenue > 0 ? ((totalNet / totalRevenue) * 100).toFixed(1) : 0;

  const totalProductsQty = state.products.reduce((s, p) => s + p.qty, 0);
  const lowStockProducts = state.products.filter(p => p.qty > 0 && p.qty <= p.alert);
  const emptyProducts = state.products.filter(p => p.qty === 0);

  // 50/50 division
  const p1Paid = state.payouts.filter(x => x.partnerIdx === 0).reduce((s, x) => s + x.amount, 0);
  const p2Paid = state.payouts.filter(x => x.partnerIdx === 1).reduce((s, x) => s + x.amount, 0);
  const share = totalNet / 2;

  const invTotal = state.investments.reduce((s, i) => s + i.amount, 0);
  const invReturn = state.investments.filter(i => i.status === 'done').reduce((s, i) => s + i.returnAmount, 0);
  const invActive = state.investments.filter(i => i.status === 'active').length;

  return {
    totalRevenue, totalCOGS, totalExpenses, totalNet, totalPaid, remaining, margin,
    totalProductsQty, lowStockProducts, emptyProducts,
    p1Paid, p2Paid, share,
    invTotal, invReturn, invActive
  };
}

function renderDashboard(stats) {
  const revEl = document.getElementById('stat-revenue');
  const profEl = document.getElementById('stat-profit');
  const margEl = document.getElementById('stat-margin');
  const prodEl = document.getElementById('stat-products');
  const shareEl = document.getElementById('stat-share');

  if (revEl) revEl.textContent = fmt(stats.totalRevenue);
  if (profEl) profEl.textContent = fmt(stats.totalNet);
  if (margEl) margEl.textContent = `Marża: ${stats.margin}%`;
  if (prodEl) prodEl.textContent = stats.totalProductsQty + ' szt.';
  if (shareEl) shareEl.textContent = fmt(stats.share);

  // Low stock alert list
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
          <span class="${p.danger ? 'badge-danger' : 'badge-warn'}">${p.danger ? 'BRAK' : p.qty + ' szt.'}</span>
        </div>`
      ).join('');
      if (statLow) statLow.textContent = `⚠️ ${alerts.length} prod. wymaga zamówienia`;
    } else {
      lowList.innerHTML = '<p class="empty-state">Wszystko w porządku! Magazyn pełny ✅</p>';
      if (statLow) statLow.textContent = 'Brak alertów magazynowych';
    }
  }

  // Finance summary
  const fsRev = document.getElementById('fs-revenue');
  const fsCost = document.getElementById('fs-cost');
  const fsExp = document.getElementById('fs-expenses');
  const fsNet = document.getElementById('fs-net');
  const fsPaid = document.getElementById('fs-paid');
  const fsRem = document.getElementById('fs-remaining');

  if (fsRev) fsRev.textContent = fmt(stats.totalRevenue);
  if (fsCost) fsCost.textContent = fmt(stats.totalCOGS);
  if (fsExp) fsExp.textContent = fmt(stats.totalExpenses);
  if (fsNet) fsNet.textContent = fmt(stats.totalNet);
  if (fsPaid) fsPaid.textContent = fmt(stats.totalPaid);
  if (fsRem) fsRem.textContent = fmt(stats.remaining);

  // Recent sales
  const recentList = document.getElementById('recent-sales-list');
  if (recentList) {
    const recent = [...state.sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    if (recent.length) {
      recentList.innerHTML = recent.map(s => `
        <div class="sale-item">
          <div>
            <div class="sale-name">${escapeHtml(s.productName)}</div>
            <div class="sale-date">${fmtDate(s.date)} · ${s.qty} szt. · Sprzedał: <strong>${escapeHtml(s.seller)}</strong></div>
          </div>
          <div class="sale-amount">+${fmt(s.revenue)}</div>
        </div>`).join('');
    } else {
      recentList.innerHTML = '<p class="empty-state">Brak ostatnich transakcji</p>';
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

function renderPodzialTab(stats) {
  const p1Gross = document.getElementById('p1-gross');
  const p1Paid = document.getElementById('p1-paid');
  const p1Rem = document.getElementById('p1-remaining');
  const p2Gross = document.getElementById('p2-gross');
  const p2Paid = document.getElementById('p2-paid');
  const p2Rem = document.getElementById('p2-remaining');

  if (p1Gross) p1Gross.textContent = fmt(stats.share);
  if (p1Paid) p1Paid.textContent = fmt(stats.p1Paid);
  if (p1Rem) p1Rem.textContent = fmt(Math.max(0, stats.share - stats.p1Paid));

  if (p2Gross) p2Gross.textContent = fmt(stats.share);
  if (p2Paid) p2Paid.textContent = fmt(stats.p2Paid);
  if (p2Rem) p2Rem.textContent = fmt(Math.max(0, stats.share - stats.p2Paid));
}

function renderInvestmentsTab(stats) {
  const invTot = document.getElementById('inv-total');
  const invRet = document.getElementById('inv-return');
  const invAct = document.getElementById('inv-active');

  if (invTot) invTot.textContent = fmt(stats.invTotal);
  if (invRet) invRet.textContent = fmt(stats.invReturn);
  if (invAct) invAct.textContent = stats.invActive;
}

// ============== REVENUE CHART ==============
let chartCanvas, chartCtx;
function renderChart() {
  chartCanvas = document.getElementById('revenue-chart');
  if (!chartCanvas) return;
  chartCtx = chartCanvas.getContext('2d');

  // Last 7 days
  const days = [];
  const revenues = [];
  const profits = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    days.push(d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }));
    const daySales = state.sales.filter(s => s.date === dayStr);
    revenues.push(daySales.reduce((s, x) => s + x.revenue, 0));
    profits.push(daySales.reduce((s, x) => s + x.profit, 0));
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

  // Grid lines
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

  // Revenue Fill Gradient
  const revPoints = revenues.map((v, i) => toXY(i, v));
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

  // Data Dots & Dates
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
  ctx.fillText('Zysk', padL + 126, 12);
}

// ============== DEMO DATA SEEDER ==============
function loadDemoData() {
  if (state.products && state.products.length > 0) {
    if (!state.notes || state.notes.length === 0) {
      seedDemoNotes();
      saveState();
    }
    return;
  }

  const products = [
    { id: uid(), name: 'Słuchawki Bezprzewodowe Pro ANC', category: 'Elektronika', qty: 16, buy: 75.00, sell: 169.99, alert: 5, createdAt: todayStr() },
    { id: uid(), name: 'Powerbank FastCharge 20000mAh', category: 'Elektronika', qty: 22, buy: 45.00, sell: 99.00, alert: 6, createdAt: todayStr() },
    { id: uid(), name: 'Etui Skórzane MagSafe iPhone 15/16', category: 'Akcesoria', qty: 32, buy: 18.00, sell: 59.90, alert: 8, createdAt: todayStr() },
    { id: uid(), name: 'Szkło Hartowane 9H (Zestaw 3 szt.)', category: 'Akcesoria', qty: 45, buy: 5.50, sell: 29.90, alert: 12, createdAt: todayStr() },
    { id: uid(), name: 'Kabel USB-C Braided 100W 2m', category: 'Kable', qty: 3, buy: 9.80, sell: 39.00, alert: 6, createdAt: todayStr() },
    { id: uid(), name: 'Uchwyt Samochodowy Indukcyjny', category: 'Akcesoria', qty: 0, buy: 32.00, sell: 79.99, alert: 4, createdAt: todayStr() }
  ];
  state.products = products;

  // Realistic sales spread over last 7 days for Ja & Patryk
  state.sales = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < count; j++) {
      const p = products[Math.floor(Math.random() * (products.length - 1))];
      if (p.qty <= 0) continue;
      const qty = 1;
      const revenue = qty * p.sell;
      const profit = qty * (p.sell - p.buy);
      state.sales.push({
        id: uid(),
        productId: p.id,
        productName: p.name,
        qty,
        price: p.sell,
        revenue,
        profit,
        costPerUnit: p.buy,
        date: dateStr,
        seller: Math.random() > 0.5 ? 'Ja' : 'Patryk'
      });
    }
  }

  state.expenses = [
    { id: uid(), desc: 'Kampania reklamowa Meta Ads', category: 'Marketing', amount: 200, date: todayStr() },
    { id: uid(), desc: 'Paczka kartonów fasonowych 100szt.', category: 'Opakowania', amount: 89, date: todayStr() },
    { id: uid(), desc: 'Serwer i domena sklepu', category: 'Oprogramowanie', amount: 49, date: todayStr() }
  ];

  state.investments = [
    { id: uid(), name: 'Nowy towar – Power Banki 30szt.', goal: 'Poszerzenie oferty magazynowej', amount: 1350, date: todayStr(), status: 'active', returnAmount: 0 },
    { id: uid(), name: 'Kampania Google Ads na start', goal: 'Pozyskanie pierwszych 50 zamówień', amount: 450, date: todayStr(), status: 'done', returnAmount: 1100 }
  ];

  state.payouts = [
    { id: uid(), partnerIdx: 0, partnerName: 'Ja', amount: 400, note: 'Zaliczka za bieżący tydzień', date: todayStr() },
    { id: uid(), partnerIdx: 1, partnerName: 'Patryk', amount: 400, note: 'Zaliczka za bieżący tydzień', date: todayStr() }
  ];

  seedDemoNotes();

  addHistory('product', 'Panel ShopPanel zainicjowany pomyślnie dla wspólników: Ja & Patryk');
  saveState();
}

// ============== REFRESH ALL ==============
function refresh() {
  const stats = calcStats();
  renderDashboard(stats);
  renderProducts();
  renderSales();
  renderExpenses();
  renderFinanceTab(stats);
  renderPodzialTab(stats);
  renderInvestments();
  renderInvestmentsTab(stats);
  renderPayouts();
  renderNotes();
  renderHistory();
  fillSaleDropdown();
  updateAuthUI();
  setTimeout(renderChart, 60);
}

// ============== APP INIT ==============
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  loadDemoData();
  initDate();
  updateCategoryFilter();
  initAuth();
  refresh();

  // Resize chart on window resize
  window.addEventListener('resize', () => {
    clearTimeout(window._resizeTimer);
    window._resizeTimer = setTimeout(renderChart, 150);
  });
});
