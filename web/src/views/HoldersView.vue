<template>
  <div class="page-card">
    <el-card shadow="never">
      <div class="page-toolbar desktop-toolbar">
        <el-input
          v-model="filters.search"
          placeholder="搜索姓名 / 闲鱼号 / 微信号 / 电话"
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
        <el-select v-model="filters.provides_hotel" placeholder="出酒店" clearable style="width: 100px">
          <el-option label="出酒店权益" :value="1" />
          <el-option label="不出酒店" :value="0" />
        </el-select>
        <el-select v-model="filters.provides_golf" placeholder="出高尔夫" clearable style="width: 105px">
          <el-option label="出高尔夫权益" :value="1" />
          <el-option label="不出高尔夫" :value="0" />
        </el-select>
        <el-select v-model="filters.availability" placeholder="可用时间" clearable style="width: 120px">
          <el-option v-for="(m, k) in AVAILABILITY_MAP" :key="k" :label="m.label" :value="k" />
        </el-select>
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建预订人</el-button>
      </div>

      <!-- 移动端工具栏 -->
      <div class="mobile-toolbar">
        <el-input
          v-model="filters.search"
          class="toolbar-search"
          placeholder="搜索姓名 / 闲鱼号 / 微信号 / 电话"
          clearable
          @keyup.enter="loadList(1)"
        />
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="filtersExpanded = !filtersExpanded">
          {{ filtersExpanded ? '收起筛选' : '筛选' }}
        </el-button>
        <el-button type="primary" :icon="Plus" circle title="新建预订人" @click="openCreate" />
        <div v-show="filtersExpanded" class="filter-extra">
          <el-select v-model="filters.willing_present" placeholder="愿意到场" clearable>
            <el-option label="愿意到场" :value="1" />
            <el-option label="不愿意到场" :value="0" />
          </el-select>
          <el-select v-model="filters.willing_assist" placeholder="愿意协助" clearable>
            <el-option label="愿意协助" :value="1" />
            <el-option label="不愿意协助" :value="0" />
          </el-select>
          <el-select v-model="filters.active" placeholder="合作中" clearable>
            <el-option label="合作中" :value="1" />
            <el-option label="已停用" :value="0" />
          </el-select>
          <el-select v-model="filters.provides_hotel" placeholder="出酒店" clearable>
            <el-option label="出酒店权益" :value="1" />
            <el-option label="不出酒店" :value="0" />
          </el-select>
          <el-select v-model="filters.provides_golf" placeholder="出高尔夫" clearable>
            <el-option label="出高尔夫权益" :value="1" />
            <el-option label="不出高尔夫" :value="0" />
          </el-select>
          <el-select v-model="filters.availability" placeholder="可用时间" clearable>
            <el-option v-for="(m, k) in AVAILABILITY_MAP" :key="k" :label="m.label" :value="k" />
          </el-select>
          <el-button @click="resetFilters">重置</el-button>
          <div class="toolbar-spacer" />
          <el-button type="primary" :icon="Plus" @click="openCreate">新建预订人</el-button>
        </div>
      </div>

      <div class="desktop-table">
      <el-table
        :data="rows"
        v-loading="loading"
        empty-text="暂无预订人数据"
        :row-class-name="rowClassName"
      >
        <el-table-column prop="name" label="姓名" min-width="90" fixed="left" />
        <el-table-column label="来源/出权益" width="150">
          <template #default="{ row }">
            <div class="badge-cell">
              <el-tag :type="sourceChannelType(row.source_channel)" size="small">
                {{ channelText(row.source_channel) }}
              </el-tag>
              <el-tag v-if="row.provides_hotel" type="success" size="small">出酒店</el-tag>
              <el-tag v-if="row.provides_golf" type="primary" size="small">出高尔夫</el-tag>
              <span v-if="!row.provides_hotel && !row.provides_golf" class="badge-none">都不出</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="卡片类型" min-width="120">
          <template #default="{ row }">
            <template v-if="row.card_type">
              <el-tag v-for="ct in splitCardTypes(row.card_type)" :key="ct" size="small" class="card-tag">{{ ct }}</el-tag>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="xianyu_id" label="闲鱼号" min-width="100">
          <template #default="{ row }">{{ row.xianyu_id || '-' }}</template>
        </el-table-column>
        <el-table-column prop="wechat_id" label="微信号" min-width="100">
          <template #default="{ row }">{{ row.wechat_id || '-' }}</template>
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
      </div>

      <!-- 移动端卡片列表 -->
      <div class="mobile-cards" v-loading="loading">
        <el-empty v-if="!rows.length" description="暂无预订人数据" :image-size="60" />
        <div
          v-for="row in rows"
          :key="row.id"
          class="m-card"
          :class="{ 'row-refresh-due': row.hotel_refresh_month === currentMonth || golfDue(row) }"
        >
          <div class="m-title">
            <span class="m-name">{{ row.name }}</span>
            <span class="m-tags">
              <el-tag :type="row.active ? 'success' : 'info'" size="small">
                {{ row.active ? '合作中' : '已停用' }}
              </el-tag>
              <el-tag v-if="row.provides_hotel" type="success" size="small" class="due-tag">出酒店</el-tag>
              <el-tag v-if="row.provides_golf" type="primary" size="small" class="due-tag">出高尔夫</el-tag>
              <span v-if="!row.provides_hotel && !row.provides_golf" class="badge-none">都不出</span>
            </span>
          </div>
          <div class="m-line">
            <span class="m-label">卡片/来源</span>
            <span class="m-value">
              <template v-if="row.card_type">
                <el-tag v-for="ct in splitCardTypes(row.card_type)" :key="ct" size="small" class="card-tag">{{ ct }}</el-tag>
              </template>
              <span v-else>-</span>
              ·
              <el-tag :type="sourceChannelType(row.source_channel)" size="small">
                {{ channelText(row.source_channel) }}
              </el-tag>
            </span>
          </div>
          <div class="m-line">
            <span class="m-label">酒店权益</span>
            <span class="m-value">
              <el-tag :type="row.hotel_benefit_count > 0 ? 'warning' : 'info'" size="small">
                {{ row.hotel_benefit_count }} 次
              </el-tag>
              <span :class="{ 'month-due': row.hotel_refresh_month === currentMonth }" class="m-month">
                {{ monthText(row.hotel_refresh_month) }}更新
              </span>
              <el-tag v-if="row.hotel_refresh_month === currentMonth" type="warning" size="small" class="due-tag">本月更新</el-tag>
            </span>
          </div>
          <div class="m-line">
            <span class="m-label">高尔夫权益</span>
            <span class="m-value">
              <el-tag :type="(row.golf_benefit_total ?? 0) > 0 ? 'success' : 'info'" size="small">
                {{ row.golf_benefit_total ?? 0 }} 次
              </el-tag>
              <el-tag v-if="golfDue(row)" type="warning" size="small" class="due-tag">本月更新</el-tag>
              <div class="m-summary">{{ golfSummary(row) }}</div>
            </span>
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
          <el-select
            v-model="form.card_type"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入卡片类型"
            style="width: 100%"
          >
            <el-option v-for="ct in cardTypeOptions" :key="ct" :label="ct" :value="ct" />
          </el-select>
          <div class="field-tip">常见配额：经典白≈酒店6+高尔夫12；普通白金≈酒店2+高尔夫0</div>
        </el-form-item>
        <el-form-item label="闲鱼号">
          <el-input v-model="form.xianyu_id" maxlength="100" placeholder="闲鱼号" />
        </el-form-item>
        <el-form-item label="微信号">
          <el-input v-model="form.wechat_id" maxlength="100" placeholder="微信号" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" maxlength="30" placeholder="手机号" />
        </el-form-item>
        <el-form-item label="来源渠道">
          <el-select v-model="form.source_channel" style="width: 140px">
            <el-option v-for="(m, k) in CHANNEL_MAP" :key="k" :label="m" :value="k" />
          </el-select>
          <div class="field-tip">权益人来自哪个渠道（结算提示按此联动）</div>
        </el-form-item>
        <el-form-item label="出酒店权益">
          <el-switch v-model="form.provides_hotel" active-text="出酒店权益" />
        </el-form-item>
        <el-form-item label="出高尔夫">
          <el-switch v-model="form.provides_golf" active-text="出高尔夫权益" />
          <div class="field-tip">只出单边权益的预订人关掉另一边，酒店/高尔夫下单匹配时可识别</div>
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
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Collection } from '@element-plus/icons-vue'
import { benefitHoldersApi, golfBenefitTypesApi, optionDictApi } from '../api'
import { monthText, availabilityMeta, AVAILABILITY_MAP, channelText, CHANNEL_MAP } from '../utils/format'

