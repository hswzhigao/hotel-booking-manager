const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.post('/', async (req, res, next) => {
  try {
    const { hotel_id, name, bed_type, default_price, notes } = req.body || {};
    if (!hotel_id || !name || !String(name).trim()) return res.status(400).json({ error: '酒店和房型名称不能为空' });
    const [h] = await pool.query('SELECT id FROM hotels WHERE id = ?', [hotel_id]);
    if (!h.length) return res.status(400).json({ error: '酒店不存在' });
    const [ins] = await pool.query(
      'INSERT INTO room_types (hotel_id, name, bed_type, default_price, notes) VALUES (?,?,?,?,?)',
      [hotel_id, String(name).trim(), bed_type || null, default_price == null || default_price === '' ? null : Number(default_price), notes || null]
    );
    res.json({ id: ins.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '该酒店下已存在同名房型' });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, bed_type, default_price, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '房型名称不能为空' });
    const [r] = await pool.query(
      'UPDATE room_types SET name=?, bed_type=?, default_price=?, notes=? WHERE id=?',
      [String(name).trim(), bed_type || null, default_price == null || default_price === '' ? null : Number(default_price), notes || null, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: '房型不存在' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '该酒店下已存在同名房型' });
    next(e);
  }
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
