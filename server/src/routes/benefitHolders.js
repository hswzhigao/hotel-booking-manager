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

const AVAILABILITIES = ['any', 'weekend_only', 'weekday_only'];
const GOLF_BENEFITS_SQL = `
  (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
      'id', hgb.id, 'benefit_type_id', hgb.benefit_type_id,
      'type_name', t.name, 'course_scope', t.course_scope,
      'count_left', hgb.count_left, 'refresh_month', hgb.refresh_month, 'notes', hgb.notes
    )), JSON_ARRAY())
   FROM holder_golf_benefits hgb JOIN golf_benefit_types t ON t.id = hgb.benefit_type_id
   WHERE hgb.holder_id = h.id) golf_benefits,
  (SELECT COALESCE(SUM(hgb.count_left), 0) FROM holder_golf_benefits hgb WHERE hgb.holder_id = h.id) golf_benefit_total`;

// 基本字段校验（不含高尔夫明细）
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
  if (b.source_channel !== undefined && b.source_channel !== null && b.source_channel !== '' && !['xianyu','wechat','other'].includes(b.source_channel)) {
    const e = new Error('来源渠道不合法（xianyu/wechat/other）'); e.status = 400; throw e;
  }
  return {
    name: String(b.name || '').trim(),
    xianyu_id: b.xianyu_id || null,
    wechat_id: b.wechat_id || null,
    phone: b.phone || null,
    benefit_types: b.benefit_types || null,
    card_type: b.card_type || null,
    source_channel: ['xianyu','wechat','other'].includes(b.source_channel) ? b.source_channel : 'other',
    provides_hotel: bool(b.provides_hotel === undefined ? 1 : b.provides_hotel),
    provides_golf: bool(b.provides_golf === undefined ? 1 : b.provides_golf),
    willing_present: bool(b.willing_present),
    willing_assist: bool(b.willing_assist),
    active: bool(b.active === undefined ? 1 : b.active),
    hotel_benefit_count: count(b.hotel_benefit_count, '酒店权益次数'),
    hotel_refresh_month: month(b.hotel_refresh_month),
    availability: AVAILABILITIES.includes(b.availability) ? b.availability : 'any',
    notes: b.notes || null,
  };
}

// 高尔夫明细数组校验：[{benefit_type_id, count_left, refresh_month, notes}]
async function normalizeGolfBenefits(arr) {
  if (arr === undefined || arr === null) return null; // 未传=不动
  if (!Array.isArray(arr)) {
    const e = new Error('golf_benefits 应为数组'); e.status = 400; throw e;
  }
  const seen = new Set();
  const rows = [];
  for (const r of arr) {
    const tid = Number(r && r.benefit_type_id);
    if (!Number.isInteger(tid) || tid < 1) {
      const e = new Error('持有权益缺少有效的权益种类'); e.status = 400; throw e;
    }
    if (seen.has(tid)) {
      const e = new Error('同一权益种类只能有一行明细'); e.status = 400; throw e;
    }
    seen.add(tid);
    if (r.count_left === null || r.count_left === undefined || r.count_left === '' || isNaN(Number(r.count_left))) {
      const e = new Error('权益次数不合法'); e.status = 400; throw e;
    }
    const cl = Number(r.count_left);
    if (!Number.isInteger(cl) || cl < 0) {
      const e = new Error('权益次数不合法'); e.status = 400; throw e;
    }
    let rm = null;
    if (r.refresh_month !== null && r.refresh_month !== undefined && r.refresh_month !== '') {
      rm = Number(r.refresh_month);
      if (!Number.isInteger(rm) || rm < 1 || rm > 12) {
        const e = new Error('更新月应为 1-12 或留空（未知）'); e.status = 400; throw e;
      }
    }
    rows.push({ benefit_type_id: tid, count_left: cl, refresh_month: rm, notes: r.notes || null });
  }
  // 校验种类都存在
  if (rows.length) {
    const [ts] = await pool.query('SELECT id, name FROM golf_benefit_types WHERE id IN (?)', [rows.map(r => r.benefit_type_id)]);
    if (ts.length !== rows.length) {
      const e = new Error('存在无效的权益种类'); e.status = 400; throw e;
    }
  }
  return rows; // [] = 清空，null = 未传不动
}

