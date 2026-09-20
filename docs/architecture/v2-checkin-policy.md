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

---

# V2.1 修订 — 预订人/客户概念分离（Finalized，2026-09-21 用户确认）

## 用户澄清的业务模型

- **客户** = 闲鱼上来订酒店的住店人：姓名/微信/电话 + 住店历史统计。**不再持有任何权益**。
- **预订人** = 信用卡/渠道权益持有者（原"权益人"）：持有什么权益、**升级权益次数**（升房券等卡附带）、是否愿意到场/协助、合作中状态。UI 统一改称「预订人」。
- 预定单：客户（住的人）+ 预订人（用谁的权益）双向关联。

## 变更点（相对 V2）

### 数据模型
- `benefit_holders` 增加 `benefit_count INT NOT NULL DEFAULT 0`（升级权益次数）
- `customers.benefit_count` **删除**（存量数据已确认清空重录，直接 DROP）
- `bookings.benefit_used` 语义变更：勾选时**必须已选预订人**，扣减/返还均作用于**预订人**的 benefit_count；编辑换预订人时旧预订人返还、新预订人扣减；规则沿用 V1 §4.3（不足 400、取消返还、删除返还、cancelled 不占用）

### API
- `benefit-holders` POST/PUT 接受 `benefit_count`（手动调整用于充值/纠错）；列表返回它
- `customers` 全组移除 benefit_count 字段
- `bookings` POST/PUT：benefit_used=1 且无 benefit_holder_id → 400「使用升级权益需选择预订人」；权益校验与扣减目标改为预订人
- 校验顺序：先校验预订人存在 → benefit_used=1 时校验其 benefit_count≥1

### 前端
- 所有「权益人」字样改「预订人」（菜单/页面/表头/抽屉字段/提示）
- 预订人页：加升级权益次数（表单+列，标注手动调整；预定消耗自动扣减）
- 客户页：移除剩余权益列与编辑项；客户详情抽屉保留历史预定（每单含"是否用权益"）与消费统计，移除权益统计
- 预定抽屉：勾选"使用升级权益"→ 显示**所选预订人**剩余次数（随预订人切换刷新）；未选预订人时勾选权益给出内联警示；不选权益/不选预订人均可正常保存

### 数据处理
- 上线 V2.1 时清空全部业务表（hotels/room_types/customers/bookings/booking_items/benefit_holders，保留 users），用户重新录入
- migrate-v2 增加：benefit_holders.benefit_count 加列 + customers DROP COLUMN benefit_count（幂等判断）

### 验收场景（V2.1 增补）
1. 建预订人（权益2）→ 建单勾权益关联他 → 次数 2→1；取消返还 → 2；删除返还 → 2
2. 勾权益未选预订人 → 400 且提示明确
3. 换预订人编辑：旧人 +1、新人 -1、不足拦截
4. 客户 CRUD 全程无权益字段；客户详情无权益统计但有每单"是否用权益"
5. UI 全部文案为「预订人」无「权益人」残留
