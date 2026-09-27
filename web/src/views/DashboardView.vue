<template>
  <div class="page-card dashboard-page">
    <!-- ===== V7 1. 总账卡组：总营收/总成本/手续费/毛利润/净利润/利润率（all_*） ===== -->
    <div class="section-label">总账</div>
    <div class="ledger-grid" v-loading="summaryLoading">
      <el-card v-for="card in ledgerCards" :key="card.label" class="stat-card" shadow="hover">
        <div class="stat-label">{{ card.label }}</div>
        <div class="stat-value big" :class="card.cls || ''">{{ card.value }}</div>
        <div v-if="card.sub" class="stat-sub">{{ card.sub }}</div>
      </el-card>
    </div>

    <!-- ===== V7 1b. 本月卡组（含手动记账）+ 今日卡 ===== -->
    <div class="section-label">本月<span class="section-tag">含手动记账</span></div>
    <div class="ledger-grid" v-loading="summaryLoading">
      <el-card v-for="card in monthCards" :key="card.label" class="stat-card" shadow="hover">
        <div class="stat-label">{{ card.label }}</div>
        <div class="stat-value big" :class="card.cls || ''">{{ card.value }}</div>
        <div v-if="card.sub" class="stat-sub">{{ card.sub }}</div>
      </el-card>
      <el-card class="stat-card today-card" shadow="hover">
        <div class="stat-label">今日收益</div>
        <div class="stat-value big" :class="profitClass(summary.today_profit)">{{ profitText(summary.today_profit) }}</div>
        <div class="stat-sub">卖价 {{ money(summary.today_sale) }} / 成本 {{ money(summary.today_cost) }}</div>
      </el-card>
    </div>

    <!-- ===== V6 2. 分账两区块：酒店业务 / 高尔夫业务（桌面并排，移动堆叠） ===== -->
    <el-row class="split-row" :gutter="16" v-loading="summaryLoading">
      <el-col :xs="24" :md="12">
        <el-card shadow="hover" class="biz-card">
          <template #header>
            <div class="biz-head">
              <span class="biz-name">酒店业务</span>
              <el-tag size="small" type="info">{{ summary.booking_count || 0 }} 单</el-tag>
            </div>
          </template>
          <div class="biz-grid">
            <div class="biz-item">
              <div class="stat-label">收入</div>
              <div class="stat-value">{{ money(summary.total_sale) }}</div>
            </div>
            <div class="biz-item">
              <div class="stat-label">成本</div>
              <div class="stat-value">{{ money(summary.total_cost) }}</div>
            </div>
            <div class="biz-item">
              <div class="stat-label">手续费</div>
              <div class="stat-value fee-color">{{ money(summary.hotel_fee_total) }}</div>
            </div>
            <div class="biz-item">
              <div class="stat-label">净利</div>
              <div class="stat-value" :class="profitClass(summary.hotel_total_profit)">
                {{ profitText(summary.hotel_total_profit) }}
              </div>
            </div>
            <div class="biz-item">
              <div class="stat-label">利润率</div>
              <div class="stat-value">{{ summary.hotel_profit_rate ?? '-' }}%</div>
            </div>
            <div class="biz-item">
              <div class="stat-label">本月收入</div>
              <div class="stat-value">{{ money(summary.month_sale) }}</div>
            </div>
            <div class="biz-item">
              <div class="stat-label">本月净利</div>
              <div class="stat-value" :class="profitClass(summary.hotel_month_profit)">
                {{ profitText(summary.hotel_month_profit) }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="hover" class="biz-card">
          <template #header>
            <div class="biz-head">
              <span class="biz-name">高尔夫业务</span>
              <el-tag size="small" type="info">{{ summary.golf_order_count || 0 }} 单</el-tag>
            </div>
          </template>
          <div class="biz-grid">
            <div class="biz-item">
              <div class="stat-label">收入</div>
              <div class="stat-value">{{ money(summary.golf_total_sale) }}</div>
            </div>
            <div class="biz-item">
              <div class="stat-label">成本</div>
              <div class="stat-value">{{ money(summary.golf_total_cost) }}</div>
            </div>
            <div class="biz-item">
              <div class="stat-label">手续费</div>
              <div class="stat-value fee-color">{{ money(summary.golf_fee_total) }}</div>
            </div>
            <div class="biz-item">
              <div class="stat-label">净利</div>
              <div class="stat-value" :class="profitClass(summary.golf_total_profit)">
                {{ profitText(summary.golf_total_profit) }}
              </div>
            </div>
            <div class="biz-item">
              <div class="stat-label">利润率</div>
              <div class="stat-value">{{ summary.golf_profit_rate ?? '-' }}%</div>
            </div>
            <div class="biz-item">
              <div class="stat-label">本月收入</div>
              <div class="stat-value">{{ money(summary.golf_month_sale) }}</div>
            </div>
            <div class="biz-item">
              <div class="stat-label">本月净利</div>
              <div class="stat-value" :class="profitClass(summary.golf_month_profit)">
                {{ profitText(summary.golf_month_profit) }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- ===== 渠道收益（闲鱼/微信/其他，双业务线合并口径） ===== -->
    <el-card shadow="never" class="channel-card">
      <template #header>
        <div class="card-head"><span>渠道收益</span><span class="head-meta">酒店 + 高尔夫合并</span></div>
      </template>
      <div class="desktop-table">
        <el-table :data="summary.channels || []" empty-text="暂无渠道数据" size="small">
          <el-table-column label="渠道" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.channel === 'xianyu' ? 'warning' : row.channel === 'wechat' ? 'success' : 'info'">
                {{ channelText(row.channel) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="order_count" label="订单数" width="80" align="center" />
          <el-table-column label="总收入" align="right">
            <template #default="{ row }">¥{{ Number(row.sale).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="总毛利" align="right">
            <template #default="{ row }"><span :class="profitClass(row.profit)">+¥{{ Number(row.profit).toFixed(2) }}</span></template>
          </el-table-column>
          <el-table-column label="本月收入" align="right">
            <template #default="{ row }">¥{{ Number(row.month_sale).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="本月毛利" align="right">
            <template #default="{ row }"><span :class="profitClass(row.month_profit)">+¥{{ Number(row.month_profit).toFixed(2) }}</span></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="mobile-cards">
        <el-empty v-if="!(summary.channels || []).length" description="暂无渠道数据" :image-size="60" />
        <div v-for="c in summary.channels || []" :key="c.channel" class="m-card">
          <div class="m-title">
            <el-tag size="small" :type="c.channel === 'xianyu' ? 'warning' : c.channel === 'wechat' ? 'success' : 'info'">{{ channelText(c.channel) }}</el-tag>
            <span class="m-meta">{{ c.order_count }} 单</span>
          </div>
          <div class="m-sub">收入 ¥{{ Number(c.sale).toFixed(2) }} · 利润 +¥{{ Number(c.profit).toFixed(2) }}</div>
          <div class="m-sub">本月 ¥{{ Number(c.month_sale).toFixed(2) }} / +¥{{ Number(c.month_profit).toFixed(2) }}</div>
        </div>
      </div>
    </el-card>

    <!-- ===== V6 3. 收益趋势图（echarts 按需引入；一次拉取，业务/指标切换纯前端重绘） ===== -->
    <el-card shadow="never" class="trend-card">
      <template #header>
        <div class="card-head"><span>收益趋势</span></div>
      </template>
      <div class="trend-controls">
        <el-radio-group v-model="trendBucket" size="small" @change="onBucketChange">
          <el-radio-button value="day">按日</el-radio-button>
          <el-radio-button value="week">按周</el-radio-button>
          <el-radio-button value="month">按月</el-radio-button>
          <el-radio-button value="year">按年</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="trendBiz" size="small">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="hotel">酒店</el-radio-button>
          <el-radio-button value="golf">高尔夫</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="trendMetric" size="small">
          <el-radio-button value="sale">收入</el-radio-button>
          <el-radio-button value="profit">净利</el-radio-button>
        </el-radio-group>
        <div class="trend-zoom">
          <el-button-group size="small">
            <el-button :icon="ArrowLeft" title="向左平移" @click="zoomPan(-1)" />
            <el-button :icon="ArrowRight" title="向右平移" @click="zoomPan(1)" />
          </el-button-group>
          <el-button-group size="small">
            <el-button :icon="Minus" title="缩小" @click="zoomScale(-1)" />
            <el-button :icon="Plus" title="放大" @click="zoomScale(1)" />
          </el-button-group>
          <el-button size="small" @click="resetZoom">满屏</el-button>
        </div>
      </div>
      <div v-loading="trendLoading" class="trend-wrap">
        <div ref="chartEl" class="trend-chart"></div>
      </div>
    </el-card>

    <!-- ===== V6 4. 最近订单卡：tab 切换酒店/高尔夫，行点击就地弹只读详情（不跳路由） ===== -->
    <el-card shadow="never" class="recent-card">
      <template #header>
        <div class="card-head">
          <span>最近订单</span>
          <el-button text type="primary" size="small" @click="goAll">查看全部</el-button>
        </div>
      </template>
      <el-tabs v-model="recentTab">
        <el-tab-pane label="酒店预定" name="hotel">
          <div class="desktop-table">
            <el-table
              :data="recentBookings"
              v-loading="summaryLoading"
              empty-text="暂无预定数据"
              row-class-name="row-clickable"
              class="click-table"
              @row-click="openHotelDetail"
            >
              <el-table-column label="下单时间" width="160">
                <template #default="{ row }">{{ datetimeText(row.order_time) }}</template>
              </el-table-column>
              <el-table-column prop="customer_name" label="客户" min-width="90" />
              <el-table-column prop="hotel_name" label="酒店" min-width="150" show-overflow-tooltip />
              <el-table-column label="入住 ~ 离店" min-width="170">
                <template #default="{ row }">{{ row.check_in }} ~ {{ row.check_out }}</template>
              </el-table-column>
              <el-table-column prop="nights" label="晚数" width="60" align="center" />
              <el-table-column prop="items_summary" label="明细" min-width="130" show-overflow-tooltip />
              <el-table-column label="卖价" width="105" align="right">
                <template #default="{ row }"><span class="money">{{ money(row.sale_total) }}</span></template>
              </el-table-column>
              <el-table-column label="手续费" width="90" align="right">
                <template #default="{ row }"><span class="money fee-color">{{ money(row.fee) }}</span></template>
              </el-table-column>
              <el-table-column label="净利" width="100" align="right">
                <template #default="{ row }">
                  <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="90">
                <template #default="{ row }">
                  <el-tag :type="statusMeta(row.status).type" size="small">{{ statusMeta(row.status).label }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div class="mobile-cards" v-loading="summaryLoading">
            <el-empty v-if="!recentBookings.length" description="暂无预定数据" :image-size="60" />
            <div v-for="row in recentBookings" :key="row.id" class="m-card" @click="openHotelDetail(row)">
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
                  <span class="money fee-color">{{ money(row.fee) }}</span>
                  /
                  <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
                </span>
              </div>
            </div>
            <div class="recent-mobile-more">
              <el-button text type="primary" size="small" @click="goBookings">查看全部预定</el-button>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="高尔夫订单" name="golf" lazy>
          <div class="desktop-table">
            <el-table
              :data="golfRecent"
              v-loading="golfLoading"
              empty-text="暂无高尔夫订单"
              row-class-name="row-clickable"
              class="click-table"
              @row-click="openGolfDetail"
            >
              <el-table-column label="下单时间" width="160">
                <template #default="{ row }">{{ datetimeText(row.order_time) }}</template>
              </el-table-column>
              <el-table-column prop="customer_name" label="客户" min-width="90" />
              <el-table-column prop="course_name" label="球场" min-width="150" show-overflow-tooltip />
              <el-table-column label="打球日期" width="105">
                <template #default="{ row }">
                  {{ row.play_date }}<span v-if="row.tee_time"> {{ row.tee_time }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="players" label="人数" width="60" align="center" />
              <el-table-column label="权益种类" min-width="105">
                <template #default="{ row }">
                  <el-tag v-if="row.benefit_type_name" type="warning" size="small">{{ row.benefit_type_name }}</el-tag>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="卖价" width="95" align="right">
                <template #default="{ row }"><span class="money">{{ money(row.sale_price) }}</span></template>
              </el-table-column>
              <el-table-column label="手续费" width="85" align="right">
                <template #default="{ row }"><span class="money fee-color">{{ money(row.fee) }}</span></template>
              </el-table-column>
              <el-table-column label="净利" width="90" align="right">
                <template #default="{ row }">
                  <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag :type="golfStatusMeta(row.status).type" size="small">{{ golfStatusMeta(row.status).label }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div class="mobile-cards" v-loading="golfLoading">
            <el-empty v-if="!golfRecent.length" description="暂无高尔夫订单" :image-size="60" />
            <div v-for="row in golfRecent" :key="row.id" class="m-card" @click="openGolfDetail(row)">
              <div class="m-title">
                <span class="m-name">{{ row.customer_name }}</span>
                <el-tag :type="golfStatusMeta(row.status).type" size="small">{{ golfStatusMeta(row.status).label }}</el-tag>
              </div>
              <div class="m-sub">{{ row.course_name }}</div>
              <div class="m-line">
                <span class="m-label">日期/人数</span>
                <span class="m-value">{{ row.play_date }} · {{ row.players }}人</span>
              </div>
              <div class="m-line">
                <span class="m-label">金额</span>
                <span class="m-value">
                  <span class="money">{{ money(row.sale_price) }}</span>
                  /
                  <span class="money fee-color">{{ money(row.fee) }}</span>
                  /
                  <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
                </span>
              </div>
            </div>
            <div class="recent-mobile-more">
              <el-button text type="primary" size="small" @click="goGolf">查看全部高尔夫订单</el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- ===== 酒店预定详情（就地只读，数据取 summary 行 + bookingsApi.detail 的 items） ===== -->
    <el-dialog v-model="hotelDetailVisible" title="酒店预定详情" width="640px" class="detail-dialog">
      <div v-loading="hotelDetailLoading" class="detail-body">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态" :span="2">
            <el-tag :type="statusMeta(hotelDetail.status).type" :class="statusMeta(hotelDetail.status).cls" size="small">
              {{ statusMeta(hotelDetail.status).label }}
            </el-tag>
            <span v-if="hotelStep" class="flow-step">（流程第 {{ hotelStep }}/9 步）</span>
          </el-descriptions-item>
          <el-descriptions-item label="客户">{{ hotelDetail.customer_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="酒店">{{ hotelDetail.hotel_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="入住 ~ 离店" :span="2">
            {{ hotelDetail.check_in }} ~ {{ hotelDetail.check_out }}（{{ hotelDetail.nights }}晚，{{ hotelDetail.room_count }}间）
          </el-descriptions-item>
          <el-descriptions-item label="卖价合计">
            <span class="money">{{ money(hotelDetail.sale_total) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="成本合计">
            <span class="money">{{ money(hotelDetail.cost_total) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="手续费">
            <span class="money fee-color">{{ money(hotelDetail.fee) }}</span>
            <span class="flow-step">（费率 {{ feeRatePctText(hotelDetail.fee_rate) }}）</span>
          </el-descriptions-item>
          <el-descriptions-item label="净利">
            <span class="money" :class="profitClass(hotelDetail.profit)">{{ profitText(hotelDetail.profit) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">{{ datetimeText(hotelDetail.order_time) }}</el-descriptions-item>
          <el-descriptions-item label="权益" :span="2">
            {{ hotelDetail.benefit_used ? `已使用 ×${hotelDetail.benefit_count_used || 1}` : '未使用' }}
            <span v-if="hotelDetail.benefit_holder_name">（预订人：{{ hotelDetail.benefit_holder_name }}）</span>
          </el-descriptions-item>
          <el-descriptions-item label="双早">
            {{ hotelDetail.breakfast_included ? '含双早' : '不含' }}
          </el-descriptions-item>
          <el-descriptions-item label="成交渠道">{{ channelText(hotelDetail.channel) }}</el-descriptions-item>
          <el-descriptions-item label="结算">
            <template v-if="hotelDetail.benefit_holder_id">
              {{ hotelDetail.holder_settled ? '已结算' : '未结算' }}
            </template>
            <template v-else>-</template>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ hotelDetail.notes || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 class="detail-items-title">每晚价明细</h4>
        <el-table :data="hotelDetail.items || []" empty-text="无明细" size="small">
          <el-table-column label="#" type="index" width="45" />
          <el-table-column prop="room_type_name" label="房型" min-width="110" />
          <el-table-column label="每晚价" align="right" width="100">
            <template #default="{ row }"><span class="money">{{ money(row.price) }}</span></template>
          </el-table-column>
          <el-table-column :label="`小计（×${hotelDetail.nights || 0}晚）`" align="right" min-width="130">
            <template #default="{ row }">
              <span class="money">{{ money(Number(row.price || 0) * (hotelDetail.nights || 0)) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- ===== 高尔夫订单详情（就地只读，列表行数据已含全部字段） ===== -->
    <el-dialog v-model="golfDetailVisible" title="高尔夫订单详情" width="560px" class="detail-dialog">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="状态">
          <el-tag :type="golfStatusMeta(golfDetail.status).type" size="small">
            {{ golfStatusMeta(golfDetail.status).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="下单时间">{{ datetimeText(golfDetail.order_time) }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ golfDetail.customer_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="球场">{{ golfDetail.course_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="打球日期">
          {{ golfDetail.play_date }}<span v-if="golfDetail.tee_time"> {{ golfDetail.tee_time }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="人数">{{ golfDetail.players || '-' }} 人</el-descriptions-item>
        <el-descriptions-item label="权益种类">
          <el-tag v-if="golfDetail.benefit_type_name" type="warning" size="small">{{ golfDetail.benefit_type_name }}</el-tag>
          <span v-else>{{ golfDetail.benefit_used ? '-' : '未使用' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="预订人">{{ golfDetail.benefit_holder_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="卖价">
          <span class="money">{{ money(golfDetail.sale_price) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="成本">
          <span class="money">{{ money(golfDetail.cost_price) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="手续费">
          <span class="money fee-color">{{ money(golfDetail.fee) }}</span>
          <span class="flow-step">（费率 {{ feeRatePctText(golfDetail.fee_rate) }}）</span>
        </el-descriptions-item>
        <el-descriptions-item label="净利">
          <span class="money" :class="profitClass(golfDetail.profit)">{{ profitText(golfDetail.profit) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="教定位">{{ golfDetail.teach_needed ? '需要教定位' : '不需要' }}</el-descriptions-item>
        <el-descriptions-item label="成交渠道">{{ channelText(golfDetail.channel) }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ golfDetail.notes || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Minus, Plus } from '@element-plus/icons-vue'
// V6 收益图表：echarts 按需引入（禁止全量 import 'echarts'）
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import {
  DataZoomComponent, GridComponent, LegendComponent, TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { bookingsApi, golfOrdersApi, statsApi } from '../api'
import {
  money, profitText, profitClass, datetimeText, statusMeta, statusStep, golfStatusMeta, channelText,
  feeRatePctText,
} from '../utils/format'

echarts.use([BarChart, LineChart, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const router = useRouter()

// ===== 汇总数据（summary：总账 all_* + 分账 hotel/golf + recent_bookings） =====
const summaryLoading = ref(false)
const summary = ref({
  booking_count: 0, total_sale: 0, total_cost: 0, total_profit: 0,
  month_sale: 0, month_profit: 0,
  golf_order_count: 0, golf_total_sale: 0, golf_total_cost: 0, golf_total_profit: 0,
  golf_month_sale: 0, golf_month_profit: 0,
  all_order_count: 0, all_total_sale: 0, all_total_cost: 0, all_total_profit: 0,
  all_month_sale: 0, all_month_profit: 0,
  today_sale: 0, today_cost: 0, today_profit: 0,
  recent_bookings: [],
})

const recentBookings = computed(() => summary.value.recent_bookings || [])

// 利润率显示：后端两位小数数值；兜底 '-'（0 是合法值）
function rateText(rate) {
  return rate === null || rate === undefined || rate === '' ? '-' : `${rate}%`
}

// V7 总账卡组：总营收/总成本/手续费/毛利润/净利润/利润率（all_*，订单口径）
const ledgerCards = computed(() => [
  {
    label: '总营收',
    value: money(summary.value.all_total_sale),
    sub: `${summary.value.all_order_count || 0} 单（酒店+高尔夫）`,
  },
  { label: '总成本', value: money(summary.value.all_total_cost) },
  { label: '手续费', value: money(summary.value.all_total_fee) },
  { label: '毛利润', value: profitText(summary.value.all_gross_profit) },
  {
    label: '净利润',
    value: profitText(summary.value.all_net_profit),
    sub: `毛利 ${money(summary.value.all_gross_profit)} − 手续费 ${money(summary.value.all_total_fee)}`,
    cls: profitClass(summary.value.all_net_profit),
  },
  { label: '利润率', value: rateText(summary.value.all_profit_rate), sub: '净利 / 营收' },
])

// V7 本月卡组（month_all_*，含手动记账）；副行注明口径，手动月收支单独小字
const monthCards = computed(() => [
  { label: '本月营收', value: money(summary.value.month_all_sale), sub: '含手动记账' },
  { label: '本月成本', value: money(summary.value.month_all_cost), sub: '含手动记账' },
  { label: '手续费', value: money(summary.value.month_all_fee) },
  { label: '本月毛利', value: profitText(summary.value.month_all_gross) },
  {
    label: '本月净利',
    value: profitText(summary.value.month_all_net),
    cls: profitClass(summary.value.month_all_net),
  },
  {
    label: '利润率',
    value: rateText(summary.value.month_all_rate),
    sub: `手动：收入 ${money(summary.value.manual_month_income)} / 支出 ${money(summary.value.manual_month_expense)}`,
  },
])

// ===== 收益趋势 =====
const TREND_LIMITS = { day: 30, week: 12, month: 12, year: 3 }
const trendBucket = ref('day')
const trendBiz = ref('all') // all | hotel | golf
const trendMetric = ref('sale') // sale | profit
const trendLoading = ref(false)
const trendCache = ref({}) // bucket → items（一次拉取，业务/指标切换不重拉）
const chartEl = ref(null)
let chart = null
let resizeObserver = null
let resizeTimer = null

const HOTEL_COLOR = '#409EFF'
const GOLF_COLOR = '#67C23A'

function round2(v) {
  return Math.round(Number(v || 0) * 100) / 100
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

// MySQL %x-W%v 同口径 ISO 周标签（ISO 年-周，周日为一周最后一天）
function isoWeekLabel(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (t.getDay() + 6) % 7 // 周一=0 … 周日=6
  t.setDate(t.getDate() - day + 3) // 定位到本周四
  const isoYear = t.getFullYear()
  const jan4 = new Date(isoYear, 0, 4) // 1月4日必在第 1 周
  const jan4Day = (jan4.getDay() + 6) % 7
  jan4.setDate(jan4.getDate() - jan4Day + 3) // 第 1 周的周四
  const week = 1 + Math.round((t - jan4) / (7 * 864e5))
  return `${isoYear}-W${pad2(week)}`
}

// 生成默认周期区间（以当前周期收尾）；后端只返回有数据的周期，缺的由前端补 0
function genLabels(bucket, limit) {
  const now = new Date()
  const out = []
  if (bucket === 'day') {
    for (let i = limit - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`)
    }
  } else if (bucket === 'week') {
    for (let i = limit - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7)
      out.push(isoWeekLabel(d))
    }
  } else if (bucket === 'month') {
    for (let i = limit - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
    }
  } else {
    for (let i = limit - 1; i >= 0; i--) out.push(String(now.getFullYear() - i))
  }
  return out
}

// 补 0 + 合并窗口外仍有数据的周期（后端按 lookback 窗口过滤，可能含未来单）
// V7：利润=净利 = sale − cost − fee（trend items 已含 hotel_fee/golf_fee）
const trendRows = computed(() => {
  const bucket = trendBucket.value
  const items = trendCache.value[bucket] || []
  const labels = new Set(genLabels(bucket, TREND_LIMITS[bucket]))
  for (const it of items) if (it.period) labels.add(it.period)
  const map = new Map(items.map((it) => [it.period, it]))
  return [...labels].sort().map((period) => {
    const it = map.get(period) || {}
    const hotelSale = Number(it.hotel_sale || 0)
    const hotelCost = Number(it.hotel_cost || 0)
    const hotelFee = Number(it.hotel_fee || 0)
    const golfSale = Number(it.golf_sale || 0)
    const golfCost = Number(it.golf_cost || 0)
    const golfFee = Number(it.golf_fee || 0)
    return {
      period,
      hotel_sale: round2(hotelSale),
      hotel_profit: round2(hotelSale - hotelCost - hotelFee),
      golf_sale: round2(golfSale),
      golf_profit: round2(golfSale - golfCost - golfFee),
    }
  })
})

async function loadTrend(bucket) {
  if (trendCache.value[bucket]) return
  trendLoading.value = true
  try {
    const r = await statsApi.trend({ bucket, limit: TREND_LIMITS[bucket] })
    trendCache.value = { ...trendCache.value, [bucket]: r.items || [] }
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    trendLoading.value = false
  }
}

function onBucketChange(bucket) {
  loadTrend(bucket)
}

// tooltip：跟随业务线选择——全部=酒店/高尔夫/合计；单一业务=只显示所选线的收入与利润
function trendTooltipFormatter(params) {
  const row = trendRows.value[params?.[0]?.dataIndex]
  if (!row) return ''
  const profitY = (v) => `${v > 0 ? '+' : ''}¥${Number(v).toFixed(2)}`
  const line = (label, text, strong) =>
    `<div style="display:flex;justify-content:space-between;gap:20px;line-height:1.8">` +
    `<span style="color:#606266">${label}</span>` +
    `<span style="font-weight:${strong ? 600 : 400};font-variant-numeric:tabular-nums">${text}</span></div>`
  const head = (text) =>
    `<div style="color:#909399;font-size:12px;margin:3px 0 1px">${text}</div>`
  const biz = trendBiz.value
  const saleRows = []
  const profitRows = []
  if (biz === 'hotel') {
    saleRows.push(line('收入', money(row.hotel_sale), true))
    profitRows.push(line('净利', profitY(row.hotel_profit), true))
  } else if (biz === 'golf') {
    saleRows.push(line('收入', money(row.golf_sale), true))
    profitRows.push(line('净利', profitY(row.golf_profit), true))
  } else {
    saleRows.push(
      line('酒店', money(row.hotel_sale)),
      line('高尔夫', money(row.golf_sale)),
      line('合计', money(round2(row.hotel_sale + row.golf_sale)), true),
    )
    profitRows.push(
      line('酒店净利', profitY(row.hotel_profit)),
      line('高尔夫净利', profitY(row.golf_profit)),
      line('合计净利', profitY(round2(row.hotel_profit + row.golf_profit)), true),
    )
  }
  return (
    `<div style="min-width:190px">` +
    `<div style="font-weight:600;margin-bottom:2px;color:#303133">${row.period}</div>` +
    (biz === 'all' ? head('收入') : '') +
    saleRows.join('') +
    (biz === 'all' ? head('净利') : '') +
    profitRows.join('') +
    `</div>`
  )
}

function renderTrend() {
  if (!chart) return
  const rows = trendRows.value
  const periods = rows.map((r) => r.period)
  const isSale = trendMetric.value === 'sale'
  const lines = trendBiz.value === 'all' ? ['hotel', 'golf'] : [trendBiz.value]
  const series = lines.map((key) => {
    const meta = key === 'hotel'
      ? { name: '酒店', color: HOTEL_COLOR }
      : { name: '高尔夫', color: GOLF_COLOR }
    const data = rows.map((r) => (isSale ? r[`${key}_sale`] : r[`${key}_profit`]))
    if (isSale) {
      return {
        name: meta.name, type: 'bar', data,
        barMaxWidth: 26,
        itemStyle: { color: meta.color, borderRadius: [3, 3, 0, 0] },
      }
    }
    return {
      name: meta.name, type: 'line', data, smooth: true,
      symbol: 'circle', symbolSize: 6,
      lineStyle: { width: 2.5 }, itemStyle: { color: meta.color },
      areaStyle: { color: meta.color, opacity: 0.08 },
    }
  })

  // 窄屏 + 周期多（按日 30 点）：图表容器内横滑（inside 缩放拖动 + 底部滑条，默认看最近 10 期）
  const narrow = chartEl.value ? chartEl.value.clientWidth < 768 : false
  const useSlider = narrow && periods.length > 12
  const sliderStart = useSlider ? Math.max(0, Math.round(100 - (10 / periods.length) * 100)) : 0
  // 注意：同轴多 dataZoom 时窗口取第一个组件的 start/end，故 inside 与 slider 需同参
  const zoomWindow = useSlider ? { start: sliderStart, end: 100 } : {}
  hasSlider.value = useSlider
  defaultZoom.value = { start: sliderStart, end: 100 }

  chart.setOption(
    {
      grid: { left: 6, right: 10, top: 34, bottom: useSlider ? 32 : 8, containLabel: true },
      legend: {
        top: 4, left: 0, itemWidth: 14, itemHeight: 9, itemGap: 16,
        textStyle: { color: '#606266', fontSize: 12 },
      },
      tooltip: {
        trigger: 'axis',
        className: 'v6-trend-tooltip',
        confine: true,
        axisPointer: { type: isSale ? 'shadow' : 'line' },
        formatter: trendTooltipFormatter,
      },
      xAxis: {
        type: 'category',
        data: periods,
        axisLine: { lineStyle: { color: '#dcdfe6' } },
        axisTick: { show: false },
        axisLabel: { hideOverlap: true, fontSize: 10, color: '#909399' },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 10, color: '#909399',
          formatter: (v) => (Math.abs(v) >= 1000 ? `${round2(v / 1000)}k` : `${v}`),
        },
        splitLine: { lineStyle: { color: '#f0f2f5' } },
      },
      dataZoom: useSlider
        ? [
            { type: 'inside', ...zoomWindow },
            { type: 'slider', height: 16, bottom: 2, ...zoomWindow },
          ]
        : [{ type: 'inside' }],
      series,
    },
    { notMerge: true },
  )
}

watch(trendRows, () => renderTrend())
watch([trendBiz, trendMetric], () => renderTrend())

// ===== 图表缩放控件（◀ ▶ 平移、＋ − 缩放、满屏复位；兼容鼠标拖拽/滚轮） =====
const hasSlider = ref(false)
const defaultZoom = ref({ start: 0, end: 100 })

function currentZoom() {
  if (!chart) return { start: 0, end: 100 }
  const dz = chart.getOption().dataZoom
  return dz && dz[0] ? { start: dz[0].start, end: dz[0].end } : { start: 0, end: 100 }
}

function applyZoom(start, end) {
  if (!chart) return
  const s = Math.max(0, Math.min(100, start))
  const e = Math.max(s + 5, Math.min(100, end))
  chart.dispatchAction({ type: 'dataZoom', start: s, end: e })
  if (hasSlider.value) chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 1, start: s, end: e })
}

function zoomPan(dir) {
  const { start, end } = currentZoom()
  const span = end - start
  const step = Math.max(5, Math.round(span * 0.25))
  let s = start + dir * step
  let e = end + dir * step
  if (e > 100) { e = 100; s = 100 - span }
  if (s < 0) { s = 0; e = span }
  applyZoom(s, e)
}

function zoomScale(dir) {
  const { start, end } = currentZoom()
  const span = end - start
  const center = (start + end) / 2
  const newSpan = dir > 0 ? Math.max(10, span * 0.7) : Math.min(100, span * 1.4)
  let s = center - newSpan / 2
  let e = center + newSpan / 2
  if (s < 0) { s = 0; e = newSpan }
  if (e > 100) { e = 100; s = 100 - newSpan }
  applyZoom(Math.round(s), Math.round(e))
}

function resetZoom() {
  applyZoom(defaultZoom.value.start, defaultZoom.value.end)
}

function onContainerResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    if (chart) {
      chart.resize()
      renderTrend()
    }
  }, 120)
}

// ===== 最近订单（酒店 summary.recent_bookings / 高尔夫 golfOrdersApi.list） =====
const recentTab = ref('hotel')
const golfLoading = ref(false)
const golfRecent = ref([])

// ===== 详情弹窗（就地只读，不跳路由） =====
const hotelDetailVisible = ref(false)
const hotelDetailLoading = ref(false)
const hotelDetail = ref({})
const hotelStep = computed(() => statusStep(hotelDetail.value.status))

async function openHotelDetail(row) {
  hotelDetail.value = { ...row }
  hotelDetailVisible.value = true
  hotelDetailLoading.value = true
  try {
    // 明细（房型/每晚价）不在 summary 行数据里，需拉 bookingsApi.detail
    const d = await bookingsApi.detail(row.id)
    hotelDetail.value = { ...row, ...d }
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    hotelDetailLoading.value = false
  }
}

const golfDetailVisible = ref(false)
const golfDetail = ref({})

function openGolfDetail(row) {
  golfDetail.value = row
  golfDetailVisible.value = true
}

function goBookings() {
  router.push('/bookings')
}

function goGolf() {
  router.push('/golf')
}

function goAll() {
  router.push(recentTab.value === 'hotel' ? '/bookings' : '/golf')
}

onMounted(async () => {
  // 图表初始化（容器渲染后）+ 尺寸监听
  await nextTick()
  if (chartEl.value) {
    chart = echarts.init(chartEl.value)
    resizeObserver = new ResizeObserver(onContainerResize)
    resizeObserver.observe(chartEl.value)
    renderTrend() // 先渲染空轴，数据到达后由 trendRows watcher 重绘
  }
  loadTrend(trendBucket.value)

  summaryLoading.value = true
  golfLoading.value = true
  try {
    const [s, g] = await Promise.all([
      statsApi.summary(),
      golfOrdersApi.list({ page: 1, page_size: 5 }),
    ])
    summary.value = s
    golfRecent.value = g.items || []
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    summaryLoading.value = false
    golfLoading.value = false
  }
})

onBeforeUnmount(() => {
  if (resizeTimer) clearTimeout(resizeTimer)
  if (resizeObserver) resizeObserver.disconnect()
  if (chart) {
    chart.dispose()
    chart = null
  }
})
</script>

<style scoped>
/* ===== 1. 卡组：分区标题 + 自适应列（6~7 卡自动铺满，桌面 6 列，窄屏换行） ===== */
.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 2px 0 8px;
}

.section-label:first-child {
  margin-top: 0;
}

.section-tag {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}

.ledger-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.ledger-grid + .section-label {
  margin-top: 16px;
}

.stat-card {
  text-align: center;
}

.stat-label {
  font-size: 13px;
  color: #909399;
}

.stat-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  font-variant-numeric: tabular-nums;
}

.stat-value.big {
  font-size: 26px;
}

.stat-value.positive,
.money-profit.positive {
  color: #67c23a;
}

.stat-value.negative,
.money-profit.negative {
  color: #f56c6c;
}

.stat-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

/* ===== 2. 分账两区块 ===== */
.split-row {
  margin-top: 16px;
}

.biz-card {
  margin-bottom: 16px;
}

.biz-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.biz-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.biz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
  gap: 8px;
  text-align: center;
}

.biz-item .stat-value {
  font-size: 16px;
}

/* ===== 3. 收益趋势 ===== */
.trend-card {
  margin-top: 0;
}

/* 手续费金额弱化色（与列表 money-fee 一致） */
.fee-color {
  color: #e6a23c;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.trend-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin-bottom: 10px;
}

.trend-wrap {
  width: 100%;
}

.trend-chart {
  width: 100%;
  height: 260px;
}

/* ===== 4. 最近订单 ===== */
.recent-card {
  margin-top: 16px;
}

.recent-card :deep(.el-tabs__header) {
  margin-bottom: 8px;
}

.click-table :deep(.el-table__row) {
  cursor: pointer;
}

.recent-mobile-more {
  text-align: center;
}

/* ===== 详情弹窗 ===== */
.detail-items-title {
  margin: 14px 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.flow-step {
  margin-left: 6px;
  font-size: 12px;
  color: #909399;
}

/* ===== 移动端（<768px）：卡组堆叠 / 控件换行 / 图表容器内横滑 ===== */
@media (max-width: 767px) {
  .ledger-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .stat-value.big {
    font-size: 20px;
  }

  .biz-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .m-card {
    cursor: pointer;
  }

  .el-card {
    --el-card-padding: 12px;
  }
}
</style>
