<template>
  <div class="page-card">
    <el-card shadow="never">
      <div class="page-toolbar">
        <el-input
          v-model="search"
          placeholder="搜索姓名 / 微信 / 电话"
          clearable
          style="width: 240px"
          @keyup.enter="loadList(1)"
        />
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetSearch">重置</el-button>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建客户</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" empty-text="暂无客户数据">
        <el-table-column prop="name" label="姓名" min-width="90" />
        <el-table-column prop="wechat" label="微信" min-width="110">
          <template #default="{ row }">{{ row.wechat || '-' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="电话" min-width="120">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column label="剩余权益" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.benefit_count > 0 ? 'warning' : 'info'" size="small">
              {{ row.benefit_count }} 次
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="booking_count" label="预定次数" width="90" align="center" />
        <el-table-column prop="total_room_nights" label="间夜数" width="80" align="center" />
        <el-table-column label="累计消费" width="110" align="right">
          <template #default="{ row }"><span class="money">{{ money(row.total_spend) }}</span></template>
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
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" maxlength="50" placeholder="客户姓名" />
        </el-form-item>
        <el-form-item label="微信" prop="wechat">
          <el-input v-model="form.wechat" maxlength="100" placeholder="微信 / 闲鱼号" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="form.phone" maxlength="30" placeholder="手机号" />
        </el-form-item>
        <el-form-item label="剩余权益" prop="benefit_count">
          <el-input-number v-model="form.benefit_count" :min="0" :step="1" />
          <div class="field-tip">手动调整用于充值 / 纠错，预定消耗自动扣减</div>
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
    <el-drawer v-model="detailVisible" :title="`客户详情 - ${detail.customer?.name || ''}`" size="640px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="姓名">{{ detail.customer?.name }}</el-descriptions-item>
        <el-descriptions-item label="剩余权益">{{ detail.customer?.benefit_count }} 次</el-descriptions-item>
        <el-descriptions-item label="微信">{{ detail.customer?.wechat || '-' }}</el-descriptions-item>
        <el-descriptions-item label="电话">{{ detail.customer?.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="预定次数">{{ detail.customer?.booking_count }}</el-descriptions-item>
        <el-descriptions-item label="间夜数">{{ detail.customer?.total_room_nights }}</el-descriptions-item>
        <el-descriptions-item label="累计消费">
          <span class="money">{{ money(detail.customer?.total_spend) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.customer?.notes || '-' }}</el-descriptions-item>
      </el-descriptions>

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
          <template #default="{ row }"><span class="money">{{ money(row.sale_total) }}</span></template>
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
import { Plus } from '@element-plus/icons-vue'
import { customersApi } from '../api'
import { money, dateText, statusMeta } from '../utils/format'

// ===== 列表 =====
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const search = ref('')

async function loadList(p = page.value) {
  loading.value = true
  try {
    const data = await customersApi.list({
      page: p,
      page_size: pageSize.value,
      search: search.value || undefined,
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

function resetSearch() {
  search.value = ''
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
  wechat: '',
  phone: '',
  benefit_count: 0,
  notes: '',
})

const form = reactive(emptyForm())

const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  benefit_count: [{ required: true, message: '请填写剩余权益次数', trigger: 'blur' }],
}

function openCreate() {
  Object.assign(form, emptyForm())
  formVisible.value = true
}

function openEdit(row) {
  Object.assign(form, emptyForm(), {
    id: row.id,
    name: row.name,
    wechat: row.wechat || '',
    phone: row.phone || '',
    benefit_count: Number(row.benefit_count || 0),
    notes: row.notes || '',
  })
  formVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const payload = {
    name: form.name,
    wechat: form.wechat || '',
    phone: form.phone || '',
    benefit_count: form.benefit_count,
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
    // 错误提示已由拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除客户「${row.name}」吗？有预定记录的客户无法删除。`,
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
const detail = ref({ customer: null, bookings: [] })

async function openDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  try {
    detail.value = await customersApi.detail(row.id)
  } catch (e) {
    detail.value = { customer: null, bookings: [] }
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

.field-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 4px;
}

.detail-title {
  margin: 20px 0 8px;
  color: #303133;
}

.item-price-line {
  line-height: 1.6;
}
</style>
