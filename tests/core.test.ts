import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import type { SearchCriteria, TeeTime } from "../shared/types";
import { createApp } from "../server/app";
import { matchClub, normalizeCriteria } from "../server/catalog";
import type { QueryParser } from "../server/nlu/parseQuery";
import { buildSystemPrompt } from "../server/nlu/parseQuery";
import { buildSpeech, speakDate, speakFee, speakTime } from "../server/reply";
import { matches } from "../server/search/filter";
import { pickTop, rankTeeTimes, sortForList } from "../server/search/recommend";
import { featuredSections, upcomingWeekend } from "../server/search/featured";
import { runSearch } from "../server/search/service";
import { MemorySource, normalizeFee, normalizeTime, parseTeeTimeCsv } from "../server/source/CsvSource";

const c = (over: Partial<SearchCriteria> = {}): SearchCriteria => ({ dates: [], regions: [], clubs: [], sort: "recommend", ...over });

let seq = 0;
const tt = (over: Partial<TeeTime>): TeeTime => ({
  id: `t${seq++}`,
  date: "2026-10-10",
  region: "한강이남",
  club: "A컨트리클럽",
  time: "07:00",
  course: "OUT",
  fee: 200000,
  ...over,
});

const ROWS: TeeTime[] = [
  tt({ club: "A컨트리클럽", time: "06:30", fee: 250000 }),
  tt({ club: "A컨트리클럽", time: "07:00", fee: 250000 }),
  tt({ club: "B골프클럽", time: "07:10", fee: 180000 }),
  tt({ club: "C컨트리클럽", time: "11:50", fee: null }),
  tt({ club: "D컨트리클럽", region: "한강이북", time: "13:00", fee: 150000 }),
  tt({ club: "A컨트리클럽", date: "2026-10-11", time: "08:00", fee: 230000 }),
  tt({ club: "베어포트리조트CC(구.웅포)", region: "전라도", date: "2026-10-12", time: "09:00", fee: 120000 }),
];

describe("CSV 정규화", () => {
  it("BOM·따옴표 금액·한 자리 시간·0원을 처리한다", () => {
    const csv = '﻿날짜,지역,골프장,티타임,코스,그린피\n2026-10-10,한강이남,김포씨사이드컨트리클럽,6:24,남코스,"270,000"\n2026-10-10,전라도,무안클린밸리,7:00,클린,0\n,,,,,\n잘못된날짜,한강이남,X,7:00,A,1000\n';
    const { rows, skipped } = parseTeeTimeCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(skipped, 1);
    assert.deepEqual({ time: rows[0].time, fee: rows[0].fee }, { time: "06:24", fee: 270000 });
    assert.equal(rows[1].fee, null);
  });
  it("컬럼이 다르면 실패한다", () => {
    assert.throws(() => parseTeeTimeCsv("date,region\n2026-10-10,x\n"), /컬럼/);
  });
  it("값 정규화", () => {
    assert.equal(normalizeTime("17:23"), "17:23");
    assert.equal(normalizeTime("25:00"), null);
    assert.equal(normalizeFee("215,000"), 215000);
    assert.equal(normalizeFee(""), null);
  });
});

describe("필터", () => {
  it("시간 경계를 포함한다", () => {
    const t = tt({ time: "12:00" });
    assert.ok(matches(t, c({ timeFrom: "12:00", timeTo: "12:00" })));
    assert.ok(!matches(t, c({ timeTo: "11:59" })));
  });
  it("예산 조건이 있으면 그린피 미정은 제외한다", () => {
    assert.ok(!matches(tt({ fee: null }), c({ maxFee: 300000 })));
    assert.ok(matches(tt({ fee: null }), c()));
  });
  it("골프장을 지정하면 지역 조건 대신 골프장만 본다", () => {
    assert.ok(matches(tt({ club: "D컨트리클럽", region: "한강이북" }), c({ clubs: ["D컨트리클럽"], regions: ["한강이남"] })));
  });
});

