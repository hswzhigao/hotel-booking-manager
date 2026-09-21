<template>
  <div class="page-card">
    <el-card shadow="never">
      <div class="page-toolbar">
        <el-input
          v-model="filters.search"
          placeholder="搜索姓名 / 微信 / 电话"
          clearable
          style="width: 200px"
          @keyup.enter="loadList(1)"
        />
        <el-select v-model="filters.willing_present" placeholder="愿意到场" clearable style="width: 120px">
          <el-option label="愿意到场" :value="1" />
          <el-option label="不愿意到场" :value="0" />
        </el-select>
        <el-select v-model="filters.willing_assist" placeholder="愿意协助" clearable style="width: 120px">
          <el-option label="愿意协助" :value="1" />
          <el-option label="不愿意协助" :value="0" />
        </el-select>
        <el-select v-model="filters.active" placeholder="合作中" clearable style="width: 110px">
          <el-option label="合作中" :value="1" />
          <el-option label="已停用" :value="0" />
        </el-select>
        <el-select v-model="filters.availability" placeholder="可用时间" clearable style="width: 120px">
          <el-option v-for="(m, k) in AVAILABILITY_MAP" :key="k" :label="m.label" :value="k" />
        </el-select>
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <div class="toolbar-spacer" />
        <el-button plain :icon="Collection" @click="openTypesDialog">权益种类</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建预订人</el-button>
      </div>

      <el-table
        :data="rows"
        v-loading="loading"
        empty-text="暂无预订人数据"
        :row-class-name="rowClassName"
      >
        <el-table-column prop="name" label="姓名" min-width="90" fixed="left" />
        <el-table-column prop="card_type" label="卡片类型" min-width="100">
          <template #default="{ row }">{{ row.card_type || '-' }}</template>
        </el-table-column>
        <el-table-column prop="wechat" label="微信" min-width="100">
          <template #default="{ row }">{{ row.wechat || '-' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="电话" min-width="115">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column label="酒店权益" width="85" align="center">
          <template #default="{ row }">
            <el-tag :type="row.hotel_benefit_count > 0 ? 'warning' : 'info'" size="small">
              {{ row.hotel_benefit_count }} 次
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="高尔夫权益" min-width="170">
          <template #default="{ row }">
            <div class="golf-cell">
              <span>
                <el-tag :type="(row.golf_benefit_total ?? 0) > 0 ? 'success' : 'info'" size="small">
                  {{ row.golf_benefit_total ?? 0 }} 次
                </el-tag>
                <el-tag v-if="golfDue(row)" type="warning" size="small" class="due-tag">本月更新</el-tag>
              </span>
              <div class="type-summary">{{ golfSummary(row) }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="酒店更新月" width="95" align="center">
          <template #default="{ row }">
            <span :class="{ 'month-due': row.hotel_refresh_month === currentMonth }">{{ monthText(row.hotel_refresh_month) }}</span>
            <el-tag v-if="row.hotel_refresh_month === currentMonth" type="warning" size="small" class="due-tag">本月更新</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="可用时间" width="85" align="center">
          <template #default="{ row }">
            <el-tag :type="availabilityMeta(row.availability).type" size="small">
              {{ availabilityMeta(row.availability).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="150">
          <template #default="{ row }">
            <el-tag v-if="row.willing_present" type="success" size="small">✓ 愿意到场</el-tag>
            <el-tag v-if="row.willing_assist" type="success" size="small">✓ 愿意协助</el-tag>
            <span v-if="!row.willing_present && !row.willing_assist">-</span>
          </template>
        </el-table-column>
        <el-table-column label="合作中" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.active ? 'success' : 'info'" size="small">
              {{ row.active ? '合作中' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="booking_count" label="关联预定数" width="90" align="center" />
        <el-table-column prop="golf_order_count" label="高尔夫订单数" width="95" align="center" />
        <el-table-column prop="notes" label="备注" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.notes || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
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

    <!-- 新建/编辑 Dialog -->
    <el-dialog
      v-model="formVisible"
      :title="form.id ? '编辑预订人' : '新建预订人'"
      width="600px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="96px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" maxlength="50" placeholder="预订人姓名" />
        </el-form-item>
        <el-form-item label="卡片类型">
          <el-input v-model="form.card_type" maxlength="100" placeholder="如：经典白 / 大白金 / 普通白金" />
          <div class="field-tip">常见配额：经典白≈酒店6+高尔夫12；普通白金≈酒店2+高尔夫0</div>
        </el-form-item>
        <el-form-item label="微信">
          <el-input v-model="form.wechat" maxlength="100" placeholder="微信 / 闲鱼号" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" maxlength="30" placeholder="手机号" />
        </el-form-item>
        <el-form-item label="酒店权益" prop="hotel_benefit_count">
          <el-input-number v-model="form.hotel_benefit_count" :min="0" :step="1" />
          <div class="field-tip">剩余次数，手动调整用于充值 / 纠错，酒店预定消耗自动扣减</div>
        </el-form-item>
        <el-form-item label="酒店更新月">
          <el-select v-model="form.hotel_refresh_month" placeholder="未知" clearable style="width: 140px">
            <el-option v-for="m in 12" :key="m" :label="`${m}月`" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="高尔夫权益">
          <div class="benefit-rows">
            <div v-for="(b, i) in form.golf_benefits" :key="i" class="benefit-row">
              <el-select
                v-model="b.benefit_type_id"
                placeholder="权益种类"
                filterable
                style="width: 160px"
              >
                <el-option v-for="t in benefitTypes" :key="t.id" :label="t.name" :value="t.id" />
              </el-select>
              <el-input-number
                v-model="b.count_left"
                :min="0"
                :step="1"
                :controls="false"
                placeholder="剩余次数"
                style="width: 110px"
              />
              <el-select v-model="b.refresh_month" placeholder="更新月" clearable style="width: 95px">
                <el-option v-for="m in 12" :key="m" :label="`${m}月`" :value="m" />
              </el-select>
              <el-button
                :icon="Delete"
                circle
                type="danger"
                plain
                size="small"
                @click="removeGolfBenefit(i)"
              />
            </div>
            <div v-if="!form.golf_benefits.length" class="field-tip no-benefit-tip">
              未登记高尔夫权益（金葵花 / 经典白高尔夫 / 中信银行等可同时持有多种）
            </div>
            <el-button :icon="Plus" plain type="primary" size="small" @click="addGolfBenefit">添加权益种类</el-button>
          </div>
        </el-form-item>
        <el-form-item label="可用时间">
          <el-select v-model="form.availability" style="width: 140px">
            <el-option v-for="(m, k) in AVAILABILITY_MAP" :key="k" :label="m.label" :value="k" />
          </el-select>
          <div class="field-tip">仅周末 / 仅工作日的预订人，下单时按打球日期给出匹配提示</div>
        </el-form-item>
        <el-form-item label="持有权益">
          <el-input
            v-model="form.benefit_types"
            type="textarea"
            :rows="2"
            maxlength="500"
            placeholder="如：招行经典白金卡房晚、飞猪F4"
          />
        </el-form-item>
        <el-form-item label="愿意到场">
          <el-switch v-model="form.willing_present" active-text="愿意本人到场办理" />
        </el-form-item>
        <el-form-item label="愿意协助">
          <el-switch v-model="form.willing_assist" active-text="愿意协助办理（证件信息/电话确认）" />
        </el-form-item>
        <el-form-item label="合作中">
          <el-switch v-model="form.active" active-text="合作中" inactive-text="已停用" />
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

    <!-- 权益种类字典 Dialog -->
    <el-dialog v-model="typesVisible" title="高尔夫权益种类管理" width="640px" destroy-on-close>
      <div class="type-form">
        <el-form :inline="true" :model="typeForm" class="type-inline-form">
          <el-form-item label="名称" required>
            <el-input v-model="typeForm.name" maxlength="100" placeholder="如：金葵花" style="width: 150px" />
          </el-form-item>
          <el-form-item label="适用球场">
            <el-radio-group v-model="typeForm.scopeMode">
              <el-radio value="all">全部通用</el-radio>
              <el-radio value="custom">指定球场</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="typeForm.scopeMode === 'custom'" label="球场列表">
            <el-input
              v-model="typeForm.course_scope"
              maxlength="200"
              placeholder="球场名称，逗号分隔（如：上海东镇高尔夫球场,上海金桥高尔夫尊运动公园）"
              style="width: 360px"
            />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="typeForm.notes" maxlength="500" placeholder="选填" style="width: 200px" />
          </el-form-item>
        </el-form>
        <div class="type-form-actions">
          <el-button v-if="typeForm.id" @click="resetTypeForm">取消编辑</el-button>
          <el-button type="primary" :loading="typeSaving" @click="onSaveType">
            {{ typeForm.id ? '保存修改' : '新增种类' }}
          </el-button>
        </div>
      </div>

      <el-table :data="benefitTypes" v-loading="typesLoading" empty-text="暂无权益种类" size="small">
        <el-table-column prop="name" label="名称" min-width="110" />
        <el-table-column label="适用球场" min-width="220">
          <template #default="{ row }">
            <el-tag v-if="scopeIsAll(row.course_scope)" type="success" size="small">全部球场通用</el-tag>
            <span v-else>{{ row.course_scope }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.notes || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="center">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="onEditType(row)">编辑</el-button>
            <el-button text type="danger" size="small" @click="onDeleteType(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Collection } from '@element-plus/icons-vue'
import { benefitHoldersApi, golfBenefitTypesApi } from '../api'
import { monthText, availabilityMeta, AVAILABILITY_MAP } from '../utils/format'

// 更新月=当前月 → 行高亮（黄色底 +「本月更新」徽标）
const currentMonth = new Date().getMonth() + 1

function golfDue(row) {
  return (row.golf_benefits || []).some((b) => b.refresh_month === currentMonth)
}

function rowClassName({ row }) {
  return row.hotel_refresh_month === currentMonth || golfDue(row) ? 'row-refresh-due' : ''
}

// 高尔夫权益摘要：经典白高尔夫×6、金葵花×3
function golfSummary(row) {
  const list = row.golf_benefits || []
  if (!list.length) return '未登记'
  return list.map((b) => `${b.type_name}×${b.count_left}`).join('、')
}

// ===== 列表与筛选 =====
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({
  search: '',
  willing_present: null,
  willing_assist: null,
  active: null,
  availability: null,
})

async function loadList(p = page.value) {
  loading.value = true
  try {
    const data = await benefitHoldersApi.list({
      page: p,
      page_size: pageSize.value,
      search: filters.search || undefined,
      willing_present: filters.willing_present ?? undefined,
      willing_assist: filters.willing_assist ?? undefined,
      active: filters.active ?? undefined,
      availability: filters.availability || undefined,
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
  filters.search = ''
  filters.willing_present = null
  filters.willing_assist = null
  filters.active = null
  filters.availability = null
  loadList(1)
}

function onPageChange(p) {
  loadList(p)
}

function onSizeChange(size) {
  pageSize.value = size
  loadList(1)
}

// ===== 新建/编辑 =====
const formVisible = ref(false)
const formRef = ref(null)
const saving = ref(false)

const emptyForm = () => ({
  id: null,
  name: '',
  card_type: '',
  wechat: '',
  phone: '',
  hotel_benefit_count: 0,
  hotel_refresh_month: null,
  golf_benefits: [],
  availability: 'any',
  benefit_types: '',
  willing_present: false,
  willing_assist: false,
  active: true,
  notes: '',
})

const form = reactive(emptyForm())

const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  hotel_benefit_count: [{ required: true, message: '请填写酒店权益次数', trigger: 'blur' }],
}

function addGolfBenefit() {
  form.golf_benefits.push({ benefit_type_id: null, count_left: 0, refresh_month: null })
}

function removeGolfBenefit(index) {
  form.golf_benefits.splice(index, 1)
}

function openCreate() {
  Object.assign(form, emptyForm())
  formVisible.value = true
  ensureTypesLoaded()
}

function openEdit(row) {
  Object.assign(form, emptyForm(), {
    id: row.id,
    name: row.name,
    card_type: row.card_type || '',
    wechat: row.wechat || '',
    phone: row.phone || '',
    hotel_benefit_count: Number(row.hotel_benefit_count || 0),
    hotel_refresh_month: row.hotel_refresh_month || null,
    golf_benefits: (row.golf_benefits || []).map((b) => ({
      benefit_type_id: b.benefit_type_id,
      count_left: Number(b.count_left || 0),
      refresh_month: b.refresh_month ?? null,
    })),
    availability: row.availability || 'any',
    benefit_types: row.benefit_types || '',
    willing_present: !!row.willing_present,
    willing_assist: !!row.willing_assist,
    active: !!row.active,
    notes: row.notes || '',
  })
  formVisible.value = true
  ensureTypesLoaded()
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  // 明细行校验：已选种类的行必须有次数；种类不可重复
  const detail = form.golf_benefits.filter((b) => b.benefit_type_id)
  if (form.golf_benefits.some((b) => !b.benefit_type_id && Number(b.count_left) > 0)) {
    ElMessage.warning('该行已填次数，请选择权益种类（或删除该行）')
    return
  }
  const ids = detail.map((b) => b.benefit_type_id)
  if (new Set(ids).size !== ids.length) {
    ElMessage.warning('同一权益种类只能登记一行，请合并后重试')
    return
  }
  const payload = {
    name: form.name,
    card_type: form.card_type || '',
    wechat: form.wechat || '',
    phone: form.phone || '',
    hotel_benefit_count: form.hotel_benefit_count,
    hotel_refresh_month: form.hotel_refresh_month ?? '',
    availability: form.availability,
    golf_benefits: detail.map((b) => ({
      benefit_type_id: b.benefit_type_id,
      count_left: Number(b.count_left || 0),
      refresh_month: b.refresh_month ?? '',
    })),
    benefit_types: form.benefit_types || '',
    willing_present: form.willing_present ? 1 : 0,
    willing_assist: form.willing_assist ? 1 : 0,
    active: form.active ? 1 : 0,
    notes: form.notes || '',
  }
  saving.value = true
  try {
    if (form.id) {
      await benefitHoldersApi.update(form.id, payload)
      ElMessage.success('预订人已更新')
    } else {
      await benefitHoldersApi.create(payload)
      ElMessage.success('预订人已创建')
    }
    formVisible.value = false
    await loadList()
  } catch (e) {
    // 400/409 等错误提示已由拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除预订人「${row.name}」吗？被酒店预定或高尔夫订单引用的预订人无法删除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    return
  }
  try {
    await benefitHoldersApi.remove(row.id)
    ElMessage.success('预订人已删除')
    await loadList()
  } catch (e) {
    // 409「该预订人已被酒店预定/高尔夫订单引用，无法删除」等错误提示已由拦截器统一处理
  }
}

// ===== 权益种类字典 =====
const typesVisible = ref(false)
const typesLoading = ref(false)
const benefitTypes = ref([])
const typeSaving = ref(false)

const emptyTypeForm = () => ({ id: null, name: '', scopeMode: 'all', course_scope: '', notes: '' })
const typeForm = reactive(emptyTypeForm())

function scopeIsAll(scope) {
  return !scope || scope === 'all'
}

async function loadTypes() {
  typesLoading.value = true
  try {
    const data = await golfBenefitTypesApi.list()
    benefitTypes.value = data.items || []
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    typesLoading.value = false
  }
}

// 明细行的种类下拉需要字典数据：打开新建/编辑抽屉时确保已加载
async function ensureTypesLoaded() {
  if (benefitTypes.value.length) return
  await loadTypes()
}

async function openTypesDialog() {
  typesVisible.value = true
  resetTypeForm()
  await loadTypes()
}

function resetTypeForm() {
  Object.assign(typeForm, emptyTypeForm())
}

function onEditType(row) {
  Object.assign(typeForm, emptyTypeForm(), {
    id: row.id,
    name: row.name || '',
    scopeMode: scopeIsAll(row.course_scope) ? 'all' : 'custom',
    course_scope: scopeIsAll(row.course_scope) ? '' : row.course_scope,
    notes: row.notes || '',
  })
}

async function onSaveType() {
  const name = typeForm.name.trim()
  if (!name) {
    ElMessage.warning('请输入种类名称')
    return
  }
  if (typeForm.scopeMode === 'custom' && !typeForm.course_scope.trim()) {
    ElMessage.warning('请填写适用的球场名称（逗号分隔），或改为全部通用')
    return
  }
  const payload = {
    name,
    course_scope: typeForm.scopeMode === 'all' ? 'all' : typeForm.course_scope.trim(),
    notes: typeForm.notes || '',
  }
  typeSaving.value = true
  try {
    if (typeForm.id) {
      await golfBenefitTypesApi.update(typeForm.id, payload)
      ElMessage.success('权益种类已更新')
    } else {
      await golfBenefitTypesApi.create(payload)
      ElMessage.success('权益种类已创建')
    }
    resetTypeForm()
    await loadTypes()
  } catch (e) {
    // 400/409 等错误提示已由拦截器统一处理
  } finally {
    typeSaving.value = false
  }
}

async function onDeleteType(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除权益种类「${row.name}」吗？被预订人持有明细引用的种类无法删除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    return
  }
  try {
    await golfBenefitTypesApi.remove(row.id)
    ElMessage.success('权益种类已删除')
    await loadTypes()
  } catch (e) {
    // 409 等错误提示已由拦截器统一处理
  }
}

onMounted(() => loadList(1))
</script>

<style scoped>
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

.field-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 4px;
}

/* 更新月=当前月：黄色底高亮 */
:deep(.el-table .row-refresh-due) {
  background-color: #fdf6c6;
}

:deep(.el-table .row-refresh-due:hover > td.el-table__cell) {
  background-color: #faecab;
}

.month-due {
  font-weight: 600;
  color: #b88230;
}

.due-tag {
  margin-left: 4px;
}

.golf-cell .type-summary {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
  line-height: 1.4;
}

.benefit-rows {
  width: 100%;
}

.benefit-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.no-benefit-tip {
  margin-top: 0;
  margin-bottom: 8px;
}

.type-form {
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.type-inline-form :deep(.el-form-item) {
  margin-bottom: 8px;
}

.type-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
