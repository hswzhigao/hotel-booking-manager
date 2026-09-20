const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

const AVAILABILITIES = ['any', 'weekend_only', 'weekday_only'];

// 规整字段：布尔/枚举/整数月份与次数校验
function holderFields(body) {
  const b = body || {};
  const bool = v => Number(v) === 1 ? 1 : 0;
  const month = v => {
    if (v === null || v === undefined || v === '') return null;
    const m = Number(v);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      const e = new Error('更新月应为 1-12 或留空（未知）'); e.status = 400; throw e;
    }
    return m;
  };
  const count = (v, label) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      const e = new Error(label + '不合法'); e.status = 400; throw e;
    }
    return n;
  };
  if (b.availability !== undefined && b.availability !== null && b.availability !== '' && !AVAILABILITIES.includes(b.availability)) {
    const e = new Error('可用时间不合法'); e.status = 400; throw e;
  }
  return {
    name: String(b.name || '').trim(),
    wechat: b.wechat || null,
    phone: b.phone || null,
    benefit_types: b.benefit_types || null,
    card_type: b.card_type || null,
    willing_present: bool(b.willing_present),
    willing_assist: bool(b.willing_assist),
    active: bool(b.active === undefined ? 1 : b.active),
    hotel_benefit_count: count(b.hotel_benefit_count, '酒店权益次数'),
    golf_benefit_count: count(b.golf_benefit_count, '高尔夫权益次数'),
    hotel_refresh_month: month(b.hotel_refresh_month),
    golf_refresh_month: month(b.golf_refresh_month),
    availability: AVAILABILITIES.includes(b.availability) ? b.availability : (b.availability === undefined || b.availability === null || b.availability === '' ? 'any' : null),
    notes: b.notes || null,
  };
}

// 预订人列表（搜索 + 标签筛选）
router.get('/', async (req, res, next) => {
  try {
    const { search = '', willing_present, willing_assist, active, availability, page = 1, page_size = 20 } = req.query;
    const where = []; const params = [];
    if (search) {
      const like = `%${search}%`;
      where.push('(h.name LIKE ? OR h.wechat LIKE ? OR h.phone LIKE ? OR h.benefit_types LIKE ? OR h.card_type LIKE ?)');
      params.push(like, like, like, like, like);
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
    if (availability) {
      if (!AVAILABILITIES.includes(availability)) return res.status(400).json({ error: '可用时间筛选值不合法' });
      where.push('h.availability = ?'); params.push(availability);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [countRows] = await pool.query(`SELECT COUNT(*) total FROM benefit_holders h ${whereSql}`, params);
    const size = Math.min(100, Number(page_size) || 20);
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const [rows] = await pool.query(
      `SELECT h.*,
        (SELECT COUNT(*) FROM bookings b WHERE b.benefit_holder_id = h.id) booking_count,
        (SELECT COUNT(*) FROM golf_orders g WHERE g.benefit_holder_id = h.id) golf_order_count
      FROM benefit_holders h ${whereSql} ORDER BY h.active DESC, h.id DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );
    res.json({ total: countRows[0].total, items: rows });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const f = holderFields(req.body);
    if (!f.name) return res.status(400).json({ error: '预订人姓名不能为空' });
    const [ins] = await pool.query(
      `INSERT INTO benefit_holders (name, wechat, phone, benefit_types, card_type, willing_present, willing_assist, active, hotel_benefit_count, golf_benefit_count, hotel_refresh_month, golf_refresh_month, availability, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [f.name, f.wechat, f.phone, f.benefit_types, f.card_type, f.willing_present, f.willing_assist, f.active, f.hotel_benefit_count, f.golf_benefit_count, f.hotel_refresh_month, f.golf_refresh_month, f.availability, f.notes]
    );
    res.json({ id: ins.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const f = holderFields(req.body);
    if (!f.name) return res.status(400).json({ error: '预订人姓名不能为空' });
    const [r] = await pool.query(
      `UPDATE benefit_holders SET name=?, wechat=?, phone=?, benefit_types=?, card_type=?, willing_present=?, willing_assist=?, active=?, hotel_benefit_count=?, golf_benefit_count=?, hotel_refresh_month=?, golf_refresh_month=?, availability=?, notes=? WHERE id=?`,
      [f.name, f.wechat, f.phone, f.benefit_types, f.card_type, f.willing_present, f.willing_assist, f.active, f.hotel_benefit_count, f.golf_benefit_count, f.hotel_refresh_month, f.golf_refresh_month, f.availability, f.notes, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: '预订人不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [bk] = await pool.query('SELECT COUNT(*) c FROM bookings WHERE benefit_holder_id = ?', [req.params.id]);
    if (bk[0].c > 0) return res.status(409).json({ error: '该预订人已被酒店预定引用，无法删除' });
    const [go] = await pool.query('SELECT COUNT(*) c FROM golf_orders WHERE benefit_holder_id = ?', [req.params.id]);
    if (go[0].c > 0) return res.status(409).json({ error: '该预订人已被高尔夫订单引用，无法删除' });
    const [r] = await pool.query('DELETE FROM benefit_holders WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '预订人不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
