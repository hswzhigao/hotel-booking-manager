# V3.2 设计 — 酒店订单全流程状态 + 权益人结算

状态：**Finalized**（2026-09-21 用户提供完整业务流程）

## 1. 酒店订单状态机（10 态）

```
communicating 沟通中（闲鱼客户咨询）
  ↓
ordered 已下单（闲鱼付好款）
  ↓
info_confirmed 已确认信息（与客户确认酒店/日期/房型/几间几晚/是否升级/是否含双早）
  ↓
booking 预订中（闲鱼或微信找权益人预订）
  ↓
booked 已预订（权益人已帮订、已付款）
  ↓
hotel_confirmed 酒店已确认（权益平台发单成功，酒店确认订单）
  ↓
awaiting_checkin 待入住（未到入住时间）
  ↓
checked_in 已入住（客户拿到房间）
  ↓
finished 入住完成（可提醒客户确认收货）

cancelled 已取消（任意阶段可转入；权益返还）
```

- status ENUM 扩展为 10 值（替换 active/completed/cancelled 三态）
- 权益扣减规则不变：`benefit_used=1 且 status≠cancelled` 占用；但占用张数改为 `benefit_count_used`（默认 1）
- 财务统计口径：排除 `communicating`（未成交）与 `cancelled`；bookings 客户统计同理

## 2. 结算（给权益人的钱）

- benefit_holders 增加 `source_channel ENUM('xianyu','wechat','other') DEFAULT 'other'`（来源渠道）
- bookings 增加 `holder_settled TINYINT(1) DEFAULT 0`（是否已给权益人结算）
- 结算时机提示（前端按 source_channel 显示，不强制）：
  - 闲鱼渠道权益人：客户入住完成后 → 提醒「去闲鱼确认收货」，结算后勾选已结算
  - 微信好友权益人：酒店订单确认（hotel_confirmed）后 → 提醒「微信转账」，转账后勾选已结算

## 3. 其他字段

- bookings 增加 `breakfast_included TINYINT(1) DEFAULT 0`（是否含双早，确认信息阶段勾选）
- bookings 增加 `benefit_count_used INT UNSIGNED DEFAULT 1`（本单消耗权益张数，勾权益时填，默认 1；校验 1-99）

## 4. 多权益人拆单

- 保持「一笔预定 = 一个预订人」模型
- 前端 BookingsView 增加「复制预定」操作：复制客户/酒店/日期/明细/成本等信息，清空权益人与结算状态，快速建第二笔挂另一预订人
- 2 间房需要 2 个权益人 → 建两笔各 1 间的预定（或按券数拆）

## 5. API 变更

- bookings POST/PUT 接受：status（10 态白名单）、breakfast_included、holder_settled、benefit_count_used；benefit 扣减/返还按张数（编辑差额=新张数−旧张数，换人=旧人返还旧张数+新人扣新张数）
- bookings 列表/详情返回 holder_source_channel（JOIN benefit_holders）供前端结算提示
- benefit-holders POST/PUT 接受 source_channel；列表返回
- stats/summary 与客户统计排除 communicating+cancelled（口径注释同步）

## 6. 迁移

- migrate-v5.js：bookings ALTER status ENUM 10 值（表当前无数据，直接 MODIFY）+ ADD breakfast_included/holder_settled/benefit_count_used；benefit_holders ADD source_channel
- schema.sql 同步

## 7. 前端变更（BookingsView 为主，小陈下一轮）

1. 状态列：10 态彩色徽标 + 下拉切换（按流程排序）；详情显示流程位置
2. 抽屉：含双早开关；勾「使用升级权益」出现张数输入（默认1）显示所选预订人酒店剩余；结算状态开关（列表列 + 提示按 source_channel）
3. 「复制预定」按钮（行操作）：预填弹窗快速建单
4. 客户详情/仪表盘状态徽标同步
5. HoldersView：来源渠道字段（闲鱼/微信/其他）

## 8. 验收场景（增补）

1. 10 态全流转：建单 communicating → 逐级推进到 finished；任意态 → cancelled 权益返还
2. 张数：1 间 3 晚勾权益填 3 张 → 预订人酒店权益 6→3；取消 → 返还 3
3. 编辑改张数 3→2 → 返还 1；换人 → 旧人还 3、新人扣 2（不足拦截）
4. 张数非法（0/100/非整数）400
5. 双早/结算字段保存回读；结算提示按 source_channel
6. 统计口径：communicating 单不计入收入；ordered 起计入
7. 复制预定：前端 E2E 验证预填与清空逻辑
8. 回归：高尔夫线、权益种类线不受影响
