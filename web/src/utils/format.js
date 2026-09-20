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