describe("골프장 이름 매칭", () => {
  const clubs = ["써닝포인트컨트리클럽", "해운대 컨트리클럽", "해운대비치골프앤리조트", "베어포트리조트CC(구.웅포)", "장성 푸른솔 골프클럽", "포천푸른솔 골프클럽", "클럽72"];
  it("접미사·공백·괄호 별칭을 처리한다", () => {
    assert.deepEqual(matchClub("써닝포인트 CC", clubs), ["써닝포인트컨트리클럽"]);
    assert.deepEqual(matchClub("해운대", clubs), ["해운대 컨트리클럽"]);
    assert.deepEqual(matchClub("웅포", clubs), ["베어포트리조트CC(구.웅포)"]);
    assert.deepEqual(matchClub("클럽72", clubs), ["클럽72"]);
  });
  it("부분 일치는 여러 곳을 돌려주고, 없으면 빈 목록", () => {
    assert.equal(matchClub("푸른솔", clubs).length, 2);
    assert.deepEqual(matchClub("남서울", clubs), []);
  });
  it("normalizeCriteria는 정식명 변환·미일치·범위 밖 날짜를 알려준다", async () => {
    const catalog = await new MemorySource(ROWS).catalog();
    const n = normalizeCriteria(c({ clubs: ["웅포", "없는CC"], dates: ["2026-11-01", "2026-10-10"], regions: ["화성"], timeFrom: "13:00", timeTo: "09:00" }), catalog);
    assert.deepEqual(n.criteria.clubs, ["베어포트리조트CC(구.웅포)"]);
    assert.deepEqual(n.unmatchedClubs, ["없는CC"]);
    assert.deepEqual(n.outOfRangeDates, ["2026-11-01"]);
    assert.deepEqual(n.criteria.regions, []);
    assert.deepEqual([n.criteria.timeFrom, n.criteria.timeTo], ["09:00", "13:00"]);
  });
});

describe("추천", () => {
  const morning = ROWS.filter((t) => t.date === "2026-10-10" && t.region === "한강이남" && t.time <= "12:00");
  it("희망 시간·가격으로 점수를 매기고 동점은 고정 순서", () => {
    const ranked = rankTeeTimes(morning, c({ preferredTime: "07:00" }));
    assert.equal(ranked[0].teeTime.club, "B골프클럽"); // 10분 차이 + 최저가
    assert.ok(ranked[0].reasons.includes("조건 내 최저가"));
    assert.deepEqual(rankTeeTimes(morning, c({ preferredTime: "07:00" })).map((r) => r.teeTime.id), ranked.map((r) => r.teeTime.id));
  });
  it("Top 3는 서로 다른 골프장을 먼저 고른다", () => {
    const top = pickTop(rankTeeTimes(morning, c({ preferredTime: "07:00" })), 3);
    assert.equal(new Set(top.map((r) => r.teeTime.club)).size, 3);
  });
  it("골프장이 모자라면 같은 골프장 다른 시간으로 채운다", () => {
    const top = pickTop(rankTeeTimes(ROWS.filter((t) => t.club === "A컨트리클럽"), c()), 3);
    assert.equal(top.length, 3);
  });
  it("그린피 미정은 가격 점수 0, 가격순 정렬에서 맨 뒤", () => {
    const ranked = rankTeeTimes(morning, c({ sort: "price" }));
    assert.ok(ranked.find((r) => r.teeTime.fee == null)!.reasons.includes("그린피 문의 필요"));
    assert.equal(sortForList(ranked, "price").at(-1)!.fee, null);
  });
});

describe("검색 서비스·대안", () => {
  it("결과가 없으면 조건을 하나씩 완화한 대안을 준다", async () => {
    const source = new MemorySource(ROWS);
    const r = await runSearch(source, c({ dates: ["2026-10-10"], regions: ["한강이북"], timeTo: "12:00" }), await source.catalog());
    assert.equal(r.total, 0);
    const labels = r.alternatives.map((a) => a.label);
    assert.ok(labels.some((l) => l.startsWith("시간대")), labels.join());
    assert.ok(labels.some((l) => l.startsWith("인접 지역")), labels.join());
    assert.ok(r.alternatives.every((a) => a.total > 0 && a.items.length > 0));
  });
  it("예산 대안은 실제 최저 그린피까지 올려 제안하고, 시간은 단계적으로 푼다", async () => {
    const source = new MemorySource(ROWS);
    const r = await runSearch(source, c({ dates: ["2026-10-10"], clubs: ["D컨트리클럽"], timeTo: "07:00", maxFee: 100000 }), await source.catalog());
    assert.equal(r.total, 0);
    const labels = r.alternatives.map((a) => a.label);
    assert.ok(labels.includes("예산을 15만원까지 늘리면") === false, labels.join()); // 시간 조건 때문에 예산만으로는 0건
    const r2 = await runSearch(source, c({ dates: ["2026-10-10"], regions: ["한강이남"], maxFee: 100000 }), await source.catalog());
    assert.ok(r2.alternatives.some((a) => a.label === "예산을 18만원까지 늘리면" && a.total === 1), r2.alternatives.map((a) => a.label).join());
    const r3 = await runSearch(source, c({ dates: ["2026-10-10"], clubs: ["D컨트리클럽"], timeTo: "07:00" }), await source.catalog());
    assert.ok(r3.alternatives.some((a) => a.label === "시간대 상관없이 보면"), r3.alternatives.map((a) => a.label).join());
  });
  it("결과가 충분하면 대안을 찾지 않는다", async () => {
    const source = new MemorySource(ROWS);
    const r = await runSearch(source, c({ dates: ["2026-10-10"], regions: ["한강이남"] }), await source.catalog());
    assert.equal(r.total, 4);
    assert.equal(r.clubCount, 3);
    assert.equal(r.alternatives.length, 0);
  });
});

