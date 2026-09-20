---
id: backend-v2
package: server
module: 后端 API v2
status: in-progress
depends-on: []
---
# 任务：后端 v2（入住政策/权益人/预定关联）
objective：benefit_holders 新表+CRUD、hotels 政策字段、bookings 关联权益人、migrate-v2 幂等迁移。
context：docs/architecture/v2-checkin-policy.md（§2 模型 §3 API）；v1 已上线代码为基线。
path：server/
verification：§5 场景 1-3、5-6 API 层 + v1 回归；小赵独立验收。
执行：主 agent 开发（2026-09-21）。
