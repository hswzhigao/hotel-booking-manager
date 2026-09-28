<template>
  <div class="page-card">
    <el-card shadow="never">
      <!-- 筛选区：桌面工具栏；<768px 移动工具栏（月份+查询+筛选开关） -->
      <div class="page-toolbar desktop-toolbar">
        <el-date-picker
          v-model="filters.month"
          type="month"
          value-format="YYYY-MM"
          placeholder="选择月份"
          clearable
          style="width: 160px"
        />
        <el-select v-model="filters.type" placeholder="类型" clearable style="width: 120px">
          <el-option v-for="(m, k) in TYPE_MAP" :key="k" :label="m.label" :value="k" />
        </el-select>
        <el-select v-model="filters.business" placeholder="归属" clearable style="width: 120px">
          <el-option v-for="(m, k) in BUSINESS_MAP" :key="k" :label="m.label" :value="k" />
        </el-select>
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建记账</el-button>
      </div>

      <!-- 移动端工具栏 -->
      <div class="mobile-toolbar">
        <el-date-picker
          v-model="filters.month"
          type="month"
          value-format="YYYY-MM"
          placeholder="月份"
          clearable
          class="toolbar-search"
        />
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="filtersExpanded = !filtersExpanded">
          {{ filtersExpanded ? '收起筛选' : '筛选' }}
        </el-button>
        <el-button type="primary" :icon="Plus" circle title="新建记账" @click="openCreate" />
        <div v-show="filtersExpanded" class="filter-extra">
          <el-select v-model="filters.type" placeholder="类型" clearable>
            <el-option v-for="(m, k) in TYPE_MAP" :key="k" :label="m.label" :value="k" />
          </el-select>
          <el-select v-model="filters.business" placeholder="归属" clearable>
            <el-option v-for="(m, k) in BUSINESS_MAP" :key="k" :label="m.label" :value="k" />
          </el-select>
          <el-button @click="resetFilters">重置</el-button>
        </div>
      </div>

      <!-- 月度小计卡：收入 / 支出 / 净额（同筛选口径） -->
      <div class="summary-grid" v-loading="loading">
        <div class="summary-item">
          <div class="summary-label">收入</div>
          <div class="summary-value income money-revenue">¥{{ Number(summary.income || 0).toFixed(2) }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">支出</div>
          <div class="summary-value expense">¥{{ Number(summary.expense || 0).toFixed(2) }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">净额</div>
          <div class="summary-value" :class="netClass">{{ netText }}</div>
        </div>
      </div>

      <!-- 列表：桌面表格 / 移动卡片 -->
      <div class="desktop-table">
        <el-table :data="rows" v-loading="loading" empty-text="暂无记账记录">
          <el-table-column label="日期" width="120">
            <template #default="{ row }">{{ dateText(row.entry_date) }}</template>
          </el-table-column>
          <el-table-column label="类型" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="TYPE_MAP[row.type]?.type || 'info'" size="small">
                {{ TYPE_MAP[row.type]?.label || row.type }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="归属" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="BUSINESS_MAP[row.business]?.tagType || 'info'" size="small" effect="plain">
                {{ BUSINESS_MAP[row.business]?.label || row.business }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="120" align="right">
            <template #default="{ row }">
              <span class="money" :class="row.type === 'income' ? 'ledger-income' : 'ledger-expense'">
                {{ row.type === 'income' ? '+' : '-' }}¥{{ Number(row.amount || 0).toFixed(2) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="notes" label="备注" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.notes || '-' }}</template>
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
        <el-empty v-if="!rows.length" description="暂无记账记录" :image-size="60" />
        <div v-for="row in rows" :key="row.id" class="m-card">
          <div class="m-title">
            <span class="m-name">
              <el-tag :type="TYPE_MAP[row.type]?.type || 'info'" size="small">
                {{ TYPE_MAP[row.type]?.label || row.type }}
              </el-tag>
              <el-tag :type="BUSINESS_MAP[row.business]?.tagType || 'info'" size="small" effect="plain" class="biz-tag">
                {{ BUSINESS_MAP[row.business]?.label || row.business }}
              </el-tag>
            </span>
            <span class="money m-amount" :class="row.type === 'income' ? 'ledger-income' : 'ledger-expense'">
              {{ row.type === 'income' ? '+' : '-' }}¥{{ Number(row.amount || 0).toFixed(2) }}
            </span>
          </div>
          <div class="m-line">
            <span class="m-label">日期</span>
            <span class="m-value">{{ dateText(row.entry_date) }}</span>
          </div>
          <div class="m-line">
            <span class="m-label">备注</span>
            <span class="m-value">{{ row.notes || '-' }}</span>
          </div>
          <div class="m-actions">
            <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button text type="danger" size="small" @click="onDelete(row)">删除</el-button>
          </div>
        </div>
      </div>

      <el-pagination
        class="pager"
        background
        layout="total, prev, pager, next"
        :total="total"
        :current-page="page"
        :page-size="pageSize"
        @current-change="onPageChange"
      />
    </el-card>

    <!-- 新建/编辑 Dialog -->
    <el-dialog v-model="formVisible" :title="form.id ? '编辑记账' : '新建记账'" width="480px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="72px">
        <el-form-item label="日期" prop="entry_date">
          <el-date-picker
            v-model="form.entry_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio-button value="income">收入</el-radio-button>
            <el-radio-button value="expense">支出</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="归属" prop="business">
          <el-select v-model="form.business" style="width: 160px">
            <el-option v-for="(m, k) in BUSINESS_MAP" :key="k" :label="m.label" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number
            v-model="form.amount"
            :min="0.01"
            :precision="2"
            :step="10"
            :controls="false"
            placeholder="金额（正数）"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { manualEntriesApi } from '../api'
import { dateText } from '../utils/format'

// 类型徽标：收入绿 / 支出红
const TYPE_MAP = {
  income: { label: '收入', type: 'success' },
  expense: { label: '支出', type: 'danger' },
}

// 归属：酒店 / 高尔夫 / 通用
const BUSINESS_MAP = {
  hotel: { label: '酒店', tagType: 'primary' },
  golf: { label: '高尔夫', tagType: 'success' },
  general: { label: '通用', tagType: 'info' },
}

// ===== 列表 =====
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const summary = ref({ income: 0, expense: 0 })
const filtersExpanded = ref(false)

const filters = reactive({
  month: null,
  type: null,
  business: null,
})

async function loadList(p = page.value) {
  loading.value = true
  try {
    const data = await manualEntriesApi.list({
      month: filters.month || undefined,
      type: filters.type || undefined,
      business: filters.business || undefined,
      page: p,
      page_size: pageSize.value,
    })
    rows.value = data.items || []
    total.value = data.total || 0
    summary.value = data.summary || { income: 0, expense: 0 }
    page.value = p
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.month = null
  filters.type = null
  filters.business = null
  loadList(1)
}

function onPageChange(p) {
  loadList(p)
}

// 月度小计：净额 = 收入 − 支出
const netValue = computed(() => Number(summary.value.income || 0) - Number(summary.value.expense || 0))
const netText = computed(() => (netValue.value > 0 ? '+' : '') + netValue.value.toFixed(2))
const netClass = computed(() => ({
  'ledger-income': netValue.value > 0,
  'ledger-expense': netValue.value < 0,
}))

// ===== 新建/编辑 =====
const formVisible = ref(false)
const formRef = ref(null)
const saving = ref(false)

const emptyForm = () => ({
  id: null,
  entry_date: todayStr(),
  type: 'income',
  business: 'general',
  amount: null,
  notes: '',
})

const form = reactive(emptyForm())

const formRules = {
  entry_date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  business: [{ required: true, message: '请选择归属', trigger: 'change' }],
  amount: [
    { required: true, message: '请填写金额', trigger: 'blur' },
    { type: 'number', min: 0.01, message: '金额应为正数', trigger: 'blur' },
  ],
}

function todayStr() {
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function openCreate() {
  Object.assign(form, emptyForm())
  formVisible.value = true
}

function openEdit(row) {
  Object.assign(form, emptyForm(), {
    id: row.id,
    entry_date: dateText(row.entry_date),
    type: row.type,
    business: row.business,
    amount: Number(row.amount || 0),
    notes: row.notes || '',
  })
  formVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const payload = {
    entry_date: form.entry_date,
    type: form.type,
    business: form.business,
    amount: Number(form.amount),
    notes: form.notes || '',
  }
  saving.value = true
  try {
    if (form.id) {
      await manualEntriesApi.update(form.id, payload)
      ElMessage.success('记账已更新')
    } else {
      await manualEntriesApi.create(payload)
      ElMessage.success('记账已创建')
    }
    formVisible.value = false
    await loadList()
  } catch (e) {
    // 400 文案由拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${dateText(row.entry_date)} ${TYPE_MAP[row.type]?.label || ''} ¥${Number(row.amount || 0).toFixed(2)}」的记账吗？`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    return
  }
  try {
    await manualEntriesApi.remove(row.id)
    ElMessage.success('记账已删除')
    // 删空当前页时回退一页
    if (rows.value.length === 1 && page.value > 1) {
      await loadList(page.value - 1)
    } else {
      await loadList()
    }
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

onMounted(() => {
  // 默认带出当前月份
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  filters.month = `${d.getFullYear()}-${p(d.getMonth() + 1)}`
  loadList(1)
})
</script>

<style scoped>
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

/* 月度小计卡：桌面 3 列，移动 3 列窄距 */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.summary-item {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
}

.summary-label {
  font-size: 13px;
  color: #909399;
}

.summary-value {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  font-variant-numeric: tabular-nums;
}

.ledger-income {
  color: #f56c6c;
}

.ledger-expense {
  color: #303133;
}

.biz-tag {
  margin-left: 6px;
}

.m-amount {
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .summary-grid {
    gap: 8px;
    margin-bottom: 12px;
  }

  .summary-value {
    font-size: 16px;
  }
}
</style>
