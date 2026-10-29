// Vercel Serverless Function: POST /api/login
const {
  verifyAdminPassword,
  hashPassword,
  safeCompare,
  stripAccents,
  generateToken,
  loadDb
} = require('./db.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const { login, password } = body || {};
    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Podaj login oraz hasło' });
    }

    const cleanLogin = String(login).trim().toLowerCase();
    const normLogin = stripAccents(cleanLogin);

    // 1. Check Admin Account
    if (cleanLogin === 'admin' || normLogin === 'admin') {
      const isAdminValid = verifyAdminPassword(password) || (password.trim() !== password && verifyAdminPassword(password.trim()));
      if (isAdminValid) {
        const token = generateToken({
          userId: 'admin_1',
          login: 'admin',
          name: 'Administrator',
          role: 'admin'
        });

        return res.status(200).json({
          success: true,
          token,
          user: {
            id: 'admin_1',
            login: 'admin',
            name: 'Administrator',
            role: 'admin'
          }
        });
      }
    }

    // 2. Check Cloud DB Users (Created by Admin)
    const db = await loadDb(true); // Force fresh load
    const userList = (db && Array.isArray(db.users)) ? db.users : [];

    const foundUser = userList.find(u => {
      if (!u) return false;
      const uLogin = String(u.login || '').trim().toLowerCase();
      const uName = String(u.name || '').trim().toLowerCase();
      return uLogin === cleanLogin ||
             uName === cleanLogin ||
             stripAccents(uLogin) === normLogin ||
             stripAccents(uName) === normLogin;
    });

    if (foundUser && foundUser.salt && foundUser.passwordHash) {
      const computedHash = hashPassword(password, foundUser.salt);
      let isValid = safeCompare(computedHash, foundUser.passwordHash);
      if (!isValid && password.trim() !== password) {
        isValid = safeCompare(hashPassword(password.trim(), foundUser.salt), foundUser.passwordHash);
      }

      if (isValid) {
        const token = generateToken({
          userId: foundUser.id,
          login: foundUser.login,
          name: foundUser.name,
          role: foundUser.role || 'Wspólnik'
        });

        return res.status(200).json({
          success: true,
          token,
          user: {
            id: foundUser.id,
            login: foundUser.login,
            name: foundUser.name,
            role: foundUser.role || 'Wspólnik'
          }
        });
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Nieprawidłowy login lub hasło'
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Wystąpił błąd serwera' });
  }
};
