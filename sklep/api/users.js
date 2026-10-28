// Vercel Serverless Function: /api/users
const crypto = require('crypto');
const {
  verifyToken,
  hashPassword,
  loadDb,
  saveDb
} = require('./db.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Check auth - Only Admin can access /api/users
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Wymagane uprawnienia administratora' });
  }

  const db = await loadDb();
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
    const { login, password, name, role } = req.body || {};

    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Podaj login oraz hasło dla nowego użytkownika' });
    }

    const cleanLogin = String(login).trim().toLowerCase();
    if (cleanLogin === 'admin' || db.users.some(u => u.login && u.login.toLowerCase() === cleanLogin)) {
      return res.status(400).json({ success: false, message: 'Konto o takim loginie już istnieje!' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const newUser = {
      id: 'usr_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      login: cleanLogin,
      name: (name && String(name).trim()) || cleanLogin,
      role: role || 'Wspólnik',
      salt,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);

    if (!Array.isArray(db.history)) db.history = [];
    db.history.unshift({
      id: 'hist_' + Date.now().toString(36),
      type: 'auth',
      text: `Utworzono nowe konto użytkownika: <strong>${newUser.name}</strong> (login: ${newUser.login}, rola: ${newUser.role})`,
      ts: new Date().toISOString()
    });

    await saveDb(db);

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
    const { id } = req.body || req.query || {};
    if (!id || id === 'admin_1') {
      return res.status(400).json({ success: false, message: 'Nie można usunąć głównego konta administratora' });
    }

    const found = db.users.find(u => u.id === id);
    db.users = db.users.filter(u => u.id !== id);

    if (found && Array.isArray(db.history)) {
      db.history.unshift({
        id: 'hist_' + Date.now().toString(36),
        type: 'auth',
        text: `Usunięto konto użytkownika: <strong>${found.name}</strong> (${found.login})`,
        ts: new Date().toISOString()
      });
    }

    await saveDb(db);

    return res.status(200).json({ success: true, message: 'Konto zostało usunięte' });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
