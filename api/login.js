// Vercel Serverless Function: POST /api/login
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SERVER_SECRET = process.env.SHOPPANEL_SECRET || 'shoppanel_secure_jwt_token_secret_2026_x99';
const ADMIN_SALT = 'shoppanel_salt_2026_super_secure';
// Cryptographic PBKDF2 hash of admin password (100,000 iterations, SHA-512)
// Plaintext password is NEVER stored or committed anywhere in code!
const ADMIN_HASH = 'a3bed58123ade15a5c3bec348c972031955011b1abc6f8d313fd5dc274988c24a4b1ea2d00d41c6a8209b043591d619480a1c3219be577084f4516a51c9af126';

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), String(salt), 100000, 64, 'sha512').toString('hex');
}

function safeCompare(a, b) {
  try {
    const bufA = Buffer.from(String(a), 'hex');
    const bufB = Buffer.from(String(b), 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}

function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days valid
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function getStoredUsers() {
  try {
    const dbPath = path.join('/tmp', 'shoppanel_users.json');
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  } catch (e) {
    // Ephemeral fallback
  }
  return [];
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

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

    // 2. Check Custom Created Users
    const customUsers = getStoredUsers();
    const foundUser = customUsers.find(u => u.login.toLowerCase() === cleanLogin);
    if (foundUser) {
      const computedHash = hashPassword(password, foundUser.salt);
      if (safeCompare(computedHash, foundUser.passwordHash)) {
        const token = generateToken({
          userId: foundUser.id,
          login: foundUser.login,
          name: foundUser.name,
          role: foundUser.role || 'user'
        });

        return res.status(200).json({
          success: true,
          token,
          user: {
            id: foundUser.id,
            login: foundUser.login,
            name: foundUser.name,
            role: foundUser.role || 'user'
          }
        });
      }
    }

    // Invalid credentials
    return res.status(401).json({
      success: false,
      message: 'Nieprawidłowy login lub hasło'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Wystąpił błąd serwera' });
  }
};
