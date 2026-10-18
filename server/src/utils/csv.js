// CSV 导出工具：Excel 兼容（\ufeff BOM + 双引号转义 + CRLF）
function esc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** headers: string[]; rows: any[][]; 返回带 BOM 的 CSV 文本 */
function toCsv(headers, rows) {
  const lines = [headers.map(esc).join(',')];
  for (const r of rows) lines.push(r.map(esc).join(','));
  return '\ufeff' + lines.join('\r\n');
}

/** Express 响应：text/csv 附件下载（中文文件名走 RFC 5987） */
function sendCsv(res, filename, headers, rows) {
  const ascii = 'export.csv';
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`);
  res.send(toCsv(headers, rows));
}

module.exports = { toCsv, sendCsv };
