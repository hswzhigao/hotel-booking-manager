# 系统设计 — 酒店预订管理系统

状态：**Finalized**（已定案，可据此实现）

## 1. 目标与背景

用户是酒店预订中介：闲鱼接单 → 微信联系客户 → 帮客户预订酒店 → 赚取差价。系统供**单一管理员**（用户本人）使用，管理酒店、房型、客户、预定，记录卖价与成本、自动算利润，追踪客户升级权益。

- 部署目标：Ubuntu 24.04 服务器 124.220.169.36（已有 MySQL 8）
- 最终访问：域名 hhao1121（待用户提供完整域名后配 DNS+HTTPS）；先用 http://124.220.169.36
- 已确认决策：需要登录（单管理员）；记录成本价并自动算利润。

## 2. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 后端 | Node.js 22 + Express 4 + mysql2/promise + bcryptjs + jsonwebtoken | 监听 127.0.0.1:3000；systemd 守护 |
| 前端 | Vue 3 + Vite 5 + Element Plus 2 + vue-router 4 + pinia 2 + axios | 构建为静态文件，nginx 托管 |
| 数据库 | MySQL 8，库名 `hhao1121`，utf8mb4 | 应用账号 `hotel_app`@`localhost`（仅授权本库） |
| 部署 | nginx：`/` 托管 dist 静态文件 + `/api` 反代 127.0.0.1:3000 | 80 端口（后续 443+certbot） |

环境约定：
- 本地开发：MySQL 走 SSH 隧道 `127.0.0.1:13306 → 服务器 3306`，连接参数由环境变量注入（见 §7）。
- 后端不使用 ORM，统一 mysql2 pool + 参数化 SQL。

## 3. 数据模型

```sql
-- server/sql/schema.sql
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hotels (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(50) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  notes VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE room_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hotel_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  bed_type VARCHAR(50) DEFAULT NULL,
  default_price DECIMAL(10,2) DEFAULT NULL,   -- 参考价，仅提示，预定价格在 items 里逐间填写
  notes VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_hotel_room (hotel_id, name),
  CONSTRAINT fk_rt_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

CREATE TABLE customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  wechat VARCHAR(100) DEFAULT NULL,           -- 微信/闲鱼号
  phone VARCHAR(30) DEFAULT NULL,
  benefit_count INT NOT NULL DEFAULT 0,       -- 剩余升级权益次数
  notes VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  hotel_id INT UNSIGNED NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INT UNSIGNED NOT NULL,               -- = DATEDIFF(check_out, check_in)，服务端计算
  sale_total DECIMAL(10,2) NOT NULL,          -- = SUM(items.price)，服务端计算
  cost_total DECIMAL(10,2) NOT NULL DEFAULT 0,-- 成本合计（手动填写）
  order_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 下单时间：默认当前，可编辑
  benefit_used TINYINT(1) NOT NULL DEFAULT 0, -- 本单是否使用升级权益
  status ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  notes VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bk_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_bk_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id)
);

CREATE TABLE booking_items (   -- 每行 = 一间房；price = 该间房整个入住期间的总价
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id INT UNSIGNED NOT NULL,
  room_type_id INT UNSIGNED NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_bi_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_bi_room FOREIGN KEY (room_type_id) REFERENCES room_types(id)
);
```

seed：`users` 插入 `admin` / bcrypt('admin123')，首次登录后建议在设置页改密。

## 4. 业务规则（后端强约束）

1. **日期**：`check_out > check_in`；`nights = DATEDIFF(check_out, check_in)` 服务端计算，不接受前端传值。
2. **价格**：`sale_total = SUM(booking_items.price)` 服务端计算，不接受前端传值；`profit = sale_total - cost_total` 查询时计算，不落库。
3. **权益占用**：预定 `benefit_used=1` 且 `status != 'cancelled'` 视为占用 1 次权益。
   - 新建占用 → `customer.benefit_count - 1`，若结果 < 0 则拒绝（400，提示剩余不足）。
   - 编辑：按新旧两个单子的占用差值调整；状态改为 cancelled → 返还；从 cancelled 改回 → 重新占用（同样校验剩余）。
   - 删除预定 → 若原单占用权益则返还。
   - 手动调整：编辑客户时可直接修改 `benefit_count`（充值/纠错用）。
