// V5 幂等迁移：酒店订单 10 态流程 + 结算 + 双早 + 权益张数 + 预订人来源渠道
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
    // 1. bookings 10 态（旧值映射：active→awaiting_checkin, completed→finished；当前库无业务数据，映射只为健壮）
    await conn.query(`UPDATE bookings SET status = CASE status WHEN 'active' THEN 'awaiting_checkin' WHEN 'completed' THEN 'finished' ELSE status END WHERE status IN ('active','completed')`);
    await conn.query(`ALTER TABLE bookings MODIFY COLUMN status ENUM('communicating','ordered','info_confirmed','booking','booked','hotel_confirmed','awaiting_checkin','checked_in','finished','cancelled') NOT NULL DEFAULT 'communicating'`);
    console.log('  bookings status → 10 态');
    for (const [col, def] of [
      ['breakfast_included', 'TINYINT(1) NOT NULL DEFAULT 0'],
      ['holder_settled', 'TINYINT(1) NOT NULL DEFAULT 0'],
      ['benefit_count_used', 'INT UNSIGNED NOT NULL DEFAULT 1'],
    ]) {
      if (!(await columnExists(conn, 'bookings', col))) {
        await conn.query(`ALTER TABLE bookings ADD COLUMN ${col} ${def}`);
        console.log(`  bookings + ${col}`);
      }
    }
    console.log('[1/2] bookings 流程字段就绪');

    // 2. benefit_holders 来源渠道
    if (!(await columnExists(conn, 'benefit_holders', 'source_channel'))) {
      await conn.query(`ALTER TABLE benefit_holders ADD COLUMN source_channel ENUM('xianyu','wechat','other') NOT NULL DEFAULT 'other' AFTER card_type`);
      console.log('  benefit_holders + source_channel');
    }
    console.log('[2/2] benefit_holders 来源渠道就绪');
    console.log('V3.2 迁移完成（幂等，可重复执行）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
