#!/usr/bin/env bash
# Codespaces용: 최신 코드를 받아 앱(3001 포트)을 다시 띄운다.
# 코드스페이스가 켜질 때(postStartCommand) 자동 실행되고, 업데이트할 때 수동으로도 실행한다.
#   gh codespace ssh -c <이름> -- bash /workspaces/plk-ai-teetime/scripts/restart-app.sh
cd "$(dirname "$0")/.." || exit 1

# SSH 세션에는 Codespaces 시크릿이 환경변수로 들어오지 않으므로 시크릿 파일(base64)에서 읽는다.
SECRETS=/workspaces/.codespaces/shared/.env-secrets
if [ -z "$OPENAI_API_KEY" ] && [ -f "$SECRETS" ]; then
  OPENAI_API_KEY=$(grep '^OPENAI_API_KEY=' "$SECRETS" | cut -d= -f2- | base64 -d 2>/dev/null)
  export OPENAI_API_KEY
fi
if [ -z "$CODESPACE_NAME" ] && [ -f "$SECRETS" ]; then
  CODESPACE_NAME=$(grep -m1 '^CODESPACE_NAME=' "$SECRETS" | cut -d= -f2- | base64 -d 2>/dev/null)
  GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN=$(grep -m1 '^GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN=' "$SECRETS" | cut -d= -f2- | base64 -d 2>/dev/null)
  export CODESPACE_NAME GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
fi

git pull --ff-only -q || echo "[restart-app] git pull 생략 (로컬 변경 있음)"
npm install --no-audit --no-fund --loglevel=error
pkill -f "server/index.ts" || true
setsid nohup npm run demo > /tmp/app.log 2>&1 < /dev/null &
echo "[restart-app] 앱 시작. 로그: /tmp/app.log"
