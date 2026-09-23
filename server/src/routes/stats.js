const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/summary', async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;
    const [[r]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM bookings WHERE status NOT IN ('cancelled','communicating')) booking_count,
        (SELECT COALESCE(SUM(t.nt), 0) FROM (
           SELECT b.nights * COUNT(bi.id) nt FROM bookings b LEFT JOIN booking_items bi ON bi.booking_id = b.id
           WHERE b.status NOT IN ('cancelled','communicating') GROUP BY b.id, b.nights
         ) t) room_night_count,
        (SELECT COALESCE(SUM(sale_total), 0) FROM bookings WHERE status NOT IN ('cancelled','communicating')) total_sale,
        (SELECT COALESCE(SUM(cost_total), 0) FROM bookings WHERE status NOT IN ('cancelled','communicating')) total_cost,
        (SELECT COUNT(*) FROM customers) customer_count,
        (SELECT COUNT(*) FROM hotels) hotel_count,
        (SELECT COALESCE(SUM(sale_total), 0) FROM bookings WHERE status NOT IN ('cancelled','communicating') AND order_time >= ?) month_sale,
        (SELECT COALESCE(SUM(cost_total), 0) FROM bookings WHERE status NOT IN ('cancelled','communicating') AND order_time >= ?) month_cost`,
      [monthStart, monthStart]
    );
    const [[g]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM golf_orders WHERE status <> 'cancelled') golf_order_count,
        (SELECT COALESCE(SUM(sale_price), 0) FROM golf_orders WHERE status <> 'cancelled') golf_total_sale,
        (SELECT COALESCE(SUM(cost_price), 0) FROM golf_orders WHERE status <> 'cancelled') golf_total_cost,
        (SELECT COALESCE(SUM(sale_price), 0) FROM golf_orders WHERE status <> 'cancelled' AND order_time >= ?) golf_month_sale,
        (SELECT COALESCE(SUM(cost_price), 0) FROM golf_orders WHERE status <> 'cancelled' AND order_time >= ?) golf_month_cost`,
      [monthStart, monthStart]
    );
    r.golf_order_count = g.golf_order_count;
    r.golf_total_sale = g.golf_total_sale;
    r.golf_total_cost = g.golf_total_cost;
    r.golf_total_profit = Math.round((g.golf_total_sale - g.golf_total_cost) * 100) / 100;
    r.golf_month_sale = g.golf_month_sale;
    r.golf_month_profit = Math.round((g.golf_month_sale - g.golf_month_cost) * 100) / 100;
    // 今日收益（双线合计）
    const pad = n => String(n).padStart(2, '0');
    const todayStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00:00`;
    const [[t]] = await pool.query(
      `SELECT COALESCE(SUM(sale),0) sale, COALESCE(SUM(cost),0) cost FROM (
         SELECT sale_total sale, cost_total cost FROM bookings WHERE status NOT IN ('cancelled','communicating') AND order_time >= ?
         UNION ALL
         SELECT sale_price, cost_price FROM golf_orders WHERE status <> 'cancelled' AND order_time >= ?
       ) u`, [todayStart, todayStart]);
    r.today_sale = t.sale;
    r.today_cost = t.cost;
    r.today_profit = Math.round((t.sale - t.cost) * 100) / 100;

    // 渠道分解（双线合计 + 自然月口径）
    const [chRows] = await pool.query(
      `SELECT channel,
         COUNT(*) order_count,
         COALESCE(SUM(sale),0) sale,
         COALESCE(SUM(cost),0) cost,
         COALESCE(SUM(CASE WHEN ot >= ? THEN sale ELSE 0 END),0) month_sale,
         COALESCE(SUM(CASE WHEN ot >= ? THEN cost ELSE 0 END),0) month_cost
       FROM (
         SELECT channel, sale_total sale, cost_total cost, order_time ot
         FROM bookings WHERE status NOT IN ('cancelled','communicating')
         UNION ALL
         SELECT channel, sale_price, cost_price, order_time
         FROM golf_orders WHERE status <> 'cancelled'
       ) u GROUP BY channel`, [monthStart, monthStart]);
    r.channels = chRows.map(c => ({
      channel: c.channel, order_count: c.order_count,
      sale: c.sale, cost: c.cost,
      profit: Math.round((c.sale - c.cost) * 100) / 100,
      month_sale: c.month_sale,
      month_profit: Math.round((c.month_sale - c.month_cost) * 100) / 100,
    }));
    r.total_profit = Math.round((r.total_sale - r.total_cost) * 100) / 100;
    r.month_profit = Math.round((r.month_sale - r.month_cost) * 100) / 100;
    r.total_profit = Math.round((r.total_sale - r.total_cost) * 100) / 100;
    // 合并总账（酒店+高尔夫，放在两者字段都算完之后）
    r.all_order_count = r.booking_count + r.golf_order_count;
    r.all_total_sale = Math.round((r.total_sale + r.golf_total_sale) * 100) / 100;
    r.all_total_cost = Math.round((r.total_cost + r.golf_total_cost) * 100) / 100;
    r.all_total_profit = Math.round((r.total_profit + r.golf_total_profit) * 100) / 100;
    r.all_month_sale = Math.round((r.month_sale + r.golf_month_sale) * 100) / 100;
    r.all_month_profit = Math.round((r.month_profit + r.golf_month_profit) * 100) / 100;
    const [recent] = await pool.query(
      `SELECT b.*, c.name customer_name, h.name hotel_name, bh.name benefit_holder_name,
        (SELECT COUNT(*) FROM booking_items bi WHERE bi.booking_id = b.id) room_count,
        (b.sale_total - b.cost_total) profit
      FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN hotels h ON h.id = b.hotel_id
      LEFT JOIN benefit_holders bh ON bh.id = b.benefit_holder_id
      WHERE b.status NOT IN ('cancelled','communicating')
      ORDER BY b.created_at DESC, b.id DESC LIMIT 10`
    );
    const ids = recent.map(r => r.id);
    if (ids.length) {
      const [items] = await pool.query(
        `SELECT bi.booking_id, rt.name FROM booking_items bi JOIN room_types rt ON rt.id = bi.room_type_id WHERE bi.booking_id IN (?)`, [ids]
      );
      const cnt = {};
      for (const it of items) { const k = `${it.booking_id}|${it.name}`; cnt[k] = (cnt[k] || 0) + 1; }
      const namesByBooking = {};
      for (const it of items) {
        namesByBooking[it.booking_id] = namesByBooking[it.booking_id] || new Set();
        namesByBooking[it.booking_id].add(it.name);
      }
      recent.forEach(r => {
        const set = namesByBooking[r.id] || new Set();
        r.items_summary = [...set].map(n => `${n}×${cnt[`${r.id}|${n}`]}`).join('、');
      });
    }
    r.recent_bookings = recent;
    res.json(r);
  } catch (e) { next(e); }
});

module.exports = router;

// 收益趋势：bucket=day|week|month|year；返回 [{period, hotel_sale, hotel_cost, golf_sale, golf_cost}]
router.get('/trend', async (req, res, next) => {
  try {
    const { bucket = 'day' } = req.query;
    const fmtMap = {
      day: { sql: '%Y-%m-%d', limit: 30 },
      week: { sql: '%x-W%v', limit: 12 },
      month: { sql: '%Y-%m', limit: 12 },
      year: { sql: '%Y', limit: 3 },
    };
    const cfg = fmtMap[bucket];
    if (!cfg) return res.status(400).json({ error: 'bucket 不合法（day/week/month/year）' });
    let limit = Math.min(90, Number(req.query.limit) || cfg.limit);
    if (limit < 1) limit = cfg.limit;
    const rows = await pool.query(
      `SELECT period, SUM(hotel_sale) hotel_sale, SUM(hotel_cost) hotel_cost, SUM(golf_sale) golf_sale, SUM(golf_cost) golf_cost FROM (
         SELECT DATE_FORMAT(order_time, ?) period, sale_total hotel_sale, cost_total hotel_cost, 0 golf_sale, 0 golf_cost
         FROM bookings WHERE status NOT IN ('cancelled','communicating') AND order_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         UNION ALL
         SELECT DATE_FORMAT(order_time, ?), 0, 0, sale_price, cost_price
         FROM golf_orders WHERE status <> 'cancelled' AND order_time >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ) u GROUP BY period ORDER BY period`,
      [cfg.sql, limit * (bucket === 'day' ? 1 : bucket === 'week' ? 7 : bucket === 'month' ? 31 : 366),
       cfg.sql, limit * (bucket === 'day' ? 1 : bucket === 'week' ? 7 : bucket === 'month' ? 31 : 366)]
    );
    res.json({ items: rows[0] });
  } catch (e) { next(e); }
});
