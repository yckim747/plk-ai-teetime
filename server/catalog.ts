import type { CatalogInfo, ModelInfo, SearchCriteria } from "../shared/types";
import { formatDate } from "./dates";
import type { CatalogData } from "./source/TeeTimeSource";

const SUFFIX_RE = /(컨트리클럽|골프클럽|골프앤리조트|골프&리조트|골프리조트|리조트|골프장|컨트리|cc|gc)/g;

/** 골프장 이름 비교용 키: 소문자, 공백 제거, 흔한 접미사 제거 */
export function clubKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "").replace(SUFFIX_RE, "");
}

/** 정식명 하나에 대한 별칭 키 목록. 괄호 안 표기(구.웅포, 영광CC 등)도 별칭으로 본다. */
function aliasKeys(club: string): string[] {
  const keys = new Set<string>([clubKey(club), clubKey(club.replace(/\(.*?\)/g, ""))]);
  for (const m of club.matchAll(/\((.*?)\)/g)) keys.add(clubKey(m[1].replace(/^구\.?/, "")));
  keys.delete("");
  return [...keys];
}

/** 고객이 말한 골프장 이름을 데이터의 정식명으로 찾는다. 정확한 별칭 일치가 우선, 없으면 부분 일치. */
export function matchClub(query: string, clubs: Iterable<string>): string[] {
  const list = [...clubs];
  if (list.includes(query.trim())) return [query.trim()]; // 정식 이름 그대로면 바로
  const q = clubKey(query);
  if (q.length < 2) return [];
  const exact = list.filter((c) => aliasKeys(c).includes(q));
  if (exact.length) return exact;
  return list.filter((c) => aliasKeys(c).some((k) => k.length >= 2 && (k.includes(q) || q.includes(k))));
}

export interface NormalizedCriteria {
  criteria: SearchCriteria;
  unmatchedClubs: string[];
  outOfRangeDates: string[];
}

/** 골프장·지역을 카탈로그 정식명으로 맞추고 날짜·시간·예산을 정리한다. */
export function normalizeCriteria(c: SearchCriteria, catalog: CatalogData): NormalizedCriteria {
  const clubs = new Set<string>();
  const unmatchedClubs: string[] = [];
  for (const name of c.clubs) {
    const found = matchClub(name, catalog.clubRegion.keys());
    if (found.length) found.forEach((f) => clubs.add(f));
    else unmatchedClubs.push(name);
  }
  const regions = [...new Set(c.regions.filter((r) => catalog.regions.has(r)))];
  const dates = [...new Set(c.dates)].sort();
  let { timeFrom, timeTo, minFee, maxFee } = c;
  if (timeFrom && timeTo && timeFrom > timeTo) [timeFrom, timeTo] = [timeTo, timeFrom];
  if (minFee != null && maxFee != null && minFee > maxFee) [minFee, maxFee] = [maxFee, minFee];
  const criteria: SearchCriteria = { ...c, dates, regions, clubs: [...clubs], timeFrom, timeTo, minFee, maxFee };
  for (const k of ["timeFrom", "timeTo", "preferredTime", "minFee", "maxFee"] as const) {
    if (criteria[k] == null) delete criteria[k];
  }
  return {
    criteria,
    unmatchedClubs,
    outOfRangeDates: dates.filter((d) => d < catalog.dateFrom || d > catalog.dateTo),
  };
}

export function noticesFor(n: NormalizedCriteria, catalog: CatalogData): string[] {
  const notices: string[] = [];
  if (n.unmatchedClubs.length) {
    notices.push(`'${n.unmatchedClubs.join("', '")}'은(는) 현재 조회 가능한 골프장 목록에 없습니다.`);
  }
  if (n.outOfRangeDates.length) {
    notices.push(`조회 가능한 날짜는 ${formatDate(catalog.dateFrom)} ~ ${formatDate(catalog.dateTo)}입니다.`);
  }
  return notices;
}

export function toCatalogInfo(c: CatalogData, models: ModelInfo | null, today: string): CatalogInfo {
  return {
    regions: [...c.regions].map(([name, clubs]) => ({ name, clubs })),
    dateFrom: c.dateFrom,
    dateTo: c.dateTo,
    totalRows: c.totalRows,
    updatedAt: c.updatedAt.toISOString(),
    aiEnabled: !!models,
    today,
    models,
  };
}
