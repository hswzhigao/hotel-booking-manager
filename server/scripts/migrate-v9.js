// V9 幂等迁移：拆分闲鱼号/微信号 + 卡片类型入字典
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
    // 1. customers：wechat → xianyu_id，新增 wechat_id
    if (await columnExists(conn, 'customers', 'wechat') && !(await columnExists(conn, 'customers', 'xianyu_id'))) {
      await conn.query('ALTER TABLE customers RENAME COLUMN wechat TO xianyu_id');
      console.log('  customers: wechat → xianyu_id（旧数据保留为闲鱼号）');
    }
    if (!(await columnExists(conn, 'customers', 'wechat_id'))) {
      await conn.query('ALTER TABLE customers ADD COLUMN wechat_id VARCHAR(100) DEFAULT NULL AFTER xianyu_id');
      console.log('  customers + wechat_id');
    }

    // 2. benefit_holders：同
    if (await columnExists(conn, 'benefit_holders', 'wechat') && !(await columnExists(conn, 'benefit_holders', 'xianyu_id'))) {
      await conn.query('ALTER TABLE benefit_holders RENAME COLUMN wechat TO xianyu_id');
      console.log('  benefit_holders: wechat → xianyu_id');
    }
    if (!(await columnExists(conn, 'benefit_holders', 'wechat_id'))) {
      await conn.query('ALTER TABLE benefit_holders ADD COLUMN wechat_id VARCHAR(100) DEFAULT NULL AFTER xianyu_id');
      console.log('  benefit_holders + wechat_id');
    }

    // 3. 卡片类型入字典（插入前幂等防主键冲突——已有 checkin_info/golf_course 条目持续自增 id，用 INSERT IGNORE 按 category+label 唯一）
    await conn.query(`INSERT IGNORE INTO option_dict (category, label, sort) VALUES
      ('card_type','经典白',1),('card_type','大白金',2),('card_type','普通白金',3),
      ('card_type','金葵花',4),('card_type','中信银行',5),('card_type','浦发AE白',6)`);
    console.log('[4/4] 卡片类型种子就绪（经典白/大白金/普通白金/金葵花/中信银行/浦发AE白）');

    console.log('V9 迁移完成（幂等，可重复执行）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('迁移失败:', e.message);
  process.exit(1);
});
