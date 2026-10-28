// Centralized Cloud Database & Cryptographic Engine for ShopPanel
const https = require('https');
const crypto = require('crypto');

// Configuration from Environment Variables (set in Vercel / hosting platform)
const GIST_ID = process.env.SHOPPANEL_GIST_ID || '442734296674cfe80bb646249594e97e';
const GITHUB_TOKEN = process.env.SHOPPANEL_GH_TOKEN || process.env.GITHUB_TOKEN || '';
const SERVER_SECRET = process.env.SHOPPANEL_SECRET || 'shoppanel_secret_dev_key_change_me_in_production_2026';

// Admin Salt & Salted Hash (PBKDF2, SHA-512, 100,000 iterations)
const ADMIN_SALT = process.env.ADMIN_SALT || 'shoppanel_admin_salt_v2_99x';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

// Primary hash (existing author hash) and default fallback hash ('admin123')
const PRIMARY_ADMIN_HASH = '8aff579d645e92739e0391e182972ca9d232e608a2fb23f3416dc6f98d95bc40f0ad64cfa2e93a3255e6c41058d886e567b7a396c1b1ce054eb9806f69c5fd42';
const DEFAULT_FALLBACK_HASH = '4baa5b13be0c766884ac235b17ddd50e86cb97b00bdb726b869e87cf6aee63ef4a990b283e9d7f15897a913b7a568fb7a742a5381e0ab368f100b7b01bc04324'; // hash of 'admin123'

// In-memory cache for fast read operations
let cacheDb = null;
let cacheTime = 0;
const CACHE_TTL_MS = 2500; // 2.5 seconds cache to stay near real-time while avoiding rate limits

function getDefaultDb() {
  return {
    version: 2,
    users: [],
    products: [],
    sales: [],
    expenses: [],
    investments: [],
    payouts: [],
    notes: [],
    history: []
  };
}

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

function verifyAdminPassword(password) {
  if (ADMIN_PASSWORD) {
    const computed = hashPassword(password, ADMIN_SALT);
    const expected = hashPassword(ADMIN_PASSWORD, ADMIN_SALT);
    return safeCompare(computed, expected);
  }
  const computed = hashPassword(password, ADMIN_SALT);
  return safeCompare(computed, PRIMARY_ADMIN_HASH) || safeCompare(computed, DEFAULT_FALLBACK_HASH);
}

function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days valid
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

async function loadDb() {
  const now = Date.now();
  if (cacheDb && (now - cacheTime < CACHE_TTL_MS)) {
    return cacheDb;
  }

  if (!GITHUB_TOKEN) {
    return cacheDb || getDefaultDb();
  }

  return new Promise((resolve) => {
    const req = https.request(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'ShopPanel-CloudDB',
        'Authorization': `token ${GITHUB_TOKEN}`
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const json = JSON.parse(raw);
            const file = json.files && json.files['shoppanel_data.json'];
            if (file && file.content) {
              const parsed = JSON.parse(file.content);
              cacheDb = parsed;
              cacheTime = Date.now();
              return resolve(parsed);
            }
          }
        } catch (e) {}
        resolve(cacheDb || getDefaultDb());
      });
    });

    req.on('error', () => {
      resolve(cacheDb || getDefaultDb());
    });
    req.end();
  });
}

async function saveDb(data) {
  cacheDb = data;
  cacheTime = Date.now();

  if (!GITHUB_TOKEN) {
    return true; // Graceful in-memory / local fallback
  }

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      files: {
        'shoppanel_data.json': {
          content: JSON.stringify(data, null, 2)
        }
      }
    });

    const req = https.request(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'User-Agent': 'ShopPanel-CloudDB',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });

    req.on('error', err => {
      console.error('Save to cloud DB error:', err.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  ADMIN_SALT,
  PRIMARY_ADMIN_HASH,
  DEFAULT_FALLBACK_HASH,
  verifyAdminPassword,
  hashPassword,
  safeCompare,
  generateToken,
  verifyToken,
  loadDb,
  saveDb
};
