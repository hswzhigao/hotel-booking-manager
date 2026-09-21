// 展示格式化工具

/** 金额：¥ + 两位小数 */
export function money(value) {
  const n = Number(value || 0)
  return `¥${n.toFixed(2)}`
}

/** 利润：正绿负红，保留两位小数 */
export function profitText(value) {
  const n = Number(value || 0)
  return (n > 0 ? '+' : '') + n.toFixed(2)
}

export function profitClass(value) {
  const n = Number(value || 0)
  return {
    'money-profit': true,
    positive: n > 0,
    negative: n < 0,
  }
}

/** 日期 YYYY-MM-DD */
export function dateText(value) {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

/** 日期时间 YYYY-MM-DD HH:mm:ss */
export function datetimeText(value) {
  if (!value) return '-'
  return String(value).slice(0, 19).replace('T', ' ')
}

/** 日期范围选择器值 → 后端参数（Date 对象或字符串均处理） */
export function toDateString(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  const d = new Date(value)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** DateTimePicker 值 → 后端 DATETIME 字符串 YYYY-MM-DD HH:mm:ss */
export function toDatetimeString(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 19).replace('T', ' ')
  const d = new Date(value)
  const p = (x) => String(x).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  )
}

/** "YYYY-MM-DD HH:mm:ss" → Date（供 DateTimePicker 回显） */
export function parseDatetime(str) {
  if (!str) return new Date()
  const s = String(str).slice(0, 19).replace('T', ' ')
  const d = new Date(s.replace(/-/g, '/'))
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export const STATUS_MAP = {
  active: { label: '进行中', type: 'primary' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
}

export function statusMeta(status) {
  return STATUS_MAP[status] || { label: status, type: 'info' }
}

// ===== V3 高尔夫 =====
export const GOLF_STATUS_MAP = {
  pending: { label: '待定位', type: 'warning' },
  booked: { label: '已定位', type: 'primary' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
}

export function golfStatusMeta(status) {
  return GOLF_STATUS_MAP[status] || { label: status, type: 'info' }
}

export const CHANNEL_MAP = {
  xianyu: '闲鱼',
  wechat: '微信',
}

export function channelText(channel) {
  return CHANNEL_MAP[channel] || channel || '-'
}

export const AVAILABILITY_MAP = {
  any: { label: '不限', type: 'info' },
  weekend_only: { label: '仅周末', type: 'warning' },
  weekday_only: { label: '仅工作日', type: 'success' },
}

export function availabilityMeta(availability) {
  return AVAILABILITY_MAP[availability] || AVAILABILITY_MAP.any
}

/** 更新月显示：3 →「3月」，空 →「未知」 */
export function monthText(month) {
  return month ? `${month}月` : '未知'
}

/** 日期字符串是否周末（周六/周日） */
export function isWeekend(dateStr) {
  if (!dateStr) return false
  const d = new Date(String(dateStr).slice(0, 10))
  return !Number.isNaN(d.getTime()) && (d.getDay() === 0 || d.getDay() === 6)
}
