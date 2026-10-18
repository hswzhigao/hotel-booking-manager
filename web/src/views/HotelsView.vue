<template>
  <div class="page-card">
    <el-card shadow="never">
      <div class="page-toolbar desktop-toolbar">
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

      <!-- 移动端工具栏（仅关键词搜索，无其余筛选，不设折叠开关） -->
      <div class="mobile-toolbar">
        <el-input
          v-model="search"
          class="toolbar-search"
          placeholder="搜索名称 / 城市 / 地址"
          clearable
          @keyup.enter="loadList(1)"
        />
        <el-button type="primary" @click="loadList(1)">查询</el-button>
        <el-button @click="resetSearch">重置</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建酒店</el-button>
      </div>

      <div class="desktop-table">
      <el-table :data="rows" v-loading="loading" empty-text="暂无酒店数据" row-key="id" @expand-change="onExpandChange">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-wrap">
              <div v-if="splitCheckinInfo(row.checkin_info_required).length" class="checkin-tags">
                <span class="checkin-tags-label">需提供信息：</span>
                <el-tag
                  v-for="t in splitCheckinInfo(row.checkin_info_required)"
                  :key="t"
                  size="small"
                  type="info"
                  class="checkin-tag"
                >
                  {{ t }}
                </el-tag>
              </div>
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
                <el-table-column label="参考价（每晚）" width="125" align="right">
                  <template #default="{ row: rt }">
                    <span class="money">{{ rt.default_price != null ? money(rt.default_price) : '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="价格档位" min-width="150">
                  <template #default="{ row: rt }">{{ ratesSummary(rt) || '-' }}</template>
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
              <el-text type="info" size="small">参考价（每晚）仅作提示；建单时选房型自动带出，也可点档位快速填价</el-text>
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
        <el-table-column label="入住政策" width="95" align="center">
          <template #default="{ row }">
            <el-tag :type="presenceMeta(row.checkin_presence).type" size="small">
              {{ presenceMeta(row.checkin_presence).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="room_type_count" label="房型数" width="80" align="center" />
        <el-table-column prop="booking_count" label="预定数" width="80" align="center" />
        <el-table-column label="操作" width="185" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button text type="primary" @click="openGuide(row)">指南</el-button>
            <el-button text type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <!-- 移动端卡片列表 -->
      <div class="mobile-cards" v-loading="loading">
        <el-empty v-if="!rows.length" description="暂无酒店数据" :image-size="60" />
        <div v-for="row in rows" :key="row.id" class="m-card">
          <div class="m-title">
            <span class="m-name">{{ row.name }}</span>
            <el-tag :type="presenceMeta(row.checkin_presence).type" size="small">
              {{ presenceMeta(row.checkin_presence).label }}
            </el-tag>
          </div>
          <div class="m-sub">{{ [row.city, row.address].filter(Boolean).join(' · ') || '-' }}</div>
          <div v-if="splitCheckinInfo(row.checkin_info_required).length" class="m-checkin-tags">
            <el-tag
              v-for="t in splitCheckinInfo(row.checkin_info_required)"
              :key="t"
              size="small"
              type="info"
              class="checkin-tag"
            >
              {{ t }}
            </el-tag>
          </div>
          <div class="m-line">
            <span class="m-label">房型/预定</span>
            <span class="m-value">{{ row.room_type_count }} / {{ row.booking_count }}</span>
          </div>
          <div class="m-actions">
            <el-button text type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button text type="primary" size="small" @click="openRoomTypes(row)">房型</el-button>
            <el-button text type="primary" size="small" @click="openGuide(row)">指南</el-button>
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
        <el-divider content-position="left" class="policy-divider">入住政策</el-divider>
        <el-form-item label="官方电话">
          <el-input v-model="form.official_phone" maxlength="50" placeholder="酒店官方电话（咨询入住用）" />
        </el-form-item>
        <el-form-item label="本人到场">
          <el-radio-group v-model="form.presenceValue">
            <el-radio-button value="unknown">未确认</el-radio-button>
            <el-radio-button value="present">需本人到场</el-radio-button>
            <el-radio-button value="absent">无需到场</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="需提供信息">
          <el-select
            v-model="form.checkinInfoValues"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            placeholder="选择预设值，或输入后回车自定义"
            style="width: 100%"
          >
            <el-option v-for="o in checkinInfoOptions" :key="o.id" :label="o.label" :value="o.label" />
          </el-select>
          <div class="field-tip">选项来自「基础配置」；自定义输入的新值只保存到本酒店，不进字典</div>
        </el-form-item>
        <el-form-item label="办理流程">
          <el-input
            v-model="form.checkin_process"
            type="textarea"
            :rows="2"
            maxlength="1000"
            placeholder="电话咨询结果整理，如：提前1天致电前台报预订人姓名"
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

    <!-- 房型新建/编辑 Dialog -->
    <el-dialog
      v-model="roomFormVisible"
      :title="roomForm.id ? '编辑房型' : `新增房型 - ${roomForm.hotelName}`"
      width="440px"
      destroy-on-close
    >
      <el-form ref="roomFormRef" :model="roomForm" :rules="roomFormRules" label-width="110px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="roomForm.name" maxlength="100" placeholder="如：大床房" />
        </el-form-item>
        <el-form-item label="床型">
          <el-input v-model="roomForm.bed_type" maxlength="50" placeholder="如：1.8米大床" />
        </el-form-item>
        <el-form-item label="参考价（每晚）" prop="default_price">
          <el-input-number
            v-model="roomForm.default_price"
            :min="0"
            :precision="2"
            :step="50"
            :controls="false"
            placeholder="参考价（每晚）"
            style="width: 100%"
          />
          <div class="field-tip">仅作提示，预定建单时自动带出，可改</div>
        </el-form-item>
        <el-form-item label="价格档位">
          <div class="rates-editor">
            <div v-for="(r, i) in roomForm.rates" :key="i" class="rate-row">
              <el-input v-model="r.label" maxlength="50" placeholder="档位名，如：平日" class="rate-label" />
              <el-input-number
                v-model="r.price"
                :min="0"
                :precision="2"
                :step="50"
                :controls="false"
                placeholder="每晚价"
                class="rate-price"
              />
              <el-button
                :icon="Delete"
                circle
                type="danger"
                plain
                size="small"
                title="删除档位"
                @click="roomForm.rates.splice(i, 1)"
              />
            </div>
            <el-button size="small" :icon="Plus" plain type="primary" @click="addRate">添加档位</el-button>
            <div class="field-tip">如：平日 520 / 周末 660 / 国庆 888；建单时点档位一键填入每晚价</div>
          </div>
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

    <!-- 入住指南 Dialog -->
    <el-dialog
      v-model="guideVisible"
      :title="`入住指南 - ${guideForm.hotelName}`"
      width="640px"
      destroy-on-close
      @close="flushGuideSave"
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="指南编辑后自动保存；可一键复制发送给客户"
        class="guide-tip"
      />
      <el-input
        v-model="guideForm.guide_text"
        type="textarea"
        :rows="10"
        placeholder="填写入住指南，如：办理入住时请出示身份证，报预订人姓名 XXX，前台电话 021-XXXXXXX…"
        @input="onGuideInput"
      />
      <div class="guide-status">
        <el-text v-if="guideSavedAt" type="success" size="small">已自动保存 {{ guideSavedAt }}</el-text>
        <el-text v-else-if="guideSaving" type="info" size="small">保存中…</el-text>
      </div>
      <template #footer>
        <el-button @click="guideVisible = false">关闭</el-button>
        <el-button type="primary" :icon="DocumentCopy" @click="onCopyGuide">复制指南</el-button>
      </template>
    </el-dialog>

    <!-- 移动端房型管理（桌面端由表格行展开承担；共用 openRoomCreate/openRoomEdit/onRoomDelete） -->
    <el-dialog
      v-model="mobileRoomsVisible"
      :title="`房型管理 - ${mobileRoomsHotel?.name || ''}`"
      width="92%"
      destroy-on-close
    >
      <div class="mobile-room-toolbar">
        <el-button size="small" type="primary" :icon="Plus" @click="openRoomCreate(mobileRoomsHotel)">
          新增房型
        </el-button>
        <el-text type="info" size="small">参考价（每晚）仅作提示，建单时可点档位快速填价</el-text>
      </div>
      <div v-for="rt in roomTypeMap[mobileRoomsHotel?.id] || []" :key="rt.id" class="mobile-room-row">
        <div class="mobile-room-info">
          <div class="mobile-room-name">{{ rt.name }}</div>
          <div class="mobile-room-meta">
            {{ rt.bed_type || '-' }} · {{ rt.default_price != null ? money(rt.default_price) : '无参考价' }}{{ rt.notes ? ` · ${rt.notes}` : '' }}
          </div>
          <div v-if="ratesSummary(rt)" class="mobile-room-rates">{{ ratesSummary(rt) }}</div>
        </div>
        <el-button text type="primary" size="small" @click="openRoomEdit(mobileRoomsHotel, rt)">编辑</el-button>
        <el-button text type="danger" size="small" @click="onRoomDelete(mobileRoomsHotel, rt)">删除</el-button>
      </div>
      <el-empty
        v-if="!(roomTypeMap[mobileRoomsHotel?.id] || []).length"
        description="该酒店暂无房型，请先添加"
        :image-size="60"
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, DocumentCopy } from '@element-plus/icons-vue'
import { hotelsApi, roomTypesApi, optionDictApi } from '../api'
import { money } from '../utils/format'

// ===== 「需提供信息」预设值字典（基础配置维护，酒店表单多选来源）=====
const checkinInfoOptions = ref([])

async function loadCheckinInfoOptions() {
  try {
    checkinInfoOptions.value = await optionDictApi.list({ category: 'checkin_info' })
  } catch (e) {
    checkinInfoOptions.value = []
  }
}

// 逗号分隔文本 → 标签数组（存储列复用，展示/回显统一走此函数）
function splitCheckinInfo(s) {
  return String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

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

const emptyForm = () => ({
  id: null,
  name: '',
  city: '',
  address: '',
  phone: '',
  notes: '',
  official_phone: '',
  presenceValue: 'unknown', // unknown=未确认(null) / present=需本人到场(1) / absent=无需到场(0)
  checkinInfoValues: [], // 需提供信息（数组，提交时 join(',') 存逗号文本）
  checkin_process: '',
})
const form = reactive(emptyForm())

// checkin_presence 徽标：1=需到场(橙) / 0=无需(绿) / 空=未确认(灰)
function presenceMeta(cp) {
  if (cp === 1) return { label: '需到场', type: 'warning' }
  if (cp === 0) return { label: '无需到场', type: 'success' }
  return { label: '未确认', type: 'info' }
}

function presenceToValue(cp) {
  if (cp === 1) return 'present'
  if (cp === 0) return 'absent'
  return 'unknown'
}

function valueToPresence(v) {
  if (v === 'present') return 1
  if (v === 'absent') return 0
  return null
}

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
    official_phone: row.official_phone || '',
    presenceValue: presenceToValue(row.checkin_presence),
    checkinInfoValues: splitCheckinInfo(row.checkin_info_required),
    checkin_process: row.checkin_process || '',
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
    official_phone: form.official_phone || '',
    checkin_presence: valueToPresence(form.presenceValue),
    checkin_info_required: form.checkinInfoValues.join(','),
    checkin_process: form.checkin_process || '',
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

// ===== 移动端房型管理（卡片「房型」按钮入口） =====
const mobileRoomsVisible = ref(false)
const mobileRoomsHotel = ref(null)

function openRoomTypes(row) {
  mobileRoomsHotel.value = row
  mobileRoomsVisible.value = true
  loadRoomTypes(row.id)
}

// ===== 入住指南 =====
const guideVisible = ref(false)
const guideSaving = ref(false)
const guideSavedAt = ref('')
const guideDirty = ref(false)
const guideForm = reactive({ hotelId: null, hotelName: '', guide_text: '' })
// 行快照：指南自动保存走整单 PUT（后端全字段更新），避免漏传字段被清空
let guideRowSnapshot = null
let guideSaveTimer = null

function openGuide(row) {
  clearTimeout(guideSaveTimer)
  guideRowSnapshot = row
  Object.assign(guideForm, {
    hotelId: row.id,
    hotelName: row.name,
    guide_text: row.guide_text || '',
  })
  guideSavedAt.value = ''
  guideDirty.value = false
  guideVisible.value = true
}

function onGuideInput() {
  guideDirty.value = true
  clearTimeout(guideSaveTimer)
  guideSaveTimer = setTimeout(saveGuide, 900)
}

async function saveGuide() {
  if (!guideForm.hotelId || guideSaving.value) return
  const row = guideRowSnapshot || {}
  const payload = {
    name: row.name || '',
    city: row.city || '',
    address: row.address || '',
    phone: row.phone || '',
    notes: row.notes || '',
    official_phone: row.official_phone || '',
    checkin_presence: row.checkin_presence ?? null,
    checkin_info_required: row.checkin_info_required || '',
    checkin_process: row.checkin_process || '',
    guide_text: guideForm.guide_text || '',
  }
  guideSaving.value = true
  try {
    await hotelsApi.update(guideForm.hotelId, payload)
    const d = new Date()
    const p = (x) => String(x).padStart(2, '0')
    guideSavedAt.value = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    guideDirty.value = false
    // 同步行快照，避免后续自动保存用旧值覆盖
    if (guideRowSnapshot) guideRowSnapshot.guide_text = guideForm.guide_text
  } catch (e) {
    // 错误提示已由拦截器统一处理
  } finally {
    guideSaving.value = false
  }
}

function flushGuideSave() {
  clearTimeout(guideSaveTimer)
  if (guideDirty.value) saveGuide()
}

async function onCopyGuide() {
  const text = (guideForm.guide_text || '').trim()
  if (!text) {
    ElMessage.warning('指南内容为空，请先填写')
    return
  }
  let ok = false
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      ok = true
    }
  } catch (e) {
    ok = false
  }
  if (!ok) {
    // headless / 非安全上下文降级：execCommand 兜底
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      ok = document.execCommand('copy')
      document.body.removeChild(ta)
    } catch (e) {
      ok = false
    }
  }
  if (ok) ElMessage.success('已复制，可粘贴发给客户')
  else ElMessage.error('复制失败，请手动选择文本复制')
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
  rates: [], // 价格档位 [{label, price}]，提交整组替换
  notes: '',
})
const roomForm = reactive(emptyRoomForm())

