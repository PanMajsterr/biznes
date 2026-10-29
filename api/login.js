// Vercel Serverless Function: POST /api/login
const {
  verifyAdminPassword,
  hashPassword,
  safeCompare,
  stripAccents,
  applySecurityHeaders,
  generateToken,
  loadDb
} = require('./db.js');

// In-memory sliding window rate limiter to defeat brute-force attacks
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes lockout

function getClientIp(req) {
  const headers = (req && req.headers) || {};
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return headers['x-real-ip'] || (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

function checkRateLimit(key) {
  const record = loginAttempts.get(key);
  if (!record) return { allowed: true };
  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    const remainingSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return { allowed: false, remainingSec };
  }
  // Reset if window expired
  if (Date.now() - record.lastAttempt > LOCKOUT_MS) {
    loginAttempts.delete(key);
    return { allowed: true };
  }
  return { allowed: true, count: record.count };
}

function recordFailedAttempt(key) {
  const record = loginAttempts.get(key) || { count: 0, lastAttempt: Date.now() };
  record.count += 1;
  record.lastAttempt = Date.now();
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(key, record);
}

function clearRateLimit(key) {
  loginAttempts.delete(key);
}

module.exports = async (req, res) => {
  applySecurityHeaders(req, res);

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

    // Input length protection against DoS
    if (typeof login !== 'string' || login.length > 50) {
      return res.status(400).json({ success: false, message: 'Nieprawidłowa długość loginu' });
    }
    if (typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ success: false, message: 'Nieprawidłowa długość hasła' });
    }

    const ip = getClientIp(req);
    const cleanLogin = String(login).trim().toLowerCase();
    const rateLimitKey = `${ip}_${cleanLogin}`;

    const limitStatus = checkRateLimit(rateLimitKey);
    if (!limitStatus.allowed) {
      return res.status(429).json({
        success: false,
        message: `Zbyt wiele nieudanych prób logowania. Konto tymczasowo zablokowane ze względów bezpieczeństwa. Spróbuj za ${limitStatus.remainingSec}s.`
      });
    }

    const normLogin = stripAccents(cleanLogin);

    // 1. Check Admin Account
    if (cleanLogin === 'admin' || normLogin === 'admin') {
      const isAdminValid = verifyAdminPassword(password) || (password.trim() !== password && verifyAdminPassword(password.trim()));
      if (isAdminValid) {
        clearRateLimit(rateLimitKey);
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
        clearRateLimit(rateLimitKey);
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

    // Record failure for rate limiting and apply artificial delay against timing side-channel
    recordFailedAttempt(rateLimitKey);
    await new Promise(r => setTimeout(r, 450));

    return res.status(401).json({
      success: false,
      message: 'Nieprawidłowy login lub hasło'
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Wystąpił błąd serwera' });
  }
};
