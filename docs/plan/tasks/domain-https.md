---
id: domain-https
package: deploy
module: 域名与 HTTPS
status: in-progress
depends-on: [deploy-release]
---

# 任务：域名解析 + HTTPS

## objective
hhao1121.cn 域名可访问系统，并配置 HTTPS。

## 已完成
- [x] 用户提供域名：hhao1121.cn（腾讯云 DNSPod 免费版，2026-09-20）
- [x] 用户已在 DNSPod 添加 A 记录：@ 和 www → 124.220.169.36（已验证解析生效）
- [x] nginx server_name 已配置 hhao1121.cn www.hhao1121.cn 并 reload
- [x] 80 端口安全组已放行（验证连通）

## 待办
- [x] **用户操作**：安全组放行 443/TCP（HTTPS 需要）——2026-09-20 由主 agent 通过共享浏览器操作完成：该实例为轻量应用服务器（Lighthouse，上海地域 lhins-ci9b82qo），在「防火墙」页添加规则 HTTPS(443)/TCP/全部IPv4/允许，已验证放行生效（connection refused = 无监听，非超时拦截）
- [ ] deploy-release 完成后：certbot --nginx -d hhao1121.cn -d www.hhao1121.cn 签发证书
- [ ] 验证 https://hhao1121.cn 与 HTTP→HTTPS 跳转
