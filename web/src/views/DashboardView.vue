<template>
  <div class="page-card">
    <el-row :gutter="16">
      <el-col v-for="card in cards" :key="card.label" :xs="12" :sm="8" :md="6" :lg="3">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value" :class="card.cls || ''">{{ card.value }}</div>
          <div v-if="card.sub" class="stat-sub">{{ card.sub }}</div>
        </el-card>
      </el-col>
    </el-row>

    <div class="section-title">高尔夫业务</div>
    <el-row :gutter="16">
      <el-col v-for="card in golfCards" :key="card.label" :xs="12" :sm="12" :md="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value" :class="card.cls || ''">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- V3.3 渠道分区卡：酒店+高尔夫合并按成交渠道统计 -->
    <div class="section-title">渠道收益</div>
    <el-row v-if="channelCards.length" :gutter="16">
      <el-col v-for="ch in channelCards" :key="ch.channel" :xs="24" :sm="12" :md="8">
        <el-card class="stat-card channel-card" shadow="hover">
          <div class="channel-head">
            <span class="channel-name">{{ ch.name }}</span>
            <el-tag size="small" type="info">{{ ch.orderCount }} 单</el-tag>
          </div>
          <div class="channel-line">
            <span class="channel-label">收入</span>
            <span class="money">{{ money(ch.sale) }}</span>
          </div>
          <div class="channel-line">
            <span class="channel-label">利润</span>
            <span class="money money-profit" :class="ch.profit >= 0 ? 'positive' : 'negative'">
              {{ profitText(ch.profit) }}
            </span>
          </div>
          <div class="channel-line">
            <span class="channel-label">月收入</span>
            <span class="money">{{ money(ch.monthSale) }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-empty v-else description="暂无渠道成交数据" :image-size="60" />

    <el-card shadow="never" class="recent-card">
      <template #header>最近预定</template>
      <div class="desktop-table">
      <el-table :data="recentBookings" v-loading="loading" empty-text="暂无预定数据">
        <el-table-column label="下单时间" width="170">
          <template #default="{ row }">{{ datetimeText(row.order_time) }}</template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" min-width="100" />
        <el-table-column prop="hotel_name" label="酒店" min-width="140" />
        <el-table-column label="入住/离店" min-width="180">
          <template #default="{ row }">{{ row.check_in }} ~ {{ row.check_out }}</template>
        </el-table-column>
        <el-table-column prop="nights" label="晚数" width="70" align="center" />
        <el-table-column prop="room_count" label="间数" width="70" align="center" />
        <el-table-column label="卖价" width="110" align="right">
          <template #default="{ row }"><span class="money">{{ money(row.sale_total) }}</span></template>
        </el-table-column>
        <el-table-column label="利润" width="100" align="right">
          <template #default="{ row }">
            <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusMeta(row.status).type" size="small">{{ statusMeta(row.status).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default>
            <el-button text type="primary" @click="goBookings">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <!-- 移动端简化卡片（客户/酒店/日期/金额/状态） -->
      <div class="mobile-cards" v-loading="loading">
        <el-empty v-if="!recentBookings.length" description="暂无预定数据" :image-size="60" />
        <div v-for="row in recentBookings" :key="row.id" class="m-card">
          <div class="m-title">
            <span class="m-name">{{ row.customer_name }}</span>
            <el-tag :type="statusMeta(row.status).type" size="small">{{ statusMeta(row.status).label }}</el-tag>
          </div>
          <div class="m-sub">{{ row.hotel_name }}</div>
          <div class="m-line">
            <span class="m-label">入住/离店</span>
            <span class="m-value">{{ row.check_in }} ~ {{ row.check_out }}</span>
          </div>
          <div class="m-line">
            <span class="m-label">金额</span>
            <span class="m-value">
              <span class="money">{{ money(row.sale_total) }}</span>
              /
              <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
            </span>
          </div>
        </div>
        <div class="recent-mobile-more">
          <el-button text type="primary" size="small" @click="goBookings">查看全部预定</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { statsApi } from '../api'
import { money, profitText, profitClass, datetimeText, statusMeta, channelText } from '../utils/format'

const router = useRouter()
const loading = ref(false)
const summary = ref({
  booking_count: 0,
  room_night_count: 0,
  total_sale: 0,
  total_cost: 0,
  total_profit: 0,
  customer_count: 0,
  hotel_count: 0,
  month_sale: 0,
  month_profit: 0,
  recent_bookings: [],
  // V3 高尔夫统计
  golf_order_count: 0,
  golf_total_sale: 0,
  golf_total_cost: 0,
  golf_total_profit: 0,
  // V3.3 今日收益 + 渠道分解
  today_sale: 0,
  today_cost: 0,
  today_profit: 0,
  channels: [],
})

const recentBookings = computed(() => summary.value.recent_bookings || [])

const cards = computed(() => [
  {
    label: '今日收益',
    value: profitText(summary.value.today_profit),
    sub: `今日卖价 ${money(summary.value.today_sale)}`,
    cls: Number(summary.value.today_profit) >= 0 ? 'positive' : 'negative',
  },
  { label: '预定数', value: summary.value.booking_count },
  { label: '总收入', value: money(summary.value.total_sale) },
  { label: '总成本', value: money(summary.value.total_cost) },
  {
    label: '总利润',
    value: profitText(summary.value.total_profit),
    cls: Number(summary.value.total_profit) >= 0 ? 'positive' : 'negative',
  },
  { label: '客户数', value: summary.value.customer_count },
  { label: '酒店数', value: summary.value.hotel_count },
  { label: '本月收入', value: money(summary.value.month_sale) },
  {
    label: '本月利润',
    value: profitText(summary.value.month_profit),
    cls: Number(summary.value.month_profit) >= 0 ? 'positive' : 'negative',
  },
])

// 渠道分区卡：channels[{channel,order_count,sale,cost,profit,month_sale,month_profit}]
const channelCards = computed(() =>
  (summary.value.channels || []).map((c) => ({
    channel: c.channel,
    name: channelText(c.channel),
    orderCount: c.order_count,
    sale: Number(c.sale || 0),
    profit: Number(c.profit || 0),
    monthSale: Number(c.month_sale || 0),
  })),
)

const golfCards = computed(() => [
  { label: '高尔夫订单数', value: summary.value.golf_order_count },
  { label: '高尔夫总收入', value: money(summary.value.golf_total_sale) },
  { label: '高尔夫总成本', value: money(summary.value.golf_total_cost) },
  {
    label: '高尔夫总利润',
    value: profitText(summary.value.golf_total_profit),
    cls: Number(summary.value.golf_total_profit) >= 0 ? 'positive' : 'negative',
  },
])

onMounted(async () => {
  loading.value = true
  try {
    summary.value = await statsApi.summary()
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    loading.value = false
  }
})

function goBookings() {
  router.push('/bookings')
}
</script>

<style scoped>
.stat-card {
  margin-bottom: 16px;
  text-align: center;
}

.stat-label {
  font-size: 13px;
  color: #909399;
}

.stat-value {
  margin-top: 6px;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  font-variant-numeric: tabular-nums;
}

.stat-value.positive {
  color: #67c23a;
}

.stat-value.negative {
  color: #f56c6c;
}

.stat-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.channel-card {
  text-align: left;
}

.channel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.channel-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.channel-line {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #606266;
  padding: 3px 0;
}

.channel-label {
  color: #909399;
}

.section-title {
  margin: 8px 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.recent-card {
  margin-top: 4px;
}

.recent-mobile-more {
  text-align: center;
}
</style>
