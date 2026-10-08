/**
 * Vercel 배포용 빌드 (Build Output API v3).
 *   .vercel/output/static/              ← 웹 화면 (vite build 결과)
 *   .vercel/output/functions/api.func/  ← /api/* 를 처리하는 서버 함수(번들 1개) + 티타임 CSV
 * 배포: npm run deploy:vercel
 */
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const OUT = ".vercel/output";
const FN = `${OUT}/functions/api.func`;

rmSync(OUT, { recursive: true, force: true });
execSync("npx vite build", { stdio: "inherit" });
cpSync("dist", `${OUT}/static`, { recursive: true });

await build({
  entryPoints: ["server/vercel.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: `${FN}/index.mjs`,
  // CommonJS 패키지(express 등)가 require를 쓸 수 있게 한다.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});

mkdirSync(`${FN}/data`, { recursive: true });
cpSync(process.env.TEETIME_CSV || "data/teetimes.csv", `${FN}/data/teetimes.csv`);

const json = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2));
json(`${FN}/.vc-config.json`, {
  runtime: "nodejs22.x",
  handler: "index.mjs",
  launcherType: "Nodejs",
  shouldAddHelpers: false,
  maxDuration: 60,
});
json(`${OUT}/config.json`, {
  version: 3,
  routes: [
    { src: "^/api(?:/.*)?$", dest: "/api" },
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/index.html" },
  ],
});
console.log(`[build-vercel] ${OUT} 준비 완료`);