describe("첫 화면 추천 섹션", () => {
  it("다가오는 주말 날짜", () => {
    assert.deepEqual(upcomingWeekend("2026-10-08"), ["2026-10-10", "2026-10-11"]);
    assert.deepEqual(upcomingWeekend("2026-10-10"), ["2026-10-10", "2026-10-11"]);
    assert.deepEqual(upcomingWeekend("2026-10-11"), ["2026-10-11"]);
  });
  it("주말 오전 추천과 가성비 섹션을 실제 데이터로 만든다", async () => {
    const source = new MemorySource(ROWS);
    const [weekend, value] = await featuredSections(source, await source.catalog(), "2026-10-08");
    assert.equal(weekend.id, "weekend");
    assert.ok(weekend.items.every((r) => ["2026-10-10", "2026-10-11"].includes(r.teeTime.date) && r.teeTime.time <= "10:00"));
    assert.deepEqual(weekend.items.slice(0, 2).map((r) => r.teeTime.club).sort(), ["A컨트리클럽", "B골프클럽"]);
    assert.equal(value.id, "value");
    assert.ok(value.items.every((r) => r.teeTime.fee != null), "가성비에는 그린피 미정 제외");
    assert.equal(value.items[0].teeTime.fee, 120000);
    const clubs = value.items.map((r) => r.teeTime.club);
    assert.equal(new Set(clubs.slice(0, 4)).size, 4, "앞쪽은 골프장 중복 없이");
  });
  it("/api/featured", async () => {
    const app = createApp({ source: new MemorySource(ROWS), today: () => "2026-10-08" });
    const server = app.listen(0);
    try {
      const body = await (await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/featured`)).json();
      assert.deepEqual(body.map((s: { id: string }) => s.id), ["weekend", "value"]);
    } finally {
      server.close();
    }
  });
});

describe("음성 답변 문장", () => {
  it("시간·금액을 읽기 좋은 말로 바꾼다", () => {
    assert.equal(speakTime("08:13"), "오전 8시 13분");
    assert.equal(speakTime("13:00"), "오후 1시");
    assert.equal(speakTime("12:30"), "오후 12시 30분");
    assert.equal(speakDate("2026-10-10"), "10월 10일 토요일");
    assert.equal(speakFee(195000), "그린피 19만 5천원");
    assert.equal(speakFee(190000), "그린피 19만원");
    assert.equal(speakFee(null), "그린피는 별도 문의");
  });
  it("괄호·기호 없이 추천과 화면 안내를 말한다", async () => {
    const source = new MemorySource(ROWS);
    const r = await runSearch(source, c({ dates: ["2026-10-12"], clubs: ["베어포트리조트CC(구.웅포)"] }), await source.catalog());
    const s = buildSpeech(r);
    assert.match(s, /^10월 12일 월요일 베어포트리조트CC에서 찾아봤어요. 티타임 1개가 있고/);
    assert.match(s, /추천은 베어포트리조트CC 오전 9시, 그린피 12만원이에요/);
    assert.match(s, /화면에서 확인해 주세요/);
    assert.doesNotMatch(s, /[()·~]/);
  });
});

describe("프롬프트", () => {
  it("오늘·달력·골프장 목록을 포함한다", async () => {
    const p = buildSystemPrompt(await new MemorySource(ROWS).catalog(), "2026-10-08");
    assert.match(p, /오늘: 2026-10-08\(목\)/);
    assert.match(p, /이번 주: 2026-10-05\(월\).*2026-10-11\(일\)/);
    assert.match(p, /베어포트리조트CC\(구\.웅포\)/);
  });
});

describe("HTTP API", () => {
  async function withServer(parser: QueryParser | undefined, fn: (base: string) => Promise<void>) {
    // 조각 여러 개로 흘려보내는 가짜 음성 합성
    const speaker = {
      stream: async (text: string) =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            for (const part of ["pcm:", text, ":end"]) controller.enqueue(new TextEncoder().encode(part));
            controller.close();
          },
        }),
    };
    const app = createApp({ source: new MemorySource(ROWS), parser, speaker: parser && speaker, today: () => "2026-10-08" });
    const server = app.listen(0);
    try {
      await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
      server.close();
    }
  }
  const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("/api/search는 AI 없이 검색한다", async () => {
    await withServer(undefined, async (base) => {
      const res = await post(`${base}/api/search`, { criteria: c({ dates: ["2026-10-10"], regions: ["한강이남"], maxFee: 200000 }) });
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.result.total, 1);
      assert.equal(body.result.recommendations[0].teeTime.club, "B골프클럽");
      assert.match(body.reply, /B골프클럽/);
      assert.match(body.speech, /B골프클럽/);
    });
  });

  it("/api/query는 AI 미설정이면 503", async () => {
    await withServer(undefined, async (base) => {
      assert.equal((await post(`${base}/api/query`, { message: "주말" })).status, 503);
    });
  });

  it("/api/query는 파싱 결과로 검색하고, 날짜가 없으면 되묻는다", async () => {
    const parser: QueryParser = {
      async parse({ message, prev }) {
        const base = { anyDate: false, needsClarification: false, question: null, suggestions: [], nearRegions: [] };
        if (message === "웅포") return { ...base, criteria: c({ clubs: ["웅포"] }) };
        if (message === "한강이북") return { ...base, criteria: c({ regions: ["한강이북"] }) };
        return { ...base, criteria: { ...(prev ?? c()), sort: "price" } };
      },
    };
    await withServer(parser, async (base) => {
      const a = await (await post(`${base}/api/query`, { message: "웅포" })).json();
      assert.equal(a.result.total, 1);
      assert.deepEqual(a.criteria.clubs, ["베어포트리조트CC(구.웅포)"]);

      const b = await (await post(`${base}/api/query`, { message: "한강이북" })).json();
      assert.ok(b.clarification);
      assert.equal(b.result, undefined);

      const d = await (await post(`${base}/api/query`, { message: "더 싸게", prevCriteria: c({ dates: ["2026-10-10"] }) })).json();
      assert.equal(d.criteria.sort, "price");
      assert.equal(d.result.items[0].fee, 150000);
    });
  });

  it("/api/speak는 PCM 음성 조각을 이어서 흘려보내고, AI 미설정이면 503", async () => {
    const parser: QueryParser = { parse: async () => { throw new Error("unused"); } };
    await withServer(parser, async (base) => {
      const res = await post(`${base}/api/speak`, { text: "안녕하세요" });
      assert.equal(res.headers.get("content-type"), "audio/pcm;rate=24000");
      assert.equal(Buffer.from(await res.arrayBuffer()).toString(), "pcm:안녕하세요:end");
      assert.equal((await post(`${base}/api/speak`, { text: "" })).status, 400);
    });
    await withServer(undefined, async (base) => {
      assert.equal((await post(`${base}/api/speak`, { text: "안녕" })).status, 503);
    });
  });

  it("데이터에 없는 골프장이면 가까운 지역을 대안으로 보여주고, 최근 대화를 파서에 넘긴다", async () => {
    let seenHistory: unknown;
    const parser: QueryParser = {
      async parse({ history }) {
        seenHistory = history;
        return {
          criteria: c({ clubs: ["남서울CC"], dates: ["2026-10-10"] }),
          anyDate: false,
          needsClarification: false,
          question: null,
          suggestions: [],
          nearRegions: ["한강이북"],
        };
      },
    };
    await withServer(parser, async (base) => {
      const history = [{ role: "user", text: "남서울CC 이번 토요일" }];
      const body = await (await post(`${base}/api/query`, { message: "근처 골프장", history })).json();
      assert.deepEqual(seenHistory, history);
      assert.match(body.reply, /남서울CC.*가까운 한강이북/);
      assert.equal(body.result.total, 0);
      assert.equal(body.result.alternatives[0].criteria.regions[0], "한강이북");
      assert.equal(body.result.alternatives[0].items[0].teeTime.club, "D컨트리클럽");
      assert.deepEqual(body.criteria.dates, ["2026-10-10"], "원래 조건(날짜)은 유지");
    });
  });

  it("잘못된 요청은 400", async () => {
    await withServer(undefined, async (base) => {
      assert.equal((await post(`${base}/api/search`, { criteria: { dates: ["10월"] } })).status, 400);
    });
  });
});
