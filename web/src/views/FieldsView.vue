<template>
  <div class="page-card">
    <!-- ===== 普通字典分区（预设值 CRUD） ===== -->
    <el-card v-for="cat in CATEGORIES" :key="cat.category" shadow="never" class="dict-card" v-loading="loading">
      <div class="page-toolbar desktop-toolbar">
        <span class="cat-title">{{ cat.name }}</span>
        <span class="cat-meta">预设值 {{ (dictMap[cat.category] || []).length }} 项</span>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openCreate(cat)">新增预设值</el-button>
      </div>

      <div class="mobile-toolbar">
        <span class="cat-title">{{ cat.name }}</span>
        <span class="cat-meta">{{ (dictMap[cat.category] || []).length }} 项</span>
        <div class="toolbar-spacer" />
        <el-button size="small" type="primary" :icon="Plus" @click="openCreate(cat)">新增</el-button>
      </div>

      <div class="desktop-table">
        <el-table :data="dictMap[cat.category] || []" empty-text="暂无预设值" size="small">
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="label" :label="cat.valueLabel || '预设值'" min-width="160" />
          <el-table-column prop="sort" label="排序" width="80" align="center" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button text type="danger" size="small" @click="onDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 移动端卡片列表 -->
      <div class="mobile-cards">
        <el-empty
          v-if="!(dictMap[cat.category] || []).length"
          description="暂无预设值"
          :image-size="60"
        />
        <div v-for="row in dictMap[cat.category] || []" :key="row.id" class="m-card">
          <div class="m-title">
            <span class="m-name">{{ row.label }}</span>
            <span class="m-sort">排序 {{ row.sort }}</span>
          </div>
          <div class="m-actions">
            <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button text type="danger" size="small" @click="onDelete(row)">删除</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- ===== 高尔夫权益种类分区（业务字典：名称 + 适用球场范围） ===== -->
    <el-card shadow="never" class="dict-card" v-loading="typesLoading">
      <div class="page-toolbar desktop-toolbar">
        <span class="cat-title">高尔夫权益种类</span>
        <span class="cat-meta">共 {{ benefitTypes.length }} 种</span>
        <div class="toolbar-spacer" />
        <el-button type="primary" :icon="Plus" @click="openTypeCreate">新增种类</el-button>
      </div>

      <div class="mobile-toolbar">
        <span class="cat-title">高尔夫权益种类</span>
        <span class="cat-meta">{{ benefitTypes.length }} 种</span>
        <div class="toolbar-spacer" />
        <el-button size="small" type="primary" :icon="Plus" @click="openTypeCreate">新增</el-button>
      </div>

      <div class="desktop-table">
        <el-table :data="benefitTypes" empty-text="暂无权益种类" size="small">
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="name" label="名称" min-width="110" />
          <el-table-column label="适用球场" min-width="240">
            <template #default="{ row }">
              <el-tag v-if="scopeIsAll(row.course_scope)" type="success" size="small">全部球场通用</el-tag>
              <template v-else>
                <el-tag v-for="c in scopeList(row.course_scope)" :key="c" size="small" class="scope-tag">{{ c }}</el-tag>
              </template>
            </template>
          </el-table-column>
          <el-table-column prop="notes" label="备注" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.notes || '-' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button text type="primary" size="small" @click="openTypeEdit(row)">编辑</el-button>
              <el-button text type="danger" size="small" @click="onDeleteType(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="mobile-cards">
        <el-empty v-if="!benefitTypes.length" description="暂无权益种类" :image-size="60" />
        <div v-for="row in benefitTypes" :key="row.id" class="m-card">
          <div class="m-title">
            <span class="m-name">{{ row.name }}</span>
            <el-tag v-if="scopeIsAll(row.course_scope)" type="success" size="small">全部通用</el-tag>
          </div>
          <div v-if="!scopeIsAll(row.course_scope)" class="m-sub">{{ row.course_scope }}</div>
          <div class="m-actions">
            <el-button text type="primary" size="small" @click="openTypeEdit(row)">编辑</el-button>
            <el-button text type="danger" size="small" @click="onDeleteType(row)">删除</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 新增/编辑预设值 Dialog -->
    <el-dialog
      v-model="formVisible"
      :title="form.id ? '编辑预设值' : `新增预设值 - ${form.categoryName}`"
      width="420px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="70px">
        <el-form-item label="预设值" prop="label">
          <el-input v-model="form.label" maxlength="100" placeholder="如：身份证后四位" />
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="form.sort" :min="0" :max="9999" :step="1" :controls="false" style="width: 100%" />
          <div class="field-tip">数字越小越靠前</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑权益种类 Dialog -->
    <el-dialog
      v-model="typeVisible"
      :title="typeForm.id ? '编辑权益种类' : '新增权益种类'"
      width="480px"
      destroy-on-close
    >
      <el-form ref="typeFormRef" :model="typeForm" :rules="typeRules" label-width="82px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="typeForm.name" maxlength="100" placeholder="如：金葵花 / 经典白高尔夫" />
        </el-form-item>
        <el-form-item label="适用球场">
          <el-switch v-model="typeForm.allCourses" active-text="全部球场通用" />
        </el-form-item>
        <el-form-item v-if="!typeForm.allCourses" label="指定球场" required>
          <el-select
            v-model="typeForm.courses"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入球场（可多选）"
            style="width: 100%"
          >
            <el-option v-for="c in courseDictOptions" :key="c" :label="c" :value="c" />
          </el-select>
          <div class="field-tip">选项来自「高尔夫球场」字典；也可输入新球场。金葵花类仅限特定球场时用</div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="typeForm.notes" maxlength="500" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeVisible = false">取消</el-button>
        <el-button type="primary" :loading="typeSaving" @click="onSaveType">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { optionDictApi, golfBenefitTypesApi } from '../api'

