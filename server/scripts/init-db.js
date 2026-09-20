// 幂等初始化：建表 + seed 管理员 admin/admin123
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const config = require('../src/config');

(async () => {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
    await conn.query(sql);
    const hash = bcrypt.hashSync('admin123', 10);
    await conn.query('INSERT IGNORE INTO users (username, password_hash) VALUES (?, ?)', ['admin', hash]);
    const [tables] = await conn.query('SHOW TABLES');
    console.log('数据库初始化完成，表：', tables.map(r => Object.values(r)[0]).join(', '));
    console.log('管理员账号：admin / admin123（首次登录后请在设置页修改密码）');
  } finally {
    await conn.end();
  }
})().catch(e => {
  console.error('初始化失败:', e.message);
  process.exit(1);
});
