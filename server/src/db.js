const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: true,   // DATE/DATETIME 以 'YYYY-MM-DD[ HH:MM:SS]' 字符串返回
  decimalNumbers: true, // DECIMAL 以数字返回
});

module.exports = pool;
