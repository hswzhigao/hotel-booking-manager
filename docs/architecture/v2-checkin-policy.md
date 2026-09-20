# V2 设计 — 入住政策 / 权益人 / 入住指南

状态：**Finalized**（2026-09-21 与用户确认三项关键决策：权益人与客户为两个独立群体；预定单关联权益人；指南每店一段+复制按钮）

## 1. 背景

用户经营的酒店来自信用卡/平台权益。办理入住时部分酒店要求**预订人本人到场**，部分仅需提供预订人信息。需要：
1. 给酒店登记入住政策（电话咨询结果：是否需本人到场、需提供哪些信息、办理流程）
2. 管理**权益人**（出借信用卡/平台权益的人，独立于住店客户），打标签：是否愿意到场、是否愿意协助办理、持有哪些权益、是否合作中
3. 每家酒店维护一段「入住指南」文本，可一键复制发给闲鱼客户
4. 预定单记录"这单用了哪个权益人"，可与酒店政策匹配（需到场的酒店 → 优先选愿意到场的权益人）

## 2. 数据模型变更

### 新表 benefit_holders（权益人）
```sql
CREATE TABLE IF NOT EXISTS benefit_holders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  wechat VARCHAR(100) DEFAULT NULL,
  phone VARCHAR(30) DEFAULT NULL,
  benefit_types VARCHAR(500) DEFAULT NULL,     -- 持有权益（自由文本，如"招行经典白金卡房晚、飞猪F4"）
  willing_present TINYINT(1) NOT NULL DEFAULT 0, -- 是否愿意本人到场办理
  willing_assist TINYINT(1) NOT NULL DEFAULT 0,  -- 是否愿意协助办理（提供证件信息/电话确认等）
  active TINYINT(1) NOT NULL DEFAULT 1,          -- 是否合作中（0=已停用）
  notes VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### hotels 表新增列（入住政策，1:1 就放本表）
```sql
-- checkin_presence 三态：NULL 未确认 / 1 需预订人本人到场 / 0 无需到场
checkin_presence TINYINT(1) DEFAULT NULL,
checkin_info_required VARCHAR(1000) DEFAULT NULL, -- 需提供的预订人信息（如"姓名+身份证后四位+手机号"）
checkin_process VARCHAR(1000) DEFAULT NULL,       -- 办理入住流程（电话咨询结果整理）
official_phone VARCHAR(50) DEFAULT NULL,          -- 酒店官方电话
guide_text TEXT,                                  -- 入住指南（发给客户看，支持复制）
```

### bookings 表新增列
```sql
benefit_holder_id INT UNSIGNED DEFAULT NULL, -- 本单使用的权益人（可空）
CONSTRAINT fk_bk_holder FOREIGN KEY (benefit_holder_id) REFERENCES benefit_holders(id)
```

### 迁移
- `server/sql/schema.sql` 同步为全量最新结构（新装直接建全）。
- `server/scripts/migrate-v2.js`：对已有库幂等迁移——benefit_holders 用 CREATE TABLE IF NOT EXISTS；hotels/bookings 的 ADD COLUMN 先查 information_schema.COLUMNS 再执行；deploy 后自动跑。

## 3. API 变更

### 权益人 benefit-holders（新增，全组需登录）
- `GET /api/benefit-holders?search=&willing_present=&willing_assist=&active=&page=&page_size=`
  → `{total, items:[{id,name,wechat,phone,benefit_types,willing_present,willing_assist,active,notes,booking_count,created_at}]}`
  - search 匹配 name/wechat/phone；booking_count=关联预定数（全状态）
- `POST /api/benefit-holders` `{name!,wechat,phone,benefit_types,willing_present,willing_assist,active,notes}` → `{id}`
- `PUT /api/benefit-holders/:id`（同上）
- `DELETE /api/benefit-holders/:id`——被预定引用 → 409「该权益人已被预定引用，无法删除」（预定不级联删）

### hotels（扩展）
- GET 列表/详情 items 增加：`checkin_presence,checkin_info_required,checkin_process,official_phone,guide_text`
- POST/PUT 接受上述字段（checkin_presence 允许 null/0/1，非法值 400）
- 列表加一列展示政策徽标由前端根据 checkin_presence 渲染

### bookings（扩展）
- POST/PUT 接受可选 `benefit_holder_id`（存在性校验，不存在 400；null=清空）
- 列表/详情返回 `benefit_holder_id,benefit_holder_name`（LEFT JOIN）

### 不变
- auth / room-types / customers / stats 及全部 v1 业务规则、错误码约定不变。

## 4. 前端变更

### 新页面：权益人管理 /holders（侧边栏菜单加「权益人管理」，图标 User）
- 列表：姓名、微信、电话、持有权益、标签（愿意到场✓/愿意协助✓ 徽标）、合作中（是/停用 徽标）、关联预定数、备注、操作
- 筛选：关键词 + 愿意到场/愿意协助/合作中 三个下拉
- 新建/编辑 Dialog：全字段表单；willing_present/willing_assist/active 用开关
- 删除二次确认；409 提示

### 酒店管理页扩展
- 酒店新建/编辑表单加「入住政策」区块：官方电话、是否需本人到场（单选：未确认/需本人到场/无需到场）、需提供的预订人信息、办理流程说明
- 列表加「入住政策」列：徽标（未确认=灰 / 需到场=橙 / 无需=绿）
- 行操作加「入住指南」按钮 → Dialog：酒店名 + 可编辑指南文本（textarea，自动保存）+ **「复制指南」按钮**（navigator.clipboard，成功 ElMessage 提示"已复制，可粘贴发给客户"）

### 预定管理页扩展
- 新建/编辑抽屉加「权益人」下拉（可搜索、可清空），选项显示 `姓名（权益摘要）`
- **联动提示**：所选酒店 checkin_presence=1（需到场）时，抽屉顶部显示橙色提示「该酒店需预订人本人到场办理」，权益人下拉选项中对 willing_present=1 的标注「✓愿意到场」徽标，未标注的排后面
- 列表加「权益人」列；详情抽屉显示权益人及其标签

### 兼容
- v1 数据不受影响：benefit_holder_id 全部为空显示「-」
- 未迁移政策字段的酒店显示「未确认」

## 5. 验收场景（V2 新增）

1. 权益人 CRUD：建 2 个权益人（一个愿意到场+协助，一个只协助），标签徽标正确；筛选 willing_present=1 只出第一个；停用后列表标灰
2. 删除保护：给权益人挂一张预定后删除 → 409
3. 酒店政策：编辑酒店为「需本人到场」+ 需提供信息 + 办理流程 → 列表徽标橙色；另存一家「无需到场」绿色、一家「未确认」灰色
4. 入住指南：编辑指南文本保存；点「复制指南」→ 剪贴板内容与文本一致（E2E 用 CDP 读剪贴板/权限判定）
5. 预定关联：建单选权益人 → 列表/详情显示权益人姓名；需到场酒店建单时出现橙色提示且愿意到场的权益人带 ✓ 标注
6. 旧数据兼容：v1 的既有预定/客户/酒店全部正常展示（权益人列为 -，政策未确认）
7. 回归：v1 核心流程（登录、建酒店/房型/客户、建预定、权益扣减返还、统计、409 保护）不回归

## 6. 任务与验收

- backend-v2：主 agent 开发（延续 v1 风格），小赵独立验收（场景 1-3、5-6 的 API 层 + 回归）
- frontend-v2：小陈开发（延续 v1 页面结构），小周 E2E 验收（场景 1-7 UI 层，复用 /tmp/e2e 工具与经验，限时 25 分钟）
- deploy-v2：migrate-v2 迁移 → deploy.sh → 线上冒烟（三域名 HTTPS + 回归点检）
