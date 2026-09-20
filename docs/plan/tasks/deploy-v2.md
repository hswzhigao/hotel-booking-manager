---
id: deploy-v2
package: deploy
module: v2 部署
status: pending
depends-on: [backend-v2, frontend-v2]
---
# 任务：v2 部署
objective：migrate-v2 迁移线上库 → deploy.sh → 冒烟（三域名 HTTPS+回归点检）→ 代码推 GitHub。
