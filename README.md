# hotel-booking-manager — 酒店预订 & 高尔夫权益双业务线管理系统

面向信用卡/渠道权益中介的业务管理工具：闲鱼接单 → 微信/闲鱼找权益人 → 代客预订酒店或高尔夫 → 赚取差价。单一管理员使用，部署于腾讯云轻量服务器。

线上地址：**https://hhao1121.cn/hotel/**（已备案域名 + HTTPS；系统以子路径方式部署，域名根为其他站点）

## 业务模型

- **客户**：付钱住店/打球的买家（闲鱼获客，双标签：酒店客户 / 高尔夫客户；支持闲鱼号/微信号双联系方式）
- **预订人（权益持有人）**：出借信用卡/平台权益的人，独立资源池。持有什么卡（**卡片类型多选，可配置**）、酒店权益次数、多种高尔夫权益种类（金葵花/经典白/中信…各自适用球场不同）、是否愿意到场/协助、仅周末或仅工作日可用、权益每年几月更新、来源渠道（闲鱼/微信）
- **预定单**：双向关联「住的客户 × 用谁权益的预订人」

## 功能总览

### 酒店业务线
- **酒店管理**：酒店信息 + 房型（床型/参考价（每晚）+ **价格档位**：平日/周末/国庆等，一键带价）；**入住政策**（需预订人本人到场三态、需提供信息多选、办理流程、官方电话）；**入住指南**（可编辑文本，一键复制发客户）
- **酒店订单**：
  - 每间房一行、**每晚价 × 晚数自动小计**、卖价合计自动汇总；多房型混单一笔搞定；成本价手动填
  - **10 态业务流程**：沟通中→已下单→确认信息→预订中→已预订→酒店已确认→待入住→已入住→入住完成（+任意阶段取消）；**列表内点徽标直接改状态**
  - **权益张数**（默认 1，1 间 3 晚用 3 张券）、**含双早**、下单时间可回填
  - **手续费**：闲鱼单默认 1.6%（可逐单改）、微信单 0%；利润 = 卖价 − 成本 − 手续费（净利）
  - **结算标记**：闲鱼渠道预订人（入住完成后确认收货）/ 微信好友（酒店确认后转账）
  - **复制拆单**：2 间房需要 2 个预订人时一键复制
  - 需到场酒店橙色提醒、优先推荐愿意到场的预订人

### 高尔夫业务线
- **权益种类字典**：名称 + 适用球场范围（金葵花=仅金桥、经典白/中信=通用，可增删改），球场×种类自动校验
- **高尔夫订单**：客户×预订人×球场（字典+历史下拉）×日期×**权益点**；勾选「消耗高尔夫权益」时按**权益点数量**从预订人对应种类明细中扣减（不足拦截）；**教定位标记**；渠道（闲鱼/微信/其他）；四态（待定位→已定位→已完成→取消）；列表内改状态；手续费同酒店线
- 编辑订单时权益点变动按差额自动增减；取消/删除自动返还权益点

### 客户与预订人
- **客户**：双业务标签、闲鱼号/微信号、历史（酒店订单含每间价格明细 + 高尔夫订单）；累计消费 = 酒店卖价 + 高尔夫卖价（排除取消单）
- **预订人**：卡片类型多选、酒店权益次数+更新月、高尔夫权益明细（种类×剩余权益点×更新月）、愿意到场/协助、合作中、来源渠道；**更新月到期高亮**
- **搜索**：全站拼音支持——客户/预订人姓名、酒店名、球场名均可 **全拼/首字母** 搜索（张三→zhangsan/zs、金桥→jinqiao、三亚→sanyaguo），另可搜闲鱼号、微信号、电话
- **排序**：酒店订单（下单时间/入住日期/卖价/净利）、高尔夫订单（下单时间/打球日期/卖价/净利）、客户（姓名/预定次数/累计消费）表头点击排序（服务端全量排序）
- **导出**：四个列表页一键导出 CSV（跟随筛选与排序，Excel 直接打开不乱码）

