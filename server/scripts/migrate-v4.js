// V4 幂等迁移：高尔夫权益按种类管理（种类字典 + 持有明细 + 订单关联种类）
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
    // 1. 种类字典 + 种子
    await conn.query(`
      CREATE TABLE IF NOT EXISTS golf_benefit_types (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        course_scope VARCHAR(200) NOT NULL DEFAULT 'all',
        notes VARCHAR(500) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await conn.query(`INSERT IGNORE INTO golf_benefit_types (name, course_scope, notes) VALUES
      ('经典白高尔夫', 'all', '东镇、金桥通用'),
      ('中信银行', 'all', '东镇、金桥通用'),
      ('金葵花', '上海金桥高尔夫尊运动公园', '仅金桥可用')`);
    console.log('[1/4] golf_benefit_types 就绪（含种子 3 种）');

    // 2. 持有明细
    await conn.query(`
      CREATE TABLE IF NOT EXISTS holder_golf_benefits (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        holder_id INT UNSIGNED NOT NULL,
        benefit_type_id INT UNSIGNED NOT NULL,
        count_left INT NOT NULL DEFAULT 0,
        refresh_month TINYINT DEFAULT NULL,
        notes VARCHAR(500) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_hgb_holder FOREIGN KEY (holder_id) REFERENCES benefit_holders(id) ON DELETE CASCADE,
        CONSTRAINT fk_hgb_type FOREIGN KEY (benefit_type_id) REFERENCES golf_benefit_types(id),
        UNIQUE KEY uk_holder_type (holder_id, benefit_type_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[2/4] holder_golf_benefits 就绪');

    // 3. golf_orders 加 benefit_type_id + FK
    if (!(await columnExists(conn, 'golf_orders', 'benefit_type_id'))) {
      await conn.query('ALTER TABLE golf_orders ADD COLUMN benefit_type_id INT UNSIGNED DEFAULT NULL AFTER benefit_used');
      console.log('  golf_orders + benefit_type_id');
    }
    const [fk] = await conn.query(
      `SELECT COUNT(*) n FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'golf_orders' AND CONSTRAINT_NAME = 'fk_go_type'`,
      [config.db.database]
    );
    if (fk[0].n === 0) {
      await conn.query('ALTER TABLE golf_orders ADD CONSTRAINT fk_go_type FOREIGN KEY (benefit_type_id) REFERENCES golf_benefit_types(id)');
      console.log('  golf_orders + fk_go_type');
    }
    console.log('[3/4] golf_orders 关联种类就绪');

    // 4. benefit_holders 移除单一计数列（V3.1 已由明细替代；部署时数据清空重录）
    if (await columnExists(conn, 'benefit_holders', 'golf_benefit_count')) {
      await conn.query('ALTER TABLE benefit_holders DROP COLUMN golf_benefit_count');
      console.log('  benefit_holders - golf_benefit_count');
    }
    if (await columnExists(conn, 'benefit_holders', 'golf_refresh_month')) {
      await conn.query('ALTER TABLE benefit_holders DROP COLUMN golf_refresh_month');
      console.log('  benefit_holders - golf_refresh_month');
    }
    console.log('[4/4] benefit_holders 单一计数列移除');
    console.log('V3.1 迁移完成（幂等，可重复执行）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
