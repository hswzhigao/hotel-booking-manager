---
id: backend-api
package: server
module: 后端 API
status: ready
depends-on: [deploy-infra]
---

# 任务：后端 API 实现

## objective
实现 `server/` 下完整可运行的后端：MySQL schema + seed、JWT 鉴权、hotels/room-types/customers/bookings/stats 全部接口，满足设计文档 §4 业务规则与 §5 契约。

## context
- 设计契约（唯一依据，已 Finalized）：[docs/architecture/system-design.md](../../architecture/system-design.md) §3 数据模型、§4 业务规则、§5 API 契约、§7 配置与目录。
- 依赖 deploy-infra 已完成：SSH 隧道 `127.0.0.1:13306` → 服务器 MySQL；库 `hhao1121`；应用账号见 `server/.env`（主 agent 提供）。
- 技术栈限定：Express 4 + mysql2/promise + bcryptjs + jsonwebtoken，**不用 ORM**。

## path
`server/` 全部（package.json、src/、sql/schema.sql、.env.example）

## verification
- `npm install && node src/index.js` 启动无错。
- 用 curl 跑通设计文档 §8 验收场景 1–11（API 层面）。
- 权益扣减/返还/校验规则与 §4.3 完全一致；sale_total/nights 服务端计算。
- 消融：不引入未约定的抽象层（无 repository/service 分层、无 ORM、无 TypeScript），Express 路由函数内直接参数化 SQL。

## 交付物
- 代码 + `.env.example`；返回：验证结果、未尽事项。
