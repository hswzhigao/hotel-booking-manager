// V10 幂等迁移：拼音搜索键（客户 + 预订人），存量数据回填
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
    for (const table of ['customers', 'benefit_holders']) {
      if (!(await columnExists(conn, table, 'search_key'))) {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN search_key VARCHAR(200) DEFAULT '' AFTER name`);
        console.log(`  ${table} + search_key`);
      }
      const [rows] = await conn.query(`SELECT id, name FROM ${table}`);
      for (const r of rows) {
        const key = searchKey(r.name);
        if (key) await conn.query(`UPDATE ${table} SET search_key = ? WHERE id = ?`, [key, r.id]);
      }
      console.log(`  ${table} 回填 ${rows.length} 条`);
    }
    console.log('V10 迁移完成（幂等，可重复执行）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