4. **删除保护**：
   - 客户有预定（任意状态）→ 拒绝删除（409）。
   - 酒店被预定引用 → 拒绝（409）；无引用时级联删其房型。
   - 房型被 booking_items 引用 → 拒绝（409）。
   - 预定删除 → items 级联删除 + 权益返还。
5. **下单时间** `order_time`：插入时默认当前时间；编辑时可修改。`created_at` 不可改。
6. **客户统计口径**：booking_count / total_spend / 间夜数均**排除 cancelled** 单。

## 5. API 契约

前缀 `/api`，JSON；除 login 外均需 `Authorization: Bearer <token>`（JWT HS256，7 天有效）。
响应错误统一 `{ "error": "中文可读信息" }`；状态码：401 未登录/Token 失效、400 参数/业务校验失败、404 不存在、409 删除保护、500 服务器错误。列表接口统一 `{ total, items }`，参数 `page`(默认1) `page_size`(默认20)。

### 认证 auth
- `POST /api/auth/login` `{username,password}` → `{token, username}`；错误凭据 → 401 "用户名或密码错误"
- `GET /api/auth/me` → `{username}`
- `POST /api/auth/change-password` `{old_password,new_password}` → `{ok:true}`

### 酒店 hotels
- `GET /api/hotels?search=&page=&page_size=` → items 含 `id,name,city,address,phone,notes,room_type_count,booking_count,created_at`
- `POST /api/hotels` `{name!,city,address,phone,notes}` → `{id}`
- `PUT /api/hotels/:id`（同上）
- `DELETE /api/hotels/:id`（被预定时 409 "该酒店已有预定记录，无法删除"）

### 房型 room-types
- `GET /api/hotels/:id/room-types` → `[{id,hotel_id,name,bed_type,default_price,notes}]`
- `POST /api/room-types` `{hotel_id!,name!,bed_type,default_price,notes}`
- `PUT /api/room-types/:id`
- `DELETE /api/room-types/:id`（被引用 409）

### 客户 customers
- `GET /api/customers?search=&page=&page_size=` → items 含 `id,name,wechat,phone,benefit_count,booking_count,total_rooms,total_room_nights,total_spend,notes`
- `POST /api/customers` `{name!,wechat,phone,benefit_count,notes}`
- `PUT /api/customers/:id`（同上，benefit_count 可直接改）
- `DELETE /api/customers/:id`（有预定 409）
- `GET /api/customers/:id` → `{customer:{...同列表字段}, bookings:[{...预定列表字段, items:[{room_type_name,price}]}]}`（历史预定，排除 cancelled 计入统计）

### 预定 bookings
- `GET /api/bookings?customer_id=&hotel_id=&status=&date_from=&date_to=&search=&page=&page_size=`
  - search 匹配：客户名、酒店名；date_from/date_to 过滤 `check_in` 区间
  - items 含 `id,order_time,customer_id,customer_name,hotel_id,hotel_name,check_in,check_out,nights,room_count,sale_total,cost_total,profit,benefit_used,status,notes,items_summary`（如 "大床房×2、双床房×1"）
- `GET /api/bookings/:id` → detail 含 `items:[{id,room_type_id,room_type_name,price}]`
- `POST /api/bookings` `{customer_id!,hotel_id!,check_in!,check_out!,cost_total,order_time?,benefit_used,status,notes,items:[{room_type_id!,price!}]}`
  - items 至少 1 行；price ≥ 0
- `PUT /api/bookings/:id`（同上）
- `DELETE /api/bookings/:id`

### 统计 stats
- `GET /api/stats/summary` → `{booking_count,room_night_count,total_sale,total_cost,total_profit,customer_count,hotel_count,month_sale,month_profit,recent_bookings:[最近10条,字段同列表]}`（除 customer_count/hotel_count 外均排除 cancelled；month_* 为自然月）

## 6. 页面规格（前端）

路由（vue-router，history 模式）；未登录访问任意页 → 跳 /login；axios 拦截器：401 → 清 token 跳登录。

