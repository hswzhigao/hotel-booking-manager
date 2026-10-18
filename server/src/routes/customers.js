const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

const { pinyin } = require('pinyin-pro');
function buildSearchKey(name) {
  if (!name) return '';
  const full = String(pinyin(name, { toneType: 'none', type: 'array' })).replace(/,/g, '');
  const initials = String(pinyin(name, { pattern: 'first', toneType: 'none', type: 'array' })).replace(/,/g, '');
  return `${full} ${initials}`.trim();
}


router.use(auth);

const STATS_SQL = `
  (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = c.id AND b.status NOT IN ('cancelled','communicating')) booking_count,
  (SELECT COALESCE(SUM(t.rc), 0) FROM (
     SELECT COUNT(*) rc FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
     WHERE b.customer_id = c.id AND b.status NOT IN ('cancelled','communicating') GROUP BY b.id
   ) t) total_rooms,
  (SELECT COALESCE(SUM(t2.nt), 0) FROM (
     SELECT b.nights * COUNT(bi.id) nt FROM bookings b LEFT JOIN booking_items bi ON bi.booking_id = b.id
     WHERE b.customer_id = c.id AND b.status NOT IN ('cancelled','communicating') GROUP BY b.id, b.nights
   ) t2) total_room_nights,
  (SELECT COALESCE(SUM(b.sale_total), 0) FROM bookings b
   WHERE b.customer_id = c.id AND b.status NOT IN ('cancelled','communicating'))
 + (SELECT COALESCE(SUM(g.sale_price), 0) FROM golf_orders g
   WHERE g.customer_id = c.id AND g.status NOT IN ('cancelled')) total_spend`;

// 客户列表（含统计）
router.get('/', async (req, res, next) => {
  try {
    const { search = '', is_hotel, is_golf, page = 1, page_size = 20 } = req.query;
    const like = `%${search}%`;
    const where = []; const params = [];
    if (search) { where.push('(c.name LIKE ? OR c.search_key LIKE ? OR c.xianyu_id LIKE ? OR c.wechat_id LIKE ? OR c.phone LIKE ?)'); params.push(like, like, like, like, like); }
    if (is_hotel !== undefined && is_hotel !== '') { where.push('c.is_hotel = ?'); params.push(Number(is_hotel) === 1 ? 1 : 0); }
    if (is_golf !== undefined && is_golf !== '') { where.push('c.is_golf = ?'); params.push(Number(is_golf) === 1 ? 1 : 0); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [countRows] = await pool.query(`SELECT COUNT(*) total FROM customers c ${whereSql}`, params);
    const size = Math.min(100, Number(page_size) || 20);
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const [rows] = await pool.query(
      `SELECT c.*, ${STATS_SQL} FROM customers c ${whereSql} ORDER BY c.id DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );
    res.json({ total: countRows[0].total, items: rows });
  } catch (e) { next(e); }
});

// 导出 CSV（与列表相同筛选，不分页）
router.get('/export', async (req, res, next) => {
  try {
    const { search = '', is_hotel, is_golf } = req.query;
    const like = `%${search}%`;
    const where = []; const params = [];
    if (search) { where.push('(c.name LIKE ? OR c.search_key LIKE ? OR c.xianyu_id LIKE ? OR c.wechat_id LIKE ? OR c.phone LIKE ?)'); params.push(like, like, like, like, like); }
    if (is_hotel !== undefined && is_hotel !== '') { where.push('c.is_hotel = ?'); params.push(Number(is_hotel) === 1 ? 1 : 0); }
    if (is_golf !== undefined && is_golf !== '') { where.push('c.is_golf = ?'); params.push(Number(is_golf) === 1 ? 1 : 0); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [rows] = await pool.query(
      `SELECT c.*, ${STATS_SQL} FROM customers c ${whereSql} ORDER BY c.id DESC`, params
    );
    const { sendCsv } = require('../utils/csv');
    sendCsv(res, `客户_${new Date().toISOString().slice(0, 10)}.csv`,
      ['姓名', '闲鱼号', '微信号', '电话', '酒店客户', '高尔夫客户', '酒店单数', '总间数', '总间夜', '累计消费', '备注', '创建时间'],
      rows.map(c => [
        c.name, c.xianyu_id || '', c.wechat_id || '', c.phone || '',
        c.is_hotel ? '是' : '', c.is_golf ? '是' : '',
        c.booking_count, c.total_rooms, c.total_room_nights,
        Number(c.total_spend || 0).toFixed(2), c.notes || '',
        String(c.created_at || '').slice(0, 19).replace('T', ' '),
      ])
    );
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
        (b.sale_total - b.cost_total - ROUND(b.sale_total * b.fee_rate, 2)) profit
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
    const [golfOrders] = await pool.query(
      `SELECT g.*, bh.name benefit_holder_name, bh.availability holder_availability,
        t.name benefit_type_name, (g.sale_price - g.cost_price - ROUND(g.sale_price * g.fee_rate, 2)) profit
      FROM golf_orders g LEFT JOIN benefit_holders bh ON bh.id = g.benefit_holder_id
      LEFT JOIN golf_benefit_types t ON t.id = g.benefit_type_id
      WHERE g.customer_id = ? ORDER BY g.order_time DESC, g.id DESC`, [req.params.id]
    );
    res.json({ customer: cs[0], bookings, golf_orders: golfOrders });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, xianyu_id, wechat_id, phone, is_hotel = 1, is_golf = 0, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '客户姓名不能为空' });
    const [ins] = await pool.query(
      'INSERT INTO customers (name, search_key, xianyu_id, wechat_id, phone, is_hotel, is_golf, notes) VALUES (?,?,?,?,?,?,?,?)',
      [String(name).trim(), buildSearchKey(String(name).trim()), xianyu_id || null, wechat_id || null, phone || null,
       Number(is_hotel) === 1 ? 1 : 0, Number(is_golf) === 1 ? 1 : 0, notes || null]
    );
    res.json({ id: ins.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, xianyu_id, wechat_id, phone, is_hotel = 1, is_golf = 0, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '客户姓名不能为空' });
    const [r] = await pool.query(
      'UPDATE customers SET name=?, search_key=?, xianyu_id=?, wechat_id=?, phone=?, is_hotel=?, is_golf=?, notes=? WHERE id=?',
      [String(name).trim(), buildSearchKey(String(name).trim()), xianyu_id || null, wechat_id || null, phone || null,
       Number(is_hotel) === 1 ? 1 : 0, Number(is_golf) === 1 ? 1 : 0, notes || null, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: '客户不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [bk] = await pool.query('SELECT COUNT(*) c FROM bookings WHERE customer_id = ?', [req.params.id]);
    if (bk[0].c > 0) return res.status(409).json({ error: '该客户已有酒店预定记录，无法删除' });
    const [go] = await pool.query('SELECT COUNT(*) c FROM golf_orders WHERE customer_id = ?', [req.params.id]);
    if (go[0].c > 0) return res.status(409).json({ error: '该客户已有高尔夫订单，无法删除' });
    const [r] = await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '客户不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
