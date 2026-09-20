# V3 设计 — 高尔夫权益业务线

状态：**Finalized**（2026-09-21 用户确认：共用客户池+业务标签；球场填名称；四态+教定位标记；更新月到期高亮）

## 1. 业务模型

- **预订人共用**（酒店+高尔夫同一池子）：卡片类型决定标准配额（经典白≈6酒店+12高尔夫、普通白金≈2酒店+0高尔夫，实际次数每人单独记）
- **高尔夫流程**：闲鱼沟通 → 闲鱼付款（首次）→ 加微信 → 找有高尔夫权益的预订人**定位**（不会的教定位）→ 打球完成
- **可用时间匹配**：部分预订人仅周末有空出权益、部分仅工作日、部分不限 → 下单时与打球日期匹配提示
- **权益年度刷新**：每人的酒店/高尔夫权益分别在某月更新（常只知月份，可能未知）→ 记录月份，当前月到期高亮
- **客户池共用**：酒店客户与高尔夫买家同一池，打「酒店/高尔夫」双标签

## 2. 数据模型变更

### benefit_holders（预订人扩展）
```sql
card_type VARCHAR(100) DEFAULT NULL,            -- 卡片类型（自由文本：经典白/大白金/普通白金…，界面上提示常见配额）
-- benefit_count 更名为：
hotel_benefit_count INT NOT NULL DEFAULT 0,     -- 酒店权益剩余次数
golf_benefit_count INT NOT NULL DEFAULT 0,      -- 高尔夫权益剩余次数
hotel_refresh_month TINYINT DEFAULT NULL,       -- 酒店权益更新月 1-12，NULL=未知
golf_refresh_month TINYINT DEFAULT NULL,        -- 高尔夫权益更新月
availability ENUM('any','weekend_only','weekday_only') NOT NULL DEFAULT 'any', -- 可用时间
```

### customers（客户扩展）
```sql
is_hotel TINYINT(1) NOT NULL DEFAULT 1,   -- 酒店客户标签
is_golf TINYINT(1) NOT NULL DEFAULT 0,    -- 高尔夫客户标签
```

