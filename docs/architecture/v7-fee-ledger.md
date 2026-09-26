# V7 设计 — 页面标题 / 列表内改状态 / 手续费 / 手动记账 / 菜单更名

状态：**Finalized**（2026-09-23 用户确认四项需求，菜单名为拟定可再调）

## 1. 页面标题
- MainLayout 顶栏标题（原固定「酒店预订管理」）改为**当前路由标题**；document.title 同步「{页面名} · 酒店预订管理系统」
- 路由 meta.title：仪表盘/酒店订单/高尔夫订单/客户/酒店/预订人/记账本/基础配置/设置；移动端顶栏同

## 2. 列表内直接改状态（酒店订单 + 高尔夫订单）
- 状态列加内联下拉（el-select size=small 或 el-dropdown）：点击徽标展开全部合法状态，选中即保存
- 保存实现：GET 详情 → 替换 status → 全量 PUT（权益扣减/返还由后端既有逻辑处理）；乐观更新+失败回滚+toast
- 移动卡片：状态徽标旁加小按钮「改状态」弹 ActionSheet 式下拉

## 3. 手续费（fee_rate）
- bookings / golf_orders 增加 `fee_rate DECIMAL(5,4) NOT NULL DEFAULT 0`（0~0.5 校验）
- 创建默认：channel=xianyu → 0.016，其他 → 0；表单可改（显示为百分比，如 1.6%）
- `fee = round(sale × fee_rate, 2)`；**profit 语义统一改为净利润 = sale − cost − fee**（列表/详情/客户统计/仪表盘/趋势）
- 响应增加 `fee` 字段；编辑回读 fee_rate
- 迁移：存量 xianyu 单回填 0.016，其他 0

## 4. 手动记账（manual_entries）
```sql
CREATE TABLE manual_entries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entry_date DATE NOT NULL,
  type ENUM('income','expense') NOT NULL,
  business ENUM('hotel','golf','general') NOT NULL DEFAULT 'general',
  amount DECIMAL(10,2) NOT NULL,
  notes VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
- API：GET（筛选 month/type/business）+ POST/PUT/DELETE /api/manual-entries
- 「记账本」页面：日期/类型/归属/金额/备注，列表+增删改，月度小计行

## 5. 仪表盘口径（summary 扩展）
- 文案：总收益→**总营收**
- 新字段（合计+本月，口径：订单 ± 手动记账）：
  - `all_total_sale`（营收=订单卖价） / `all_total_cost` / `all_total_fee`
  - `all_gross_profit`（毛利=营收−成本）/ `all_net_profit`（净利=营收−成本−手续费）
  - `all_profit_rate`（=净利/营收，两位小数百分比字符串或数值）
  - `month_*` 同构（本月营收计入手动记账收入、本月成本计入手动记账支出；净利=毛利−手续费±手动收支）
  - `manual_month_income / manual_month_expense`
  - 分账（hotel/golf）同构加 fee/gross/net/rate（不含 general 手动记账）
- 趋势图 items 增加 `hotel_fee/golf_fee`，利润=净利口径

## 6. 菜单更名（路由 path 不变，仅 label）
预定管理→酒店订单；高尔夫管理→高尔夫订单；客户管理→客户；酒店管理→酒店；预订人管理→预订人；字段管理→基础配置；系统设置→设置；新增 记账本

## 7. 验收场景
1. 每个页面顶栏/标签页标题正确（9 页）
2. 列表内把酒店单推进一态、高尔夫单改已定位：立即生效、权益正确流转、失败回滚
3. 建闲鱼酒店单 → 手续费率默认 1.6%、fee=sale×1.6%、利润列=净利；微信单默认 0；改 2% 生效
4. 记账本：录收入 100/支出 50（本月）→ 仪表盘本月营收 +100、成本 +50、净利反映；删除后还原
5. 仪表盘卡片：总营收/成本/手续费/毛利/净利/利润率 与明细勾稽（订单+手动）
6. 存量数据：xianyu 单回填 1.6% 后利润变化正确
7. 回归：菜单更名后路由跳转、移动端、E2E 核心流程不受影响
