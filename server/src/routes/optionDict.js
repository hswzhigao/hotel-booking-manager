const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// 按类别取预设值
router.get('/', async (req, res, next) => {
  try {
    const { category = '' } = req.query;
    if (!category) return res.status(400).json({ error: '缺少类别参数' });
    const [rows] = await pool.query('SELECT * FROM option_dict WHERE category = ? ORDER BY sort, id', [category]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { category, label, sort = 0 } = req.body || {};
    if (!category || !String(category).trim()) return res.status(400).json({ error: '类别不能为空' });
    if (!label || !String(label).trim()) return res.status(400).json({ error: '预设值不能为空' });
    const [ins] = await pool.query(
      'INSERT INTO option_dict (category, label, sort) VALUES (?,?,?)',
      [String(category).trim(), String(label).trim(), Number(sort) || 0]
    );
    res.json({ id: ins.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '该类别下已存在此预设值' });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { label, sort = 0 } = req.body || {};
    if (!label || !String(label).trim()) return res.status(400).json({ error: '预设值不能为空' });
    const [r] = await pool.query('UPDATE option_dict SET label=?, sort=? WHERE id=?',
      [String(label).trim(), Number(sort) || 0, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '预设值不存在' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '该类别下已存在此预设值' });
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query('DELETE FROM option_dict WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '预设值不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
