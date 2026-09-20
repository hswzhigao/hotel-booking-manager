// V2 幂等迁移：benefit_holders 新表 + hotels 政策字段 + bookings 关联权益人
// 已存在的结构会跳过，可重复执行
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

async function constraintExists(conn, table, constraint) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) n FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [config.db.database, table, constraint]
  );
  return rows[0].n > 0;
}

(async () => {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
  try {
    // 1. 权益人表（schema.sql 里已有定义，直接执行 IF NOT EXISTS）
    await conn.query(`
      CREATE TABLE IF NOT EXISTS benefit_holders (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        wechat VARCHAR(100) DEFAULT NULL,
        phone VARCHAR(30) DEFAULT NULL,
        benefit_types VARCHAR(500) DEFAULT NULL,
        willing_present TINYINT(1) NOT NULL DEFAULT 0,
        willing_assist TINYINT(1) NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        benefit_count INT NOT NULL DEFAULT 0,
        notes VARCHAR(500) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    // V2.1：权益人表补 benefit_count（老 v2 结构升级）
    if (!(await columnExists(conn, 'benefit_holders', 'benefit_count'))) {
      await conn.query('ALTER TABLE benefit_holders ADD COLUMN benefit_count INT NOT NULL DEFAULT 0 AFTER active');
      console.log('  benefit_holders + benefit_count');
    }
    console.log('[1/3] benefit_holders 表就绪');

    // 2. hotels 入住政策字段
    const hotelCols = [
      ['checkin_presence', 'TINYINT(1) DEFAULT NULL'],
      ['checkin_info_required', 'VARCHAR(1000) DEFAULT NULL'],
      ['checkin_process', 'VARCHAR(1000) DEFAULT NULL'],
      ['official_phone', 'VARCHAR(50) DEFAULT NULL'],
      ['guide_text', 'TEXT'],
    ];
    for (const [col, def] of hotelCols) {
      if (!(await columnExists(conn, 'hotels', col))) {
        await conn.query(`ALTER TABLE hotels ADD COLUMN ${col} ${def}`);
        console.log(`  hotels + ${col}`);
      }
    }
    console.log('[2/3] hotels 入住政策字段就绪');

    // 3. bookings 关联权益人
    if (!(await columnExists(conn, 'bookings', 'benefit_holder_id'))) {
      await conn.query('ALTER TABLE bookings ADD COLUMN benefit_holder_id INT UNSIGNED DEFAULT NULL');
      console.log('  bookings + benefit_holder_id');
    }
    if (!(await constraintExists(conn, 'bookings', 'fk_bk_holder'))) {
      await conn.query(
        'ALTER TABLE bookings ADD CONSTRAINT fk_bk_holder FOREIGN KEY (benefit_holder_id) REFERENCES benefit_holders(id)'
      );
      console.log('  bookings + fk_bk_holder');
    }
    console.log('[3/3] bookings 关联就绪');

    // V2.1：客户表移除 benefit_count（权益归属预订人；存量数据已确认清空重录）
    if (await columnExists(conn, 'customers', 'benefit_count')) {
      await conn.query('ALTER TABLE customers DROP COLUMN benefit_count');
      console.log('  customers - benefit_count（权益已归属预订人）');
    }
    console.log('V2.1 迁移完成（幂等，可重复执行）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