### 记账与统计
- **记账本**：杂项收入/支出（归属酒店/高尔夫/通用），月度小计，计入仪表盘本月口径
- **仪表盘**：总账（总营收/成本/手续费/毛利/净利/**利润率**）+ 分账（酒店/高尔夫）+ 渠道收益（闲鱼/微信/其他）+ **收益趋势图**（按日/周/月/年 × 全部/酒店/高尔夫 × 收入/净利，带缩放按钮）+ 最近订单（点行弹详情）
- 财务口径：酒店排除「沟通中/已取消」、高尔夫排除「已取消」；**利润/营收类数字统一红色**（中国记账惯例）

### 界面与移动端
- 清新浅色主题（主色 #3b6cf6）：圆角卡片、柔和阴影、菜单选中态、统计卡图标
- iPhone 全功能适配：汉堡菜单、卡片流列表、全宽抽屉、移动端日期用两个独立日期框（跨月选择无忧、不弹键盘）、底部操作栏吸底、图表可横滑缩放

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite 5 + Element Plus 2 + vue-router 4 + pinia 2 + echarts（按需引入） |
| 后端 | Node.js 22 + Express 4 + mysql2 + bcryptjs + jsonwebtoken + pinyin-pro |
| 数据库 | MySQL 8（utf8mb4，14 张表） |
| 部署 | nginx（/hotel/ 静态托管 + /api 反代）+ systemd + certbot HTTPS 自动续期 |

## 目录结构

```
server/   后端 API（sql/schema.sql 全量建表；scripts/init-db.js + migrate-v2~v11 幂等迁移链）
web/      前端 SPA（views: Dashboard/Bookings/Golf/Customers/Hotels/Holders/Ledger/Fields/Settings）
deploy/   nginx 站点配置、systemd unit、一键部署 deploy.sh
docs/     设计文档（docs-sprint 交付：V1→V13 架构设计/任务/验收记录全留痕）
```

## 本地开发

```bash
# 1. MySQL 8 建库 hhao1121；配置 server/.env（参考 server/.env.example）
# 2. 后端
cd server && npm install && npm run init-db && npm start   # http://127.0.0.1:3000
# 3. 前端
cd web && npm install && npm run dev                        # http://localhost:5173
```

## 部署

```bash
./deploy/deploy.sh   # 以 VITE_BASE=/hotel/ 构建前端 → rsync 至 /var/www/hotel/ → 服务器 init-db + migrate 链 → systemctl restart
```

服务器：Ubuntu 24.04（腾讯云轻量），nginx 配置见 `deploy/`，服务名 `hotel-api`，数据库每周自动备份（cron，保留 30 天）。

## 设计与验收文档

- V1 系统设计（数据模型/业务规则/API 契约/验收场景）：[docs/architecture/system-design.md](docs/architecture/system-design.md)
- V2 入住政策/权益人/入住指南 + V2.1 预订人/客户概念分离：[docs/architecture/v2-checkin-policy.md](docs/architecture/v2-checkin-policy.md)
- V3 高尔夫业务线 + V3.1 权益按种类管理：[docs/architecture/v3-golf.md](docs/architecture/v3-golf.md)
- V3.2 酒店订单 10 态流程/结算 + V3.3 渠道统计：[docs/architecture/v3_2-hotel-workflow.md](docs/architecture/v3_2-hotel-workflow.md) / [v3_3-channel-stats.md](docs/architecture/v3_3-channel-stats.md)
- V4 移动端适配：[docs/architecture/v4-mobile.md](docs/architecture/v4-mobile.md)
- V5 字段管理/价格档位/每晚价模型：[docs/architecture/v5-field-and-pricing.md](docs/architecture/v5-field-and-pricing.md)
- V6 仪表盘重构：[docs/architecture/v6-dashboard.md](docs/architecture/v6-dashboard.md)
- V7 手续费/记账本/菜单更名/内联状态：[docs/architecture/v7-fee-ledger.md](docs/architecture/v7-fee-ledger.md)
- V9/V10 联系方式分字段/卡片类型字典/拼音搜索/图表缩放：[docs/architecture/v9-contacts-and-search.md](docs/architecture/v9-contacts-and-search.md)
- V13 UI 全面优化 + 移动端日期专项修复：[docs/architecture/v13-ui-polish.md](docs/architecture/v13-ui-polish.md)
- 架构图/ER 图/业务流程图：[docs/architecture/diagrams.md](docs/architecture/diagrams.md)
- 任务划分与验收记录：[docs/plan/](docs/plan/)（开发/验收分人执行、全链路留痕）
