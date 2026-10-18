const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

const STATUSES = ['communicating', 'ordered', 'info_confirmed', 'booking', 'booked', 'hotel_confirmed', 'awaiting_checkin', 'checked_in', 'finished', 'cancelled'];
const CHANNELS = ['xianyu', 'wechat', 'other'];

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
  const { customer_id, hotel_id, check_in, check_out, cost_total = 0, order_time, benefit_used = 0, status = 'communicating', notes, items, benefit_holder_id,
          breakfast_included = 0, channel = 'xianyu', fee_rate, holder_settled = 0, benefit_count_used = 1 } = body || {};
  if (!customer_id || !hotel_id) bad(400, '请选择客户和酒店');
  const ci = parseDate(check_in), co = parseDate(check_out);
  if (!ci || !co) bad(400, '入住/离店日期格式应为 YYYY-MM-DD');
  if (new Date(`${co}T00:00:00`) <= new Date(`${ci}T00:00:00`)) bad(400, '离店日期必须晚于入住日期');
  if (!STATUSES.includes(status)) bad(400, '状态不合法');
  if (!CHANNELS.includes(channel)) bad(400, '成交渠道不合法');
  // 手续费率：默认闲鱼 1.6%，其他 0；可按单修改（0~0.5）
  let fr;
  if (fee_rate === null || fee_rate === undefined || fee_rate === '') {
    fr = channel === 'xianyu' ? 0.016 : 0;
  } else {
    fr = Number(fee_rate);
    if (isNaN(fr) || fr < 0 || fr > 0.5) bad(400, '手续费率不合法（0~50%）');
  }
  const bu = Number(benefit_used) === 1 ? 1 : 0;
  if (benefit_count_used === null || benefit_count_used === undefined || benefit_count_used === '' || isNaN(Number(benefit_count_used))) {
    bad(400, '权益张数不合法');
  }
  const bcu = Number(benefit_count_used);
  if (!Number.isInteger(bcu) || bcu < 1 || bcu > 99) bad(400, '权益张数应为 1-99');
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
  // V5：明细价为每晚单价，卖价合计 = 晚数 × Σ(每晚价)
  const saleTotal = Math.round(nights * items.reduce((s, i) => s + Number(i.price), 0) * 100) / 100;
  return {
    customer_id: Number(customer_id), hotel_id: Number(hotel_id),
    check_in: ci, check_out: co, nights, saleTotal, costTotal: ct,
    orderTime: ot, benefitUsed: bu, benefitCountUsed: bcu, status, notes: notes || null,
    benefit_holder_id: holderId,
    breakfastIncluded: Number(breakfast_included) === 1 ? 1 : 0,
    channel, feeRate: fr,
    holderSettled: Number(holder_settled) === 1 ? 1 : 0,
    items: items.map(i => ({ room_type_id: Number(i.room_type_id), price: Number(i.price) })),
  };
}

const effectiveUse = (benefitUsed, status) => (Number(benefitUsed) === 1 && status !== 'cancelled') ? 1 : 0;