// 整组替换高尔夫明细（事务内）
async function replaceGolfBenefits(conn, holderId, rows) {
  if (rows === null) return;
  await conn.query('DELETE FROM holder_golf_benefits WHERE holder_id = ?', [holderId]);
  for (const r of rows) {
    await conn.query(
      'INSERT INTO holder_golf_benefits (holder_id, benefit_type_id, count_left, refresh_month, notes) VALUES (?,?,?,?,?)',
      [holderId, r.benefit_type_id, r.count_left, r.refresh_month, r.notes]
    );
  }
}

// 预订人列表（搜索 + 标签筛选）
router.get('/', async (req, res, next) => {
  try {
    const { search = '', willing_present, willing_assist, active, availability, provides_hotel, provides_golf, page = 1, page_size = 20 } = req.query;
    const where = []; const params = [];
    if (search) {
      const like = `%${search}%`;
      where.push('(h.name LIKE ? OR h.search_key LIKE ? OR h.xianyu_id LIKE ? OR h.wechat_id LIKE ? OR h.phone LIKE ? OR h.benefit_types LIKE ? OR h.card_type LIKE ?)');
      params.push(like, like, like, like, like, like, like);
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
    if (provides_hotel !== undefined && provides_hotel !== '') {
      where.push('h.provides_hotel = ?'); params.push(Number(provides_hotel) === 1 ? 1 : 0);
    }
    if (provides_golf !== undefined && provides_golf !== '') {
      where.push('h.provides_golf = ?'); params.push(Number(provides_golf) === 1 ? 1 : 0);
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
      `SELECT h.*, ${GOLF_BENEFITS_SQL},
        (SELECT COUNT(*) FROM bookings b WHERE b.benefit_holder_id = h.id) booking_count,
        (SELECT COUNT(*) FROM golf_orders g WHERE g.benefit_holder_id = h.id) golf_order_count
      FROM benefit_holders h ${whereSql} ORDER BY h.active DESC, h.id DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );
    res.json({ total: countRows[0].total, items: rows });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const f = holderFields(req.body);
    if (!f.name) return res.status(400).json({ error: '预订人姓名不能为空' });
    const golfRows = await normalizeGolfBenefits(req.body && req.body.golf_benefits);
    await conn.beginTransaction();
    const [ins] = await conn.query(
      `INSERT INTO benefit_holders (name, search_key, xianyu_id, wechat_id, phone, benefit_types, card_type, source_channel, provides_hotel, provides_golf, willing_present, willing_assist, active, hotel_benefit_count, hotel_refresh_month, availability, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [f.name, buildSearchKey(f.name), f.xianyu_id, f.wechat_id, f.phone, f.benefit_types, f.card_type, f.source_channel, f.provides_hotel, f.provides_golf, f.willing_present, f.willing_assist, f.active, f.hotel_benefit_count, f.hotel_refresh_month, f.availability, f.notes]
    );
    await replaceGolfBenefits(conn, ins.insertId, golfRows || []);
    await conn.commit();
    res.json({ id: ins.insertId });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally { conn.release(); }
});

router.put('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const f = holderFields(req.body);
    if (!f.name) return res.status(400).json({ error: '预订人姓名不能为空' });
    const golfRows = await normalizeGolfBenefits(req.body && req.body.golf_benefits);
    await conn.beginTransaction();
    const [r] = await conn.query(
      `UPDATE benefit_holders SET name=?, search_key=?, xianyu_id=?, wechat_id=?, phone=?, benefit_types=?, card_type=?, source_channel=?, provides_hotel=?, provides_golf=?, willing_present=?, willing_assist=?, active=?, hotel_benefit_count=?, hotel_refresh_month=?, availability=?, notes=? WHERE id=?`,
      [f.name, buildSearchKey(f.name), f.xianyu_id, f.wechat_id, f.phone, f.benefit_types, f.card_type, f.source_channel, f.provides_hotel, f.provides_golf, f.willing_present, f.willing_assist, f.active, f.hotel_benefit_count, f.hotel_refresh_month, f.availability, f.notes, req.params.id]
    );
    if (r.affectedRows === 0) { await conn.rollback(); return res.status(404).json({ error: '预订人不存在' }); }
    await replaceGolfBenefits(conn, Number(req.params.id), golfRows);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally { conn.release(); }
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
