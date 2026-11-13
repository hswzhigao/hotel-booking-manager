// 列表排序解析：sort_by（白名单列名 → SQL 表达式）+ sort_order（asc|desc）
// 用法：const orderSql = parseSort(req.query, SORT_COLS, 'b.order_time DESC')
function parseSort(query, SORT_COLS, defaultSort) {
  const { sort_by, sort_order } = query || {};
  const expr = SORT_COLS[sort_by];
  if (!expr) return defaultSort;
  const order = sort_order === 'asc' ? 'ASC' : 'DESC';
  // 表达式列加 id 兜底保证稳定排序；默认排序约定已含 id
  return `ORDER BY ${expr} ${order}, id DESC`;
}

module.exports = { parseSort };