// 类别常量（普通字典分区）
const CATEGORIES = [
  { category: 'checkin_info', name: '入住需提供信息', valueLabel: '预设值' },
  { category: 'golf_course', name: '高尔夫球场', valueLabel: '球场名称' },
]

// category → 预设值列表（GET 按 sort,id 排序）
const dictMap = reactive({})
const loading = ref(false)

async function loadCategory(cat) {
  try {
    dictMap[cat] = await optionDictApi.list({ category: cat })
  } catch (e) {
    dictMap[cat] = []
  }
}

async function loadAll() {
  loading.value = true
  await Promise.all(CATEGORIES.map((c) => loadCategory(c.category)))
  loading.value = false
}

// 球场字典选项（供权益种类的球场多选）
const courseDictOptions = computed(() => (dictMap.golf_course || []).map((x) => x.label))

// ===== 普通字典：新增/编辑 =====
const formVisible = ref(false)
const formRef = ref(null)
const saving = ref(false)

const emptyForm = () => ({ id: null, category: '', categoryName: '', label: '', sort: 0 })
const form = reactive(emptyForm())

const formRules = {
  label: [{ required: true, message: '请输入预设值', trigger: 'blur' }],
}

function openCreate(cat) {
  Object.assign(form, emptyForm(), { category: cat.category, categoryName: cat.name })
  formVisible.value = true
}

function openEdit(row) {
  const cat = CATEGORIES.find((c) => c.category === row.category)
  Object.assign(form, emptyForm(), {
    id: row.id,
    category: row.category,
    categoryName: cat ? cat.name : row.category,
    label: row.label,
    sort: Number(row.sort) || 0,
  })
  formVisible.value = true
}

async function onSave() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  const payload = { label: form.label, sort: Number(form.sort) || 0 }
  saving.value = true
  try {
    if (form.id) {
      await optionDictApi.update(form.id, payload)
      ElMessage.success('预设值已更新')
    } else {
      await optionDictApi.create({ ...payload, category: form.category })
      ElMessage.success('预设值已创建')
    }
    formVisible.value = false
    await loadCategory(form.category)
  } catch (e) {
    // 400（同类别重复）等错误提示已由拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  const tip = row.category === 'golf_course'
    ? '纯字典数据，删除后新订单的球场下拉不再预置它（历史订单不受影响）'
    : '纯字典数据，删除不影响已保存的酒店信息'
  try {
    await ElMessageBox.confirm(`确定删除「${row.label}」吗？${tip}。`, '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch (e) {
    return
  }
  try {
    await optionDictApi.remove(row.id)
    ElMessage.success('预设值已删除')
    await loadCategory(row.category)
  } catch (e) {
    // 错误提示已由拦截器统一处理
  }
}

// ===== 权益种类（业务字典：golf_benefit_types） =====
const typesLoading = ref(false)
const benefitTypes = ref([])
const typeVisible = ref(false)
const typeFormRef = ref(null)
const typeSaving = ref(false)

const emptyTypeForm = () => ({ id: null, name: '', allCourses: true, courses: [], notes: '' })
const typeForm = reactive(emptyTypeForm())

const typeRules = {
  name: [{ required: true, message: '请输入种类名称', trigger: 'blur' }],
}

function scopeIsAll(scope) {
  return !scope || scope === 'all'
}

function scopeList(scope) {
  return String(scope || '').split(',').map((x) => x.trim()).filter(Boolean)
}

async function loadTypes() {
  typesLoading.value = true
  try {
    const data = await golfBenefitTypesApi.list()
    benefitTypes.value = Array.isArray(data) ? data : (data.items || [])
  } catch (e) {
    benefitTypes.value = []
  } finally {
    typesLoading.value = false
  }
}

function openTypeCreate() {
  Object.assign(typeForm, emptyTypeForm())
  typeVisible.value = true
}

function openTypeEdit(row) {
  Object.assign(typeForm, emptyTypeForm(), {
    id: row.id,
    name: row.name || '',
    allCourses: scopeIsAll(row.course_scope),
    courses: scopeIsAll(row.course_scope) ? [] : scopeList(row.course_scope),
    notes: row.notes || '',
  })
  typeVisible.value = true
}

async function onSaveType() {
  const valid = await typeFormRef.value.validate().catch(() => false)
  if (!valid) return
  if (!typeForm.allCourses && !typeForm.courses.length) {
    ElMessage.warning('请选择至少一个球场，或改为全部通用')
    return
  }
  const payload = {
    name: typeForm.name.trim(),
    course_scope: typeForm.allCourses ? 'all' : typeForm.courses.join(','),
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
    typeVisible.value = false
    await loadTypes()
  } catch (e) {
    // 400 重名 / 409 被引用等错误提示已由拦截器统一处理
  } finally {
    typeSaving.value = false
  }
}

async function onDeleteType(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除权益种类「${row.name}」吗？被预订人持有或订单引用时无法删除。`,
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

onMounted(() => {
  loadAll()
  loadTypes()
})
</script>

<style scoped>
.dict-card {
  margin-bottom: 16px;
}

.cat-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.cat-meta {
  font-size: 12px;
  color: #909399;
}

.field-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-top: 4px;
  width: 100%;
}

.m-sort {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}

.m-sub {
  font-size: 12px;
  color: #909399;
  margin: 4px 0;
}

.scope-tag {
  margin-right: 4px;
}
</style>
