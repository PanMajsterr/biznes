// Vercel Serverless Function: /api/users
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SERVER_SECRET = process.env.SHOPPANEL_SECRET || 'shoppanel_secure_jwt_token_secret_2026_x99';
const DB_PATH = path.join('/tmp', 'shoppanel_users.json');

function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function loadUsers() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveUsers(users) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {}
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), String(salt), 100000, 64, 'sha512').toString('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check auth
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Wymagane uprawnienia administratora' });
  }

  const users = loadUsers();

  // GET: List all users (excluding hashes and salts!)
  if (req.method === 'GET') {
    const safeList = users.map(u => ({
      id: u.id,
      login: u.login,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt
    }));

    // Prepend default admin to list
    safeList.unshift({
      id: 'admin_1',
      login: 'admin',
      name: 'Administrator',
      role: 'admin',
      createdAt: '2026-10-28T10:00:00.000Z'
    });

    return res.status(200).json({ success: true, users: safeList });
  }

  // POST: Create a new user
  if (req.method === 'POST') {
    const { login, password, name, role } = req.body || {};

    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Podaj login oraz hasło dla nowego konta' });
    }

    const cleanLogin = String(login).trim().toLowerCase();
    if (cleanLogin === 'admin' || users.some(u => u.login.toLowerCase() === cleanLogin)) {
      return res.status(400).json({ success: false, message: 'Konto o takim loginie już istnieje' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const newUser = {
      id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      login: cleanLogin,
      name: (name && String(name).trim()) || cleanLogin,
      role: role || 'Wspólnik',
      salt,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    return res.status(201).json({
      success: true,
      message: 'Użytkownik utworzony pomyślnie',
      user: {
        id: newUser.id,
        login: newUser.login,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });
  }

  // DELETE: Remove a user
  if (req.method === 'DELETE') {
    const { id } = req.body || req.query || {};
    if (!id || id === 'admin_1') {
      return res.status(400).json({ success: false, message: 'Nie można usunąć głównego konta administratora' });
    }

    const filtered = users.filter(u => u.id !== id);
    saveUsers(filtered);

    return res.status(200).json({ success: true, message: 'Konto zostało usunięte' });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
