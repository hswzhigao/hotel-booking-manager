// 临时 V3.1 mock 层 —— 后端 golf-benefit-types 与 golf_orders.benefit_type_id 尚未实现（404），
// 用于渲染验证抽屉的种类联动逻辑。开启：localStorage.setItem('mock_golf_v31', '1')。
// 后端 V3.1 上线后：删除本文件，并把 api/index.js 中 golfMock.* 调用还原为 http 直连。
import http from './http'

const MOCK_KEY = 'mock_golf_v31'

const enabled = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MOCK_KEY) === '1'
  } catch (e) {
    return false
  }
}

// ---------- 权益种类字典（契约 seed：经典白高尔夫/中信银行=通用，金葵花=仅金桥） ----------
let mockTypes = [
  { id: 1, name: '经典白高尔夫', course_scope: 'all', notes: '东镇、金桥通用', created_at: '2026-09-01 10:00:00' },
  { id: 2, name: '中信银行', course_scope: 'all', notes: '', created_at: '2026-09-01 10:00:00' },
  { id: 3, name: '金葵花', course_scope: '上海金桥高尔夫尊运动公园', notes: '仅金桥可用', created_at: '2026-09-01 10:00:00' },
]
let nextTypeId = 4

// ---------- 预订人持有明细装饰（按 id 稳定分配三种画像） ----------
// 画像0：经典白6(10月更新)+金葵花3 → 合计9，用于球场过滤验证（金葵花仅金桥）
// 画像1：中信银行2(9月=本月更新) → 用于「本月更新」高亮验证
// 画像2：无高尔夫权益 → 用于抽屉「无适用种类」警示验证
const HOLDER_PROFILES = [
  (id) => [
    { id: id * 100 + 1, benefit_type_id: 1, type_name: '经典白高尔夫', course_scope: 'all', count_left: 6, refresh_month: 10 },
    { id: id * 100 + 3, benefit_type_id: 3, type_name: '金葵花', course_scope: '上海金桥高尔夫尊运动公园', count_left: 3, refresh_month: null },
  ],
  (id) => [
    { id: id * 100 + 2, benefit_type_id: 2, type_name: '中信银行', course_scope: 'all', count_left: 2, refresh_month: 9 },
  ],
  () => [],
]

// 名称解析用的引用快照（decorateHolders 自动登记预订人；客户在首次列表时拉取真实数据）
const refs = { holders: new Map(), customers: new Map() }

async function loadCustomerRefs() {
  if (refs.customers.size) return
  try {
    const data = await http.get('/customers', { params: { page: 1, page_size: 100 } })
    ;(data.items || []).forEach((c) => refs.customers.set(c.id, c.name))
  } catch (e) {
    /* 拉取失败时用占位名 */
  }
}

function holderName(id) {
  return refs.holders.get(Number(id)) || `预订人#${id}`
}

function customerName(id) {
  return refs.customers.get(Number(id)) || `客户#${id}`
}

function typeName(id) {
  const t = mockTypes.find((x) => x.id === Number(id))
  return t ? t.name : null
}

// benefit-holders 响应装饰：注入 golf_benefits 明细与合计，并删除 V3.1 已移除的单一字段
function decorateHolders(data) {
  if (!enabled() || !data) return data
  const items = (data.items || []).map((h) => {
    const golf_benefits = HOLDER_PROFILES[h.id % HOLDER_PROFILES.length](h.id)
    refs.holders.set(h.id, h.name)
    const decorated = { ...h, golf_benefits, golf_benefit_total: golf_benefits.reduce((s, b) => s + b.count_left, 0) }
    delete decorated.golf_benefit_count
    delete decorated.golf_refresh_month
    return decorated
  })
  return { ...data, items }
}

