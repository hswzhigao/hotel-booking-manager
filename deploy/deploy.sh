#!/usr/bin/env bash
# 一键部署：本地构建前端 → rsync 到服务器 → 服务器安装依赖/初始化库/重启服务
# 用法：在项目根目录执行 ./deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SERVER=ubuntu@124.220.169.36
APP_DIR=/opt/hhao1121
WEB_DIR=/var/www/hhao1121/web

echo "==> 1/4 构建前端..."
( cd web && npm run build )

echo "==> 2/4 同步代码..."
rsync -az --delete web/dist/ "$SERVER:$WEB_DIR/"
rsync -az --delete --exclude node_modules --exclude .env server/ "$SERVER:$APP_DIR/server/"

echo "==> 3/4 服务器端安装依赖并初始化/迁移数据库（幂等）..."
ssh "$SERVER" "cd $APP_DIR/server && npm install --omit=dev && npm run init-db && npm run migrate-v2 && npm run migrate-v3 && npm run migrate-v4 && npm run migrate-v5 && npm run migrate-v6 && npm run migrate-v7 && npm run migrate-v8 && npm run migrate-v9"

echo "==> 4/4 重启服务..."
ssh "$SERVER" "sudo systemctl restart hotel-api && sleep 1 && systemctl is-active hotel-api"

echo "部署完成：http://124.220.169.36"
