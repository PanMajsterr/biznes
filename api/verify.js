// Vercel Serverless Function: GET/POST /api/verify
const {
  verifyToken,
  applySecurityHeaders
} = require('./db.js');

module.exports = async (req, res) => {
  applySecurityHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '') || (body && body.token);

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
