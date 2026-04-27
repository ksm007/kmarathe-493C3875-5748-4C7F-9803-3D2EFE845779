#!/bin/bash
set -e  # exit immediately on any error

APP_DIR="${APP_DIR:-/home/ksm/turbo-vets/kmarathe-493C3875-5748-4C7F-9803-3D2EFE845779}"
cd "$APP_DIR"

echo "[1/5] Pulling latest code..."
git pull origin main

echo "[2/5] Installing dependencies..."
npm ci --prefer-offline

echo "[3/5] Building API..."
npm run build:api

echo "[4/5] Building Dashboard..."
npm run build:dashboard

echo "[5/5] Running database migrations..."
npm run db:migrate

echo "[6/6] Reloading application..."
pm2 reload ecosystem.config.js --env production \
  || pm2 start ecosystem.config.js --env production

echo ""
echo "Deploy complete. Status:"
pm2 status turbo-vets-api