// 酒店权益按张数调整：sign='-' 扣 n 张（原子防透支），'+' 返还 n 张
async function adjustHotelBenefit(conn, sign, holderId, n) {
  if (sign === '-') {
    const [c] = await conn.query(
      'UPDATE benefit_holders SET hotel_benefit_count = hotel_benefit_count - ? WHERE id = ? AND hotel_benefit_count >= ?',
      [n, holderId, n]
    );
    if (c.affectedRows === 0) { bad(400, '该预订人剩余酒店权益不足'); }
  } else {
    await conn.query(
      'UPDATE benefit_holders SET hotel_benefit_count = hotel_benefit_count + ? WHERE id = ?',
      [n, holderId]
    );
  }
}

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
    if (search) { where.push('(c.name LIKE ? OR c.search_key LIKE ? OR h.name LIKE ? OR h.search_key LIKE ?)'); const like = `%${search}%`; params.push(like, like, like, like); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [countRows] = await pool.query(
      `SELECT COUNT(*) total FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN hotels h ON h.id = b.hotel_id ${whereSql}`, params
    );
    const size = Math.min(100, Number(page_size) || 20);
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const [rows] = await pool.query(
      `SELECT b.*, c.name customer_name, h.name hotel_name, bh.name benefit_holder_name, bh.source_channel holder_source_channel,
        (SELECT COUNT(*) FROM booking_items bi WHERE bi.booking_id = b.id) room_count,
        ROUND(b.sale_total * b.fee_rate, 2) fee,
        (b.sale_total - b.cost_total - ROUND(b.sale_total * b.fee_rate, 2)) profit
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

// 导出 CSV（与列表相同筛选，不分页）
router.get('/export', async (req, res, next) => {
  try {
    const { customer_id, hotel_id, status, date_from, date_to, search = '' } = req.query;
    const where = []; const params = [];
    if (customer_id) { where.push('b.customer_id = ?'); params.push(customer_id); }
    if (hotel_id) { where.push('b.hotel_id = ?'); params.push(hotel_id); }
    if (status) {
      if (!STATUSES.includes(status)) bad(400, '状态不合法');
      where.push('b.status = ?'); params.push(status);
    }
    if (date_from) { if (!parseDate(date_from)) bad(400, 'date_from 格式应为 YYYY-MM-DD'); where.push('b.check_in >= ?'); params.push(date_from); }
    if (date_to) { if (!parseDate(date_to)) bad(400, 'date_to 格式应为 YYYY-MM-DD'); where.push('b.check_in <= ?'); params.push(date_to); }
    if (search) { where.push('(c.name LIKE ? OR c.search_key LIKE ? OR h.name LIKE ? OR h.search_key LIKE ?)'); const like = `%${search}%`; params.push(like, like, like, like); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [rows] = await pool.query(
      `SELECT b.*, c.name customer_name, h.name hotel_name, bh.name benefit_holder_name,
        ROUND(b.sale_total * b.fee_rate, 2) fee,
        (b.sale_total - b.cost_total - ROUND(b.sale_total * b.fee_rate, 2)) profit
      FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN hotels h ON h.id = b.hotel_id
      LEFT JOIN benefit_holders bh ON bh.id = b.benefit_holder_id
      ${whereSql} ORDER BY b.order_time DESC, b.id DESC`,
      params
    );
    const ids = rows.map(r => r.id);
    const namesByBooking = {};
    const cnt = {};
    if (ids.length) {
      const [items] = await pool.query(
        `SELECT bi.booking_id, rt.name FROM booking_items bi JOIN room_types rt ON rt.id = bi.room_type_id WHERE bi.booking_id IN (?)`, [ids]
      );
      for (const it of items) { const k = `${it.booking_id}|${it.name}`; cnt[k] = (cnt[k] || 0) + 1; }
      for (const it of items) {
        namesByBooking[it.booking_id] = namesByBooking[it.booking_id] || new Set();
        namesByBooking[it.booking_id].add(it.name);
      }
    }
    const STATUS_LABEL = {
      communicating: '沟通中', ordered: '已下单', info_confirmed: '已确认信息', booking: '预订中',
      booked: '已预订', hotel_confirmed: '酒店已确认', awaiting_checkin: '待入住', checked_in: '已入住',
      finished: '入住完成', cancelled: '已取消',
    };
    const CH_LABEL = { xianyu: '闲鱼', wechat: '微信', other: '其他' };
    const { sendCsv } = require('../utils/csv');
    sendCsv(res, `酒店订单_${new Date().toISOString().slice(0, 10)}.csv`,
      ['下单时间', '客户', '酒店', '状态', '入住日期', '离店日期', '晚数', '房型', '卖价合计', '成本合计', '手续费率', '手续费', '净利', '预订人', '权益张数', '含双早', '渠道', '已结算', '备注'],
      rows.map(r => [
        String(r.order_time || '').slice(0, 19).replace('T', ' '),
        r.customer_name, r.hotel_name, STATUS_LABEL[r.status] || r.status,
        String(r.check_in || '').slice(0, 10), String(r.check_out || '').slice(0, 10),
        r.nights, [...(namesByBooking[r.id] || [])].map(n => `${n}×${cnt[`${r.id}|${n}`]}`).join('、'),
        Number(r.sale_total || 0).toFixed(2), Number(r.cost_total || 0).toFixed(2),
        `${Number((r.fee_rate || 0) * 100).toFixed(2)}%`, Number(r.fee || 0).toFixed(2), Number(r.profit || 0).toFixed(2),
        r.benefit_holder_name || '', r.benefit_count_used, r.breakfast_included ? '是' : '否',
        CH_LABEL[r.channel] || r.channel || '', r.holder_settled ? '是' : '否', r.notes || '',
      ])
    );
  } catch (e) { next(e); }
});

// 预定详情
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, c.name customer_name, h.name hotel_name, bh.name benefit_holder_name, bh.source_channel holder_source_channel,
        (SELECT COUNT(*) FROM booking_items bi WHERE bi.booking_id = b.id) room_count,
        ROUND(b.sale_total * b.fee_rate, 2) fee,
        (b.sale_total - b.cost_total - ROUND(b.sale_total * b.fee_rate, 2)) profit
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
    const cols = ['customer_id', 'hotel_id', 'check_in', 'check_out', 'nights', 'sale_total', 'cost_total', 'benefit_used', 'benefit_count_used', 'status', 'breakfast_included', 'channel', 'fee_rate', 'holder_settled', 'notes', 'benefit_holder_id'];
    const vals = [p.customer_id, p.hotel_id, p.check_in, p.check_out, p.nights, p.saleTotal, p.costTotal, p.benefitUsed, p.benefitCountUsed, p.status, p.breakfastIncluded, p.channel, p.feeRate, p.holderSettled, p.notes, p.benefit_holder_id];
    if (p.orderTime) { cols.push('order_time'); vals.push(p.orderTime); } // 不传则取数据库当前时间
    const [ins] = await conn.query(
      `INSERT INTO bookings (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals
    );
    const bid = ins.insertId;
    for (const it of p.items) {
      await conn.query('INSERT INTO booking_items (booking_id, room_type_id, price) VALUES (?,?,?)', [bid, it.room_type_id, it.price]);
    }
    if (effectiveUse(p.benefitUsed, p.status) === 1) {
      await adjustHotelBenefit(conn, '-', p.benefit_holder_id, p.benefitCountUsed);
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
        `UPDATE bookings SET customer_id=?, hotel_id=?, check_in=?, check_out=?, nights=?, sale_total=?, cost_total=?, order_time=?, benefit_used=?, benefit_count_used=?, status=?, breakfast_included=?, channel=?, fee_rate=?, holder_settled=?, notes=?, benefit_holder_id=? WHERE id=?`,
        [p.customer_id, p.hotel_id, p.check_in, p.check_out, p.nights, p.saleTotal, p.costTotal, p.orderTime, p.benefitUsed, p.benefitCountUsed, p.status, p.breakfastIncluded, p.channel, p.feeRate, p.holderSettled, p.notes, p.benefit_holder_id, id]
      );
    } else {
      await conn.query(
        `UPDATE bookings SET customer_id=?, hotel_id=?, check_in=?, check_out=?, nights=?, sale_total=?, cost_total=?, benefit_used=?, benefit_count_used=?, status=?, breakfast_included=?, channel=?, fee_rate=?, holder_settled=?, notes=?, benefit_holder_id=? WHERE id=?`,
        [p.customer_id, p.hotel_id, p.check_in, p.check_out, p.nights, p.saleTotal, p.costTotal, p.benefitUsed, p.benefitCountUsed, p.status, p.breakfastIncluded, p.channel, p.feeRate, p.holderSettled, p.notes, p.benefit_holder_id, id]
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
    const oldCount = oldUse === 1 ? (Number(old.benefit_count_used) || 1) : 0;
    const newCount = newUse === 1 ? p.benefitCountUsed : 0;
    if (oldHolder !== null && oldHolder === newHolder) {
      const diff = newCount - oldCount;
      if (diff > 0) {
        await adjustHotelBenefit(conn, '-', newHolder, diff);
      } else if (diff < 0) {
        await adjustHotelBenefit(conn, '+', oldHolder, -diff);
      }
    } else {
      if (oldCount > 0 && oldHolder !== null) {
        await adjustHotelBenefit(conn, '+', oldHolder, oldCount);
      }
      if (newCount > 0) {
        await adjustHotelBenefit(conn, '-', newHolder, newCount);
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
      await adjustHotelBenefit(conn, '+', old.benefit_holder_id, Number(old.benefit_count_used) || 1);
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
