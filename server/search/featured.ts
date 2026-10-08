import type { FeaturedSection, SearchCriteria } from "../../shared/types";
import { upcomingWeekend } from "../../shared/format";
import { addDays, dateRange, formatDate } from "../dates";
import type { CatalogData, TeeTimeSource } from "../source/TeeTimeSource";
import { pickTop, rankTeeTimes } from "./recommend";

const PER_SECTION = 6;

export { upcomingWeekend };

/**
 * 첫 화면 추천 섹션. 고객이 묻기 전에 바로 고를 수 있는 실제 티타임을 고른다.
 * 각 섹션은 그 조건(criteria)도 함께 돌려줘서 "더 보기"를 누르면 같은 조건으로 검색한다.
 */
export async function featuredSections(source: TeeTimeSource, catalog: CatalogData, today: string): Promise<FeaturedSection[]> {
  const start = today > catalog.dateFrom ? today : catalog.dateFrom;
  const inRange = (d: string) => d >= catalog.dateFrom && d <= catalog.dateTo;
  const sections: FeaturedSection[] = [];

  const weekend = upcomingWeekend(start).filter(inRange);
  if (weekend.length) {
    const criteria: SearchCriteria = {
      dates: weekend,
      regions: [],
      clubs: [],
      timeFrom: "06:00",
      timeTo: "10:00",
      preferredTime: "07:30",
      sort: "recommend",
    };
    const items = pickTop(rankTeeTimes(await source.search(criteria), criteria), PER_SECTION);
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

  const week = dateRange(start, addDays(start, 6)).filter(inRange);
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
