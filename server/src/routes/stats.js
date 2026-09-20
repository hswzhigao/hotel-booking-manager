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
        (SELECT COUNT(*) FROM bookings WHERE status <> 'cancelled') booking_count,
        (SELECT COALESCE(SUM(t.nt), 0) FROM (
           SELECT b.nights * COUNT(bi.id) nt FROM bookings b LEFT JOIN booking_items bi ON bi.booking_id = b.id
           WHERE b.status <> 'cancelled' GROUP BY b.id, b.nights
         ) t) room_night_count,
        (SELECT COALESCE(SUM(sale_total), 0) FROM bookings WHERE status <> 'cancelled') total_sale,
        (SELECT COALESCE(SUM(cost_total), 0) FROM bookings WHERE status <> 'cancelled') total_cost,
        (SELECT COUNT(*) FROM customers) customer_count,
        (SELECT COUNT(*) FROM hotels) hotel_count,
        (SELECT COALESCE(SUM(sale_total), 0) FROM bookings WHERE status <> 'cancelled' AND order_time >= ?) month_sale,
        (SELECT COALESCE(SUM(cost_total), 0) FROM bookings WHERE status <> 'cancelled' AND order_time >= ?) month_cost`,
      [monthStart, monthStart]
    );
    r.total_profit = Math.round((r.total_sale - r.total_cost) * 100) / 100;
    r.month_profit = Math.round((r.month_sale - r.month_cost) * 100) / 100;
    const [recent] = await pool.query(
      `SELECT b.*, c.name customer_name, h.name hotel_name,
        (SELECT COUNT(*) FROM booking_items bi WHERE bi.booking_id = b.id) room_count,
        (b.sale_total - b.cost_total) profit
      FROM bookings b JOIN customers c ON c.id = b.customer_id JOIN hotels h ON h.id = b.hotel_id
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
