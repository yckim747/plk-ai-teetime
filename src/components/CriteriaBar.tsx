import { formatDate, formatManwon } from "../../shared/format";
import type { SearchCriteria } from "../../shared/types";

interface Props {
  criteria: SearchCriteria | null;
  onChange: (c: SearchCriteria) => void;
  disabled: boolean;
}

interface Chip {
  key: string;
  label: string;
  remove: (c: SearchCriteria) => SearchCriteria;
}

function chipsFor(c: SearchCriteria): Chip[] {
  const chips: Chip[] = [];
  if (c.dates.length > 4) {
    chips.push({ key: "dates", label: `📅 ${formatDate(c.dates[0])}~${formatDate(c.dates[c.dates.length - 1])} (${c.dates.length}일)`, remove: (x) => ({ ...x, dates: [] }) });
  } else {
    for (const d of c.dates) chips.push({ key: d, label: `📅 ${formatDate(d)}`, remove: (x) => ({ ...x, dates: x.dates.filter((v) => v !== d) }) });
  }
  if (!c.dates.length) chips.push({ key: "alldates", label: "📅 전체 기간", remove: (x) => x });
  if (c.clubs.length) {
    for (const cl of c.clubs) chips.push({ key: cl, label: `⛳ ${cl}`, remove: (x) => ({ ...x, clubs: x.clubs.filter((v) => v !== cl) }) });
  } else {
    for (const r of c.regions) chips.push({ key: r, label: `📍 ${r}`, remove: (x) => ({ ...x, regions: x.regions.filter((v) => v !== r) }) });
  }
  if (c.timeFrom || c.timeTo) {
    chips.push({
      key: "time",
      label: `🕒 ${c.timeFrom ?? ""}~${c.timeTo ?? ""}`,
      remove: ({ timeFrom: _f, timeTo: _t, ...x }) => x,
    });
  }
  if (c.preferredTime) chips.push({ key: "pref", label: `희망 ${c.preferredTime}`, remove: ({ preferredTime: _p, ...x }) => x });
  if (c.minFee || c.maxFee) {
    const label = c.minFee && c.maxFee ? `${formatManwon(c.minFee)}~${formatManwon(c.maxFee)}` : c.maxFee ? `${formatManwon(c.maxFee)} 이하` : `${formatManwon(c.minFee!)} 이상`;
    chips.push({ key: "fee", label: `💰 ${label}`, remove: ({ minFee: _a, maxFee: _b, ...x }) => x });
  }
  return chips;
}

/** 현재 적용된 검색 조건. 칩의 ×를 누르면 그 조건만 빼고 다시 검색한다(AI 호출 없음). */
export function CriteriaBar({ criteria, onChange, disabled }: Props) {
  if (!criteria) return <div className="criteria muted">검색 조건이 여기에 표시됩니다</div>;
  return (
    <div className="criteria" aria-label="적용된 검색 조건">
      {chipsFor(criteria).map((chip) => (
        <span key={chip.key} className="cchip">
          {chip.label}
          {chip.key !== "alldates" && (
            <button aria-label={`${chip.label} 조건 빼기`} disabled={disabled} onClick={() => onChange(chip.remove(criteria))}>
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
