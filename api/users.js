// Vercel Serverless Function: /api/users
const crypto = require('crypto');
const {
  verifyToken,
  hashPassword,
  stripAccents,
  sanitizeHtml,
  applySecurityHeaders,
  loadDb,
  saveDb
} = require('./db.js');

module.exports = async (req, res) => {
  applySecurityHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Check auth - Only Admin can access /api/users
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Wymagane uprawnienia administratora' });
  }

  const db = await loadDb(true); // Always fresh
  if (!Array.isArray(db.users)) db.users = [];

  // GET: List all users (excluding hashes and salts!)
  if (req.method === 'GET') {
    const safeList = db.users.map(u => ({
      id: u.id,
      login: u.login,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt
    }));

    // Prepend default admin
    safeList.unshift({
      id: 'admin_1',
      login: 'admin',
      name: 'Administrator',
      role: 'admin',
      createdAt: '2026-10-28T10:00:00.000Z'
    });

    return res.status(200).json({ success: true, users: safeList });
  }

  // POST: Create a new user account
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const { login, password, name, role } = body || {};

    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Podaj login oraz hasło dla nowego użytkownika' });
    }

    if (typeof login !== 'string' || login.length > 50) {
      return res.status(400).json({ success: false, message: 'Nieprawidłowa długość loginu (max 50 znaków)' });
    }
    if (typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ success: false, message: 'Nieprawidłowa długość hasła (max 128 znaków)' });
    }

    const cleanLogin = String(login).trim().toLowerCase();
    const normLogin = stripAccents(cleanLogin);

    if (cleanLogin === 'admin' || normLogin === 'admin' || db.users.some(u => {
      if (!u || !u.login) return false;
      const existing = String(u.login).trim().toLowerCase();
      return existing === cleanLogin || stripAccents(existing) === normLogin;
    })) {
      return res.status(400).json({ success: false, message: 'Konto o takim loginie już istnieje!' });
    }

    const safeName = sanitizeHtml((name && String(name).trim()) || cleanLogin).slice(0, 80);
    const safeRole = sanitizeHtml(role || 'Wspólnik').slice(0, 30);

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const newUser = {
      id: 'usr_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      login: cleanLogin,
      name: safeName,
      role: safeRole,
      salt,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);

    if (!Array.isArray(db.history)) db.history = [];
    db.history.unshift({
      id: 'hist_' + Date.now().toString(36),
      type: 'auth',
      text: `Utworzono nowe konto użytkownika: <strong>${safeName}</strong> (login: ${cleanLogin}, rola: ${safeRole})`,
      ts: new Date().toISOString()
    });

    const saved = await saveDb(db);
    if (!saved) {
      console.error('Failed to save newUser to Gist DB');
    }

    return res.status(201).json({
      success: true,
      message: 'Konto użytkownika utworzone pomyślnie!',
      user: {
        id: newUser.id,
        login: newUser.login,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });
  }

  // DELETE: Remove a user account
  if (req.method === 'DELETE') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const id = (body && body.id) || (req.query && req.query.id);

    if (!id || id === 'admin_1') {
      return res.status(400).json({ success: false, message: 'Nie można usunąć głównego konta administratora' });
    }

    const found = db.users.find(u => u.id === id);
    db.users = db.users.filter(u => u.id !== id);

    if (found && Array.isArray(db.history)) {
      db.history.unshift({
        id: 'hist_' + Date.now().toString(36),
        type: 'auth',
        text: `Usunięto konto użytkownika: <strong>${sanitizeHtml(found.name)}</strong> (${sanitizeHtml(found.login)})`,
        ts: new Date().toISOString()
      });
    }

    await saveDb(db);

    return res.status(200).json({ success: true, message: 'Konto zostało usunięte' });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
