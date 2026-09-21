# hotel-booking-manager — 酒店预订 & 高尔夫权益双业务线管理系统

面向信用卡/渠道权益中介的业务管理工具：闲鱼接单 → 微信/闲鱼找权益人 → 代客预订酒店或高尔夫 → 赚取差价。单一管理员使用，部署于腾讯云轻量服务器。

线上地址：https://hhao1121.cn （备选：www / order9d 子域名）

## 业务模型

- **客户**：付钱住店/打球的买家（闲鱼获客，双标签：酒店客户 / 高尔夫客户）
- **预订人（权益持有人）**：出借信用卡/平台权益的人，独立资源池。持有什么卡、酒店权益次数、多种高尔夫权益种类（金葵花/经典白/中信…各自适用球场不同）、是否愿意到场/协助、仅周末或仅工作日可用、权益每年几月更新、来源渠道（闲鱼/微信）
- **预定单**：双向关联「住的客户 × 用谁权益的预订人」

## 功能

### 酒店业务线
- **酒店管理**：酒店信息 + 房型（床型/参考价）；**入住政策**（是否需预订人本人到场三态、需提供的预订人信息、办理流程、官方电话）；**入住指南**（每店一段可编辑文本，一键复制发给闲鱼客户）
- **预定管理**：
  - 每间房一行、**价格可各不相同**；晚数/卖价合计服务端自动算；成本价手动填、利润自动算
  - **10 态业务流程**：沟通中→已下单→确认信息→预订中→已预订→酒店已确认→待入住→已入住→入住完成（+任意阶段取消）
  - **权益张数**：勾选使用权益时填张数（1 间 3 晚用 3 张券的场景）
  - **结算标记**：闲鱼渠道权益人（入住完成后确认收货）/ 微信好友（酒店确认后转账），转完勾「已结算」
  - 含双早字段；下单时间默认当前、可回填编辑
  - **复制预定**：多权益人拆单一键复制第二笔（2 间房找 2 个预订人）
  - 需到场酒店自动橙色提醒，优先推荐愿意到场的预订人

### 高尔夫业务线
- **权益种类字典**：金葵花（仅金桥）、经典白高尔夫（通用）、中信银行（通用）——可增删改、设置适用球场范围
- **高尔夫订单**：客户×预订人×球场×日期×人数；权益按**种类明细**扣减（球场×种类自动校验，金葵花去东镇直接拦截）；**教定位标记**；渠道（闲鱼/微信）；四态（待定位→已定位→已完成→取消）
- 预订人可用时间与打球日期匹配警示（仅周末/仅工作日）

### 客户与预订人
- **客户管理**：双业务标签、筛选、历史（酒店预定含每间价格明细 + 高尔夫订单）
- **预订人管理**：卡片类型、酒店权益次数+更新月、高尔夫权益明细（种类×次数×更新月）、愿意到场/协助、合作中、来源渠道；**更新月到期高亮**（本月更新黄牌提醒）

### 统计
- 仪表盘：双业务线收入/成本/利润/间夜数/订单数/本月口径（沟通中与已取消不计入财务）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite 5 + Element Plus 2 + vue-router 4 + pinia 2 |
| 后端 | Node.js 22 + Express 4 + mysql2 + bcryptjs + jsonwebtoken |
| 数据库 | MySQL 8（utf8mb4，12 张表） |
| 部署 | nginx（静态托管 + /api 反代）+ systemd + certbot HTTPS 自动续期 |

## 目录结构

```
server/   后端 API（sql/schema.sql 全量建表；scripts/init-db.js 初始化 + migrate-v2~v5.js 幂等迁移链）
web/      前端 SPA（views: Dashboard/Bookings/Customers/Hotels/Holders/Golf/Settings）
deploy/   nginx 站点配置、systemd unit、一键部署 deploy.sh
docs/     设计文档（docs-sprint 交付：架构设计/任务/验收记录全留痕）
```

## 本地开发

```bash
# 1. MySQL 8 建库 hhao1121；配置 server/.env（参考 server/.env.example）
# 2. 后端
cd server && npm install && npm run init-db && npm start   # http://127.0.0.1:3000
# 3. 前端
cd web && npm install && npm run dev                        # http://localhost:5173
```

默认管理员：`admin / admin123`（首次登录后请到「系统设置」改密码）

## 部署

```bash
./deploy/deploy.sh   # 构建前端 → rsync → 服务器 init-db + migrate 链 → systemctl restart
```

服务器：Ubuntu 24.04（腾讯云轻量 124.220.169.36），nginx 配置见 `deploy/nginx-hhao1121.conf`，服务名 `hotel-api`。

## 设计与验收文档

- V1 系统设计（数据模型/业务规则/API 契约/页面规格/验收场景）：[docs/architecture/system-design.md](docs/architecture/system-design.md)
- V2 入住政策/权益人/入住指南：[docs/architecture/v2-checkin-policy.md](docs/architecture/v2-checkin-policy.md)（含 V2.1 预订人/客户概念分离修订）
- V3 高尔夫业务线 + V3.1 权益按种类管理：[docs/architecture/v3-golf.md](docs/architecture/v3-golf.md)
- V3.2 酒店订单 10 态流程/结算：[docs/architecture/v3_2-hotel-workflow.md](docs/architecture/v3_2-hotel-workflow.md)
- 任务划分与验收记录：[docs/plan/](docs/plan/)（每个环节开发/验收分人执行、全链路留痕）
