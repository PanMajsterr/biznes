// Vercel Serverless Function: /api/sync
const {
  verifyToken,
  loadDb,
  saveDb
} = require('./db.js');

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
    return res.status(401).json({ success: false, message: 'Wymagana autoryzacja' });
  }

  // GET: Read cloud data
  if (req.method === 'GET') {
    try {
      const db = await loadDb();
      // Strip sensitive user fields before sending to client
      const safeData = {
        ...db,
        users: (db.users || []).map(u => ({
          id: u.id,
          login: u.login,
          name: u.name,
          role: u.role,
          createdAt: u.createdAt
        }))
      };
      return res.status(200).json({ success: true, data: safeData });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Błąd odczytu z bazy danych' });
    }
  }

  // POST: Sync/Write cloud data
  if (req.method === 'POST') {
    try {
      const { data } = req.body || {};
      if (!data) {
        return res.status(400).json({ success: false, message: 'Brak danych do zapisu' });
      }

      const currentDb = await loadDb();

      // Safely merge data: keep user accounts preserved
      const updatedDb = {
        version: 2,
        users: currentDb.users || [], // User accounts are managed via /api/users
        products: Array.isArray(data.products) ? data.products : (currentDb.products || []),
        sales: Array.isArray(data.sales) ? data.sales : (currentDb.sales || []),
        expenses: Array.isArray(data.expenses) ? data.expenses : (currentDb.expenses || []),
        investments: Array.isArray(data.investments) ? data.investments : (currentDb.investments || []),
        payouts: Array.isArray(data.payouts) ? data.payouts : (currentDb.payouts || []),
        notes: Array.isArray(data.notes) ? data.notes : (currentDb.notes || []),
        history: Array.isArray(data.history) ? data.history : (currentDb.history || [])
      };

      await saveDb(updatedDb);
      return res.status(200).json({ success: true, message: 'Dane pomyślnie zsynchronizowane w chmurze' });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Błąd zapisu do bazy danych' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
