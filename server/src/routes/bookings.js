const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

const STATUSES = ['active', 'completed', 'cancelled'];

function bad(status, msg) { const e = new Error(msg); e.status = status; throw e; }

function parseDate(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return null;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : String(s);
}

function parseOrderTime(s) {
  if (!s) return null; // 不传则由数据库取当前时间
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 19).replace('T', ' ');
  return bad(400, '下单时间格式不合法');
}

// 校验并规整预定入参
async function validatePayload(body) {
  const { customer_id, hotel_id, check_in, check_out, cost_total = 0, order_time, benefit_used = 0, status = 'active', notes, items, benefit_holder_id } = body || {};
  if (!customer_id || !hotel_id) bad(400, '请选择客户和酒店');
  const ci = parseDate(check_in), co = parseDate(check_out);
  if (!ci || !co) bad(400, '入住/离店日期格式应为 YYYY-MM-DD');
  if (new Date(`${co}T00:00:00`) <= new Date(`${ci}T00:00:00`)) bad(400, '离店日期必须晚于入住日期');
  if (!STATUSES.includes(status)) bad(400, '状态不合法');
  const bu = Number(benefit_used) === 1 ? 1 : 0;
  const ct = Number(cost_total) || 0;
  if (ct < 0) bad(400, '成本价不合法');
  if (!Array.isArray(items) || items.length === 0) bad(400, '至少需要一间房');
  for (const it of items) {
    const p = Number(it.price);
    if (!it.room_type_id || isNaN(p) || p < 0) bad(400, '明细行的房型或价格不合法');
  }
  const ot = parseOrderTime(order_time);
  const [[cust]] = await pool.query('SELECT id FROM customers WHERE id = ?', [customer_id]);
  if (!cust) bad(400, '客户不存在');
  const [[hotel]] = await pool.query('SELECT id FROM hotels WHERE id = ?', [hotel_id]);
  if (!hotel) bad(400, '酒店不存在');
  let holderId = null;
  if (benefit_holder_id !== undefined && benefit_holder_id !== null && benefit_holder_id !== '') {
    const [[holder]] = await pool.query('SELECT id FROM benefit_holders WHERE id = ?', [benefit_holder_id]);
    if (!holder) bad(400, '预订人不存在');
    holderId = Number(benefit_holder_id);
  }
  // V2.1：升级权益归属预订人——勾选权益必须已选预订人
  if (bu === 1 && holderId === null) bad(400, '使用升级权益需选择预订人');
  const rtIds = [...new Set(items.map(i => Number(i.room_type_id)))];
  const [rts] = await pool.query('SELECT id, hotel_id, name FROM room_types WHERE id IN (?)', [rtIds]);
  if (rts.length !== rtIds.length) bad(400, '存在无效房型');
  for (const rt of rts) {
    if (rt.hotel_id !== Number(hotel_id)) bad(400, `房型「${rt.name}」不属于所选酒店`);
  }
  const nights = Math.round((new Date(`${co}T00:00:00`) - new Date(`${ci}T00:00:00`)) / 86400000);
  const saleTotal = Math.round(items.reduce((s, i) => s + Number(i.price), 0) * 100) / 100;
  return {
    customer_id: Number(customer_id), hotel_id: Number(hotel_id),
    check_in: ci, check_out: co, nights, saleTotal, costTotal: ct,
    orderTime: ot, benefitUsed: bu, status, notes: notes || null,
    benefit_holder_id: holderId,
    items: items.map(i => ({ room_type_id: Number(i.room_type_id), price: Number(i.price) })),
  };
}

const effectiveUse = (benefitUsed, status) => (Number(benefitUsed) === 1 && status !== 'cancelled') ? 1 : 0;

