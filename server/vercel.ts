import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { createDeps } from "./deps";

/**
 * Vercel 서버리스 함수 진입점. /api/* 요청을 Express 앱이 처리한다.
 * 화면(정적 파일)은 Vercel CDN이 제공하고, 티타임 CSV는 함수와 같은 폴더(data/)에 함께 배포된다.
 */
const csvPath = fileURLToPath(new URL("./data/teetimes.csv", import.meta.url));
const metaPath = fileURLToPath(new URL("./data/meta.json", import.meta.url));
// 빌드 때 기록한 원본 CSV 수정 시각 (Vercel 파일 시각은 고정값이라 쓸 수 없음)
const dataUpdatedAt = existsSync(metaPath) ? new Date(JSON.parse(readFileSync(metaPath, "utf8")).dataUpdatedAt) : undefined;

export default createApp(createDeps(csvPath, dataUpdatedAt));
