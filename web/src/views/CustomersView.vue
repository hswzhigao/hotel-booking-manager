<template>
  <div class="page-card">
    <el-card shadow="never">
      <div class="page-toolbar desktop-toolbar">
        <el-input
          v-model="filters.search"
          placeholder="搜索姓名 / 闲鱼号 / 微信号 / 电话"
          clearable
          style="width: 220px"
          @keyup.enter="loadList(1)"
        />
        <el-select v-model="filters.is_hotel" placeholder="酒店客户" clearable style="width: 120px">
          <el-option label="酒店客户" :value="1" />
          <el-option label="非酒店客户" :value="0" />
        </el-select>
        <el-select v-model="filters.is_golf" placeholder="高尔夫客户" clearable style="width: 130px">
          <el-option label="高尔夫客户" :value="1" />
          <el-option label="非高尔夫客户" :value="0" />
        </el-select>
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <el-button :icon="Download" @click="exportCsv">导出</el-button>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建客户</el-button>
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
        <el-button type="primary" :icon="Plus" circle title="新建客户" @click="openCreate" />
        <el-button :icon="Download" circle title="导出" @click="exportCsv" />
        <div v-show="filtersExpanded" class="filter-extra">
          <el-select v-model="filters.is_hotel" placeholder="酒店客户" clearable>
            <el-option label="酒店客户" :value="1" />
            <el-option label="非酒店客户" :value="0" />
          </el-select>
          <el-select v-model="filters.is_golf" placeholder="高尔夫客户" clearable>
            <el-option label="高尔夫客户" :value="1" />
            <el-option label="非高尔夫客户" :value="0" />
          </el-select>
          <el-button @click="resetFilters">重置</el-button>
          
        </div>
      </div>

      <div class="desktop-table">
      <el-table :data="rows" v-loading="loading" empty-text="暂无客户数据">
        <el-table-column prop="name" label="姓名" min-width="90" />
        <el-table-column prop="xianyu_id" label="闲鱼号" min-width="110">
          <template #default="{ row }">{{ row.xianyu_id || '-' }}</template>
        </el-table-column>
        <el-table-column prop="wechat_id" label="微信号" min-width="110">
          <template #default="{ row }">{{ row.wechat_id || '-' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="电话" min-width="120">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column label="标签" width="150" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.is_hotel" type="primary" size="small">酒店</el-tag>
            <el-tag v-if="row.is_golf" type="success" size="small" class="tag-gap">高尔夫</el-tag>
            <span v-if="!row.is_hotel && !row.is_golf">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="booking_count" label="预定次数" width="90" align="center" />
        <el-table-column prop="total_room_nights" label="间夜数" width="80" align="center" />
        <el-table-column label="累计消费" width="110" align="right">
          <template #default="{ row }"><span class="money money-revenue">{{ money(row.total_spend) }}</span></template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.notes || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button text type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <!-- 移动端卡片列表 -->
      <div class="mobile-cards" v-loading="loading">
        <el-empty v-if="!rows.length" description="暂无客户数据" :image-size="60" />
        <div v-for="row in rows" :key="row.id" class="m-card">
          <div class="m-title">
            <span class="m-name">{{ row.name }}</span>
            <span class="m-tags">
              <el-tag v-if="row.is_hotel" type="primary" size="small">酒店</el-tag>
              <el-tag v-if="row.is_golf" type="success" size="small" class="tag-gap">高尔夫</el-tag>
              <span v-if="!row.is_hotel && !row.is_golf" class="m-summary">无标签</span>
            </span>
          </div>
          <div class="m-line">
            <span class="m-label">闲鱼号</span>
            <span class="m-value">{{ row.xianyu_id || '-' }}</span>
          </div>
          <div class="m-line">
            <span class="m-label">微信号</span>
            <span class="m-value">{{ row.wechat_id || '-' }}</span>
          </div>
          <div class="m-line">
            <span class="m-label">电话</span>
            <span class="m-value">{{ row.phone || '-' }}</span>
          </div>
          <div class="m-line">
            <span class="m-label">累计消费</span>
            <span class="m-value money money-revenue">{{ money(row.total_spend) }}</span>
          </div>
          <div class="m-line">
            <span class="m-label">间夜数</span>
            <span class="m-value">{{ row.total_room_nights }}</span>
          </div>
          <div class="m-actions">
            <el-button text type="primary" size="small" @click="openDetail(row)">详情</el-button>
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
      :title="form.id ? '编辑客户' : '新建客户'"
      width="480px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" maxlength="50" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="闲鱼号" prop="xianyu_id">
          <el-input v-model="form.xianyu_id" maxlength="100" placeholder="闲鱼号" />
        </el-form-item>
        <el-form-item label="微信号" prop="wechat_id">
          <el-input v-model="form.wechat_id" maxlength="100" placeholder="微信号" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="form.phone" maxlength="30" placeholder="手机号" />
        </el-form-item>
        <el-form-item label="酒店客户">
          <el-switch v-model="form.is_hotel" active-text="酒店客户" />
        </el-form-item>
        <el-form-item label="高尔夫客户">
          <el-switch v-model="form.is_golf" active-text="高尔夫客户" />
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

    <!-- 客户详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="`客户详情 - ${detail.customer?.name || ''}`" size="720px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="姓名">{{ detail.customer?.name }}</el-descriptions-item>
        <el-descriptions-item label="标签">
          <el-tag v-if="detail.customer?.is_hotel" type="primary" size="small">酒店</el-tag>
          <el-tag v-if="detail.customer?.is_golf" type="success" size="small" class="tag-gap">高尔夫</el-tag>
          <span v-if="!detail.customer?.is_hotel && !detail.customer?.is_golf">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="闲鱼号">{{ detail.customer?.xianyu_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="微信号">{{ detail.customer?.wechat_id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="电话">{{ detail.customer?.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="预定次数">{{ detail.customer?.booking_count }}</el-descriptions-item>
        <el-descriptions-item label="高尔夫订单数">{{ (detail.golf_orders || []).length }}</el-descriptions-item>
        <el-descriptions-item label="间夜数">{{ detail.customer?.total_room_nights }}</el-descriptions-item>
        <el-descriptions-item label="累计消费">
          <span class="money money-revenue">{{ money(detail.customer?.total_spend) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.customer?.notes || '-' }}</el-descriptions-item>
      </el-descriptions>

      <h4 class="detail-title">高尔夫订单</h4>
      <el-table
        :data="detail.golf_orders || []"
        v-loading="detailLoading"
        empty-text="暂无高尔夫订单"
        size="small"
      >
        <el-table-column prop="play_date" label="打球日期" width="105">
          <template #default="{ row }">{{ dateText(row.play_date) }}</template>
        </el-table-column>
        <el-table-column prop="course_name" label="球场" min-width="120" show-overflow-tooltip />
        <el-table-column label="预订人" width="90">
          <template #default="{ row }">{{ row.benefit_holder_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="权益种类" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.benefit_type_name" type="warning" size="small">{{ row.benefit_type_name }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="players" label="人数" width="60" align="center" />
        <el-table-column label="卖价" width="95" align="right">
          <template #default="{ row }"><span class="money money-revenue">{{ money(row.sale_price) }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="golfStatusMeta(row.status).type" size="small">
              {{ golfStatusMeta(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <h4 class="detail-title">历史预定</h4>
      <el-table :data="detail.bookings || []" v-loading="detailLoading" empty-text="暂无预定记录" size="small">
        <el-table-column label="入住/离店" width="160">
          <template #default="{ row }">{{ dateText(row.check_in) }} ~ {{ dateText(row.check_out) }}</template>
        </el-table-column>
        <el-table-column prop="hotel_name" label="酒店" min-width="110" />
        <el-table-column label="晚数" width="55" align="center">
          <template #default="{ row }">{{ row.nights }}</template>
        </el-table-column>
        <el-table-column label="间数" width="55" align="center">
          <template #default="{ row }">{{ row.room_count }}</template>
        </el-table-column>
        <el-table-column label="明细（每间价格）" min-width="180">
          <template #default="{ row }">
            <div v-for="(it, i) in row.items || []" :key="i" class="item-price-line">
              {{ it.room_type_name }}：{{ money(it.price) }}
            </div>
            <div v-if="!row.items || !row.items.length">-</div>
          </template>
        </el-table-column>
        <el-table-column label="总价" width="95" align="right">
          <template #default="{ row }"><span class="money money-revenue">{{ money(row.sale_total) }}</span></template>
        </el-table-column>
        <el-table-column label="权益" width="60" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.benefit_used" type="warning" size="small">已用</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="statusMeta(row.status).type" size="small">{{ statusMeta(row.status).label }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Download } from '@element-plus/icons-vue'
import { customersApi, exportApi } from '../api'
import { money, dateText, statusMeta, golfStatusMeta } from '../utils/format'

// ===== 列表 =====
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
// 移动端筛选折叠开关（桌面端由 CSS display:contents 还原平铺，不受影响）
const filtersExpanded = ref(false)

const filters = reactive({
  search: '',
  is_hotel: null,
  is_golf: null,
})

async function exportCsv() {
  await exportApi.customers({
    search: filters.search || undefined,
    is_hotel: filters.is_hotel ?? undefined,
    is_golf: filters.is_golf ?? undefined,
  })
}

async function loadList(p = page.value) {
  loading.value = true
  try {
    const data = await customersApi.list({
      page: p,
      page_size: pageSize.value,
      search: filters.search || undefined,
      is_hotel: filters.is_hotel ?? undefined,
      is_golf: filters.is_golf ?? undefined,
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
  filters.is_hotel = null
  filters.is_golf = null
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
  xianyu_id: '',
  wechat_id: '',
  phone: '',
  is_hotel: true,
  is_golf: false,
  notes: '',
})

const form = reactive(emptyForm())

const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
}

function openCreate() {
  Object.assign(form, emptyForm())
  formVisible.value = true
}

function openEdit(row) {
  Object.assign(form, emptyForm(), {
    id: row.id,
    name: row.name,
    xianyu_id: row.xianyu_id || '',
    wechat_id: row.wechat_id || '',
    phone: row.phone || '',
    is_hotel: !!row.is_hotel,
    is_golf: !!row.is_golf,
    notes: row.notes || '',
  })
  formVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const payload = {
    name: form.name,
    xianyu_id: form.xianyu_id || '',
    wechat_id: form.wechat_id || '',
    phone: form.phone || '',
    is_hotel: form.is_hotel ? 1 : 0,
    is_golf: form.is_golf ? 1 : 0,
    notes: form.notes || '',
  }
  saving.value = true
  try {
    if (form.id) {
      await customersApi.update(form.id, payload)
      ElMessage.success('客户已更新')
    } else {
      await customersApi.create(payload)
      ElMessage.success('客户已创建')
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
      `确定删除客户「${row.name}」吗？有预定或高尔夫订单记录的客户无法删除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    return
  }
  try {
    await customersApi.remove(row.id)
    ElMessage.success('客户已删除')
    await loadList()
  } catch (e) {
    // 409 等错误提示已由拦截器统一处理
  }
}

// ===== 详情 =====
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref({ customer: null, bookings: [], golf_orders: [] })

async function openDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  try {
    detail.value = await customersApi.detail(row.id)
  } catch (e) {
    detail.value = { customer: null, bookings: [], golf_orders: [] }
  } finally {
    detailLoading.value = false
  }
}

onMounted(() => loadList(1))
</script>

<style scoped>
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}

.tag-gap {
  margin-left: 4px;
}

.detail-title {
  margin: 20px 0 8px;
  color: #303133;
}

.item-price-line {
  line-height: 1.6;
}
</style>
