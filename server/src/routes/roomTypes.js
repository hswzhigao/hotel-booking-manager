const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// 档位数组校验与替换（事务内）
async function replaceRates(conn, roomTypeId, rates) {
  await conn.query('DELETE FROM room_type_rates WHERE room_type_id = ?', [roomTypeId]);
  if (!Array.isArray(rates) || !rates.length) return;
  for (const r of rates) {
    const label = String(r.label || '').trim();
    const price = Number(r.price);
    if (!label) { const e = new Error('档位名不能为空'); e.status = 400; throw e; }
    if (isNaN(price) || price < 0) { const e = new Error('档位价格不合法'); e.status = 400; throw e; }
    await conn.query('INSERT INTO room_type_rates (room_type_id, label, price) VALUES (?,?,?)', [roomTypeId, label, price]);
  }
}

router.post('/', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { hotel_id, name, bed_type, default_price, notes, rates } = req.body || {};
    if (!hotel_id || !name || !String(name).trim()) return res.status(400).json({ error: '酒店和房型名称不能为空' });
    const [h] = await pool.query('SELECT id FROM hotels WHERE id = ?', [hotel_id]);
    if (!h.length) return res.status(400).json({ error: '酒店不存在' });
    await conn.beginTransaction();
    const [ins] = await conn.query(
      'INSERT INTO room_types (hotel_id, name, bed_type, default_price, notes) VALUES (?,?,?,?,?)',
      [hotel_id, String(name).trim(), bed_type || null, default_price == null || default_price === '' ? null : Number(default_price), notes || null]
    );
    await replaceRates(conn, ins.insertId, rates || []);
    await conn.commit();
    res.json({ id: ins.insertId });
  } catch (e) {
    await conn.rollback().catch(() => {});
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '该酒店下已存在同名房型' });
    next(e);
  } finally { conn.release(); }
});

router.put('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { name, bed_type, default_price, notes, rates } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '房型名称不能为空' });
    await conn.beginTransaction();
    const [r] = await conn.query(
      'UPDATE room_types SET name=?, bed_type=?, default_price=?, notes=? WHERE id=?',
      [String(name).trim(), bed_type || null, default_price == null || default_price === '' ? null : Number(default_price), notes || null, req.params.id]
    );
    if (r.affectedRows === 0) { await conn.rollback(); return res.status(404).json({ error: '房型不存在' }); }
    if (rates !== undefined) await replaceRates(conn, Number(req.params.id), rates);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback().catch(() => {});
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '该酒店下已存在同名房型' });
    next(e);
  } finally { conn.release(); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [ref] = await pool.query('SELECT COUNT(*) c FROM booking_items WHERE room_type_id = ?', [req.params.id]);
    if (ref[0].c > 0) return res.status(409).json({ error: '该房型已被预定引用，无法删除' });
    const [r] = await pool.query('DELETE FROM room_types WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '房型不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
