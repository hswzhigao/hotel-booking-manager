<template>
  <div class="page-card">
    <!-- 筛选区 -->
    <el-card shadow="never">
      <div class="page-toolbar">
        <el-select
          v-model="filters.customer_id"
          placeholder="客户"
          clearable
          filterable
          style="width: 160px"
        >
          <el-option
            v-for="c in customerOptions"
            :key="c.id"
            :label="c.name"
            :value="c.id"
          />
        </el-select>
        <el-select
          v-model="filters.hotel_id"
          placeholder="酒店"
          clearable
          filterable
          style="width: 180px"
        >
          <el-option
            v-for="h in hotelOptions"
            :key="h.id"
            :label="h.name"
            :value="h.id"
          />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 120px">
          <el-option v-for="(m, k) in STATUS_MAP" :key="k" :label="m.label" :value="k" />
        </el-select>
        <el-date-picker
          v-model="filters.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="入住起"
          end-placeholder="入住止"
          style="width: 240px"
        />
        <el-input
          v-model="filters.search"
          placeholder="客户名 / 酒店名关键词"
          clearable
          style="width: 200px"
          @keyup.enter="loadList(1)"
        />
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建预定</el-button>
      </div>

      <!-- 列表 -->
      <el-table :data="rows" v-loading="loading" empty-text="暂无预定数据">
        <el-table-column label="下单时间" width="165">
          <template #default="{ row }">{{ datetimeText(row.order_time) }}</template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" min-width="90" />
        <el-table-column prop="hotel_name" label="酒店" min-width="130" />
        <el-table-column label="权益人" width="90">
          <template #default="{ row }">{{ row.benefit_holder_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="入住/离店" min-width="175">
          <template #default="{ row }">{{ dateText(row.check_in) }} ~ {{ dateText(row.check_out) }}</template>
        </el-table-column>
        <el-table-column prop="nights" label="晚数" width="65" align="center" />
        <el-table-column prop="room_count" label="间数" width="65" align="center" />
        <el-table-column prop="items_summary" label="明细" min-width="140" show-overflow-tooltip />
        <el-table-column label="卖价" width="105" align="right">
          <template #default="{ row }"><span class="money">{{ money(row.sale_total) }}</span></template>
        </el-table-column>
        <el-table-column label="成本" width="105" align="right">
          <template #default="{ row }"><span class="money">{{ money(row.cost_total) }}</span></template>
        </el-table-column>
        <el-table-column label="利润" width="95" align="right">
          <template #default="{ row }">
            <span class="money" :class="profitClass(row.profit)">{{ profitText(row.profit) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="权益" width="60" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.benefit_used" type="warning" size="small">已用</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="85">
          <template #default="{ row }">
            <el-tag :type="statusMeta(row.status).type" size="small">{{ statusMeta(row.status).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button text type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

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
      :title="form.id ? '编辑预定' : '新建预定'"
      size="640px"
      destroy-on-close
    >
      <el-alert
        v-if="hotelNeedsPresence"
        title="该酒店需预订人本人到场办理"
        type="warning"
        show-icon
        :closable="false"
        class="presence-alert"
      />
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="92px">
        <el-form-item label="客户" prop="customer_id">
          <el-select
            v-model="form.customer_id"
            placeholder="选择客户"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="c in customerOptions"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="酒店" prop="hotel_id">
          <el-select
            v-model="form.hotel_id"
            placeholder="选择酒店"
            filterable
            style="width: 100%"
            @change="onHotelChange"
          >
            <el-option
              v-for="h in hotelOptions"
              :key="h.id"
              :label="h.name"
              :value="h.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="权益人">
          <el-select
            v-model="form.benefit_holder_id"
            placeholder="选择权益人（可空）"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="h in sortedHolderOptions"
              :key="h.id"
              :value="h.id"
              :label="holderLabel(h)"
            >
              <div class="holder-option">
                <span>{{ holderLabel(h) }}</span>
                <el-tag v-if="h.willing_present" type="success" size="small">✓愿意到场</el-tag>
              </div>
            </el-option>
          </el-select>
          <div v-if="hotelNeedsPresence" class="field-tip">该酒店需本人到场，优先选择带「✓愿意到场」的权益人</div>
        </el-form-item>
        <el-form-item label="入住/离店" prop="dateRange">
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="入住日期"
            end-placeholder="离店日期"
            style="width: 100%"
          />
          <span v-if="formNights > 0" class="nights-tip">共 {{ formNights }} 晚</span>
        </el-form-item>

        <el-form-item
          v-for="(item, index) in form.items"
          :key="index"
          :label="index === 0 ? '房间明细' : ''"
          :prop="'items.' + index + '.price'"
          :rules="itemPriceRules"
        >
          <div class="item-row">
            <el-select
              v-model="item.room_type_id"
              placeholder="选择房型"
              filterable
              class="item-room"
            >
              <el-option
                v-for="rt in roomTypeOptions"
                :key="rt.id"
                :label="rt.name"
                :value="rt.id"
              />
            </el-select>
            <el-input-number
              v-model="item.price"
              :min="0"
              :precision="2"
              :step="50"
              :controls="false"
              placeholder="该间总价"
              class="item-price"
            />
            <el-button
              v-if="form.items.length > 1"
              :icon="Delete"
              circle
              type="danger"
              plain
              @click="removeItem(index)"
            />
          </div>
        </el-form-item>
        <el-form-item>
          <el-button :icon="Plus" plain type="primary" @click="addItem">加一间</el-button>
          <span class="sale-summary">卖价合计：<b class="money">{{ money(formSaleTotal) }}</b></span>
        </el-form-item>

        <el-form-item label="成本合计" prop="cost_total">
          <el-input-number
            v-model="form.cost_total"
            :min="0"
            :precision="2"
            :step="50"
            :controls="false"
            placeholder="本单成本"
            style="width: 100%"
          />
          <span v-if="form.cost_total" class="nights-tip">
            预计利润：{{ profitText(formSaleTotal - form.cost_total) }}
          </span>
        </el-form-item>
        <el-form-item label="升级权益">
          <div class="benefit-line">
            <el-checkbox v-model="form.benefit_used" :disabled="!form.customer_id">
              使用升级权益
            </el-checkbox>
            <el-text v-if="selectedCustomer" type="info" size="small">
              {{ selectedCustomer.name }} 剩余 {{ selectedCustomer.benefit_count }} 次
            </el-text>
            <el-text v-if="selectedCustomer && selectedCustomer.benefit_count <= 0" type="danger" size="small">
              剩余不足，勾选后保存将被拒绝
            </el-text>
          </div>
        </el-form-item>
        <el-form-item label="下单时间" prop="order_time">
          <el-date-picker
            v-model="form.order_time"
            type="datetime"
            placeholder="选择下单时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" style="width: 100%">
            <el-option v-for="(m, k) in STATUS_MAP" :key="k" :label="m.label" :value="k" />
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

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="预定详情" size="560px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="下单时间" :span="2">{{ datetimeText(detail.order_time) }}</el-descriptions-item>
        <el-descriptions-item label="客户">{{ detail.customer_name }}</el-descriptions-item>
        <el-descriptions-item label="酒店">{{ detail.hotel_name }}</el-descriptions-item>
        <el-descriptions-item label="权益人">
          <template v-if="detail.benefit_holder_name">
            {{ detail.benefit_holder_name }}
            <el-tag v-if="detailHolder && detailHolder.willing_present" type="success" size="small">✓ 愿意到场</el-tag>
            <el-tag v-if="detailHolder && detailHolder.willing_assist" type="success" size="small">✓ 愿意协助</el-tag>
          </template>
          <template v-else>-</template>
        </el-descriptions-item>
        <el-descriptions-item label="入住日期">{{ dateText(detail.check_in) }}</el-descriptions-item>
        <el-descriptions-item label="离店日期">{{ dateText(detail.check_out) }}</el-descriptions-item>
        <el-descriptions-item label="晚数">{{ detail.nights }}</el-descriptions-item>
        <el-descriptions-item label="间数">{{ detail.room_count }}</el-descriptions-item>
        <el-descriptions-item label="卖价合计">
          <span class="money">{{ money(detail.sale_total) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="成本合计">
          <span class="money">{{ money(detail.cost_total) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="利润">
          <span class="money" :class="profitClass(detail.profit)">{{ profitText(detail.profit) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="升级权益">
          {{ detail.benefit_used ? '已使用' : '未使用' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusMeta(detail.status).type" size="small">
            {{ statusMeta(detail.status).label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.notes || '-' }}</el-descriptions-item>
      </el-descriptions>

      <h4 class="detail-items-title">每间价格明细</h4>
      <el-table :data="detail.items || []" empty-text="无明细" size="small">
        <el-table-column label="#" type="index" width="45" />
        <el-table-column prop="room_type_name" label="房型" min-width="120" />
        <el-table-column label="该间总价" align="right">
          <template #default="{ row }"><span class="money">{{ money(row.price) }}</span></template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { bookingsApi, customersApi, hotelsApi, roomTypesApi, benefitHoldersApi } from '../api'
import {
  money, profitText, profitClass, dateText, datetimeText,
  toDatetimeString, parseDatetime, statusMeta, STATUS_MAP,
} from '../utils/format'

// ===== 下拉选项 =====
const customerOptions = ref([])
const hotelOptions = ref([])
const roomTypeOptions = ref([])
const holderOptions = ref([])

async function loadOptions() {
  try {
    const [cs, hs, bh] = await Promise.all([
      customersApi.list({ page: 1, page_size: 100 }),
      hotelsApi.list({ page: 1, page_size: 100 }),
      benefitHoldersApi.list({ page: 1, page_size: 200 }),
    ])
    customerOptions.value = cs.items || []
    hotelOptions.value = hs.items || []
    holderOptions.value = bh.items || []
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

// 权益人选项：姓名（权益摘要）；willing_present=1 标注并排前
const sortedHolderOptions = computed(() =>
  [...holderOptions.value].sort((a, b) => (b.willing_present ? 1 : 0) - (a.willing_present ? 1 : 0)),
)

function holderLabel(h) {
  return `${h.name}（${h.benefit_types || '未登记权益'}）`
}

// 所选酒店入住政策联动：需本人到场时抽屉顶部橙色提示
const selectedHotel = computed(() =>
  hotelOptions.value.find((h) => h.id === form.hotel_id) || null,
)

const hotelNeedsPresence = computed(() => selectedHotel.value?.checkin_presence === 1)

const detailHolder = computed(() =>
  holderOptions.value.find((h) => h.id === detail.value.benefit_holder_id) || null,
)

// ===== 列表 =====
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({
  customer_id: null,
  hotel_id: null,
  status: null,
  dateRange: null,
  search: '',
})

async function loadList(p = page.value) {
  loading.value = true
  try {
    const params = {
      page: p,
      page_size: pageSize.value,
      customer_id: filters.customer_id || undefined,
      hotel_id: filters.hotel_id || undefined,
      status: filters.status || undefined,
      date_from: filters.dateRange?.[0] || undefined,
      date_to: filters.dateRange?.[1] || undefined,
      search: filters.search || undefined,
    }
    const data = await bookingsApi.list(params)
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
  filters.hotel_id = null
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

function todayStr(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const emptyForm = () => ({
  id: null,
  customer_id: null,
  hotel_id: null,
  benefit_holder_id: null,
  dateRange: [todayStr(0), todayStr(1)],
  items: [{ room_type_id: null, price: null }],
  cost_total: null,
  benefit_used: false,
  order_time: new Date(),
  status: 'active',
  notes: '',
})

const form = reactive(emptyForm())

const formRules = {
  customer_id: [{ required: true, message: '请选择客户', trigger: 'change' }],
  hotel_id: [{ required: true, message: '请选择酒店', trigger: 'change' }],
  dateRange: [{ required: true, message: '请选择入住/离店日期', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

const itemPriceRules = [
  { required: true, message: '请填写该间价格', trigger: 'blur' },
  { type: 'number', min: 0, message: '价格不能为负', trigger: 'blur' },
]

const selectedCustomer = computed(() =>
  customerOptions.value.find((c) => c.id === form.customer_id) || null,
)

const formNights = computed(() => {
  const [a, b] = form.dateRange || []
  if (!a || !b) return 0
  const diff = new Date(b) - new Date(a)
  return Math.round(diff / 86400000)
})

const formSaleTotal = computed(() =>
  form.items.reduce((sum, it) => sum + (Number(it.price) || 0), 0),
)

function openCreate() {
  Object.assign(form, emptyForm())
  roomTypeOptions.value = []
  formVisible.value = true
}

async function openEdit(row) {
  try {
    const d = await bookingsApi.detail(row.id)
    Object.assign(form, emptyForm(), {
      id: d.id,
      customer_id: d.customer_id,
      hotel_id: d.hotel_id,
      benefit_holder_id: d.benefit_holder_id || null,
      dateRange: [dateText(d.check_in), dateText(d.check_out)],
      items: (d.items || []).map((it) => ({ room_type_id: it.room_type_id, price: Number(it.price) })),
      cost_total: Number(d.cost_total),
      benefit_used: !!d.benefit_used,
      order_time: parseDatetime(d.order_time),
      status: d.status,
      notes: d.notes || '',
    })
    await loadRoomTypes(d.hotel_id)
    formVisible.value = true
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

async function onHotelChange() {
  form.items = form.items.map((it) => ({ ...it, room_type_id: null }))
  await loadRoomTypes(form.hotel_id)
}

async function loadRoomTypes(hotelId) {
  if (!hotelId) {
    roomTypeOptions.value = []
    return
  }
  try {
    roomTypeOptions.value = await roomTypesApi.listByHotel(hotelId)
  } catch (e) {
    roomTypeOptions.value = []
  }
}

function addItem() {
  form.items.push({ room_type_id: null, price: null })
}

function removeItem(index) {
  form.items.splice(index, 1)
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (!form.items.length || form.items.some((it) => !it.room_type_id)) {
    ElMessage.warning('每行明细需选择房型')
    return
  }
  if (form.items.some((it) => it.price === null || it.price === undefined || it.price < 0)) {
    ElMessage.warning('请为每间房填写不小于 0 的价格')
    return
  }
  const payload = {
    customer_id: form.customer_id,
    hotel_id: form.hotel_id,
    benefit_holder_id: form.benefit_holder_id ?? null,
    check_in: form.dateRange[0],
    check_out: form.dateRange[1],
    cost_total: Number(form.cost_total || 0),
    benefit_used: form.benefit_used,
    order_time: toDatetimeString(form.order_time),
    status: form.status,
    notes: form.notes || '',
    items: form.items.map((it) => ({ room_type_id: it.room_type_id, price: Number(it.price) })),
  }
  saving.value = true
  try {
    if (form.id) {
      await bookingsApi.update(form.id, payload)
      ElMessage.success('预定已更新')
    } else {
      await bookingsApi.create(payload)
      ElMessage.success('预定已创建')
    }
    formVisible.value = false
    await loadList()
    loadOptions()
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${row.customer_name} - ${row.hotel_name}」的预定吗？删除后将自动返还已占用的升级权益。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    return
  }
  try {
    await bookingsApi.remove(row.id)
    ElMessage.success('预定已删除')
    await loadList()
    loadOptions()
  } catch (e) {
    // 409 等错误提示已由拦截器统一处理
  }
}

// ===== 详情 =====
const detailVisible = ref(false)
const detail = ref({})

async function openDetail(row) {
  try {
    detail.value = await bookingsApi.detail(row.id)
    detailVisible.value = true
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

.presence-alert {
  margin-bottom: 16px;
}

.field-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 4px;
  width: 100%;
}

.holder-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nights-tip {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}

.item-row {
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.item-room {
  flex: 1;
}

.item-price {
  width: 140px;
}

.sale-summary {
  margin-left: 16px;
  font-size: 13px;
  color: #606266;
}

.benefit-line {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.detail-items-title {
  margin: 20px 0 8px;
  color: #303133;
}
</style>
