// API 按域函数，严格对应 docs/architecture/system-design.md §5 契约
// V2 扩展对应 docs/architecture/v2-checkin-policy.md §3：
//   hotels 列表/详情新增 checkin_presence/checkin_info_required/checkin_process/official_phone/guide_text，
//   POST/PUT 直接随 data 透传；bookings 新增可选 benefit_holder_id（POST/PUT）与
//   benefit_holder_id/benefit_holder_name（列表/详情返回），同样走既有函数，无需改签名。
import http from './http'

// ===== 认证 auth =====
export const authApi = {
  login: (data) => http.post('/auth/login', data), // {username,password} → {token,username}
  me: () => http.get('/auth/me'), // → {username}
  changePassword: (data) => http.post('/auth/change-password', data), // {old_password,new_password} → {ok:true}
}

// ===== 酒店 hotels =====
export const hotelsApi = {
  list: (params) => http.get('/hotels', { params }), // ?search=&page=&page_size=
  create: (data) => http.post('/hotels', data),
  update: (id, data) => http.put(`/hotels/${id}`, data),
  remove: (id) => http.delete(`/hotels/${id}`),
}

// ===== 房型 room-types =====
export const roomTypesApi = {
  listByHotel: (hotelId) => http.get(`/hotels/${hotelId}/room-types`),
  create: (data) => http.post('/room-types', data),
  update: (id, data) => http.put(`/room-types/${id}`, data),
  remove: (id) => http.delete(`/room-types/${id}`),
}

// ===== 客户 customers =====
export const customersApi = {
  list: (params) => http.get('/customers', { params }), // ?search=&page=&page_size=
  detail: (id) => http.get(`/customers/${id}`), // {customer, bookings}
  create: (data) => http.post('/customers', data),
  update: (id, data) => http.put(`/customers/${id}`, data),
  remove: (id) => http.delete(`/customers/${id}`),
}

// ===== 预定 bookings =====
export const bookingsApi = {
  list: (params) => http.get('/bookings', { params }), // ?customer_id=&hotel_id=&status=&date_from=&date_to=&search=&page=&page_size=
  detail: (id) => http.get(`/bookings/${id}`),
  create: (data) => http.post('/bookings', data),
  update: (id, data) => http.put(`/bookings/${id}`, data),
  remove: (id) => http.delete(`/bookings/${id}`),
}

// ===== 权益人 benefit-holders（V2 新增，全组需登录）=====
export const benefitHoldersApi = {
  // ?search=&willing_present=&willing_assist=&active=&page=&page_size=
  // → {total, items:[{id,name,wechat,phone,benefit_types,willing_present,willing_assist,active,notes,booking_count,created_at}]}
  list: (params) => http.get('/benefit-holders', { params }),
  // {name!,wechat,phone,benefit_types,willing_present,willing_assist,active,notes} → {id}
  create: (data) => http.post('/benefit-holders', data),
  update: (id, data) => http.put(`/benefit-holders/${id}`, data),
  // 被预定引用 → 409「该权益人已被预定引用，无法删除」
  remove: (id) => http.delete(`/benefit-holders/${id}`),
}

// ===== 统计 stats =====
export const statsApi = {
  summary: () => http.get('/stats/summary'),
}
