---
id: frontend-web
package: web
module: 前端页面
status: done
depends-on: [backend-api]
---

# 任务：前端页面实现

## objective
实现 `web/` 下完整前端：登录 + 仪表盘 + 预定管理 + 客户管理 + 酒店管理（含房型）+ 系统设置，可 `npm run build` 产出静态 dist。

## context
- 设计契约（唯一依据，已 Finalized）：[docs/architecture/system-design.md](../../architecture/system-design.md) §5 API 契约、§6 页面规格、§7 配置与目录。
- 依赖说明：仅依赖契约文档（backend-api 并行开发中）；本地开发用 vite 代理 `/api → http://127.0.0.1:3000`，后端未就绪时用 mock 思路自测渲染，不引入 mock 库。
- 技术栈限定：Vue 3 组合式 API + Element Plus 2（zh-cn locale）+ vue-router 4 + pinia 2 + axios；不用 UI 以外的组件库。

## path
`web/` 全部

## verification
- `npm install && npm run build` 零报错产出 dist。
- `npm run dev` 启动后各页面可渲染（登录页、布局导航、空表格态）。
- 页面覆盖 §6 全部要点：明细行每间价格、权益剩余显示与勾选、order_time 默认当前可编辑、利润红绿区分、401 跳登录、金额两位小数。
- 消融：不引入未约定的状态/权限抽象；api 封装一个 axios 模块 + 按域函数即可。

## 交付物
- 代码；返回：验证结果、未尽事项。

## 执行记录
- 2026-09-20：小陈开发完成（提交 25158c9），构建零报错 + 无头 Chrome 渲染验证，自修 401 重定向循环 bug。
- 2026-09-20：E2E 集成验收 pass。第一轮 agent 因平台故障中断（工具保留）；小周限时接手快跑，S02–S09 全过（截图+DOM断言+API实查），零产品 bug；两个疑点均坐实为测试脚本问题。开发=小陈，E2E 验收=小赵/小周（不同执行者 ✓）。
