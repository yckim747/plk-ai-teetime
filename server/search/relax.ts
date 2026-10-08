import type { Alternative, SearchCriteria, TeeTime } from "../../shared/types";
import { addDays, formatDate, formatManwon, fromMinutes, toMinutes } from "../dates";
import type { CatalogData, TeeTimeSource } from "../source/TeeTimeSource";
import { pickTop, rankTeeTimes } from "./recommend";

/** 결과가 없을 때 넓혀볼 인접 지역 */
export const NEIGHBOR_REGIONS: Record<string, string[]> = {
  한강이남: ["한강이북", "충청도"],
  한강이북: ["한강이남", "강원도"],
  강원도: ["한강이북", "한강이남"],
  충청도: ["한강이남", "전라도", "경상도"],
  전라도: ["충청도", "경상도"],
  경상도: ["전라도", "충청도"],
  제주도: [],
};

const MAX_ALTERNATIVES = 4;

interface Candidate {
  label: string;
  criteria: SearchCriteria;
}

const nearDates = (c: SearchCriteria, catalog: CatalogData, span: number) =>
  [...new Set(c.dates.flatMap((d) => Array.from({ length: span * 2 + 1 }, (_, i) => addDays(d, i - span))))]
    .filter((d) => !c.dates.includes(d) && d >= catalog.dateFrom && d <= catalog.dateTo)
    .sort();

/**
 * 완화 방향(날짜·시간·장소)마다 약한 것부터 강한 것 순으로 후보를 둔다.
 * 각 방향에서 결과가 나오는 첫 후보만 대안으로 쓴다.
 */
function candidateGroups(c: SearchCriteria, catalog: CatalogData): Candidate[][] {
  const groups: Candidate[][] = [];

  if (c.dates.length && c.dates.length <= 7) {
    const group: Candidate[] = [];
    for (const span of [1, 3]) {
      const near = nearDates(c, catalog, span);
      const label = near.length <= 4 ? near.map(formatDate).join(", ") : `${formatDate(near[0])}~${formatDate(near[near.length - 1])} 사이 다른 날`;
      if (near.length) group.push({ label: `날짜를 ${label}로 바꾸면`, criteria: { ...c, dates: near } });
    }
    groups.push(group);
  }

  if (c.timeFrom || c.timeTo) {
    const widened = { ...c };
    if (c.timeFrom) widened.timeFrom = fromMinutes(Math.max(toMinutes(c.timeFrom) - 60, 5 * 60));
    if (c.timeTo) widened.timeTo = fromMinutes(Math.min(toMinutes(c.timeTo) + 60, 20 * 60));
    const { timeFrom: _f, timeTo: _t, ...anyTime } = c;
    groups.push([
      { label: "시간대를 앞뒤로 1시간 넓히면", criteria: widened },
      { label: "시간대 상관없이 보면", criteria: anyTime },
    ]);
  }

  if (c.clubs.length) {
    const regions = [...new Set(c.clubs.map((cl) => catalog.clubRegion.get(cl)).filter((r): r is string => !!r))];
    if (regions.length) groups.push([{ label: `같은 지역(${regions.join(", ")})의 다른 골프장`, criteria: { ...c, clubs: [], regions } }]);
  } else if (c.regions.length) {
    const extra = [...new Set(c.regions.flatMap((r) => NEIGHBOR_REGIONS[r] ?? []))].filter((r) => !c.regions.includes(r));
    if (extra.length) groups.push([{ label: `인접 지역(${extra.join(", ")})까지 넓히면`, criteria: { ...c, regions: [...c.regions, ...extra] } }]);
  }
  return groups;
}

async function evaluate(source: TeeTimeSource, cand: Candidate): Promise<Alternative & { rows: TeeTime[] }> {
  const rows = await source.search(cand.criteria);
  return { ...cand, rows, total: rows.length, items: pickTop(rankTeeTimes(rows, cand.criteria), 3) };
}

/**
 * 필수 조건을 한 방향으로만 완화해 본 대안. 원래 조건은 바꾸지 않고 고객이 고르도록 제안만 한다.
 * 예산은 예산을 뺀 조건에서 가장 싼 그린피를 찾아 "그 금액까지 늘리면"으로 제안한다.
 */
export async function findAlternatives(source: TeeTimeSource, c: SearchCriteria, catalog: CatalogData): Promise<Alternative[]> {
  const found = await Promise.all(
    candidateGroups(c, catalog).map(async (group) => {
      for (const cand of group) {
        const alt = await evaluate(source, cand);
        if (alt.total > 0) return alt;
      }
      return null;
    }),
  );

  if (c.maxFee != null) {
    const { maxFee: _m, ...noBudget } = c;
    const fees = (await source.search(noBudget)).map((t) => t.fee).filter((f): f is number => f != null && f > c.maxFee!);
    if (fees.length) {
      const raised = Math.ceil(Math.min(...fees) / 10000) * 10000;
      found.push(await evaluate(source, { label: `예산을 ${formatManwon(raised)}까지 늘리면`, criteria: { ...c, maxFee: raised } }));
    }
  }

  return found
    .filter((a): a is Alternative & { rows: TeeTime[] } => !!a && a.total > 0)
    .slice(0, MAX_ALTERNATIVES)
    .map(({ rows: _rows, ...alt }) => alt);
}
