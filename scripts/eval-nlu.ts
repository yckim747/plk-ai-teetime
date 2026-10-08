/**
 * 자연어 → 검색 조건 변환 평가. 실제 OpenAI API를 호출한다.
 *   npm run eval:nlu                     (.env의 OPENAI_MODEL)
 *   npm run eval:nlu -- gpt-5.4-mini     (모델 지정 비교)
 * 기준일은 2026-10-08(목)로 고정한다.
 */
import { resolve } from "node:path";
import OpenAI from "openai";
import type { SearchCriteria } from "../shared/types";
import { normalizeCriteria } from "../server/catalog";
import { OpenAIQueryParser } from "../server/nlu/parseQuery";
import { CsvSource } from "../server/source/CsvSource";

try {
  process.loadEnvFile();
} catch {}

const TODAY = "2026-10-08";
const model = process.argv[2] || process.env.OPENAI_MODEL || "gpt-4.1-mini";

type Expect = Partial<Record<keyof SearchCriteria, unknown>> & { anyDate?: boolean; clarify?: boolean; unmatched?: boolean };
interface Case {
  text: string;
  prev?: SearchCriteria;
  expect: Expect;
}

const base: SearchCriteria = { dates: ["2026-10-10"], regions: ["한강이남"], clubs: [], timeFrom: "05:00", timeTo: "12:00", maxFee: 250000, sort: "recommend" };

const CASES: Case[] = [
  { text: "이번 주 토요일 오전에 한강이남 25만원 이하", expect: { dates: ["2026-10-10"], regions: ["한강이남"], timeTo: "12:00", maxFee: 250000 } },
  { text: "10월 15일 오후 2시쯤 써닝포인트", expect: { dates: ["2026-10-15"], clubs: ["써닝포인트컨트리클럽"], preferredTime: "14:00" } },
  { text: "제주도 다음 주말 새벽", expect: { dates: ["2026-10-17", "2026-10-18"], regions: ["제주도"], timeFrom: "05:00", timeTo: "07:00" } },
  { text: "이번 주말 경기 북부 오후", expect: { dates: ["2026-10-10", "2026-10-11"], regions: ["한강이북"], timeFrom: "12:00" } },
  { text: "모레 용인 쪽 아침 일찍", expect: { dates: ["2026-10-10"], regions: ["한강이남"] } },
  { text: "다음 주 수요일 부산 20만원대", expect: { dates: ["2026-10-14"], regions: ["경상도"], minFee: 200000, maxFee: 299000 } },
  { text: "10월 20일 해운대 컨트리클럽", expect: { dates: ["2026-10-20"], clubs: ["해운대 컨트리클럽"] } },
  // 스카이72는 클럽72의 옛 이름
  { text: "스카이72 이번 주말", expect: { dates: ["2026-10-10", "2026-10-11"], clubs: ["클럽72"] } },
  { text: "남서울CC 다음 주 토요일", expect: { dates: ["2026-10-17"], unmatched: true } },
  { text: "안녕하세요", expect: { clarify: true } },
  { text: "강원도 제일 싼 티타임 아무때나", expect: { anyDate: true, regions: ["강원도"], sort: "price" } },
  { text: "17일 춘천 오후 3시 이후", expect: { dates: ["2026-10-17"], regions: ["강원도"], timeFrom: "15:00" } },
  { text: "다음 주 평일 충청도 오전", expect: { dates: ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"], regions: ["충청도"], timeTo: "12:00" } },
  { text: "시월 이십일일 오전 아홉시쯤 양지파인", expect: { dates: ["2026-10-21"], clubs: ["양지파인컨트리클럽"], preferredTime: "09:00" } },
  { text: "베어포트 다음 주 토요일", expect: { dates: ["2026-10-17"], clubs: ["베어포트리조트CC(구.웅포)"] } },
  { text: "웅포 cc 10월 25일 오후", expect: { dates: ["2026-10-25"], clubs: ["베어포트리조트CC(구.웅포)"], timeFrom: "12:00" } },
  { text: "수도권 이번 토요일 7시쯤", expect: { dates: ["2026-10-10"], regions: ["한강이남", "한강이북"], preferredTime: "07:00" } },
  // 후속 문의
  { text: "좀 더 늦게", prev: base, expect: { dates: ["2026-10-10"], regions: ["한강이남"], timeTo: "13:00", maxFee: 250000 } },
  { text: "더 싼 곳 없어?", prev: base, expect: { dates: ["2026-10-10"], regions: ["한강이남"], sort: "price" } },
  { text: "한강이북도 포함해줘", prev: base, expect: { dates: ["2026-10-10"], regions: ["한강이남", "한강이북"], maxFee: 250000 } },
  { text: "가격은 상관없어", prev: base, expect: { dates: ["2026-10-10"], regions: ["한강이남"], maxFee: undefined } },
  { text: "다음 주 일요일 제주도 오후로 새로 찾아줘", prev: base, expect: { dates: ["2026-10-18"], regions: ["제주도"], timeFrom: "12:00", maxFee: undefined } },
  { text: "토요일 말고 일요일로", prev: base, expect: { dates: ["2026-10-11"], regions: ["한강이남"], maxFee: 250000 } },
  { text: "처음부터 다시 할게", prev: base, expect: { dates: [], regions: [], clubs: [], timeTo: undefined, maxFee: undefined } },
];

const norm = (v: unknown) => (Array.isArray(v) ? JSON.stringify([...v].sort()) : JSON.stringify(v));

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY가 필요합니다.");
  const source = new CsvSource(resolve(process.env.TEETIME_CSV || "data/teetimes.csv"));
  const catalog = await source.catalog();
  const parser = new OpenAIQueryParser(new OpenAI({ apiKey }), model);
  console.log(`모델: ${model}, 기준일: ${TODAY}, ${CASES.length}건\n`);

  let pass = 0;
  const latencies: number[] = [];
  const queue = [...CASES.entries()];
  const lines: string[] = new Array(CASES.length);
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const [i, tc] = item;
        const t0 = performance.now();
        const parsed = await parser.parse({ message: tc.text, prev: tc.prev, catalog, today: TODAY });
        latencies.push(performance.now() - t0);
        const n = normalizeCriteria(parsed.criteria, catalog);
        const got: Record<string, unknown> = { ...n.criteria, anyDate: parsed.anyDate, clarify: parsed.needsClarification, unmatched: n.unmatchedClubs.length > 0 };
        const diffs = Object.entries(tc.expect)
          .filter(([k, v]) => norm(got[k]) !== norm(v))
          .map(([k, v]) => `${k}: 기대 ${norm(v)} / 실제 ${norm(got[k])}`);
        if (!diffs.length) pass++;
        lines[i] = `${diffs.length ? "✗" : "✓"} ${tc.prev ? "(후속) " : ""}${tc.text}${diffs.map((d) => `\n    ${d}`).join("")}`;
      }
    }),
  );
  console.log(lines.join("\n"));
  latencies.sort((a, b) => a - b);
  console.log(`\n정확도 ${pass}/${CASES.length} (${Math.round((pass / CASES.length) * 100)}%), 지연 중앙값 ${Math.round(latencies[Math.floor(latencies.length / 2)])}ms, 최대 ${Math.round(latencies.at(-1)!)}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
