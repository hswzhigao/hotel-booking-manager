# 酒店预订管理系统（hotel-booking-manager）

面向酒店预订中介的业务管理工具：闲鱼接单 → 微信联系客户 → 代客预订酒店 → 赚取差价。单一管理员使用，部署于腾讯云轻量服务器。

线上地址：https://hhao1121.cn （备选：www / order9d 子域名，IP 直达 124.220.169.36）

## 功能

- **酒店管理**：酒店信息维护，每家酒店下管理多个房型（床型/参考价）
- **客户管理**：姓名/微信/电话/备注，**升级权益次数**（手动充值 + 预定自动扣减/返还）
- **预定管理**：绑定客户+酒店+房型；**每间房一行、价格可各不相同**；晚数与卖价合计服务端自动计算；成本价手动填写，自动算利润；下单时间默认当前、可编辑
- **权益规则**：勾选"使用升级权益"扣 1 次；取消/删除自动返还；余额不足拦截
- **查询统计**：按客户/酒店/状态/入住日期/关键词筛选；客户历史（几晚几间、每间价格、累计消费）；仪表盘汇总（预定数/收入/成本/利润/本月口径）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite 5 + Element Plus 2 + vue-router 4 + pinia 2 |
| 后端 | Node.js 22 + Express 4 + mysql2 + bcryptjs + jsonwebtoken |
| 数据库 | MySQL 8（utf8mb4） |
| 部署 | nginx（静态托管 + /api 反代）+ systemd + certbot HTTPS |

## 目录结构

```
server/   后端 API（Express，sql/schema.sql 建表，scripts/init-db.js 幂等初始化）
web/      前端 SPA（Vite 构建，dist/ 静态产物）
deploy/   nginx 站点配置、systemd unit、一键部署脚本 deploy.sh
docs/     设计文档（docs-sprint 交付：架构设计/任务/验收记录）
```

## 本地开发

```bash
# 1. 数据库：MySQL 8，建库 hhao1121，配置 server/.env（参考 server/.env.example）
# 2. 后端
cd server && npm install && npm run init-db && npm start   # http://127.0.0.1:3000
# 3. 前端
cd web && npm install && npm run dev                        # http://localhost:5173
```

默认管理员：`admin / admin123`（首次登录后请到「系统设置」改密码）

## 部署

```bash
./deploy/deploy.sh   # 构建前端 → rsync → 服务器 npm install + init-db → systemctl restart
```

服务器：Ubuntu 24.04（腾讯云轻量），nginx 站点配置见 `deploy/nginx-hhao1121.conf`，服务名 `hotel-api`。

## 设计与验收

- 系统设计（数据模型/业务规则/API 契约/页面规格/验收场景）：[docs/architecture/system-design.md](docs/architecture/system-design.md)
- 任务划分与验收记录：[docs/plan/](docs/plan/)
