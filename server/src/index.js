const express = require('express');
const config = require('./config');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const hotelsRoutes = require('./routes/hotels');
const roomTypesRoutes = require('./routes/roomTypes');
const customersRoutes = require('./routes/customers');
const bookingsRoutes = require('./routes/bookings');
const statsRoutes = require('./routes/stats');
const benefitHoldersRoutes = require('./routes/benefitHolders');
const golfOrdersRoutes = require('./routes/golfOrders');
const golfBenefitTypesRoutes = require('./routes/golfBenefitTypes');
const optionDictRoutes = require('./routes/optionDict');

const app = express();
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelsRoutes);
app.use('/api/room-types', roomTypesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/benefit-holders', benefitHoldersRoutes);
app.use('/api/golf-orders', golfOrdersRoutes);
app.use('/api/golf-benefit-types', golfBenefitTypesRoutes);
app.use('/api/option-dict', optionDictRoutes);

app.use((req, res) => res.status(404).json({ error: '接口不存在' }));

// 统一错误处理
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || '服务器错误' });
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`API 服务已启动: http://127.0.0.1:${config.port}`);
});
