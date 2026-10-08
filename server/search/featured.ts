import { upcomingWeekend, weekdayIndex } from "../../shared/format";
import type { FeaturedSection, Recommendation, SearchCriteria, TeeTime } from "../../shared/types";
import { matchClub } from "../catalog";
import { addDays, dateRange, formatDate, toMinutes } from "../dates";
import type { CatalogData, TeeTimeSource } from "../source/TeeTimeSource";
import { pickTop, rankTeeTimes } from "./recommend";

const PER_SECTION = 6;
const PREMIUM_MAX = 8;

export { upcomingWeekend };

/** 골프장별 대표 그린피: 주말 평균(없으면 전체 평균). 그린피가 전혀 없으면 null */
function clubFeeLevel(rows: TeeTime[]): Map<string, number | null> {
  const acc = new Map<string, { weekend: number[]; all: number[] }>();
  for (const t of rows) {
    let a = acc.get(t.club);
    if (!a) acc.set(t.club, (a = { weekend: [], all: [] }));
    if (t.fee == null) continue;
    a.all.push(t.fee);
    const wd = weekdayIndex(t.date);
    if (wd === 0 || wd === 6) a.weekend.push(t.fee);
  }
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return new Map([...acc].map(([club, a]) => [club, a.weekend.length ? avg(a.weekend) : a.all.length ? avg(a.all) : null]));
}

/**
 * 명문 골프장: PLK가 정한 목록(data/premium-clubs.json)의 골프장마다 7일 안 오전 티타임 하나씩,
 * 주말 평균 그린피가 높은 순(그린피 정보가 없으면 뒤)으로 보여준다.
 */
async function premiumSection(source: TeeTimeSource, catalog: CatalogData, week: string[], premiumClubs: string[]): Promise<FeaturedSection | null> {
  const clubs = [...new Set(premiumClubs.flatMap((name) => matchClub(name, catalog.clubRegion.keys())))];
  if (!clubs.length || !week.length) return null;
  const criteria: SearchCriteria = { dates: week, regions: [], clubs, timeFrom: "06:00", timeTo: "11:00", preferredTime: "08:00", sort: "time" };
  const rows = await source.search(criteria);
  if (!rows.length) return null;
  const feeLevel = clubFeeLevel(await source.search({ dates: [], regions: [], clubs, sort: "recommend" }));
  const best = new Map<string, Recommendation>();
  for (const rec of rankTeeTimes(rows, criteria)) if (!best.has(rec.teeTime.club)) best.set(rec.teeTime.club, rec);
  const items = [...best.values()]
    .sort((a, b) => (feeLevel.get(b.teeTime.club) ?? -1) - (feeLevel.get(a.teeTime.club) ?? -1))
    .slice(0, PREMIUM_MAX);
  return {
    id: "premium",
    title: "명문 골프장",
    subtitle: "7일 이내 · 오전",
    criteria: { ...criteria, clubs: items.map((r) => r.teeTime.club), sort: "recommend" },
    items,
  };
}

/**
 * 첫 화면 추천 섹션. 고객이 묻기 전에 바로 고를 수 있는 실제 티타임을 고른다.
 * 순서: 명문 골프장 → 이번 주말(좋은 시간대 위주) → 가성비.
 * 각 섹션은 그 조건(criteria)도 함께 돌려줘서 "더 보기"를 누르면 같은 조건으로 검색한다.
 */
export async function featuredSections(source: TeeTimeSource, catalog: CatalogData, today: string, premiumClubs: string[] = []): Promise<FeaturedSection[]> {
  const start = today > catalog.dateFrom ? today : catalog.dateFrom;
  const inRange = (d: string) => d >= catalog.dateFrom && d <= catalog.dateTo;
  const week = dateRange(start, addDays(start, 6)).filter(inRange);
  const sections: FeaturedSection[] = [];

  const premium = await premiumSection(source, catalog, week, premiumClubs);
  if (premium) sections.push(premium);

  const weekend = upcomingWeekend(start).filter(inRange);
  if (weekend.length) {
    const criteria: SearchCriteria = {
      dates: weekend,
      regions: [],
      clubs: [],
      timeFrom: "06:00",
      timeTo: "10:00",
      preferredTime: "07:30",
      sort: "time",
    };
    // 저렴한 곳만 몰리지 않게: 희망 시간(07:30)과 가까운 30분 단위 안에서는 골프장 그린피 수준이 높은 쪽을 먼저.
    // 가격 비교는 아래 가성비 섹션이 맡고, 위 명문 섹션에 이미 나온 골프장은 뺀다.
    const shown = new Set(premium?.items.map((r) => r.teeTime.club));
    const rows = (await source.search(criteria)).filter((t) => !shown.has(t.club));
    const level = clubFeeLevel(rows);
    const bucket = (r: Recommendation) => Math.round(Math.abs(toMinutes(r.teeTime.time) - toMinutes("07:30")) / 30);
    const ranked = rankTeeTimes(rows, criteria).sort(
      (a, b) => bucket(a) - bucket(b) || (level.get(b.teeTime.club) ?? -1) - (level.get(a.teeTime.club) ?? -1),
    );
    const items = pickTop(ranked, PER_SECTION);
    if (items.length) {
      sections.push({
        id: "weekend",
        title: "이번 주말 추천 티타임",
        subtitle: `${weekend.map(formatDate).join(" · ")} 오전`,
        criteria,
        items,
      });
    }
  }

  if (week.length) {
    const criteria: SearchCriteria = { dates: week, regions: [], clubs: [], timeFrom: "06:00", timeTo: "15:00", sort: "price" };
    // 그린피가 정해진 티타임만 (가성비 비교가 가능한 것)
    const rows = (await source.search(criteria)).filter((t) => t.fee != null);
    const items = pickTop(rankTeeTimes(rows, criteria), PER_SECTION);
    if (items.length) {
      sections.push({ id: "value", title: "가성비 티타임", subtitle: "7일 이내 · 저렴한 순", criteria, items });
    }
  }
  return sections;
}
