import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app";
import { createDeps } from "./deps";

try {
  process.loadEnvFile();
} catch {
  // .env가 없으면 환경변수만 사용
}

const csvPath = resolve(process.env.TEETIME_CSV || "data/teetimes.csv");
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "127.0.0.1";

const deps = createDeps(csvPath);
await deps.source.catalog(); // 시작 시 한 번 적재해 파일 오류를 바로 드러낸다
const app = createApp(deps);

// 빌드된 웹(npm run build)이 있으면 같은 포트에서 제공한다.
const dist = resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(dist, "index.html")));
}

app
  .listen(port, host, () => {
    console.log(`[server] http://${host}:${port}  AI: ${deps.parser ? "사용" : "미설정(수동 검색만)"}  데이터: ${csvPath}`);
    const { CODESPACE_NAME, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: domain } = process.env;
    if (CODESPACE_NAME && domain) console.log(`[server] Codespaces 주소: https://${CODESPACE_NAME}-${port}.${domain}`);
  })
  .on("error", (err) => {
    console.error(`[server] ${host}:${port} 시작 실패:`, err.message);
    process.exit(1);
  });
