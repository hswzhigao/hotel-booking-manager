const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

const STATS_SQL = `
  (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id AND b.status <> 'cancelled') booking_count,
  (SELECT COALESCE(SUM(t.rc), 0) FROM (
     SELECT COUNT(*) rc FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
     WHERE b.customer_id = c.id AND b.status <> 'cancelled' GROUP BY b.id
   ) t) total_rooms,
  (SELECT COALESCE(SUM(t2.nt), 0) FROM (
     SELECT b.nights * COUNT(bi.id) nt FROM bookings b LEFT JOIN booking_items bi ON bi.booking_id = b.id
     WHERE b.customer_id = c.id AND b.status <> 'cancelled' GROUP BY b.id, b.nights
   ) t2) total_room_nights,
  (SELECT COALESCE(SUM(b.sale_total), 0) FROM bookings b
   WHERE b.customer_id = c.id AND b.status <> 'cancelled') total_spend`;

// 客户列表（含统计）
router.get('/', async (req, res, next) => {
  try {
    const { search = '', page = 1, page_size = 20 } = req.query;
    const like = `%${search}%`;
    const where = search ? 'WHERE c.name LIKE ? OR c.wechat LIKE ? OR c.phone LIKE ?' : '';
    const params = search ? [like, like, like] : [];
    const [countRows] = await pool.query(`SELECT COUNT(*) total FROM customers c ${where}`, params);
    const size = Math.min(100, Number(page_size) || 20);
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const [rows] = await pool.query(
      `SELECT c.*, ${STATS_SQL} FROM customers c ${where} ORDER BY c.id DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );
    res.json({ total: countRows[0].total, items: rows });
  } catch (e) { next(e); }
});

// 客户详情（信息 + 历史预定含明细）
router.get('/:id', async (req, res, next) => {
  try {
    const [cs] = await pool.query(
      `SELECT c.*, ${STATS_SQL} FROM customers c WHERE c.id = ?`, [req.params.id]
    );
    if (!cs.length) return res.status(404).json({ error: '客户不存在' });
    const [bookings] = await pool.query(
      `SELECT b.*, h.name hotel_name,
        (SELECT COUNT(*) FROM booking_items bi WHERE bi.booking_id = b.id) room_count,
        (b.sale_total - b.cost_total) profit
      FROM bookings b JOIN hotels h ON h.id = b.hotel_id
      WHERE b.customer_id = ? ORDER BY b.order_time DESC, b.id DESC`, [req.params.id]
    );
    const ids = bookings.map(b => b.id);
    const itemsMap = {};
    if (ids.length) {
      const [items] = await pool.query(
        `SELECT bi.booking_id, bi.id, bi.room_type_id, rt.name room_type_name, bi.price
         FROM booking_items bi JOIN room_types rt ON rt.id = bi.room_type_id
         WHERE bi.booking_id IN (?)`, [ids]
      );
      for (const it of items) (itemsMap[it.booking_id] = itemsMap[it.booking_id] || []).push(it);
    }
    bookings.forEach(b => { b.items = itemsMap[b.id] || []; });
    res.json({ customer: cs[0], bookings });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, wechat, phone, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '客户姓名不能为空' });
    const [ins] = await pool.query(
      'INSERT INTO customers (name, wechat, phone, notes) VALUES (?,?,?,?)',
      [String(name).trim(), wechat || null, phone || null, notes || null]
    );
    res.json({ id: ins.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, wechat, phone, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '客户姓名不能为空' });
    const [r] = await pool.query(
      'UPDATE customers SET name=?, wechat=?, phone=?, notes=? WHERE id=?',
      [String(name).trim(), wechat || null, phone || null, notes || null, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: '客户不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [bk] = await pool.query('SELECT COUNT(*) c FROM bookings WHERE customer_id = ?', [req.params.id]);
    if (bk[0].c > 0) return res.status(409).json({ error: '该客户已有预定记录，无法删除' });
    const [r] = await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '客户不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