// 预定列表
router.get('/', async (req, res, next) => {
  try {
    const { customer_id, hotel_id, status, date_from, date_to, search = '', page = 1, page_size = 20 } = req.query;
    const where = []; const params = [];
    if (customer_id) { where.push('b.customer_id = ?'); params.push(customer_id); }
    if (hotel_id) { where.push('b.hotel_id = ?'); params.push(hotel_id); }
    if (status) {
      if (!STATUSES.includes(status)) bad(400, '状态不合法');
      where.push('b.status = ?'); params.push(status);
    }
    if (date_from) {
      if (!parseDate(date_from)) bad(400, 'date_from 格式应为 YYYY-MM-DD');
      where.push('b.check_in >= ?'); params.push(date_from);
    }
    if (date_to) {
      if (!parseDate(date_to)) bad(400, 'date_to 格式应为 YYYY-MM-DD');
      where.push('b.check_in <= ?'); params.push(date_to);
    }
    if (search) { where.push('(c.name LIKE ? OR h.name LIKE ?)'); const like = `%${search}%`; params.push(like, like); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [countRows] = await pool.query(
      `SELECT COUNT(*) total FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN hotels h ON h.id = b.hotel_id ${whereSql}`, params
    );
    const size = Math.min(100, Number(page_size) || 20);
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const [rows] = await pool.query(
      `SELECT b.*, c.name customer_name, h.name hotel_name, bh.name benefit_holder_name,
        (SELECT COUNT(*) FROM booking_items bi WHERE bi.booking_id = b.id) room_count,
        (b.sale_total - b.cost_total) profit
      FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN hotels h ON h.id = b.hotel_id
      LEFT JOIN benefit_holders bh ON bh.id = b.benefit_holder_id
      ${whereSql} ORDER BY b.order_time DESC, b.id DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );
    const ids = rows.map(r => r.id);
    if (ids.length) {
      const [items] = await pool.query(
        `SELECT bi.booking_id, rt.name FROM booking_items bi JOIN room_types rt ON rt.id = bi.room_type_id WHERE bi.booking_id IN (?)`, [ids]
      );
      const cnt = {};
      for (const it of items) { const k = `${it.booking_id}|${it.name}`; cnt[k] = (cnt[k] || 0) + 1; }
      const namesByBooking = {};
      for (const it of items) {
        namesByBooking[it.booking_id] = namesByBooking[it.booking_id] || new Set();
        namesByBooking[it.booking_id].add(it.name);
      }
      rows.forEach(r => {
        const set = namesByBooking[r.id] || new Set();
        r.items_summary = [...set].map(n => `${n}×${cnt[`${r.id}|${n}`]}`).join('、');
      });
    }
    res.json({ total: countRows[0].total, items: rows });
  } catch (e) { next(e); }
});

// 预定详情
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, c.name customer_name, h.name hotel_name, bh.name benefit_holder_name,
        (SELECT COUNT(*) FROM booking_items bi WHERE bi.booking_id = b.id) room_count,
        (b.sale_total - b.cost_total) profit
      FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN hotels h ON h.id = b.hotel_id
      LEFT JOIN benefit_holders bh ON bh.id = b.benefit_holder_id
      WHERE b.id = ?`, [req.params.id]
    );
    if (!rows.length) bad(404, '预定不存在');
    const [items] = await pool.query(
      `SELECT bi.id, bi.room_type_id, rt.name room_type_name, bi.price
       FROM booking_items bi JOIN room_types rt ON rt.id = bi.room_type_id WHERE bi.booking_id = ?`, [req.params.id]
    );
    rows[0].items = items;
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// 新建预定（事务：明细 + 权益扣减）
router.post('/', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const p = await validatePayload(req.body);
    await conn.beginTransaction();
    const cols = ['customer_id', 'hotel_id', 'check_in', 'check_out', 'nights', 'sale_total', 'cost_total', 'benefit_used', 'status', 'notes', 'benefit_holder_id'];
    const vals = [p.customer_id, p.hotel_id, p.check_in, p.check_out, p.nights, p.saleTotal, p.costTotal, p.benefitUsed, p.status, p.notes, p.benefit_holder_id];
    if (p.orderTime) { cols.push('order_time'); vals.push(p.orderTime); } // 不传则取数据库当前时间
    const [ins] = await conn.query(
      `INSERT INTO bookings (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals
    );
    const bid = ins.insertId;
    for (const it of p.items) {
      await conn.query('INSERT INTO booking_items (booking_id, room_type_id, price) VALUES (?,?,?)', [bid, it.room_type_id, it.price]);
    }
    if (effectiveUse(p.benefitUsed, p.status) === 1) {
      const [c] = await conn.query(
        'UPDATE benefit_holders SET benefit_count = benefit_count - 1 WHERE id = ? AND benefit_count >= 1', [p.benefit_holder_id]
      );
      if (c.affectedRows === 0) { bad(400, '该预订人剩余升级权益不足'); }
    }
    await conn.commit();
    res.json({ id: bid });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
});

// 编辑预定（事务：重建明细 + 权益差额调整，支持换客户）
router.put('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = req.params.id;
    const [[old]] = await conn.query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!old) bad(404, '预定不存在');
    const p = await validatePayload(req.body);
    await conn.beginTransaction();
    if (p.orderTime) {
      await conn.query(
        `UPDATE bookings SET customer_id=?, hotel_id=?, check_in=?, check_out=?, nights=?, sale_total=?, cost_total=?, order_time=?, benefit_used=?, status=?, notes=?, benefit_holder_id=? WHERE id=?`,
        [p.customer_id, p.hotel_id, p.check_in, p.check_out, p.nights, p.saleTotal, p.costTotal, p.orderTime, p.benefitUsed, p.status, p.notes, p.benefit_holder_id, id]
      );
    } else {
      await conn.query(
        `UPDATE bookings SET customer_id=?, hotel_id=?, check_in=?, check_out=?, nights=?, sale_total=?, cost_total=?, benefit_used=?, status=?, notes=?, benefit_holder_id=? WHERE id=?`,
        [p.customer_id, p.hotel_id, p.check_in, p.check_out, p.nights, p.saleTotal, p.costTotal, p.benefitUsed, p.status, p.notes, p.benefit_holder_id, id]
      );
    }
    await conn.query('DELETE FROM booking_items WHERE booking_id = ?', [id]);
    for (const it of p.items) {
      await conn.query('INSERT INTO booking_items (booking_id, room_type_id, price) VALUES (?,?,?)', [id, it.room_type_id, it.price]);
    }
    const oldUse = effectiveUse(old.benefit_used, old.status);
    const newUse = effectiveUse(p.benefitUsed, p.status);
    const oldHolder = old.benefit_holder_id || null;
    const newHolder = p.benefit_holder_id || null;
    if (oldHolder !== null && oldHolder === newHolder) {
      if (newUse === 1 && oldUse === 0) {
        const [c] = await conn.query(
          'UPDATE benefit_holders SET benefit_count = benefit_count - 1 WHERE id = ? AND benefit_count >= 1', [newHolder]
        );
        if (c.affectedRows === 0) { bad(400, '该预订人剩余升级权益不足'); }
      } else if (oldUse === 1 && newUse === 0) {
        await conn.query('UPDATE benefit_holders SET benefit_count = benefit_count + 1 WHERE id = ?', [oldHolder]);
      }
    } else {
      if (oldUse === 1 && oldHolder !== null) {
        await conn.query('UPDATE benefit_holders SET benefit_count = benefit_count + 1 WHERE id = ?', [oldHolder]);
      }
      if (newUse === 1) {
        const [c] = await conn.query(
          'UPDATE benefit_holders SET benefit_count = benefit_count - 1 WHERE id = ? AND benefit_count >= 1', [newHolder]
        );
        if (c.affectedRows === 0) { bad(400, '该预订人剩余升级权益不足'); }
      }
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
});

// 删除预定（返还权益，明细级联删除）
router.delete('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = req.params.id;
    const [[old]] = await conn.query('SELECT * FROM bookings WHERE id = ?', [id]);
    if (!old) bad(404, '预定不存在');
    await conn.beginTransaction();
    if (effectiveUse(old.benefit_used, old.status) === 1 && old.benefit_holder_id) {
      await conn.query('UPDATE benefit_holders SET benefit_count = benefit_count + 1 WHERE id = ?', [old.benefit_holder_id]);
    }
    await conn.query('DELETE FROM bookings WHERE id = ?', [id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
});

module.exports = router;
