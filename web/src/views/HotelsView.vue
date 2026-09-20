<template>
  <div class="page-card">
    <el-card shadow="never">
      <div class="page-toolbar">
        <el-input
          v-model="search"
          placeholder="搜索名称 / 城市 / 地址"
          clearable
          style="width: 240px"
          @keyup.enter="loadList(1)"
        />
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetSearch">重置</el-button>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建酒店</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" empty-text="暂无酒店数据" row-key="id" @expand-change="onExpandChange">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-wrap">
              <div class="expand-toolbar">
                <span class="expand-title">{{ row.name }} - 房型管理</span>
                <el-button size="small" type="primary" :icon="Plus" @click="openRoomCreate(row)">
                  新增房型
                </el-button>
              </div>
              <el-table
                :data="roomTypeMap[row.id] || []"
                size="small"
                empty-text="该酒店暂无房型，请先添加"
              >
                <el-table-column prop="name" label="房型名称" min-width="120" />
                <el-table-column prop="bed_type" label="床型" min-width="100">
                  <template #default="{ row: rt }">{{ rt.bed_type || '-' }}</template>
                </el-table-column>
                <el-table-column label="参考价" width="110" align="right">
                  <template #default="{ row: rt }">
                    <span class="money">{{ rt.default_price != null ? money(rt.default_price) : '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="notes" label="备注" min-width="140">
                  <template #default="{ row: rt }">{{ rt.notes || '-' }}</template>
                </el-table-column>
                <el-table-column label="操作" width="120">
                  <template #default="{ row: rt }">
                    <el-button text type="primary" size="small" @click="openRoomEdit(row, rt)">编辑</el-button>
                    <el-button text type="danger" size="small" @click="onRoomDelete(row, rt)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <el-text type="info" size="small">参考价仅作提示，预定价格在预定单中逐间填写</el-text>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="city" label="城市" min-width="90">
          <template #default="{ row }">{{ row.city || '-' }}</template>
        </el-table-column>
        <el-table-column prop="address" label="地址" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.address || '-' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="电话" min-width="120">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column prop="room_type_count" label="房型数" width="80" align="center" />
        <el-table-column prop="booking_count" label="预定数" width="80" align="center" />
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

    <!-- 酒店新建/编辑 Dialog -->
    <el-dialog
      v-model="formVisible"
      :title="form.id ? '编辑酒店' : '新建酒店'"
      width="480px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="60px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" maxlength="100" placeholder="酒店名称" />
        </el-form-item>
        <el-form-item label="城市">
          <el-input v-model="form.city" maxlength="50" placeholder="城市" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address" maxlength="255" placeholder="详细地址" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" maxlength="50" placeholder="联系电话" />
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

    <!-- 房型新建/编辑 Dialog -->
    <el-dialog
      v-model="roomFormVisible"
      :title="roomForm.id ? '编辑房型' : `新增房型 - ${roomForm.hotelName}`"
      width="440px"
      destroy-on-close
    >
      <el-form ref="roomFormRef" :model="roomForm" :rules="roomFormRules" label-width="70px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="roomForm.name" maxlength="100" placeholder="如：大床房" />
        </el-form-item>
        <el-form-item label="床型">
          <el-input v-model="roomForm.bed_type" maxlength="50" placeholder="如：1.8米大床" />
        </el-form-item>
        <el-form-item label="参考价" prop="default_price">
          <el-input-number
            v-model="roomForm.default_price"
            :min="0"
            :precision="2"
            :step="50"
            :controls="false"
            placeholder="参考价"
            style="width: 100%"
          />
          <div class="field-tip">参考价仅作提示，预定价格在预定单中逐间填写</div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="roomForm.notes" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roomFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="roomSaving" @click="onRoomSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { hotelsApi, roomTypesApi } from '../api'
import { money } from '../utils/format'

// ===== 列表 =====
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const search = ref('')

// 行展开的房型数据缓存：hotelId → room_types[]
const roomTypeMap = reactive({})

async function loadList(p = page.value) {
  loading.value = true
  try {
    const data = await hotelsApi.list({
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

async function loadRoomTypes(hotelId) {
  try {
    roomTypeMap[hotelId] = await roomTypesApi.listByHotel(hotelId)
  } catch (e) {
    roomTypeMap[hotelId] = []
  }
}

function onExpandChange(row, expandedRows) {
  if (expandedRows.some((r) => r.id === row.id)) {
    loadRoomTypes(row.id)
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

// ===== 酒店新建/编辑 =====
const formVisible = ref(false)
const formRef = ref(null)
const saving = ref(false)

const emptyForm = () => ({ id: null, name: '', city: '', address: '', phone: '', notes: '' })
const form = reactive(emptyForm())

const formRules = {
  name: [{ required: true, message: '请输入酒店名称', trigger: 'blur' }],
}

function openCreate() {
  Object.assign(form, emptyForm())
  formVisible.value = true
}

function openEdit(row) {
  Object.assign(form, emptyForm(), {
    id: row.id,
    name: row.name,
    city: row.city || '',
    address: row.address || '',
    phone: row.phone || '',
    notes: row.notes || '',
  })
  formVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const payload = {
    name: form.name,
    city: form.city || '',
    address: form.address || '',
    phone: form.phone || '',
    notes: form.notes || '',
  }
  saving.value = true
  try {
    if (form.id) {
      await hotelsApi.update(form.id, payload)
      ElMessage.success('酒店已更新')
    } else {
      await hotelsApi.create(payload)
      ElMessage.success('酒店已创建')
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
      `确定删除酒店「${row.name}」吗？无预定时将级联删除其全部房型。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    return
  }
  try {
    await hotelsApi.remove(row.id)
    ElMessage.success('酒店已删除')
    await loadList()
  } catch (e) {
    // 409 等错误提示已由拦截器统一处理
  }
}

// ===== 房型管理 =====
const roomFormVisible = ref(false)
const roomFormRef = ref(null)
const roomSaving = ref(false)

const emptyRoomForm = () => ({
  id: null,
  hotel_id: null,
  hotelName: '',
  name: '',
  bed_type: '',
  default_price: null,
  notes: '',
})
const roomForm = reactive(emptyRoomForm())

const roomFormRules = {
  name: [{ required: true, message: '请输入房型名称', trigger: 'blur' }],
}

function openRoomCreate(hotelRow) {
  Object.assign(roomForm, emptyRoomForm(), {
    hotel_id: hotelRow.id,
    hotelName: hotelRow.name,
  })
  roomFormVisible.value = true
}

function openRoomEdit(hotelRow, rt) {
  Object.assign(roomForm, emptyRoomForm(), {
    id: rt.id,
    hotel_id: hotelRow.id,
    hotelName: hotelRow.name,
    name: rt.name,
    bed_type: rt.bed_type || '',
    default_price: rt.default_price != null ? Number(rt.default_price) : null,
    notes: rt.notes || '',
  })
  roomFormVisible.value = true
}

async function onRoomSave() {
  const valid = await roomFormRef.value.validate().catch(() => false)
  if (!valid) return
  const payload = {
    hotel_id: roomForm.hotel_id,
    name: roomForm.name,
    bed_type: roomForm.bed_type || '',
    default_price: roomForm.default_price != null ? Number(roomForm.default_price) : null,
    notes: roomForm.notes || '',
  }
  roomSaving.value = true
  try {
    if (roomForm.id) {
      await roomTypesApi.update(roomForm.id, payload)
      ElMessage.success('房型已更新')
    } else {
      await roomTypesApi.create(payload)
      ElMessage.success('房型已创建')
    }
    roomFormVisible.value = false
    await loadRoomTypes(roomForm.hotel_id)
    await loadList()
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    roomSaving.value = false
  }
}

async function onRoomDelete(hotelRow, rt) {
  try {
    await ElMessageBox.confirm(
      `确定删除房型「${rt.name}」吗？被预定引用的房型无法删除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    return
  }
  try {
    await roomTypesApi.remove(rt.id)
    ElMessage.success('房型已删除')
    await loadRoomTypes(hotelRow.id)
    await loadList()
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

.expand-wrap {
  padding: 8px 12px 12px 48px;
}

.expand-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.expand-title {
  font-weight: 600;
  color: #303133;
}

.field-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 4px;
}
</style>
