// V8 幂等迁移：手续费率 + 手动记账表
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
    if (!(await columnExists(conn, 'bookings', 'fee_rate'))) {
      await conn.query('ALTER TABLE bookings ADD COLUMN fee_rate DECIMAL(5,4) NOT NULL DEFAULT 0 AFTER channel');
      await conn.query("UPDATE bookings SET fee_rate = 0.016 WHERE channel = 'xianyu'");
      console.log('  bookings + fee_rate（存量闲鱼单回填 1.6%）');
    }
    if (!(await columnExists(conn, 'golf_orders', 'fee_rate'))) {
      await conn.query('ALTER TABLE golf_orders ADD COLUMN fee_rate DECIMAL(5,4) NOT NULL DEFAULT 0 AFTER cost_price');
      await conn.query("UPDATE golf_orders SET fee_rate = 0.016 WHERE channel = 'xianyu'");
      console.log('  golf_orders + fee_rate（存量闲鱼单回填 1.6%）');
    }
    await conn.query(`CREATE TABLE IF NOT EXISTS manual_entries (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      entry_date DATE NOT NULL,
      type ENUM('income','expense') NOT NULL,
      business ENUM('hotel','golf','general') NOT NULL DEFAULT 'general',
      amount DECIMAL(10,2) NOT NULL,
      notes VARCHAR(500) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    console.log('  manual_entries 就绪');
    console.log('V7 迁移完成（幂等，可重复执行）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
