import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { createDeps } from "./deps";

/**
 * Vercel 서버리스 함수 진입점. /api/* 요청을 Express 앱이 처리한다.
 * 화면(정적 파일)은 Vercel CDN이 제공하고, 티타임 CSV는 함수와 같은 폴더(data/)에 함께 배포된다.
 */
const csvPath = fileURLToPath(new URL("./data/teetimes.csv", import.meta.url));

export default createApp(createDeps(csvPath));
