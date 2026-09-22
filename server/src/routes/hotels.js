const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// 酒店列表（含房型数、预定数）
router.get('/', async (req, res, next) => {
  try {
    const { search = '', page = 1, page_size = 20 } = req.query;
    const like = `%${search}%`;
    const where = search ? 'WHERE h.name LIKE ? OR h.city LIKE ? OR h.address LIKE ?' : '';
    const params = search ? [like, like, like] : [];
    const [countRows] = await pool.query(`SELECT COUNT(*) total FROM hotels h ${where}`, params);
    const size = Math.min(100, Number(page_size) || 20);
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const [rows] = await pool.query(
      `SELECT h.*,
        (SELECT COUNT(*) FROM room_types rt WHERE rt.hotel_id = h.id) room_type_count,
        (SELECT COUNT(*) FROM bookings b WHERE b.hotel_id = h.id) booking_count
      FROM hotels h ${where} ORDER BY h.id DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );
    res.json({ total: countRows[0].total, items: rows });
  } catch (e) { next(e); }
});

// 某酒店的房型列表（挂在 hotels 路由下）
router.get('/:id/room-types', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM room_types WHERE hotel_id = ? ORDER BY id DESC', [req.params.id]);
    const ids = rows.map(r => r.id);
    const ratesMap = {};
    if (ids.length) {
      const [rates] = await pool.query('SELECT id, room_type_id, label, price FROM room_type_rates WHERE room_type_id IN (?) ORDER BY id', [ids]);
      for (const r of rates) (ratesMap[r.room_type_id] = ratesMap[r.room_type_id] || []).push({ id: r.id, label: r.label, price: r.price });
    }
    rows.forEach(r => { r.rates = ratesMap[r.id] || []; });
    res.json(rows);
  } catch (e) { next(e); }
});

// 入住政策字段规整：checkin_presence 允许 null(未确认)/0(无需到场)/1(需到场)
function policyFields(body) {
  const cpRaw = body && body.checkin_presence;
  let cp;
  if (cpRaw === null || cpRaw === undefined || cpRaw === '') cp = null;
  else if (cpRaw === 0 || cpRaw === '0') cp = 0;
  else if (cpRaw === 1 || cpRaw === '1') cp = 1;
  else {
    const e = new Error('需本人到场取值不合法（未确认/需到场/无需到场）');
    e.status = 400;
    throw e;
  }
  return {
    checkin_presence: cp,
    checkin_info_required: (body && body.checkin_info_required) || null,
    checkin_process: (body && body.checkin_process) || null,
    official_phone: (body && body.official_phone) || null,
    guide_text: (body && body.guide_text) || null,
  };
}

router.post('/', async (req, res, next) => {
  try {
    const { name, city, address, phone, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '酒店名称不能为空' });
    const p = policyFields(req.body);
    const [ins] = await pool.query(
      'INSERT INTO hotels (name, city, address, phone, notes, checkin_presence, checkin_info_required, checkin_process, official_phone, guide_text) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [String(name).trim(), city || null, address || null, phone || null, notes || null,
       p.checkin_presence, p.checkin_info_required, p.checkin_process, p.official_phone, p.guide_text]
    );
    res.json({ id: ins.insertId });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, city, address, phone, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '酒店名称不能为空' });
    const p = policyFields(req.body);
    const [r] = await pool.query(
      'UPDATE hotels SET name=?, city=?, address=?, phone=?, notes=?, checkin_presence=?, checkin_info_required=?, checkin_process=?, official_phone=?, guide_text=? WHERE id=?',
      [String(name).trim(), city || null, address || null, phone || null, notes || null,
       p.checkin_presence, p.checkin_info_required, p.checkin_process, p.official_phone, p.guide_text, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: '酒店不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [bk] = await pool.query('SELECT COUNT(*) c FROM bookings WHERE hotel_id = ?', [req.params.id]);
    if (bk[0].c > 0) return res.status(409).json({ error: '该酒店已有预定记录，无法删除' });
    const [r] = await pool.query('DELETE FROM hotels WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '酒店不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
