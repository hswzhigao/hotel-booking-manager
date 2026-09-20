---
id: deploy-infra
package: deploy
module: 基础设施
status: in-progress
depends-on: []
---

# 任务：开发与部署基础设施（主 agent 执行）

## objective
为开发与部署提供环境：服务器 Node/nginx、MySQL 库与应用账号、SSH 隧道、git 仓库、部署工件。

## 已完成
- [x] 服务器安装 Node v22.23.2、nginx 1.24.0（2026-09-20）
- [x] MySQL 远程管理用户 hhao@%（用户自设密码）

## 待办
- [ ] 建库 `hhao1121` + 应用账号 `hotel_app`@localhost（随机强密码）
- [ ] SSH 隧道 127.0.0.1:13306 → 124.220.169.36:3306（后台保活）
- [ ] git init + .gitignore + 首次提交
- [ ] deploy/：nginx 站点配置、systemd unit、deploy.sh、生产 .env

## verification
本地 `mysql` 不可用，用 `nc -z 127.0.0.1 13306` + 后端启动连通性验证。