const roomFormRules = {
  name: [{ required: true, message: '请输入房型名称', trigger: 'blur' }],
}

// 档位摘要：如「平日¥520.00 · 国庆¥888.00」（列表/展开展示用）
function ratesSummary(rt) {
  return (rt.rates || [])
    .map((r) => `${r.label}¥${Number(r.price).toFixed(0)}`)
    .join(' · ')
}

function addRate() {
  roomForm.rates.push({ label: '', price: null })
}

// 表单档位行 → 提交数组：整行空忽略；有名无价/负价前端拦截（后端同样校验）
function ratesPayload() {
  const out = []
  for (const r of roomForm.rates) {
    const label = String(r.label || '').trim()
    if (!label && r.price == null) continue
    if (!label) {
      ElMessage.warning('档位名不能为空')
      return null
    }
    if (r.price == null || isNaN(Number(r.price)) || Number(r.price) < 0) {
      ElMessage.warning(`档位「${label}」价格不合法`)
      return null
    }
    out.push({ label, price: Number(r.price) })
  }
  return out
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
    rates: (rt.rates || []).map((r) => ({ label: r.label, price: Number(r.price) })),
    notes: rt.notes || '',
  })
  roomFormVisible.value = true
}

async function onRoomSave() {
  const valid = await roomFormRef.value.validate().catch(() => false)
  if (!valid) return
  const rates = ratesPayload()
  if (rates === null) return
  const payload = {
    hotel_id: roomForm.hotel_id,
    name: roomForm.name,
    bed_type: roomForm.bed_type || '',
    default_price: roomForm.default_price != null ? Number(roomForm.default_price) : null,
    rates,
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

onMounted(() => {
  loadList(1)
  loadCheckinInfoOptions()
})
</script>

<style scoped>
.pager {
  margin: 12px 0;
  justify-content: flex-end;
}

.expand-wrap {
  padding: 8px 12px 12px 48px;
}

/* 需提供信息标签串（行展开顶部） */
.checkin-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 4px 0 10px;
}

.checkin-tags-label {
  font-size: 13px;
  color: #606266;
}

.checkin-tag {
  margin-right: 0;
}

.m-checkin-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

/* 价格档位编辑器（房型 Dialog） */
.rates-editor {
  width: 100%;
}

.rate-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.rate-row:last-of-type {
  margin-bottom: 10px;
}

.rate-label {
  flex: 1;
  min-width: 0;
}

.rate-price {
  width: 120px;
  flex-shrink: 0;
}

/* 375px 下档位行折行：档位名独占一行，价格+删除按钮第二行 */
@media (max-width: 768px) {
  .rate-row {
    flex-wrap: wrap;
  }

  .rate-label {
    flex: 1 1 100%;
  }
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

.policy-divider {
  margin: 8px 0 16px;
}

.policy-divider :deep(.el-divider__text) {
  font-size: 13px;
  color: #409eff;
  font-weight: 600;
}

.guide-tip {
  margin-bottom: 12px;
}

.guide-status {
  height: 20px;
  margin-top: 6px;
}

.mobile-room-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.mobile-room-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f2f5;
}

.mobile-room-info {
  flex: 1;
  min-width: 0;
}

.mobile-room-name {
  font-weight: 600;
  color: #303133;
}

.mobile-room-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
  word-break: break-all;
}

.mobile-room-rates {
  font-size: 12px;
  color: #409eff;
  margin-top: 2px;
  word-break: break-all;
}
</style>
