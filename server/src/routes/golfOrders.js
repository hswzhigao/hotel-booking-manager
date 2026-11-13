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

const STATUSES = ['pending', 'booked', 'completed', 'cancelled'];
const CHANNELS = ['xianyu', 'wechat', 'other'];

function bad(status, msg) { const e = new Error(msg); e.status = status; throw e; }

function parseDate(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return null;
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : String(s);
}

function parseOrderTime(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 19).replace('T', ' ');
  return bad(400, '下单时间格式不合法');
}

// 球场是否在种类适用范围内（scope='all' 或球场名在逗号列表中精确匹配）
function scopeCovers(scope, courseName) {
  if (!scope) return false;
  if (scope.trim() === 'all') return true;
  return scope.split(',').map(x => x.trim()).filter(Boolean).includes(courseName);
}

// 校验并规整高尔夫订单入参
async function validatePayload(body) {
  const { customer_id, benefit_holder_id, course_name, play_date, tee_time, players = 1,
          status = 'pending', teach_needed = 0, sale_price = 0, cost_price = 0, fee_rate,
          channel = 'xianyu', benefit_used = 1, benefit_type_id, order_time, notes } = body || {};
  if (!customer_id) bad(400, '请选择客户');
  const pd = parseDate(play_date);
  if (!pd) bad(400, '打球日期格式应为 YYYY-MM-DD');
  if (!course_name || !String(course_name).trim()) bad(400, '球场名称不能为空');
  if (!STATUSES.includes(status)) bad(400, '状态不合法');
  if (!CHANNELS.includes(channel)) bad(400, '渠道不合法');
  let fr;
  if (fee_rate === null || fee_rate === undefined || fee_rate === '') {
    fr = channel === 'xianyu' ? 0.016 : 0;
  } else {
    fr = Number(fee_rate);
    if (isNaN(fr) || fr < 0 || fr > 0.5) bad(400, '手续费率不合法（0~50%）');
  }
  const bu = Number(benefit_used) === 1 ? 1 : 0;
  const tn = Number(teach_needed) === 1 ? 1 : 0;
  const sp = Number(sale_price) || 0, cp = Number(cost_price) || 0;
  if (sp < 0 || cp < 0) bad(400, '价格不合法');
  const pl = Number(players) || 1;
  if (!Number.isInteger(pl) || pl < 1 || pl > 20) bad(400, '权益点应为 1-20 的整数');
  const ot = parseOrderTime(order_time);
  const [[cust]] = await pool.query('SELECT id FROM customers WHERE id = ?', [customer_id]);
  if (!cust) bad(400, '客户不存在');
  let holderId = null;
  if (benefit_holder_id !== undefined && benefit_holder_id !== null && benefit_holder_id !== '') {
    const [[holder]] = await pool.query('SELECT id FROM benefit_holders WHERE id = ?', [benefit_holder_id]);
    if (!holder) bad(400, '预订人不存在');
    holderId = Number(benefit_holder_id);
  }
  // 勾权益必须选预订人 + 权益种类
  let typeId = null;
  if (bu === 1) {
    if (holderId === null) bad(400, '使用高尔夫权益需选择预订人');
    if (!benefit_type_id) bad(400, '使用高尔夫权益需选择权益种类');
    const [[type]] = await pool.query('SELECT id, name, course_scope FROM golf_benefit_types WHERE id = ?', [benefit_type_id]);
    if (!type) bad(400, '权益种类不存在');
    if (!scopeCovers(type.course_scope, String(course_name).trim())) {
      bad(400, `该权益（${type.name}）不能在 ${String(course_name).trim()} 使用`);
    }
    const [[held]] = await pool.query(
      'SELECT id, count_left FROM holder_golf_benefits WHERE holder_id = ? AND benefit_type_id = ?', [holderId, type.id]
    );
    if (!held) bad(400, '该预订人未持有此权益种类');
    if (Number(held.count_left) < pl) bad(400, `该预订人此权益剩余不足（剩 ${held.count_left} 点，需扣 ${pl} 点）`);
    typeId = type.id;
  } else if (benefit_type_id !== undefined && benefit_type_id !== null && benefit_type_id !== '') {
    // 不勾权益但传了种类：仅校验存在性，便于展示
    const [[type]] = await pool.query('SELECT id FROM golf_benefit_types WHERE id = ?', [benefit_type_id]);
    if (!type) bad(400, '权益种类不存在');
    typeId = type.id;
  }
  return { customer_id: Number(customer_id), holderId, typeId, courseName: String(course_name).trim(), playDate: pd,
           teeTime: tee_time || null, players: pl, status, teachNeeded: tn, salePrice: sp, costPrice: cp,
           channel, feeRate: fr, benefitUsed: bu, orderTime: ot, notes: notes || null };
}

