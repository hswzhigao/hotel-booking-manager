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
        <el-select v-model="filters.active" placeholder="合作中" clearable style="width: 120px">
          <el-option label="合作中" :value="1" />
          <el-option label="已停用" :value="0" />
        </el-select>
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetFilters">重置</el-button>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate">新建权益人</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" empty-text="暂无权益人数据">
        <el-table-column prop="name" label="姓名" min-width="90" />
        <el-table-column prop="wechat" label="微信" min-width="110">
          <template #default="{ row }">{{ row.wechat || '-' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="电话" min-width="120">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column prop="benefit_types" label="持有权益" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.benefit_types || '-' }}</template>
        </el-table-column>
        <el-table-column label="标签" min-width="150">
          <template #default="{ row }">
            <el-tag v-if="row.willing_present" type="success" size="small">✓ 愿意到场</el-tag>
            <el-tag v-if="row.willing_assist" type="success" size="small">✓ 愿意协助</el-tag>
            <span v-if="!row.willing_present && !row.willing_assist">-</span>
          </template>
        </el-table-column>
        <el-table-column label="合作中" width="85" align="center">
          <template #default="{ row }">
            <el-tag :type="row.active ? 'success' : 'info'" size="small">
              {{ row.active ? '合作中' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="booking_count" label="关联预定数" width="95" align="center" />
        <el-table-column prop="notes" label="备注" min-width="140" show-overflow-tooltip>
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
      :title="form.id ? '编辑权益人' : '新建权益人'"
      width="480px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="92px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" maxlength="50" placeholder="权益人姓名" />
        </el-form-item>
        <el-form-item label="微信">
          <el-input v-model="form.wechat" maxlength="100" placeholder="微信 / 闲鱼号" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" maxlength="30" placeholder="手机号" />
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
import { Plus } from '@element-plus/icons-vue'
import { benefitHoldersApi } from '../api'

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
  benefit_types: '',
  willing_present: false,
  willing_assist: false,
  active: true,
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
    wechat: row.wechat || '',
    phone: row.phone || '',
    benefit_types: row.benefit_types || '',
    willing_present: !!row.willing_present,
    willing_assist: !!row.willing_assist,
    active: !!row.active,
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
      ElMessage.success('权益人已更新')
    } else {
      await benefitHoldersApi.create(payload)
      ElMessage.success('权益人已创建')
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
      `确定删除权益人「${row.name}」吗？被预定引用的权益人无法删除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    return
  }
  try {
    await benefitHoldersApi.remove(row.id)
    ElMessage.success('权益人已删除')
    await loadList()
  } catch (e) {
    // 409「该权益人已被预定引用，无法删除」等错误提示已由拦截器统一处理
  }
}

onMounted(() => loadList(1))
</script>

<style scoped>
.pager {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