// ---------- 高尔夫订单 mock 存储 ----------
let mockOrders = [
  {
    id: 101, order_time: '2026-09-18 21:30:00', customer_name: '前端_高尔夫客户A', benefit_holder_name: '前端_测试预订人甲',
    course_name: '上海金桥高尔夫尊运动公园', play_date: '2026-09-26', tee_time: '08:30', players: 2,
    status: 'booked', teach_needed: 1, sale_price: 680, cost_price: 400, channel: 'xianyu',
    benefit_used: 1, benefit_type_id: 3, benefit_type_name: '金葵花', notes: '周末场',
  },
  {
    id: 102, order_time: '2026-09-15 12:10:00', customer_name: '前端_高尔夫客户B', benefit_holder_name: '前端_测试预订人乙',
    course_name: '上海东镇高尔夫球场', play_date: '2026-09-23', tee_time: null, players: 1,
    status: 'pending', teach_needed: 0, sale_price: 380, cost_price: 200, channel: 'wechat',
    benefit_used: 1, benefit_type_id: 1, benefit_type_name: '经典白高尔夫', notes: '',
  },
  {
    id: 103, order_time: '2026-09-10 09:00:00', customer_name: '前端_高尔夫客户A', benefit_holder_name: '前端_测试预订人甲',
    course_name: '上海金桥高尔夫尊运动公园', play_date: '2026-09-12', tee_time: '13:00', players: 4,
    status: 'completed', teach_needed: 0, sale_price: 1560, cost_price: 900, channel: 'xianyu',
    benefit_used: 1, benefit_type_id: 1, benefit_type_name: '经典白高尔夫', notes: '',
  },
  {
    id: 104, order_time: '2026-09-05 18:40:00', customer_name: '前端_高尔夫客户C', benefit_holder_name: null,
    course_name: '上海东镇高尔夫球场', play_date: '2026-09-08', tee_time: '09:00', players: 2,
    status: 'cancelled', teach_needed: 0, sale_price: 500, cost_price: 300, channel: 'xianyu',
    benefit_used: 0, benefit_type_id: null, benefit_type_name: null, notes: '客户爽约',
  },
]
let nextOrderId = 200

