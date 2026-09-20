const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

module.exports = function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(m[1], jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
};
