// V11 幂等迁移：酒店名拼音键 + 高尔夫订单球场名拼音键（存量回填）
const mysql = require('mysql2/promise');
const config = require('../src/config');
const { pinyin } = require('pinyin-pro');

function searchKey(name) {
  if (!name) return '';
  const full = String(pinyin(name, { toneType: 'none', type: 'array' })).replace(/,/g, '');
  const initials = String(pinyin(name, { pattern: 'first', toneType: 'none', type: 'array' })).replace(/,/g, '');
  return `${full} ${initials}`.trim();
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.db.database, table, column]
  );
  return rows[0].n > 0;
}

(async () => {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
  try {
    // 1. hotels.search_key
    if (!(await columnExists(conn, 'hotels', 'search_key'))) {
      await conn.query('ALTER TABLE hotels ADD COLUMN search_key VARCHAR(200) DEFAULT \'\' AFTER name');
      console.log('  hotels + search_key');
    }
    const [hrows] = await conn.query('SELECT id, name FROM hotels');
    for (const r of hrows) {
      const key = searchKey(r.name);
      if (key) await conn.query('UPDATE hotels SET search_key = ? WHERE id = ?', [key, r.id]);
    }
    console.log(`  hotels 回填 ${hrows.length} 条`);

    // 2. golf_orders.course_search_key
    if (!(await columnExists(conn, 'golf_orders', 'course_search_key'))) {
      await conn.query('ALTER TABLE golf_orders ADD COLUMN course_search_key VARCHAR(200) DEFAULT \'\' AFTER course_name');
      console.log('  golf_orders + course_search_key');
    }
    const [grows] = await conn.query('SELECT id, course_name FROM golf_orders');
    for (const r of grows) {
      const key = searchKey(r.course_name);
      if (key) await conn.query('UPDATE golf_orders SET course_search_key = ? WHERE id = ?', [key, r.id]);
    }
    console.log(`  golf_orders 回填 ${grows.length} 条`);
    console.log('V11 迁移完成（幂等，可重复执行）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
