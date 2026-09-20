// API 按域函数，严格对应 docs/architecture/system-design.md §5 契约
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

// ===== 统计 stats =====
export const statsApi = {
  summary: () => http.get('/stats/summary'),
}