function nowStr() {
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function normalizeOrder(data, prev) {
  const d = data || {}
  const benefitTypeId = d.benefit_used === false || d.benefit_used === 0 || !d.benefit_type_id ? null : Number(d.benefit_type_id)
  return {
    ...(prev || {}),
    customer_id: d.customer_id ?? prev?.customer_id ?? null,
    benefit_holder_id: d.benefit_holder_id ?? prev?.benefit_holder_id ?? null,
    course_name: d.course_name ?? prev?.course_name ?? '',
    play_date: d.play_date ?? prev?.play_date ?? null,
    tee_time: d.tee_time ?? prev?.tee_time ?? null,
    players: d.players ?? prev?.players ?? 1,
    status: d.status ?? prev?.status ?? 'pending',
    teach_needed: d.teach_needed ?? prev?.teach_needed ?? 0,
    sale_price: Number(d.sale_price ?? prev?.sale_price ?? 0),
    cost_price: Number(d.cost_price ?? prev?.cost_price ?? 0),
    channel: d.channel ?? prev?.channel ?? 'xianyu',
    benefit_used: d.benefit_used === undefined ? prev?.benefit_used ?? 1 : d.benefit_used ? 1 : 0,
    benefit_type_id: benefitTypeId,
    order_time: d.order_time ?? prev?.order_time ?? nowStr(),
    notes: d.notes ?? prev?.notes ?? '',
  }
}

function withDisplayFields(o) {
  const holder = o.benefit_holder_id ? holderName(o.benefit_holder_id) : o.benefit_holder_name || null
  const customer = o.customer_id ? customerName(o.customer_id) : o.customer_name || `客户#${o.customer_id}`
  return {
    ...o,
    customer_name: customer,
    benefit_holder_name: holder,
    benefit_type_name: o.benefit_type_id ? typeName(o.benefit_type_id) : null,
    holder_availability: 'any',
    profit: Number(o.sale_price || 0) - Number(o.cost_price || 0),
  }
}

// ---------- 对外接口（mock 开启时生效，关闭时透传真实请求） ----------
export const golfMock = {
  decorateHolders,

  typesList: (params) =>
    enabled()
      ? Promise.resolve({ total: mockTypes.length, items: mockTypes.map((t) => ({ ...t })) })
      : http.get('/golf-benefit-types', { params }),
  typeCreate: (data) => {
    if (!enabled()) return http.post('/golf-benefit-types', data)
    const name = String(data?.name || '').trim()
    if (!name) return Promise.reject(new Error('请输入种类名称'))
    if (mockTypes.some((t) => t.name === name)) return Promise.reject(new Error('种类名称已存在'))
    const item = { id: nextTypeId++, name, course_scope: data.course_scope || 'all', notes: data.notes || '', created_at: nowStr() }
    mockTypes.push(item)
    return Promise.resolve({ id: item.id })
  },
  typeUpdate: (id, data) => {
    if (!enabled()) return http.put(`/golf-benefit-types/${id}`, data)
    const t = mockTypes.find((x) => x.id === Number(id))
    if (!t) return Promise.reject(new Error('种类不存在'))
    const name = String(data?.name || '').trim()
    if (name && name !== t.name && mockTypes.some((x) => x.name === name)) return Promise.reject(new Error('种类名称已存在'))
    Object.assign(t, { name: name || t.name, course_scope: data.course_scope ?? t.course_scope, notes: data.notes ?? t.notes })
    return Promise.resolve({ ok: true })
  },
  typeRemove: (id) => {
    if (!enabled()) return http.delete(`/golf-benefit-types/${id}`)
    mockTypes = mockTypes.filter((t) => t.id !== Number(id))
    return Promise.resolve({ ok: true })
  },

  ordersList: async (params) => {
    if (!enabled()) return http.get('/golf-orders', { params })
    await loadCustomerRefs()
    const p = params || {}
    let items = [...mockOrders]
    if (p.customer_id) items = items.filter((o) => o.customer_id === Number(p.customer_id))
    if (p.benefit_holder_id) items = items.filter((o) => o.benefit_holder_id === Number(p.benefit_holder_id))
    if (p.status) items = items.filter((o) => o.status === p.status)
    if (p.date_from) items = items.filter((o) => o.play_date >= p.date_from)
    if (p.date_to) items = items.filter((o) => o.play_date <= p.date_to)
    if (p.search) {
      const kw = String(p.search)
      items = items.filter((o) => (o.customer_name || '').includes(kw) || (o.course_name || '').includes(kw))
    }
    items.sort((a, b) => b.id - a.id)
    const size = Number(p.page_size) || 20
    const page = Math.max(1, Number(p.page) || 1)
    return {
      total: items.length,
      items: items.slice((page - 1) * size, page * size).map((o) => withDisplayFields(o)),
    }
  },
  orderDetail: async (id) => {
    if (!enabled()) return http.get(`/golf-orders/${id}`)
    await loadCustomerRefs()
    const o = mockOrders.find((x) => x.id === Number(id))
    if (!o) return Promise.reject(new Error('订单不存在'))
    return withDisplayFields(o)
  },
  orderCreate: async (data) => {
    if (!enabled()) return http.post('/golf-orders', data)
    await loadCustomerRefs()
    const o = normalizeOrder(data, null)
    o.id = nextOrderId++
    mockOrders.push(o)
    return Promise.resolve({ id: o.id })
  },
  orderUpdate: async (id, data) => {
    if (!enabled()) return http.put(`/golf-orders/${id}`, data)
    await loadCustomerRefs()
    const o = mockOrders.find((x) => x.id === Number(id))
    if (!o) return Promise.reject(new Error('订单不存在'))
    Object.assign(o, normalizeOrder(data, o))
    return Promise.resolve({ ok: true })
  },
  orderRemove: (id) => {
    if (!enabled()) return http.delete(`/golf-orders/${id}`)
    mockOrders = mockOrders.filter((o) => o.id !== Number(id))
    return Promise.resolve({ ok: true })
  },
  courses: () => {
    if (!enabled()) return http.get('/golf-orders/courses')
    const set = new Set(mockOrders.map((o) => o.course_name).filter(Boolean))
    return Promise.resolve([...set])
  },
}

export default golfMock
