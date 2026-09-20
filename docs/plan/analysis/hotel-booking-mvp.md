# 交付分析 — 酒店预订管理系统 MVP

需求来源：用户 2026-09-20 口述 + 三项定案（要登录、记成本算利润、域名已购待提供）。
设计依据：[architecture/system-design.md](../../architecture/system-design.md)（Finalized）。

## 任务划分

| 任务 | 执行者 | 内容 | 依赖 | 状态 |
|---|---|---|---|---|
| deploy-infra | 主 agent | 服务器 Node/nginx 安装 ✅；建库建用户；SSH 隧道；git 初始化 | — | in-progress |
| backend-api | 开发 agent A → 验收 agent C | server/ 全部：schema、6 组路由、鉴权、业务规则 | deploy-infra 的隧道与库 | ready |
| frontend-web | 开发 agent B → 验收 agent D | web/ 全部：6 页面 + 路由 + api 封装 + 构建 | backend-api 的契约（设计文档已 Finalized，可并行） | ready |
| deploy-release | 主 agent | 本地集成验证 → rsync → 服务器 systemd + nginx → IP 可访问 | backend、frontend 通过验收 | pending |
| domain-https | 主 agent | DNS A 记录 → hhao1121 域名 + certbot HTTPS | **用户提供完整域名与 DNS 控制权**（外部条件） | blocked |

## 调度记录

- 2026-09-20：设计定案（system-design.md）。服务器已装 Node v22.23.2 + nginx 1.24.0。3306 安全组未放行——采用 SSH 隧道方案（本地 13306），无需放行。
- 并行策略：backend-api 与 frontend-web 依据同一份 Finalized 契约并行开发，文件区不重叠（server/ vs web/）。dev server 联调由主 agent 集成阶段负责（前端 vite 代理到本地后端，后端走隧道连服务器 MySQL）。
- 验收：每个任务由未参与开发的 agent 独立验收，依据 §8 验收场景；开发与验收不同执行者。