const effectiveUse = (benefitUsed, status) => (Number(benefitUsed) === 1 && status !== 'cancelled') ? 1 : 0;

// 权益占用调整：'-' 扣 points 点，'+' 返还 points 点（原子防透支）
async function adjustBenefit(conn, sign, holderId, typeId, points = 1) {
  if (sign === '-') {
    const [c] = await conn.query(
      'UPDATE holder_golf_benefits SET count_left = count_left - ? WHERE holder_id = ? AND benefit_type_id = ? AND count_left >= ?',
      [points, holderId, typeId, points]
    );
    if (c.affectedRows === 0) bad(400, '该权益种类剩余权益点不足');
  } else {
    await conn.query(
      'UPDATE holder_golf_benefits SET count_left = count_left + ? WHERE holder_id = ? AND benefit_type_id = ?',
      [points, holderId, typeId]
    );
  }
}

// 订单列表
router.get('/', async (req, res, next) => {
  try {
    const { customer_id, benefit_holder_id, status, date_from, date_to, search = '', page = 1, page_size = 20 } = req.query;
    const where = []; const params = [];
    if (customer_id) { where.push('g.customer_id = ?'); params.push(customer_id); }
    if (benefit_holder_id) { where.push('g.benefit_holder_id = ?'); params.push(benefit_holder_id); }
    if (status) {
      if (!STATUSES.includes(status)) bad(400, '状态不合法');
      where.push('g.status = ?'); params.push(status);
    }
    if (date_from) {
      if (!parseDate(date_from)) bad(400, 'date_from 格式应为 YYYY-MM-DD');
      where.push('g.play_date >= ?'); params.push(date_from);
    }
    if (date_to) {
      if (!parseDate(date_to)) bad(400, 'date_to 格式应为 YYYY-MM-DD');
      where.push('g.play_date <= ?'); params.push(date_to);
    }
    if (search) { where.push('(c.name LIKE ? OR c.search_key LIKE ? OR g.course_name LIKE ? OR g.course_search_key LIKE ?)'); const like = `%${search}%`; params.push(like, like, like, like); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { parseSort } = require('../utils/sort');
    const SORT_COLS = {
      order_time: 'g.order_time', play_date: 'g.play_date', players: 'g.players',
      sale_price: 'g.sale_price', cost_price: 'g.cost_price',
      profit: '(g.sale_price - g.cost_price - ROUND(g.sale_price * g.fee_rate, 2))',
    };
    const orderSql = parseSort(req.query, SORT_COLS, 'ORDER BY g.order_time DESC, g.id DESC');
    const [countRows] = await pool.query(
      `SELECT COUNT(*) total FROM golf_orders g JOIN customers c ON c.id = g.customer_id ${whereSql}`, params
    );
    const size = Math.min(100, Number(page_size) || 20);
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const [rows] = await pool.query(
      `SELECT g.*, c.name customer_name, bh.name benefit_holder_name, t.name benefit_type_name,
        bh.availability holder_availability,
        ROUND(g.sale_price * g.fee_rate, 2) fee,
        (g.sale_price - g.cost_price - ROUND(g.sale_price * g.fee_rate, 2)) profit
      FROM golf_orders g
      JOIN customers c ON c.id = g.customer_id
      LEFT JOIN benefit_holders bh ON bh.id = g.benefit_holder_id
      LEFT JOIN golf_benefit_types t ON t.id = g.benefit_type_id
      ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );
    res.json({ total: countRows[0].total, items: rows });
  } catch (e) { next(e); }
});

// 导出 CSV（与列表相同筛选，不分页）
router.get('/export', async (req, res, next) => {
  try {
    const { customer_id, benefit_holder_id, status, date_from, date_to, search = '' } = req.query;
    const where = []; const params = [];
    if (customer_id) { where.push('g.customer_id = ?'); params.push(customer_id); }
    if (benefit_holder_id) { where.push('g.benefit_holder_id = ?'); params.push(benefit_holder_id); }
    if (status) {
      if (!STATUSES.includes(status)) bad(400, '状态不合法');
      where.push('g.status = ?'); params.push(status);
    }
    if (date_from) { if (!parseDate(date_from)) bad(400, 'date_from 格式应为 YYYY-MM-DD'); where.push('g.play_date >= ?'); params.push(date_from); }
    if (date_to) { if (!parseDate(date_to)) bad(400, 'date_to 格式应为 YYYY-MM-DD'); where.push('g.play_date <= ?'); params.push(date_to); }
    if (search) { where.push('(c.name LIKE ? OR c.search_key LIKE ? OR g.course_name LIKE ? OR g.course_search_key LIKE ?)'); const like = `%${search}%`; params.push(like, like, like, like); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { parseSort } = require('../utils/sort');
    const SORT_COLS = {
      order_time: 'g.order_time', play_date: 'g.play_date', players: 'g.players',
      sale_price: 'g.sale_price', cost_price: 'g.cost_price',
      profit: '(g.sale_price - g.cost_price - ROUND(g.sale_price * g.fee_rate, 2))',
    };
    const orderSql = parseSort(req.query, SORT_COLS, 'ORDER BY g.order_time DESC, g.id DESC');
    const [rows] = await pool.query(
      `SELECT g.*, c.name customer_name, bh.name benefit_holder_name, t.name benefit_type_name,
        ROUND(g.sale_price * g.fee_rate, 2) fee,
        (g.sale_price - g.cost_price - ROUND(g.sale_price * g.fee_rate, 2)) profit
      FROM golf_orders g
      JOIN customers c ON c.id = g.customer_id
      LEFT JOIN benefit_holders bh ON bh.id = g.benefit_holder_id
      LEFT JOIN golf_benefit_types t ON t.id = g.benefit_type_id
      ${whereSql} ${orderSql}`,
      params
    );
    const STATUS_LABEL = { pending: '待定位', booked: '已定位', completed: '已完成', cancelled: '已取消' };
    const CH_LABEL = { xianyu: '闲鱼', wechat: '微信', other: '其他' };
    const { sendCsv } = require('../utils/csv');
    sendCsv(res, `高尔夫订单_${new Date().toISOString().slice(0, 10)}.csv`,
      ['下单时间', '客户', '预订人', '球场', '打球日期', '开球时间', '权益点', '状态', '卖价', '成本', '手续费率', '手续费', '净利', '权益种类', '渠道', '需教定位', '备注'],
      rows.map(r => [
        String(r.order_time || '').slice(0, 19).replace('T', ' '),
        r.customer_name, r.benefit_holder_name || '', r.course_name,
        String(r.play_date || '').slice(0, 10), String(r.tee_time || '').slice(0, 5),
        r.players, STATUS_LABEL[r.status] || r.status,
        Number(r.sale_price || 0).toFixed(2), Number(r.cost_price || 0).toFixed(2),
        `${Number((r.fee_rate || 0) * 100).toFixed(2)}%`, Number(r.fee || 0).toFixed(2), Number(r.profit || 0).toFixed(2),
        r.benefit_type_name || '', CH_LABEL[r.channel] || r.channel || '', r.teach_needed ? '是' : '否', r.notes || '',
      ])
    );
  } catch (e) { next(e); }
});

// 历史球场名（去重，供下拉）
router.get('/courses', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT course_name FROM golf_orders ORDER BY course_name');
    res.json(rows.map(r => r.course_name));
  } catch (e) { next(e); }
});

// 订单详情
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.*, c.name customer_name, bh.name benefit_holder_name, bh.availability holder_availability,
        t.name benefit_type_name, ROUND(g.sale_price * g.fee_rate, 2) fee,
        (g.sale_price - g.cost_price - ROUND(g.sale_price * g.fee_rate, 2)) profit
      FROM golf_orders g
      JOIN customers c ON c.id = g.customer_id
      LEFT JOIN benefit_holders bh ON bh.id = g.benefit_holder_id
      LEFT JOIN golf_benefit_types t ON t.id = g.benefit_type_id
      WHERE g.id = ?`, [req.params.id]
    );
    if (!rows.length) bad(404, '高尔夫订单不存在');
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// 新建（扣对应种类明细）
router.post('/', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const p = await validatePayload(req.body);
    await conn.beginTransaction();
    const cols = ['customer_id', 'benefit_holder_id', 'course_name', 'course_search_key', 'play_date', 'tee_time', 'players', 'status', 'teach_needed', 'sale_price', 'cost_price', 'fee_rate', 'channel', 'benefit_used', 'benefit_type_id', 'notes'];
    const vals = [p.customer_id, p.holderId, p.courseName, buildSearchKey(p.courseName), p.playDate, p.teeTime, p.players, p.status, p.teachNeeded, p.salePrice, p.costPrice, p.feeRate, p.channel, p.benefitUsed, p.typeId, p.notes];
    if (p.orderTime) { cols.push('order_time'); vals.push(p.orderTime); }
    const [ins] = await conn.query(
      `INSERT INTO golf_orders (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, vals
    );
    const id = ins.insertId;
    if (effectiveUse(p.benefitUsed, p.status) === 1) {
      await adjustBenefit(conn, '-', p.holderId, p.typeId, p.players);
    }
    await conn.commit();
    res.json({ id });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally { conn.release(); }
});

// 编辑（占用变化按 预订人×种类 维度调整）
router.put('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = req.params.id;
    const [[old]] = await conn.query('SELECT * FROM golf_orders WHERE id = ?', [id]);
    if (!old) bad(404, '高尔夫订单不存在');
    const p = await validatePayload(req.body);
    await conn.beginTransaction();
    if (p.orderTime) {
      await conn.query(
        `UPDATE golf_orders SET customer_id=?, benefit_holder_id=?, course_name=?, course_search_key=?, play_date=?, tee_time=?, players=?, status=?, teach_needed=?, sale_price=?, cost_price=?, fee_rate=?, channel=?, benefit_used=?, benefit_type_id=?, order_time=?, notes=? WHERE id=?`,
        [p.customer_id, p.holderId, p.courseName, buildSearchKey(p.courseName), p.playDate, p.teeTime, p.players, p.status, p.teachNeeded, p.salePrice, p.costPrice, p.feeRate, p.channel, p.benefitUsed, p.typeId, p.orderTime, p.notes, id]
      );
    } else {
      await conn.query(
        `UPDATE golf_orders SET customer_id=?, benefit_holder_id=?, course_name=?, course_search_key=?, play_date=?, tee_time=?, players=?, status=?, teach_needed=?, sale_price=?, cost_price=?, fee_rate=?, channel=?, benefit_used=?, benefit_type_id=?, notes=? WHERE id=?`,
        [p.customer_id, p.holderId, p.courseName, buildSearchKey(p.courseName), p.playDate, p.teeTime, p.players, p.status, p.teachNeeded, p.salePrice, p.costPrice, p.feeRate, p.channel, p.benefitUsed, p.typeId, p.notes, id]
      );
    }
    const oldUse = effectiveUse(old.benefit_used, old.status);
    const newUse = effectiveUse(p.benefitUsed, p.status);
    const oldHolder = old.benefit_holder_id || null;
    const oldType = old.benefit_type_id || null;
    const oldPoints = Number(old.players) || 1;
    const sameTarget = oldHolder !== null && oldHolder === p.holderId && oldType !== null && oldType === p.typeId;
    if (sameTarget) {
      if (newUse === 1 && oldUse === 0) {
        await adjustBenefit(conn, '-', p.holderId, p.typeId, p.players);
      } else if (oldUse === 1 && newUse === 0) {
        await adjustBenefit(conn, '+', oldHolder, oldType, oldPoints);
      } else if (oldUse === 1 && newUse === 1 && oldPoints !== p.players) {
        // 权益点变动：按差额调整
        const diff = p.players - oldPoints;
        if (diff > 0) await adjustBenefit(conn, '-', p.holderId, p.typeId, diff);
        else if (diff < 0) await adjustBenefit(conn, '+', p.holderId, p.typeId, -diff);
      }
    } else {
      if (oldUse === 1 && oldHolder !== null && oldType !== null) {
        await adjustBenefit(conn, '+', oldHolder, oldType, oldPoints);
      }
      if (newUse === 1) {
        await adjustBenefit(conn, '-', p.holderId, p.typeId, p.players);
      }
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally { conn.release(); }
});

// 删除（返还对应种类明细）
router.delete('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const id = req.params.id;
    const [[old]] = await conn.query('SELECT * FROM golf_orders WHERE id = ?', [id]);
    if (!old) bad(404, '高尔夫订单不存在');
    await conn.beginTransaction();
    if (effectiveUse(old.benefit_used, old.status) === 1 && old.benefit_holder_id && old.benefit_type_id) {
      await adjustBenefit(conn, '+', old.benefit_holder_id, old.benefit_type_id, Number(old.players) || 1);
    }
    await conn.query('DELETE FROM golf_orders WHERE id = ?', [id]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally { conn.release(); }
});

module.exports = router;
