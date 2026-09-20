const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// 权益人列表（搜索 + 标签筛选）
router.get('/', async (req, res, next) => {
  try {
    const { search = '', willing_present, willing_assist, active, page = 1, page_size = 20 } = req.query;
    const where = []; const params = [];
    if (search) {
      const like = `%${search}%`;
      where.push('(h.name LIKE ? OR h.wechat LIKE ? OR h.phone LIKE ? OR h.benefit_types LIKE ?)');
      params.push(like, like, like, like);
    }
    if (willing_present !== undefined && willing_present !== '') {
      where.push('h.willing_present = ?'); params.push(Number(willing_present) === 1 ? 1 : 0);
    }
    if (willing_assist !== undefined && willing_assist !== '') {
      where.push('h.willing_assist = ?'); params.push(Number(willing_assist) === 1 ? 1 : 0);
    }
    if (active !== undefined && active !== '') {
      where.push('h.active = ?'); params.push(Number(active) === 1 ? 1 : 0);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [countRows] = await pool.query(`SELECT COUNT(*) total FROM benefit_holders h ${whereSql}`, params);
    const size = Math.min(100, Number(page_size) || 20);
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const [rows] = await pool.query(
      `SELECT h.*,
        (SELECT COUNT(*) FROM bookings b WHERE b.benefit_holder_id = h.id) booking_count
      FROM benefit_holders h ${whereSql} ORDER BY h.active DESC, h.id DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );
    res.json({ total: countRows[0].total, items: rows });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, wechat, phone, benefit_types, willing_present = 0, willing_assist = 0, active = 1, benefit_count = 0, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '预订人姓名不能为空' });
    const bc = Number(benefit_count) || 0;
    if (bc < 0 || !Number.isInteger(bc)) return res.status(400).json({ error: '升级权益次数不合法' });
    const [ins] = await pool.query(
      'INSERT INTO benefit_holders (name, wechat, phone, benefit_types, willing_present, willing_assist, active, benefit_count, notes) VALUES (?,?,?,?,?,?,?,?,?)',
      [String(name).trim(), wechat || null, phone || null, benefit_types || null,
       Number(willing_present) === 1 ? 1 : 0, Number(willing_assist) === 1 ? 1 : 0,
       Number(active) === 1 ? 1 : 0, bc, notes || null]
    );
    res.json({ id: ins.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, wechat, phone, benefit_types, willing_present = 0, willing_assist = 0, active = 1, benefit_count, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '预订人姓名不能为空' });
    if (benefit_count != null) {
      const bc = Number(benefit_count);
      if (!Number.isInteger(bc) || bc < 0) return res.status(400).json({ error: '升级权益次数不合法' });
    }
    const [r] = await pool.query(
      'UPDATE benefit_holders SET name=?, wechat=?, phone=?, benefit_types=?, willing_present=?, willing_assist=?, active=?, benefit_count=COALESCE(?, benefit_count), notes=? WHERE id=?',
      [String(name).trim(), wechat || null, phone || null, benefit_types || null,
       Number(willing_present) === 1 ? 1 : 0, Number(willing_assist) === 1 ? 1 : 0,
       Number(active) === 1 ? 1 : 0,
       benefit_count == null ? null : Number(benefit_count), notes || null, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: '预订人不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [bk] = await pool.query('SELECT COUNT(*) c FROM bookings WHERE benefit_holder_id = ?', [req.params.id]);
    if (bk[0].c > 0) return res.status(409).json({ error: '该预订人已被预定引用，无法删除' });
    const [r] = await pool.query('DELETE FROM benefit_holders WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '预订人不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
