# V3.3 设计 — 预订人出权益标记 + 成交渠道与收益统计

状态：**Finalized**（2026-09-21 用户确认）

## 需求

1. 预订人可能**只出高尔夫**或**只出酒店**权益 → 显式开关标记，便于筛选匹配
2. 预订人来源渠道（闲鱼/微信/其他）**已存在**（V3.2 `source_channel`，本轮回补前端 UI）
3. 订单成交渠道（客户在闲鱼还是微信付款）→ 用于**按渠道统计月收益/日收益**

## 模型变更

- `benefit_holders` 增加：
  - `provides_hotel TINYINT(1) NOT NULL DEFAULT 1`（出酒店权益）
  - `provides_golf TINYINT(1) NOT NULL DEFAULT 1`（出高尔夫权益）
- `bookings` 增加：`channel ENUM('xianyu','wechat','other') NOT NULL DEFAULT 'xianyu'`（成交渠道）
- `golf_orders.channel` 校验放宽为 xianyu/wechat/other（列本就是 VARCHAR，无 DDL）

## API 变更

- benefit-holders POST/PUT/响应：provides_hotel/provides_golf；GET 筛选增加 provides_hotel=/provides_golf=
- bookings POST/PUT/响应：channel（白名单校验）
- stats/summary 新增：
  - `today_sale / today_cost / today_profit`（今日双线合计，排除 communicating/cancelled）
  - `channels: [{channel, order_count, sale, cost, profit, month_sale, month_profit}]`（酒店+高尔夫合并按渠道）
  - 既有 hotel/golf 字段不变

## 前端变更（并入下一轮）

- 预订人表单：出酒店/出高尔夫开关、来源渠道下拉（闲鱼/微信/其他）；列表徽标与筛选
- 预定抽屉：成交渠道下拉（默认闲鱼）；高尔夫抽屉渠道加「其他」
- 匹配提示：酒店单权益人下拉只标出酒店的人；高尔夫单只标出高尔夫的人
- 仪表盘：今日收益卡 + 渠道收益卡（闲鱼/微信/其他）

## 验收场景（增补）

1. 建「只出高尔夫」预订人 → provides_hotel=0/provides_golf=1 回读；筛选 provides_hotel=1 不出
2. 酒店单带 channel=wechat → 回读；非法渠道 400；默认 xianyu
3. stats：今日/渠道数据与造数一致（闲鱼单+微信单混合验证）
