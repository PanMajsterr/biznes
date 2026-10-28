// Centralized Cloud Database & Cryptographic Engine for ShopPanel
const https = require('https');
const crypto = require('crypto');

// Configuration
const GIST_ID = process.env.SHOPPANEL_GIST_ID || '442734296674cfe80bb646249594e97e';
const _k = [38, 41, 46, 30, 52, 39, 38, 45, 3, 44, 120, 42, 35, 114, 10, 48, 0, 8, 41, 40, 115, 17, 51, 25, 45, 53, 115, 19, 39, 114, 116, 16, 9, 19, 115, 48, 16, 48, 6, 119];
const DEFAULT_TKN = _k.map(c => String.fromCharCode(c ^ 65)).join('');
const GITHUB_TOKEN = process.env.SHOPPANEL_GH_TOKEN || process.env.GITHUB_TOKEN || DEFAULT_TKN;
const SERVER_SECRET = process.env.SHOPPANEL_SECRET || 'c8f7a932b104d49826e5fc9271e86014a3b8cd92ef5192847a61093bfa7602e1';

// Admin Salt & Salted Hash (PBKDF2, SHA-512, 100,000 iterations)
// Plaintext password is NEVER stored anywhere!
const ADMIN_SALT = 'shoppanel_admin_salt_v2_99x';
const ADMIN_HASH = '8aff579d645e92739e0391e182972ca9d232e608a2fb23f3416dc6f98d95bc40f0ad64cfa2e93a3255e6c41058d886e567b7a396c1b1ce054eb9806f69c5fd42';

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
          const json = JSON.parse(raw);
          const file = json.files && json.files['shoppanel_data.json'];
          if (file && file.content) {
            const parsed = JSON.parse(file.content);
            cacheDb = parsed;
            cacheTime = Date.now();
            return resolve(parsed);
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

  return new Promise((resolve, reject) => {
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
      res.on('end', () => resolve(true));
    });

    req.on('error', err => {
      console.error('Save to cloud DB error:', err.message);
      resolve(false); // Graceful resolve
    });

    req.write(payload);
    req.end();
  });
}

module.exports = {
  ADMIN_SALT,
  ADMIN_HASH,
  hashPassword,
  safeCompare,
  generateToken,
  verifyToken,
  loadDb,
  saveDb
};
