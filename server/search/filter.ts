import type { SearchCriteria, TeeTime } from "../../shared/types";

/** 필수 조건 일치 여부. 골프장을 지정하면 지역 조건 대신 골프장 조건만 적용한다. */
export function matches(t: TeeTime, c: SearchCriteria): boolean {
  if (c.dates.length && !c.dates.includes(t.date)) return false;
  if (c.clubs.length) {
    if (!c.clubs.includes(t.club)) return false;
  } else if (c.regions.length && !c.regions.includes(t.region)) {
    return false;
  }
  if (c.timeFrom && t.time < c.timeFrom) return false;
  if (c.timeTo && t.time > c.timeTo) return false;
  // 예산 조건이 있으면 그린피 미정(null)은 제외한다.
  if (c.maxFee != null && (t.fee == null || t.fee > c.maxFee)) return false;
  if (c.minFee != null && (t.fee == null || t.fee < c.minFee)) return false;
  return true;
}
