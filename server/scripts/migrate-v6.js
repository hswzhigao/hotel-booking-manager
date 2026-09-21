// V6 幂等迁移：预订人出权益标记 + 酒店订单成交渠道
const mysql = require('mysql2/promise');
const config = require('../src/config');

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
    for (const [col, def] of [
      ['provides_hotel', 'TINYINT(1) NOT NULL DEFAULT 1'],
      ['provides_golf', 'TINYINT(1) NOT NULL DEFAULT 1'],
    ]) {
      if (!(await columnExists(conn, 'benefit_holders', col))) {
        await conn.query(`ALTER TABLE benefit_holders ADD COLUMN ${col} ${def} AFTER source_channel`);
        console.log(`  benefit_holders + ${col}`);
      }
    }
    if (!(await columnExists(conn, 'bookings', 'channel'))) {
      await conn.query(`ALTER TABLE bookings ADD COLUMN channel ENUM('xianyu','wechat','other') NOT NULL DEFAULT 'xianyu' AFTER breakfast_included`);
      console.log('  bookings + channel');
    }
    console.log('V3.3 迁移完成（幂等，可重复执行）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
