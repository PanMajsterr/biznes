// Vercel Serverless Function: POST /api/login
const {
  ADMIN_SALT,
  ADMIN_HASH,
  hashPassword,
  safeCompare,
  generateToken,
  loadDb
} = require('./db.js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    const { login, password } = req.body || {};
    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Podaj login oraz hasło' });
    }

    const cleanLogin = String(login).trim().toLowerCase();

    // 1. Check Admin Account
    if (cleanLogin === 'admin') {
      const computedHash = hashPassword(password, ADMIN_SALT);
      if (safeCompare(computedHash, ADMIN_HASH)) {
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
    const db = await loadDb();
    const userList = (db && Array.isArray(db.users)) ? db.users : [];
    const foundUser = userList.find(u => u.login && u.login.toLowerCase() === cleanLogin);

    if (foundUser && foundUser.salt && foundUser.passwordHash) {
      const computedHash = hashPassword(password, foundUser.salt);
      if (safeCompare(computedHash, foundUser.passwordHash)) {
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
    return res.status(500).json({ success: false, message: 'Wystąpił błąd serwera' });
  }
};
