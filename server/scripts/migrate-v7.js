// V7 幂等迁移：字段字典 + 房型价格档位 + booking_items 每晚价换算
const mysql = require('mysql2/promise');
const config = require('../src/config');

(async () => {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS option_dict (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      category VARCHAR(50) NOT NULL,
      label VARCHAR(100) NOT NULL,
      sort INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_cat_label (category, label)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    await conn.query(`INSERT IGNORE INTO option_dict (category, label, sort) VALUES
      ('checkin_info','姓名',1),('checkin_info','身份证号',2),('checkin_info','手机号',3),('checkin_info','信用卡后四位',4)`);
    console.log('[1/3] option_dict 就绪（含种子）');

    await conn.query(`CREATE TABLE IF NOT EXISTS room_type_rates (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      room_type_id INT UNSIGNED NOT NULL,
      label VARCHAR(50) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      CONSTRAINT fk_rtr_rt FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    console.log('[2/3] room_type_rates 就绪');

    // booking_items.price：全程总价 → 每晚价（幂等：用标记表防重复换算）
    await conn.query(`CREATE TABLE IF NOT EXISTS migration_markers (name VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const [[marker]] = await conn.query("SELECT COUNT(*) c FROM migration_markers WHERE name='v7_price_per_night'");
    if (marker.c === 0) {
      const [rows] = await conn.query(
        `SELECT bi.id, bi.price, b.nights FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id`
      );
      let converted = 0, skipped = 0;
      for (const r of rows) {
        if (!r.nights || r.nights < 1) { skipped++; continue; }
        const per = r.price / r.nights;
        const rounded = Math.round(per * 100) / 100;
        if (Math.abs(rounded * r.nights - r.price) > 0.01) {
          console.warn(`  警告: item ${r.id} price=${r.price} nights=${r.nights} 换算除不尽，保留原值（请人工核对）`);
          skipped++; continue;
        }
        await conn.query('UPDATE booking_items SET price = ? WHERE id = ?', [rounded, r.id]);
        converted++;
      }
      await conn.query("INSERT INTO migration_markers (name) VALUES ('v7_price_per_night')");
      console.log(`[3/3] 每晚价换算完成：转换 ${converted} 条，跳过 ${skipped} 条`);
    } else {
      console.log('[3/3] 每晚价换算已执行过（标记存在，跳过）');
    }
    console.log('V5 迁移完成（幂等，可重复执行）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
