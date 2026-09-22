# V5 设计 — 字段管理 / 价格档位 / 每晚价模型 / 菜单方向

状态：**Finalized**（2026-09-21 用户反馈四项）

## 1. 移动端菜单方向
MainLayout 汉堡抽屉 `direction="ltr"`（左侧滑出）。

## 2. 字段管理（预设值字典）
- 新表 `option_dict {id, category VARCHAR(50), label VARCHAR(100), sort INT, created_at}`，UNIQUE(category,label)
- 种子（category='checkin_info'）：姓名、身份证号、手机号、信用卡后四位
- API：`GET /api/option-dict?category=`、`POST/PUT/DELETE /api/option-dict`（删除无引用保护——纯字典）
- 新页面 /fields「字段管理」（主菜单）：按类别分组卡片（当前仅「入住需提供信息」一类，结构留扩展），列表+增删改
- 酒店表单 `checkin_info_required` 改 `el-select multiple filterable allow-create`，选项来自字典；存储仍为逗号分隔文本（现有列复用）；酒店详情按分隔拆成 el-tag 展示；allow-create 的新值只进本单不进字典

## 3. 房型价格档位
- 新表 `room_type_rates {id, room_type_id FK CASCADE, label VARCHAR(50), price DECIMAL(10,2)}`
- room-types API：GET（按酒店）返回每房型 `rates:[{id,label,price}]`；POST/PUT 接受 `rates` 数组整组替换（label 非空、price≥0）；房型删除级联删档位
- 房型 Dialog：档位行编辑器（档位名+价格，可增删），参考价 label 改「参考价（每晚）」
- 预定明细行：选房型 → 每晚价自动填 default_price；房型下方渲染该房型档位 chip（如「平日 ¥500」「国庆 ¥888」，点击填入）；每晚价可手改

## 4. 每晚单价模型（核心语义变更）
- `booking_items.price` 语义：**每晚单价**（原为该间全程总价）
- `sale_total = nights × SUM(items.price)`（服务端计算）
- 前端明细行：显示「每晚价」输入 + 行小计（每晚价×晚数，实时）；底部合计=Σ行小计
- 一笔预定内每行可选不同房型（原有能力，UI 加提示文案说明）
- 旧数据迁移：booking_items.price ÷ 对应 bookings.nights（现有 1 条测试单，自动换算）
- 高尔夫订单价格语义不变（单次价格）

## 5. 迁移
migrate-v7.js：建 option_dict(+种子) 与 room_type_rates；换算存量 booking_items.price（÷nights，除不尽保留原值并输出警告日志）

## 6. 验收场景
1. 菜单左侧滑出、开合跳转正常
2. 字段管理：增删改预设值；酒店表单多选+自定义输入；详情展示 tag；存储逗号串
3. 房型：建「花园大床房」+ 平日/国庆两档位 → 建单选它 → 默认带参考价 → 点「国庆 ¥888」chip → 价格变 888
4. 每晚价：1间大床3晚每晚500 + 2间双床每晚450 → 行小计 1500/900/900、合计 3300；后端 sale_total=3300
5. 改晚数（3→4晚）→ 行小计与合计实时更新
6. 回归：权益张数、渠道、状态流转、桌面端布局不受影响
