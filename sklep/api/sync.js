// Vercel Serverless Function: /api/sync
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SERVER_SECRET = process.env.SHOPPANEL_SECRET || 'shoppanel_secure_jwt_token_secret_2026_x99';
const STORE_PATH = path.join('/tmp', 'shoppanel_store_data.json');

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Wymagane uwierzytelnienie' });
  }

  // GET: Read data
  if (req.method === 'GET') {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        return res.status(200).json({ success: true, data: JSON.parse(raw) });
      }
    } catch (e) {}
    return res.status(200).json({ success: true, data: null });
  }

  // POST: Write data
  if (req.method === 'POST') {
    try {
      const { data } = req.body || {};
      if (data) {
        fs.writeFileSync(STORE_PATH, JSON.stringify(data), 'utf8');
      }
      return res.status(200).json({ success: true, message: 'Dane zsynchronizowane' });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Błąd zapisu danych' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