// 来源渠道徽标配色：闲鱼橙、微信绿、其他灰
function sourceChannelType(channel) {
  if (channel === 'xianyu') return 'warning'
  if (channel === 'wechat') return 'success'
  return 'info'
}

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
// 移动端筛选折叠开关（桌面端由 CSS display:contents 还原平铺，不受影响）
const filtersExpanded = ref(false)

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
  provides_hotel: null,
  provides_golf: null,
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
      provides_hotel: filters.provides_hotel ?? undefined,
      provides_golf: filters.provides_golf ?? undefined,
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
  filters.provides_hotel = null
  filters.provides_golf = null
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
  card_type: [],
  xianyu_id: '',
  wechat_id: '',
  phone: '',
  source_channel: 'other',
  provides_hotel: true,
  provides_golf: true,
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
  ensureCardTypesLoaded()
}

function openEdit(row) {
  Object.assign(form, emptyForm(), {
    id: row.id,
    name: row.name,
    card_type: splitCardTypes(row.card_type),
    xianyu_id: row.xianyu_id || '',
    wechat_id: row.wechat_id || '',
    phone: row.phone || '',
    source_channel: row.source_channel || 'other',
    provides_hotel: row.provides_hotel === undefined ? true : !!row.provides_hotel,
    provides_golf: row.provides_golf === undefined ? true : !!row.provides_golf,
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
  ensureCardTypesLoaded()
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
    card_type: (form.card_type || []).join(','),
    xianyu_id: form.xianyu_id || '',
    wechat_id: form.wechat_id || '',
    phone: form.phone || '',
    source_channel: form.source_channel || 'other',
    provides_hotel: form.provides_hotel ? 1 : 0,
    provides_golf: form.provides_golf ? 1 : 0,
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

// ===== 权益种类字典（管理入口已挪至「基础配置」页，此处仅保留下拉数据加载） =====
const typesLoading = ref(false)
const benefitTypes = ref([])

async function loadTypes() {
  typesLoading.value = true
  try {
    const data = await golfBenefitTypesApi.list()
    // 后端返回裸数组，兼容 {items} 形状
    benefitTypes.value = Array.isArray(data) ? data : (data.items || [])
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

// ===== 卡片类型多选选项（来自 option_dict category=card_type） =====
const cardTypeOptions = ref([])

async function loadCardTypes() {
  try {
    const data = await optionDictApi.list({ category: 'card_type' })
    cardTypeOptions.value = (data || []).map((x) => x.label)
  } catch (e) {
    cardTypeOptions.value = []
  }
}

/** 逗号分隔字符串 → 数组 */
function splitCardTypes(value) {
  if (!value) return []
  return String(value).split(',').map((x) => x.trim()).filter(Boolean)
}

// 打开新建/编辑时确保卡片类型选项已加载
async function ensureCardTypesLoaded() {
  if (cardTypeOptions.value.length) return
  await loadCardTypes()
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

/* 移动端卡片同款高亮 */
.m-card.row-refresh-due {
  background-color: #fdf6c6;
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

.badge-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.badge-none {
  font-size: 12px;
  color: #f56c6c;
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

.card-tag {
  margin-right: 4px;
  margin-bottom: 2px;
}
</style>
