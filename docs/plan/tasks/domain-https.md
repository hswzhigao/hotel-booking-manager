---
id: domain-https
package: deploy
module: 域名与 HTTPS
status: blocked
depends-on: [deploy-release]
---

# 任务：域名解析 + HTTPS（阻塞：等用户）

## objective
hhao1121 域名 A 记录 → 124.220.169.36；nginx 绑定域名；certbot 签发 Let's Encrypt 证书，HTTP 自动跳转 HTTPS。

## blocked 原因
用户已购买域名但**尚未提供完整域名（TLD）与 DNS 控制台信息**。恢复方式：用户提供域名后，指导/协助添加 A 记录（或用户提供 DNS 操作途径）。

## 待办
- [ ] 拿到完整域名
- [ ] DNS A 记录 @ 和 www → 124.220.169.36
- [ ] nginx server_name + certbot --nginx
- [ ] 验证 https 访问与 HTTP 跳转