| 路由 | 页面 | 要点 |
|---|---|---|
| /login | 登录 | 用户名+密码；提示默认账号 admin/admin123 |
| / | 仪表盘 | 统计卡片（预定数/总收入/总成本/总利润/客户数/酒店数/本月收入/本月利润）+ 最近预定表格；点行跳预定页 |
| /bookings | 预定管理 | 筛选（客户/酒店下拉、状态、入住日期范围、关键词）；表格列：下单时间、客户、酒店、入住/离店、晚数、间数、明细摘要、卖价、成本、利润、权益、状态、操作；新建/编辑用全屏抽屉或 Dialog：选客户(可搜索下拉)、选酒店→房型级联、日期范围(默认今天→明天)、明细行动态增删（房型下拉按所选酒店过滤 + 每间价格，"加一间"按钮）、实时汇总卖价、成本价输入、勾选"使用升级权益"(显示该客户剩余 N 次)、下单时间 DateTimePicker 默认当前可改、状态、备注；详情 Dialog 展示含每间价格明细；删除二次确认 |
| /customers | 客户管理 | 搜索；表格：姓名、微信、电话、剩余权益、预定次数、间夜数、累计消费、备注、操作；新建/编辑 Dialog（benefit_count 可编辑，标注"手动调整用于充值/纠错，预定消耗自动扣减"）；点击客户 → 详情 Dialog/抽屉：信息卡 + 历史预定表（每单：日期、酒店、晚数、间数、明细含每间价格、总价、是否用权益） |
| /hotels | 酒店管理 | 搜索；表格：名称、城市、地址、电话、房型数、预定数、操作；新建/编辑 Dialog；行展开或详情管理房型（表格 + 增删改 Dialog：名称、床型、参考价、备注） |
| /settings | 系统设置 | 修改密码（旧密码、新密码、确认新密码） |

视觉：Element Plus 默认主题 + 中文 locale（zh-cn）；侧边栏布局（折叠菜单：仪表盘/预定管理/客户管理/酒店管理/系统设置）+ 顶栏（系统名 + 退出登录）；金额显示 `¥` 两位小数；利润正负用绿/红区分。

## 7. 配置与目录

```
hhao1121/
  server/               # 后端（package.json name: hhao1121-server）
    src/config.js       # 读环境变量：DB_HOST(默认127.0.0.1) DB_PORT(默认13306) DB_USER DB_PASSWORD DB_NAME(hhao1121) JWT_SECRET PORT(默认3000)
    src/db.js           # mysql2 pool（charset utf8mb4, connectionLimit 10）
    src/middleware/auth.js
    src/routes/*.js     # auth/hotels/roomTypes/customers/bookings/stats
    src/index.js        # 装配 + 0.0.0.0?否——127.0.0.1:3000
    sql/schema.sql
  web/                  # 前端（name: hhao1121-web）
    vite.config.js      # dev 代理 /api → http://127.0.0.1:3000
    src/…
  deploy/               # nginx.conf 片段、hotel-api.service、deploy.sh、生产 .env
  docs/
```

- 本地开发：`server` 目录 `.env`（dotenv 或 config.js 自行读取）指向隧道 `127.0.0.1:13306`；生产 `.env` 指向 `127.0.0.1:3306`。`.env` 不进 git。
- git：项目根初始化 git 仓库，`.gitignore` 含 `node_modules/ dist/ .env *.log`。

## 8. 验收场景（独立验收依据）

1. seed 后 admin/admin123 登录成功 → /auth/me 正常 → 改密码 → 旧密码失效、新密码可登录。
2. 建酒店 A/B → 各配 2 房型（大床房/双床房，参考价不同）。
3. 建客户"张三"（微信 zs001，权益 2）。
4. 建预定：张三 × 酒店A × 大床房2间（¥500、¥600）+ 双床房1间（¥450），10-01→10-04，成本 ¥1200：
   nights=3、room_count=3、sale_total=1550、profit=350、间数与每间价格明细正确；未勾权益 → 张三权益仍 2。
5. 建第二单勾选"使用升级权益" → 张三权益 2→1；将该单取消 → 权益回 2；再恢复 active → 权益 1。
6. 客户详情：显示每单晚数/间数/每间价格/总价；统计排除 cancelled。
7. 列表筛选：按客户/酒店/状态/入住日期；search 按客户名酒店名模糊。
8. stats/summary：总预定、总收入、总成本、总利润、本月口径正确。
9. 删除保护：有预定的酒店/客户、被引用的房型删除返回 409；删除预定后客户可删、权益返还。
10. order_time 默认当前时间、可编辑为过去时间。
11. 无 token 访问任意业务 API → 401；前端 401 自动跳登录。
12. 前端全流程可操作：登录→建酒店/房型→建客户→建预定→查详情→改/删→看统计。
