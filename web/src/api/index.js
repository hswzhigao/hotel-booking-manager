// API 按域函数，严格对应 docs/architecture/system-design.md §5 契约
// V2 扩展对应 docs/architecture/v2-checkin-policy.md §3：
//   hotels 列表/详情新增 checkin_presence/checkin_info_required/checkin_process/official_phone/guide_text，
//   POST/PUT 直接随 data 透传；bookings 新增可选 benefit_holder_id（POST/PUT）与
//   benefit_holder_id/benefit_holder_name（列表/详情返回），同样走既有函数，无需改签名。
// V3.2（docs/architecture/v3_2-hotel-workflow.md §5）：
//   bookings POST/PUT 新增 status(10 态)/breakfast_included/holder_settled/benefit_count_used(1-99)，
//   列表/详情返回 holder_source_channel（JOIN benefit_holders，供结算提示）。
// V3.3（docs/architecture/v3_3-channel-stats.md）：
//   bookings POST/PUT/响应新增 channel(xianyu/wechat/other，默认 xianyu)；
//   benefit-holders POST/PUT/响应新增 source_channel/provides_hotel/provides_golf，
//   GET 筛选支持 provides_hotel=/provides_golf=；
//   stats/summary 新增 today_sale/today_cost/today_profit 与 channels[]。
//   （V3.1 临时 mock 层已拆除，全部直连真实后端。）
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
  listByHotel: (hotelId) => http.get(`/hotels/${hotelId}/room-types`), // 每房型含 rates:[{id,label,price}]（V5 价格档位）
  create: (data) => http.post('/room-types', data), // 可带 rates:[{label,price}] 整组写入
  update: (id, data) => http.put(`/room-types/${id}`, data), // rates 不传=不动，传 []=清空，传数组=整组替换
  remove: (id) => http.delete(`/room-types/${id}`),
}

// ===== 字段字典 option-dict（V5 引入，预设值字典，删除无引用保护）=====
export const optionDictApi = {
  // ?category=（必填）→ [{id,category,label,sort,created_at}]（按 sort,id 排序）
  list: (params) => http.get('/option-dict', { params }),
  // {category!,label!,sort?} → {id}；同类别重复 label → 400
  create: (data) => http.post('/option-dict', data),
  // {label!,sort?} → {ok:true}
  update: (id, data) => http.put(`/option-dict/${id}`, data),
  remove: (id) => http.delete(`/option-dict/${id}`),
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
  // ?customer_id=&hotel_id=&status=&date_from=&date_to=&search=&page=&page_size=
  // PUT 需全量提交（含所有字段）；400 文案（如「该预订人剩余酒店权益不足」「权益张数应为 1-99」）由拦截器透出
  list: (params) => http.get('/bookings', { params }),
  detail: (id) => http.get(`/bookings/${id}`),
  // {customer_id!,hotel_id!,check_in!,check_out!,items:[{room_type_id!,price!}],
  //  cost_total?,order_time?,benefit_holder_id?,benefit_used?,benefit_count_used?(1-99),
  //  status?(10 态),channel?(xianyu/wechat/other),breakfast_included?,holder_settled?,notes?} → {id}
  create: (data) => http.post('/bookings', data),
  update: (id, data) => http.put(`/bookings/${id}`, data),
  remove: (id) => http.delete(`/bookings/${id}`),
}

// ===== 预订人 benefit-holders（V2 引入，V3.1/V3.3 字段扩展，全组需登录）=====
export const benefitHoldersApi = {
  // ?search=&willing_present=&willing_assist=&active=&availability=&provides_hotel=&provides_golf=&page=&page_size=
  // → {total, items:[{id,name,wechat,phone,benefit_types,card_type,source_channel,
  //    provides_hotel,provides_golf,willing_present,willing_assist,active,
  //    hotel_benefit_count,availability,
  //    golf_benefits:[{id,benefit_type_id,type_name,course_scope,count_left,refresh_month}],  // V3.1 明细
  //    golf_benefit_total,                                                  // V3.1 = SUM(count_left)
  //    hotel_refresh_month,notes,booking_count,golf_order_count,created_at}]}
  list: (params) => http.get('/benefit-holders', { params }),
  // {name!,wechat,phone,benefit_types,card_type,source_channel?(xianyu/wechat/other，默认 other),
  //  provides_hotel?,provides_golf?(默认 1)，willing_present,willing_assist,active,
  //  hotel_benefit_count,hotel_refresh_month(1-12或空),availability(any|weekend_only|weekday_only),
  //  golf_benefits:[{benefit_type_id,count_left,refresh_month}](整组替换),notes} → {id}
  create: (data) => http.post('/benefit-holders', data),
  update: (id, data) => http.put(`/benefit-holders/${id}`, data),
  // 被酒店预定或高尔夫订单引用 → 409
  remove: (id) => http.delete(`/benefit-holders/${id}`),
}

// ===== 高尔夫权益种类 golf-benefit-types（V3.1 字典，全组需登录）=====
export const golfBenefitTypesApi = {
  // → {total, items:[{id,name,course_scope('all'或逗号分隔球场名),notes,created_at}]}
  list: (params) => http.get('/golf-benefit-types', { params }),
  // {name!,course_scope('all'或球场名串),notes} → {id}
  create: (data) => http.post('/golf-benefit-types', data),
  update: (id, data) => http.put(`/golf-benefit-types/${id}`, data),
  // 被持有明细引用 → 409
  remove: (id) => http.delete(`/golf-benefit-types/${id}`),
}

// ===== 高尔夫订单 golf-orders（V3 新增，V3.1/V3.3 扩展，全组需登录）=====
export const golfOrdersApi = {
  // ?customer_id=&benefit_holder_id=&status=&date_from=&date_to=&search=&page=&page_size=
  // → {total, items:[{...,customer_name,benefit_holder_name,benefit_type_name,
  //    holder_availability,profit}]}
  list: (params) => http.get('/golf-orders', { params }),
  detail: (id) => http.get(`/golf-orders/${id}`),
  // {customer_id!,course_name!,play_date!,tee_time?,players?,status?,teach_needed?,
  //  sale_price?,cost_price?,channel?(xianyu/wechat/other),benefit_used?,benefit_type_id?(benefit_used=1 必填),
  //  order_time?,notes?,benefit_holder_id?} → {id}
  create: (data) => http.post('/golf-orders', data),
  update: (id, data) => http.put(`/golf-orders/${id}`, data),
  remove: (id) => http.delete(`/golf-orders/${id}`),
  // 历史球场名去重列表（供球场输入下拉）
  courses: () => http.get('/golf-orders/courses'),
}

// ===== 统计 stats =====
export const statsApi = {
  // → {booking_count,room_night_count,total_sale,total_cost,total_profit,customer_count,hotel_count,
  //    month_sale,month_profit,golf_*,recent_bookings,
  //    today_sale,today_cost,today_profit,                                   // V3.3 今日双线合计
  //    channels:[{channel,order_count,sale,cost,profit,month_sale,month_profit}]} // V3.3 渠道分解
  summary: () => http.get('/stats/summary'),
  // V6 收益趋势：?bucket=day|week|month|year&limit=N（day 默认 30、week 12、month 12、year 3，上限 90）
  // → {items:[{period,hotel_sale,hotel_cost,golf_sale,golf_cost}]} 周期正序、仅含有数据周期，
  //   合计（酒店+高尔夫）与利润由前端计算，无数据周期由前端补 0
  trend: (params) => http.get('/stats/trend', { params }),
}