### 新表 golf_orders（高尔夫订单）
```sql
CREATE TABLE IF NOT EXISTS golf_orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,             -- 买家（共用客户池）
  benefit_holder_id INT UNSIGNED DEFAULT NULL,   -- 出权益的预订人（定位人）
  course_name VARCHAR(100) NOT NULL,             -- 球场名称（自由文本；前端提供历史球场下拉）
  play_date DATE NOT NULL,                       -- 打球日期
  tee_time VARCHAR(20) DEFAULT NULL,             -- 开球时间（可选）
  players TINYINT UNSIGNED NOT NULL DEFAULT 1,   -- 打球人数
  status ENUM('pending','booked','completed','cancelled') NOT NULL DEFAULT 'pending',
    -- pending=待定位 booked=已定位 completed=已完成 cancelled=已取消
  teach_needed TINYINT(1) NOT NULL DEFAULT 0,    -- 需要教定位
  sale_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  channel VARCHAR(20) NOT NULL DEFAULT 'xianyu', -- 渠道 xianyu=闲鱼 wechat=微信
  benefit_used TINYINT(1) NOT NULL DEFAULT 1,    -- 是否消耗高尔夫权益
  order_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 可编辑，默认当前
  notes VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_go_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_go_holder FOREIGN KEY (benefit_holder_id) REFERENCES benefit_holders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 权益扣减规则（高尔夫，完全镜像酒店 V2.1 规则）
- 占用 = `benefit_used=1 且 status≠cancelled`，作用于**预订人的 golf_benefit_count**
- 勾权益必须选预订人（400「使用高尔夫权益需选择预订人」）
- 新建扣、编辑差额/换人旧还新扣、取消/删除返还、不足 400 事务回滚

## 3. API

### benefit-holders（字段更新）
- POST/PUT/响应字段：`card_type, hotel_benefit_count, golf_benefit_count, hotel_refresh_month, golf_refresh_month, availability`（month 校验 1-12 或空；availability 白名单校验）
- GET 筛选增加 `availability=`；响应附 `golf_order_count`（关联高尔夫订单数，全状态）与既有 booking_count
- DELETE 保护扩展：被酒店预定**或高尔夫订单**引用 → 409

### customers（字段更新）
- POST/PUT/响应：`is_hotel, is_golf`（0/1）
- GET 筛选增加 `is_hotel=` / `is_golf=`
- DELETE 保护扩展：有酒店预定**或高尔夫订单** → 409
- 客户详情响应增加 `golf_orders:[...]`（同列表字段）

### golf-orders（新组）
- `GET /api/golf-orders?customer_id=&benefit_holder_id=&status=&date_from=&date_to=&search=&page=&page_size=`
  - search 匹配客户名/球场名；date 过滤 play_date；返回 customer_name/benefit_holder_name/profit(sale-cost)/holder 可用时间（availability，供前端提示）
- `GET /api/golf-orders/:id`
- `POST /api/golf-orders` `{customer_id!,course_name!,play_date!,tee_time?,players?,status?,teach_needed?,sale_price?,cost_price?,channel?,benefit_used?,order_time?,notes?,benefit_holder_id?}`
- `PUT /api/golf-orders/:id`
- `DELETE /api/golf-orders/:id`
- 辅助：`GET /api/golf-orders/courses` → 历史球场名列表（SELECT DISTINCT course_name，供前端下拉）

### stats/summary 扩展
- 新增：`golf_order_count, golf_total_sale, golf_total_cost, golf_total_profit, golf_month_sale, golf_month_profit`（排除 cancelled；month 按 order_time 自然月）
- hotel 侧字段命名不变

## 4. 前端变更（与 V2.1 增量合并为一次交付）

1. **全站文案**：「权益人」→「预订人」；酒店权益字段标注清晰（不与高尔夫混淆）
2. **预订人管理页**：
   - 表单/列表新字段：卡片类型、酒店权益次数、高尔夫权益次数、酒店更新月、高尔夫更新月（1-12 下拉+「未知」）、可用时间（不限/仅周末/仅工作日）
   - **到期高亮**：更新月=当前月的行高亮（如黄色底+「本月更新」徽标）
   - 列表显示双权益次数 + 高尔夫订单数
3. **客户管理页**：酒店/高尔夫双标签（可勾选），列表徽标与筛选；客户详情抽屉增加「高尔夫订单」区块（日期/球场/预订人/状态/价格）
4. **新页面 /golf 高尔夫管理**（侧边栏菜单，图标类似 ⛳）：
   - 列表：下单时间、客户、预订人、球场、打球日期、人数、卖价、成本、利润、权益、教定位标记、状态徽标、渠道、操作
   - 筛选：客户/预订人/状态/日期区间/关键词
   - 新建/编辑抽屉：客户下拉、预订人下拉（显示高尔夫剩余次数+可用时间标签）、球场名（datalist 历史下拉）、日期、开球时间、人数、卖价/成本、勾选消耗权益（默认勾选，显示所选预订人剩余）、教定位勾选、状态四态、渠道、下单时间默认当前可编辑
   - **匹配提示**：打球日期为周六/周日 且 所选预订人 availability=weekday_only → 橙色警示「该预订人仅工作日可用」；工作日打球 + weekend_only 同理
5. **酒店预定抽屉**：权益区文案「酒店权益 剩余 N 次」从所选预订人 hotel_benefit_count 读
6. **仪表盘**：新增高尔夫统计卡（订单数/收入/成本/利润）

## 5. 迁移与部署

- `scripts/migrate-v3.js`：幂等——holders RENAME benefit_count→hotel_benefit_count（若未改）+ ADD 其余列；customers ADD is_hotel/is_golf；golf_orders CREATE IF NOT EXISTS
- deploy.sh 追加 `npm run migrate-v3`
- 上线时清空业务表（含 golf_orders），用户重录

## 6. 验收场景（V3 增补）

1. 预订人字段：建经典白（酒店6/高尔夫12/更新月酒店3月高尔夫9月/仅周末）→ 全字段回读；更新月=当前月的行在高亮列表返回中可识别（后端返回原始值，前端渲染高亮——后端验收校验值正确即可）
2. 高尔夫订单 CRUD：建单（客户A×预订人H×球场×周末日期×勾权益）→ H.golf_benefit_count 12→11；状态 pending→booked→completed 权益不变；cancelled → 返还
3. 权益规则：勾权益无预订人 400；不足 400；换预订人旧还新扣；删除返还
4. 可用时间匹配：订单数据返回 holder availability；前端警示为 UI 层（E2E 验证）
5. 教定位标记：teach_needed 保存与回读；列表标记显示
6. 客户双标签：建高尔夫客户（is_golf=1, is_hotel=0）→ 筛选 is_golf=1 命中；客户详情含高尔夫订单历史
7. 删除保护扩展：有高尔夫订单的客户/预订人删除 409
8. courses 接口：建过订单的球场名去重返回
9. stats：golf_* 字段与造数一致
10. 回归：酒店线全部功能不受影响（benefit_count→hotel_benefit_count 改名后酒店扣减正确）
