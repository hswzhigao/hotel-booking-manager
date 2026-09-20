// V3 幂等迁移：预订人权益拆分（酒店/高尔夫）+ 卡片/可用时间/更新月 + 客户双标签 + 高尔夫订单表
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
    // 1. benefit_holders：benefit_count → hotel_benefit_count，再加新列
    if (!(await columnExists(conn, 'benefit_holders', 'hotel_benefit_count'))) {
      if (await columnExists(conn, 'benefit_holders', 'benefit_count')) {
        await conn.query('ALTER TABLE benefit_holders RENAME COLUMN benefit_count TO hotel_benefit_count');
        console.log('  benefit_holders: benefit_count → hotel_benefit_count');
      } else {
        await conn.query('ALTER TABLE benefit_holders ADD COLUMN hotel_benefit_count INT NOT NULL DEFAULT 0 AFTER active');
        console.log('  benefit_holders + hotel_benefit_count');
      }
    }
    const holderCols = [
      ['card_type', 'VARCHAR(100) DEFAULT NULL', 'AFTER benefit_types'],
      ['golf_benefit_count', 'INT NOT NULL DEFAULT 0', 'AFTER hotel_benefit_count'],
      ['hotel_refresh_month', 'TINYINT DEFAULT NULL', 'AFTER golf_benefit_count'],
      ['golf_refresh_month', 'TINYINT DEFAULT NULL', 'AFTER hotel_refresh_month'],
      ['availability', "ENUM('any','weekend_only','weekday_only') NOT NULL DEFAULT 'any'", 'AFTER golf_refresh_month'],
    ];
    for (const [col, def, pos] of holderCols) {
      if (!(await columnExists(conn, 'benefit_holders', col))) {
        await conn.query(`ALTER TABLE benefit_holders ADD COLUMN ${col} ${def} ${pos}`);
        console.log(`  benefit_holders + ${col}`);
      }
    }
    console.log('[1/3] benefit_holders 权益拆分与属性就绪');

    // 2. customers 双标签
    for (const [col, def] of [['is_hotel', 'TINYINT(1) NOT NULL DEFAULT 1'], ['is_golf', 'TINYINT(1) NOT NULL DEFAULT 0']]) {
      if (!(await columnExists(conn, 'customers', col))) {
        await conn.query(`ALTER TABLE customers ADD COLUMN ${col} ${def}`);
        console.log(`  customers + ${col}`);
      }
    }
    console.log('[2/3] customers 业务标签就绪');

    // 3. golf_orders
    await conn.query(`
      CREATE TABLE IF NOT EXISTS golf_orders (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        customer_id INT UNSIGNED NOT NULL,
        benefit_holder_id INT UNSIGNED DEFAULT NULL,
        course_name VARCHAR(100) NOT NULL,
        play_date DATE NOT NULL,
        tee_time VARCHAR(20) DEFAULT NULL,
        players TINYINT UNSIGNED NOT NULL DEFAULT 1,
        status ENUM('pending','booked','completed','cancelled') NOT NULL DEFAULT 'pending',
        teach_needed TINYINT(1) NOT NULL DEFAULT 0,
        sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        channel VARCHAR(20) NOT NULL DEFAULT 'xianyu',
        benefit_used TINYINT(1) NOT NULL DEFAULT 1,
        order_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notes VARCHAR(500) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_go_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
        CONSTRAINT fk_go_holder FOREIGN KEY (benefit_holder_id) REFERENCES benefit_holders(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[3/3] golf_orders 就绪');
    console.log('V3 迁移完成（幂等，可重复执行）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
