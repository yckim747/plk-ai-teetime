#!/usr/bin/env bash
# Codespaces용: 최신 코드를 받아 앱(3001 포트)을 다시 띄운다.
# 코드스페이스가 켜질 때(postStartCommand) 자동 실행되고, 업데이트할 때 수동으로도 실행한다.
cd "$(dirname "$0")/.." || exit 1
git pull --ff-only -q || echo "[restart-app] git pull 생략 (로컬 변경 있음)"
npm install --no-audit --no-fund --loglevel=error
pkill -f "server/index.ts" || true
setsid nohup npm run demo > /tmp/app.log 2>&1 < /dev/null &
echo "[restart-app] 앱 시작. 로그: /tmp/app.log"
