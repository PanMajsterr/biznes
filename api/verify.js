// Vercel Serverless Function: GET/POST /api/verify
const crypto = require('crypto');

const SERVER_SECRET = process.env.SHOPPANEL_SECRET || 'shoppanel_secure_jwt_token_secret_2026_x99';

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
      return null; // Expired
    }
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || (req.body && req.body.token);

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Nieprawidłowa lub wygasła sesja' });
  }

  return res.status(200).json({
    success: true,
    user: {
      id: payload.userId,
      login: payload.login,
      name: payload.name,
      role: payload.role
    }
  });
};
