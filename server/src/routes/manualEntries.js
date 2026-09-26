const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

const TYPES = ['income', 'expense'];
const BUSINESSES = ['hotel', 'golf', 'general'];

function parseDate(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return null;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : String(s);
}

// 列表：month=YYYY-MM 过滤；type/business 筛选；按日期倒序
router.get('/', async (req, res, next) => {
  try {
    const { month, type, business, page = 1, page_size = 50 } = req.query;
    const where = []; const params = [];
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month 格式应为 YYYY-MM' });
      where.push("entry_date >= ? AND entry_date < DATE_ADD(?, INTERVAL 1 MONTH)");
      params.push(`${month}-01`, `${month}-01`);
    }
    if (type) {
      if (!TYPES.includes(type)) return res.status(400).json({ error: '类型不合法' });
      where.push('type = ?'); params.push(type);
    }
    if (business) {
      if (!BUSINESSES.includes(business)) return res.status(400).json({ error: '归属不合法' });
      where.push('business = ?'); params.push(business);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [countRows] = await pool.query(`SELECT COUNT(*) total FROM manual_entries ${whereSql}`, params);
    const size = Math.min(200, Number(page_size) || 50);
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const [rows] = await pool.query(
      `SELECT * FROM manual_entries ${whereSql} ORDER BY entry_date DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );
    // 月度小计（同筛选口径）
    const [[sum]] = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) income,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) expense
       FROM manual_entries ${whereSql}`, params
    );
    res.json({ total: countRows[0].total, items: rows, summary: sum });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { entry_date, type, business = 'general', amount, notes } = req.body || {};
    const d = parseDate(entry_date);
    if (!d) return res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' });
    if (!TYPES.includes(type)) return res.status(400).json({ error: '类型应为 income/expense' });
    if (!BUSINESSES.includes(business)) return res.status(400).json({ error: '归属应为 hotel/golf/general' });
    const a = Number(amount);
    if (isNaN(a) || a <= 0) return res.status(400).json({ error: '金额应为正数' });
    const [ins] = await pool.query(
      'INSERT INTO manual_entries (entry_date, type, business, amount, notes) VALUES (?,?,?,?,?)',
      [d, type, business, Math.round(a * 100) / 100, notes || null]
    );
    res.json({ id: ins.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { entry_date, type, business = 'general', amount, notes } = req.body || {};
    const d = parseDate(entry_date);
    if (!d) return res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' });
    if (!TYPES.includes(type)) return res.status(400).json({ error: '类型应为 income/expense' });
    if (!BUSINESSES.includes(business)) return res.status(400).json({ error: '归属应为 hotel/golf/general' });
    const a = Number(amount);
    if (isNaN(a) || a <= 0) return res.status(400).json({ error: '金额应为正数' });
    const [r] = await pool.query(
      'UPDATE manual_entries SET entry_date=?, type=?, business=?, amount=?, notes=? WHERE id=?',
      [d, type, business, Math.round(a * 100) / 100, notes || null, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: '记录不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query('DELETE FROM manual_entries WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '记录不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
