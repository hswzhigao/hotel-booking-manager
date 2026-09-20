const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { jwtSecret } = require('../config');
const auth = require('../middleware/auth');

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, jwtSecret, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (e) { next(e); }
});

router.get('/me', auth, (req, res) => res.json({ username: req.user.username }));

router.post('/change-password', auth, async (req, res, next) => {
  try {
    const { old_password, new_password } = req.body || {};
    if (!old_password || !new_password) return res.status(400).json({ error: '旧密码和新密码不能为空' });
    if (String(new_password).length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(String(old_password), user.password_hash)) {
      return res.status(400).json({ error: '旧密码不正确' });
    }
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(String(new_password), 10), user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
