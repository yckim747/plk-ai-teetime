import { formatDate, formatManwon } from "../shared/format";
import type { SearchCriteria } from "../shared/types";

export interface CriteriaChip {
  key: string;
  label: string;
  /** 이 조건만 뺀 새 조건. 없으면 뺄 수 없는 칩 */
  remove?: (c: SearchCriteria) => SearchCriteria;
}

/** 적용된 검색 조건을 사람이 읽는 칩으로 */
export function criteriaChips(c: SearchCriteria): CriteriaChip[] {
  const chips: CriteriaChip[] = [];
  if (c.dates.length > 3) {
    chips.push({ key: "dates", label: `${formatDate(c.dates[0])}~${formatDate(c.dates[c.dates.length - 1])}`, remove: (x) => ({ ...x, dates: [] }) });
  } else {
    for (const d of c.dates) chips.push({ key: d, label: formatDate(d), remove: (x) => ({ ...x, dates: x.dates.filter((v) => v !== d) }) });
  }
  if (!c.dates.length) chips.push({ key: "alldates", label: "전체 기간" });
  if (c.clubs.length) {
    for (const cl of c.clubs) chips.push({ key: cl, label: cl, remove: (x) => ({ ...x, clubs: x.clubs.filter((v) => v !== cl) }) });
  } else {
    for (const r of c.regions) chips.push({ key: r, label: r, remove: (x) => ({ ...x, regions: x.regions.filter((v) => v !== r) }) });
  }
  if (c.timeFrom || c.timeTo) {
    chips.push({ key: "time", label: `${c.timeFrom ?? ""}~${c.timeTo ?? ""}`, remove: ({ timeFrom: _f, timeTo: _t, preferredTime: _p, ...x }) => x });
  }
  if (c.minFee || c.maxFee) {
    const label = c.minFee && c.maxFee ? `${formatManwon(c.minFee)}~${formatManwon(c.maxFee)}` : c.maxFee ? `${formatManwon(c.maxFee)} 이하` : `${formatManwon(c.minFee!)} 이상`;
    chips.push({ key: "fee", label, remove: ({ minFee: _a, maxFee: _b, ...x }) => x });
  }
  return chips;
}
