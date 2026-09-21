// API 按域函数，严格对应 docs/architecture/system-design.md §5 契约
// V2 扩展对应 docs/architecture/v2-checkin-policy.md §3：
//   hotels 列表/详情新增 checkin_presence/checkin_info_required/checkin_process/official_phone/guide_text，
//   POST/PUT 直接随 data 透传；bookings 新增可选 benefit_holder_id（POST/PUT）与
//   benefit_holder_id/benefit_holder_name（列表/详情返回），同样走既有函数，无需改签名。
import http from './http'
// V3.1 mock 层（后端接口未实现时的渲染验证开关，见 golfMock.js 文件头说明）
import { golfMock } from './golfMock'

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

// ===== 预订人 benefit-holders（V2 引入，V3.1 字段扩展，全组需登录）=====
export const benefitHoldersApi = {
  // ?search=&willing_present=&willing_assist=&active=&availability=&page=&page_size=
  // → {total, items:[{id,name,wechat,phone,benefit_types,card_type,willing_present,willing_assist,active,
  //    hotel_benefit_count,availability,
  //    golf_benefits:[{id,benefit_type_id,type_name,course_scope,count_left,refresh_month}],  // V3.1 明细
  //    golf_benefit_total,                                                  // V3.1 = SUM(count_left)
  //    hotel_refresh_month,notes,booking_count,golf_order_count,created_at}]}
  // （V3.1 已移除单一 golf_benefit_count / golf_refresh_month 字段）
  list: (params) =>
    http.get('/benefit-holders', { params }).then((data) => golfMock.decorateHolders(data)),
  // {name!,wechat,phone,benefit_types,card_type,willing_present,willing_assist,active,
  //  hotel_benefit_count,hotel_refresh_month(1-12或空),availability(any|weekend_only|weekday_only),
  //  golf_benefits:[{benefit_type_id,count_left,refresh_month}](整组替换),notes} → {id}
  create: (data) => http.post('/benefit-holders', data),
  update: (id, data) => http.put(`/benefit-holders/${id}`, data),
  // 被酒店预定或高尔夫订单引用 → 409
  remove: (id) => http.delete(`/benefit-holders/${id}`),
}

// ===== 高尔夫权益种类 golf-benefit-types（V3.1 新增字典，全组需登录）=====
export const golfBenefitTypesApi = {
  // → {total, items:[{id,name,course_scope('all'或逗号分隔球场名),notes,created_at}]}
  list: (params) => golfMock.typesList(params),
  // {name!,course_scope('all'或球场名串),notes} → {id}
  create: (data) => golfMock.typeCreate(data),
  update: (id, data) => golfMock.typeUpdate(id, data),
  // 被持有明细引用 → 409
  remove: (id) => golfMock.typeRemove(id),
}

// ===== 高尔夫订单 golf-orders（V3 新增，V3.1 扩展，全组需登录）=====
export const golfOrdersApi = {
  // ?customer_id=&benefit_holder_id=&status=&date_from=&date_to=&search=&page=&page_size=
  // → {total, items:[{...,customer_name,benefit_holder_name,benefit_type_name,
  //    holder_availability,profit}]}
  list: (params) => golfMock.ordersList(params),
  detail: (id) => golfMock.orderDetail(id),
  // {customer_id!,course_name!,play_date!,tee_time?,players?,status?,teach_needed?,
  //  sale_price?,cost_price?,channel?,benefit_used?,benefit_type_id?(benefit_used=1 必填),
  //  order_time?,notes?,benefit_holder_id?} → {id}
  create: (data) => golfMock.orderCreate(data),
  update: (id, data) => golfMock.orderUpdate(id, data),
  remove: (id) => golfMock.orderRemove(id),
  // 历史球场名去重列表（供球场输入下拉）
  courses: () => golfMock.courses(),
}

// ===== 统计 stats =====
export const statsApi = {
  summary: () => http.get('/stats/summary'),
}
