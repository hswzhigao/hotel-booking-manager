const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// 权益种类列表
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, (SELECT COUNT(*) FROM holder_golf_benefits hgb WHERE hgb.benefit_type_id = t.id) holder_count
       FROM golf_benefit_types t ORDER BY t.id`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

function validScope(scope) {
  return typeof scope === 'string' && scope.trim().length > 0 && scope.length <= 200;
}

router.post('/', async (req, res, next) => {
  try {
    const { name, course_scope = 'all', notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '权益种类名称不能为空' });
    if (!validScope(course_scope)) return res.status(400).json({ error: '适用球场不能为空（通用填 all，或球场名逗号分隔）' });
    const [ins] = await pool.query(
      'INSERT INTO golf_benefit_types (name, course_scope, notes) VALUES (?,?,?)',
      [String(name).trim(), String(course_scope).trim(), notes || null]
    );
    res.json({ id: ins.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '已存在同名权益种类' });
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, course_scope = 'all', notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: '权益种类名称不能为空' });
    if (!validScope(course_scope)) return res.status(400).json({ error: '适用球场不能为空（通用填 all，或球场名逗号分隔）' });
    const [r] = await pool.query(
      'UPDATE golf_benefit_types SET name=?, course_scope=?, notes=? WHERE id=?',
      [String(name).trim(), String(course_scope).trim(), notes || null, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: '权益种类不存在' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '已存在同名权益种类' });
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [ref] = await pool.query('SELECT COUNT(*) c FROM holder_golf_benefits WHERE benefit_type_id = ?', [req.params.id]);
    if (ref[0].c > 0) return res.status(409).json({ error: '该权益种类已被预订人持有，无法删除' });
    const [r] = await pool.query('DELETE FROM golf_benefit_types WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '权益种类不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
