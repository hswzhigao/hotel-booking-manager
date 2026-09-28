<template>
  <div class="page-card">
    <!-- 筛选区 -->
    <el-card shadow="never">
      <div class="page-toolbar desktop-toolbar">
        <el-select v-model="filters.customer_id" placeholder="客户" clearable filterable style="width: 150px">
          <el-option v-for="c in customerOptions" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
        <el-select v-model="filters.benefit_holder_id" placeholder="预订人" clearable filterable style="width: 150px">
          <el-option v-for="h in holderOptions" :key="h.id" :label="h.name" :value="h.id" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 120px">
          <el-option v-for="(m, k) in GOLF_STATUS_MAP" :key="k" :label="m.label" :value="k" />
        </el-select>
        <el-date-picker
          v-model="filters.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="打球起"
          end-placeholder="打球止"
          style="width: 240px"
        />
        <el-input
          v-model="filters.search"
          placeholder="客户名 / 球场名关键词"
          clearable
          style="width: 190px"
          @keyup.enter="loadList(1)"
        />
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建订单</el-button>
      </div>

      <!-- 移动端工具栏 -->
      <div class="mobile-toolbar">
        <el-input
          v-model="filters.search"
          class="toolbar-search"
          placeholder="客户名 / 球场名关键词"
          clearable
          @keyup.enter="loadList(1)"
        />
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="filtersExpanded = !filtersExpanded">
          {{ filtersExpanded ? '收起筛选' : '筛选' }}
        </el-button>
        <el-button type="primary" :icon="Plus" circle title="新建订单" @click="openCreate" />
        <div v-show="filtersExpanded" class="filter-extra">
          <el-select v-model="filters.customer_id" placeholder="客户" clearable filterable>
            <el-option v-for="c in customerOptions" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
          <el-select v-model="filters.benefit_holder_id" placeholder="预订人" clearable filterable>
            <el-option v-for="h in holderOptions" :key="h.id" :label="h.name" :value="h.id" />
          </el-select>
          <el-select v-model="filters.status" placeholder="状态" clearable>
            <el-option v-for="(m, k) in GOLF_STATUS_MAP" :key="k" :label="m.label" :value="k" />
          </el-select>
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="打球起"
            end-placeholder="打球止"
          />
          <el-button @click="resetFilters">重置</el-button>
          
        </div>
      </div>

      <!-- 列表：桌面表格 / 移动卡片 -->
      <div class="desktop-table">
      <el-table :data="rows" v-loading="loading" empty-text="暂无高尔夫订单">
        <el-table-column label="下单时间" width="160">
          <template #default="{ row }">{{ datetimeText(row.order_time) }}</template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" min-width="90" />
        <el-table-column label="预订人" width="95">
          <template #default="{ row }">{{ row.benefit_holder_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="course_name" label="球场" min-width="150" show-overflow-tooltip />
        <el-table-column label="打球日期" width="105">
          <template #default="{ row }">{{ dateText(row.play_date) }}</template>
        </el-table-column>
        <el-table-column prop="players" label="人数" width="60" align="center" />
        <el-table-column label="权益种类" min-width="105">
          <template #default="{ row }">
            <el-tag v-if="row.benefit_type_name" type="warning" size="small">{{ row.benefit_type_name }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="卖价" width="95" align="right">
          <template #default="{ row }"><span class="money money-revenue">{{ money(row.sale_price) }}</span></template>
        </el-table-column>
        <el-table-column label="成本" width="95" align="right">
          <template #default="{ row }"><span class="money">{{ money(row.cost_price) }}</span></template>
        </el-table-column>
        <el-table-column label="手续费" width="85" align="right">
          <template #default="{ row }"><span class="money money-fee">{{ money(row.fee) }}</span></template>
        </el-table-column>
        <el-table-column label="净利" width="90" align="right">
          <template #default="{ row }">
            <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="教定位" width="75" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.teach_needed" type="warning" size="small">教定位</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="105">
          <template #default="{ row }">
            <!-- V7 内联改状态：点徽标展开全部状态，选中即保存（权益流转由后端 PUT 处理） -->
            <el-dropdown trigger="click" @command="(s) => onInlineStatusChange(row, s)">
              <el-tag :type="golfStatusMeta(row.status).type" size="small" class="status-toggle">
                {{ golfStatusMeta(row.status).label }}<el-icon class="status-caret"><ArrowDown /></el-icon>
              </el-tag>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="(m, k) in GOLF_STATUS_MAP"
                    :key="k"
                    :command="k"
                    :disabled="k === row.status"
                  >{{ m.label }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <el-table-column label="渠道" width="70" align="center">
          <template #default="{ row }">{{ channelText(row.channel) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button text type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <!-- 移动端卡片列表 -->
      <div class="mobile-cards" v-loading="loading">
        <el-empty v-if="!rows.length" description="暂无高尔夫订单" :image-size="60" />
        <div v-for="row in rows" :key="row.id" class="m-card">
          <div class="m-title">
            <span class="m-name">{{ row.customer_name }}</span>
            <el-tag :type="golfStatusMeta(row.status).type" size="small">
              {{ golfStatusMeta(row.status).label }}
            </el-tag>
          </div>
          <div class="m-sub">{{ row.course_name }}</div>
          <div class="m-line">
            <span class="m-label">日期/人数</span>
            <span class="m-value">{{ dateText(row.play_date) }} · {{ row.players }}人</span>
          </div>
          <div class="m-line">
            <span class="m-label">卖价/成本</span>
            <span class="m-value">
              <span class="money money-revenue">{{ money(row.sale_price) }}</span>
              /
              <span class="money">{{ money(row.cost_price) }}</span>
            </span>
          </div>
          <div class="m-line">
            <span class="m-label">手续费/净利</span>
            <span class="m-value">
              <span class="money money-fee">{{ money(row.fee) }}</span>
              /
              <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
            </span>
          </div>
          <div class="m-line">
            <span class="m-label">权益</span>
            <span class="m-value">
              <el-tag v-if="row.benefit_type_name" type="warning" size="small">{{ row.benefit_type_name }}</el-tag>
              <span v-else>-</span>
              <span v-if="row.benefit_holder_name"> · {{ row.benefit_holder_name }}</span>
              <el-tag v-if="row.teach_needed" type="warning" size="small" class="due-tag">教定位</el-tag>
            </span>
          </div>
          <div class="m-actions">
            <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button text type="danger" size="small" @click="onDelete(row)">删除</el-button>
            <!-- 移动端改状态：ActionSheet 式下拉 -->
            <el-dropdown trigger="click" class="m-status-dd" @command="(s) => onInlineStatusChange(row, s)">
              <el-button text type="primary" size="small">改状态</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="(m, k) in GOLF_STATUS_MAP"
                    :key="k"
                    :command="k"
                    :disabled="k === row.status"
                  >{{ m.label }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next, sizes"
        :total="total"
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </el-card>

    <!-- 新建/编辑抽屉 -->
    <el-drawer
      v-model="formVisible"
      :title="form.id ? '编辑高尔夫订单' : '新建高尔夫订单'"
      size="600px"
      destroy-on-close
    >
      <el-alert
        v-if="availabilityAlert"
        :title="availabilityAlert"
        type="warning"
        show-icon
        :closable="false"
        class="match-alert"
      />

      <el-form ref="formRef" :model="form" :rules="formRules" label-width="92px">
        <el-form-item label="客户" prop="customer_id">
          <el-select v-model="form.customer_id" placeholder="选择客户" filterable style="width: 100%">
            <el-option v-for="c in customerOptions" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="球场" prop="course_name">
          <el-select
            v-model="form.course_name"
            placeholder="选择或输入球场名称"
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option v-for="c in courseOptions" :key="c" :label="c" :value="c" />
          </el-select>
          <div class="field-tip">预设上海两个球场，也可输入新球场；历史打过的球场会自动出现在下拉中</div>
        </el-form-item>
        <el-form-item label="预订人">
          <el-select
            v-model="form.benefit_holder_id"
            placeholder="选择出权益的预订人（可空）"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option v-for="h in holderOptions" :key="h.id" :value="h.id" :label="h.name">
              <div class="holder-option">
                <span>{{ h.name }}</span>
                <span class="holder-meta">
                  <el-tag v-if="h.provides_golf" type="primary" size="small">出高尔夫</el-tag>
                  <el-tag :type="availabilityMeta(h.availability).type" size="small">
                    {{ availabilityMeta(h.availability).label }}
                  </el-tag>
                  <el-tag type="success" size="small">高尔夫 {{ holderGolfTotal(h) }} 次</el-tag>
                </span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="打球日期" prop="play_date">
          <el-date-picker
            v-model="form.play_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择打球日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="开球时间">
          <el-time-picker
            v-model="form.tee_time"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选填"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="人数">
          <el-input-number v-model="form.players" :min="1" :max="99" :step="1" />
        </el-form-item>

        <el-form-item label="消耗权益">
          <div class="benefit-block">
            <el-checkbox v-model="form.benefit_used">消耗高尔夫权益</el-checkbox>
            <template v-if="form.benefit_used">
              <el-select
                v-model="form.benefit_type_id"
                :disabled="!form.course_name"
                :placeholder="form.course_name ? '选择权益种类' : '请先选择球场'"
                style="width: 100%"
              >
                <el-option
                  v-for="b in applicableTypes"
                  :key="b.benefit_type_id"
                  :label="`${b.type_name}（剩余 ${b.count_left} 次）`"
                  :value="b.benefit_type_id"
                />
              </el-select>
              <div v-if="form.course_name && selectedHolder && !applicableTypes.length" class="field-tip danger-tip">
                该预订人在「{{ form.course_name }}」没有可用的高尔夫权益种类（可更换球场或预订人）
              </div>
              <div v-else-if="!selectedHolder" class="field-tip danger-tip">
                使用高尔夫权益需选择预订人
              </div>
              <div v-else class="field-tip">
                仅显示该预订人持有且适用「{{ form.course_name || '所选球场' }}」的种类
              </div>
            </template>
          </div>
        </el-form-item>

        <el-form-item label="教定位">
          <el-switch v-model="form.teach_needed" active-text="需要教定位" />
        </el-form-item>
        <el-form-item label="卖价">
          <el-input-number v-model="form.sale_price" :min="0" :precision="2" :step="50" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="成本">
          <el-input-number v-model="form.cost_price" :min="0" :precision="2" :step="50" :controls="false" style="width: 100%" />
        </el-form-item>
        <!-- V7 手续费率：默认 渠道=闲鱼→1.6% 其他→0；切渠道时未手动改过则跟随默认 -->
        <el-form-item label="手续费率">
          <el-input-number
            v-model="form.fee_rate_pct"
            :min="0"
            :max="50"
            :precision="1"
            :step="0.1"
            :controls="false"
            placeholder="0-50"
            style="width: 120px"
            @change="onFeeRateManualChange"
          />
          <span class="fee-unit">%</span>
          <span class="nights-tip">
            手续费：<b class="money">{{ money(formFeeAmount) }}</b>（卖价 × 费率）
          </span>
          <div class="field-tip">预计净利：{{ profitText(formNetProfit) }}（卖价 − 成本 − 手续费）</div>
        </el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="form.channel" style="width: 140px" @change="onChannelChange">
            <el-option v-for="(m, k) in CHANNEL_MAP" :key="k" :label="m" :value="k" />
          </el-select>
          <div class="field-tip">闲鱼渠道手续费率默认 1.6%，其他渠道默认 0%</div>
        </el-form-item>
        <el-form-item label="下单时间" prop="order_time">
          <el-date-picker
            v-model="form.order_time"
            type="datetime"
            placeholder="下单时间（默认当前）"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 140px">
            <el-option v-for="(m, k) in GOLF_STATUS_MAP" :key="k" :label="m.label" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, ArrowDown } from '@element-plus/icons-vue'
import { golfOrdersApi, customersApi, benefitHoldersApi , optionDictApi} from '../api'
import {
  money, profitText, profitClass, revenueClass, dateText, datetimeText,
  toDatetimeString, parseDatetime, isWeekend,
  golfStatusMeta, GOLF_STATUS_MAP, channelText, CHANNEL_MAP, availabilityMeta,
  defaultFeeRatePct,
} from '../utils/format'

// 球场来源：基础配置-球场字典（golf_course）∪ 历史订单球场（golf-orders/courses）
const dictCourses = ref([])

// ===== 下拉选项 =====
const customerOptions = ref([])
const holderOptions = ref([])
const historyCourses = ref([])

async function loadOptions() {
  try {
    const [cs, hs, courses, dc] = await Promise.all([
      customersApi.list({ page: 1, page_size: 100 }),
      benefitHoldersApi.list({ page: 1, page_size: 200 }),
      golfOrdersApi.courses(),
      optionDictApi.list({ category: 'golf_course' }).catch(() => []),
    ])
    customerOptions.value = cs.items || []
    holderOptions.value = (hs.items || []).map((h) => ({ ...h, provides_golf: h.provides_golf ?? 1 }))
    historyCourses.value = Array.isArray(courses) ? courses : []
    dictCourses.value = (Array.isArray(dc) ? dc : (dc.items || [])).map((x) => x.label)
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

const courseOptions = computed(() => {
  const set = new Set(dictCourses.value)
  historyCourses.value.forEach((c) => set.add(c))
  return [...set]
})

function holderGolfTotal(h) {
  if (h.golf_benefit_total !== undefined && h.golf_benefit_total !== null) return h.golf_benefit_total
  return (h.golf_benefits || []).reduce((s, b) => s + Number(b.count_left || 0), 0)
}

// ===== 列表 =====
// 移动端筛选折叠开关（桌面端由 CSS display:contents 还原平铺，不受影响）
const filtersExpanded = ref(false)

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({
  customer_id: null,
  benefit_holder_id: null,
  status: null,
  dateRange: null,
  search: '',
})

async function loadList(p = page.value) {
  loading.value = true
  try {
    const data = await golfOrdersApi.list({
      page: p,
      page_size: pageSize.value,
      customer_id: filters.customer_id || undefined,
      benefit_holder_id: filters.benefit_holder_id || undefined,
      status: filters.status || undefined,
      date_from: filters.dateRange?.[0] || undefined,
      date_to: filters.dateRange?.[1] || undefined,
      search: filters.search || undefined,
    })
    rows.value = data.items || []
    total.value = data.total || 0
    page.value = p
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.customer_id = null
  filters.benefit_holder_id = null
  filters.status = null
  filters.dateRange = null
  filters.search = ''
  loadList(1)
}

function onPageChange(p) {
  loadList(p)
}

function onSizeChange(size) {
  pageSize.value = size
  loadList(1)
}

// ===== 新建/编辑表单 =====
const formVisible = ref(false)
const formRef = ref(null)
const saving = ref(false)

const emptyForm = () => ({
  id: null,
  customer_id: null,
  benefit_holder_id: null,
  benefit_type_id: null,
  course_name: '',
  play_date: '',
  tee_time: null,
  players: 1,
  benefit_used: true,
  teach_needed: false,
  sale_price: null,
  cost_price: null,
  channel: 'xianyu',
  fee_rate_pct: defaultFeeRatePct('xianyu'), // V7：百分比展示值（1.6 = 1.6%）
  order_time: new Date(),
  status: 'pending',
  notes: '',
})

const form = reactive(emptyForm())

// V7 手续费率默认逻辑：切换渠道时若用户未手动改过，则跟随默认（闲鱼 1.6 / 其他 0）
const feeRateTouched = ref(false)

function onFeeRateManualChange() {
  feeRateTouched.value = true
}

function onChannelChange() {
  if (!feeRateTouched.value) {
    form.fee_rate_pct = defaultFeeRatePct(form.channel)
  }
}

// 手续费金额（表单实时估算）与预计净利
const formFeeAmount = computed(() =>
  Math.round(Number(form.sale_price || 0) * (Number(form.fee_rate_pct || 0) / 100) * 100) / 100,
)
const formNetProfit = computed(() =>
  Number(form.sale_price || 0) - Number(form.cost_price || 0) - formFeeAmount.value,
)

// fee_rate 载荷值：百分比 → 小数（0~0.5）
function feeRatePayload() {
  const pct = Number(form.fee_rate_pct || 0)
  return Math.round(Math.min(Math.max(pct, 0), 50) * 100) / 10000
}

const formRules = {
  customer_id: [{ required: true, message: '请选择客户', trigger: 'change' }],
  course_name: [{ required: true, message: '请选择球场', trigger: 'change' }],
  play_date: [{ required: true, message: '请选择打球日期', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

const selectedHolder = computed(() =>
  holderOptions.value.find((h) => h.id === form.benefit_holder_id) || null,
)

// 权益种类下拉：只显示该预订人持有（count_left>0）且适用所选球场的种类
const applicableTypes = computed(() => {
  if (!selectedHolder.value) return []
  const course = String(form.course_name || '').trim()
  if (!course) return []
  return (selectedHolder.value.golf_benefits || []).filter((b) => {
    if (Number(b.count_left) <= 0) return false
    if (!b.course_scope || b.course_scope === 'all') return true
    return b.course_scope.split(',').map((s) => s.trim()).includes(course)
  })
})

// 球场或预订人变化后，已选种类若不再适用则清空
watch(
  () => [form.course_name, form.benefit_holder_id],
  () => {
    if (form.benefit_type_id && !applicableTypes.value.some((b) => b.benefit_type_id === form.benefit_type_id)) {
      form.benefit_type_id = null
    }
  },
)

// 可用时间匹配警示：周末打球 + 仅工作日 / 工作日打球 + 仅周末
const availabilityAlert = computed(() => {
  const holder = selectedHolder.value
  if (!holder || !form.play_date) return ''
  const weekend = isWeekend(form.play_date)
  if (weekend && holder.availability === 'weekday_only') return '该预订人仅工作日可用，而打球日期是周末'
  if (!weekend && holder.availability === 'weekend_only') return '该预订人仅周末有空出权益，而打球日期是工作日'
  return ''
})

function openCreate() {
  Object.assign(form, emptyForm())
  feeRateTouched.value = false
  formVisible.value = true
}

async function openEdit(row) {
  try {
    const d = await golfOrdersApi.detail(row.id)
    Object.assign(form, emptyForm(), {
      id: d.id,
      customer_id: d.customer_id,
      benefit_holder_id: d.benefit_holder_id || null,
      benefit_type_id: d.benefit_type_id || null,
      course_name: d.course_name || '',
      play_date: dateText(d.play_date),
      tee_time: d.tee_time || null,
      players: Number(d.players || 1),
      benefit_used: !!d.benefit_used,
      teach_needed: !!d.teach_needed,
      sale_price: Number(d.sale_price || 0),
      cost_price: Number(d.cost_price || 0),
      channel: d.channel || 'xianyu',
      fee_rate_pct: Math.round(Number(d.fee_rate || 0) * 10000) / 100,
      order_time: parseDatetime(d.order_time),
      status: d.status || 'pending',
      notes: d.notes || '',
    })
    feeRateTouched.value = false
    formVisible.value = true
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

// 详情 → 全量 PUT 载荷（后端 PUT 需提交所有字段；fee_rate 不传会被后端按渠道默认重置，故必须带上）
function payloadFromDetail(d, override = {}) {
  return {
    customer_id: d.customer_id,
    benefit_holder_id: d.benefit_holder_id ?? null,
    benefit_type_id: d.benefit_type_id ?? null,
    course_name: String(d.course_name || '').trim(),
    play_date: dateText(d.play_date),
    tee_time: d.tee_time || '',
    players: Number(d.players || 1),
    status: d.status,
    teach_needed: d.teach_needed ? 1 : 0,
    sale_price: Number(d.sale_price || 0),
    cost_price: Number(d.cost_price || 0),
    channel: d.channel || 'xianyu',
    fee_rate: Number(d.fee_rate || 0),
    benefit_used: d.benefit_used ? 1 : 0,
    order_time: d.order_time ? toDatetimeString(d.order_time) : '',
    notes: d.notes || '',
    ...override,
  }
}

// V7 列表内改状态：拉详情 → 替换 status → 全量 PUT（权益流转由后端处理）
// 乐观更新行内状态，失败回滚（错误文案由拦截器 toast）；成功后重拉列表核对
async function onInlineStatusChange(row, status) {
  if (status === row.status) return
  const prev = row.status
  row.status = status // 乐观更新
  try {
    const d = await golfOrdersApi.detail(row.id)
    await golfOrdersApi.update(row.id, payloadFromDetail(d, { status }))
    ElMessage.success(`状态已改为「${golfStatusMeta(status).label}」`)
    await loadList() // 重拉核对（权益流转由后端处理，行内衍生字段以服务端为准）
  } catch (e) {
    row.status = prev // 回滚
  }
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (form.benefit_used) {
    if (!form.benefit_holder_id) {
      ElMessage.warning('使用高尔夫权益需选择预订人')
      return
    }
    if (!form.benefit_type_id) {
      ElMessage.warning('使用高尔夫权益需选择权益种类')
      return
    }
  }
  const payload = {
    customer_id: form.customer_id,
    benefit_holder_id: form.benefit_holder_id ?? null,
    benefit_type_id: form.benefit_used ? form.benefit_type_id : null,
    course_name: String(form.course_name || '').trim(),
    play_date: form.play_date,
    tee_time: form.tee_time || '',
    players: form.players || 1,
    status: form.status,
    teach_needed: form.teach_needed ? 1 : 0,
    sale_price: Number(form.sale_price || 0),
    cost_price: Number(form.cost_price || 0),
    channel: form.channel,
    fee_rate: feeRatePayload(),
    benefit_used: form.benefit_used ? 1 : 0,
    order_time: toDatetimeString(form.order_time),
    notes: form.notes || '',
  }
  saving.value = true
  try {
    if (form.id) {
      await golfOrdersApi.update(form.id, payload)
      ElMessage.success('高尔夫订单已更新')
    } else {
      await golfOrdersApi.create(payload)
      ElMessage.success('高尔夫订单已创建')
    }
    formVisible.value = false
    await loadList()
    loadOptions()
  } catch (e) {
    // 400（如「该权益不能在XX球场使用」「权益次数不足」）等错误提示已由拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${row.customer_name} - ${row.course_name}」的高尔夫订单吗？删除后将返还已消耗的高尔夫权益。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    return
  }
  try {
    await golfOrdersApi.remove(row.id)
    ElMessage.success('高尔夫订单已删除')
    await loadList()
    loadOptions()
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

onMounted(() => {
  loadOptions()
  loadList(1)
})
</script>

<style scoped>
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

.match-alert {
  margin-bottom: 16px;
}

.field-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 4px;
  width: 100%;
}

.danger-tip {
  color: #f56c6c;
}

.fee-unit {
  margin-left: 6px;
  font-size: 13px;
  color: #606266;
}

.nights-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}

.holder-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.holder-meta {
  display: flex;
  align-items: center;
  gap: 4px;
}

.benefit-block {
  width: 100%;
}

.benefit-block .el-select {
  margin-top: 6px;
}
</style>
