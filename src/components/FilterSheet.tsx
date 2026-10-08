import { useMemo, useState } from "react";
import { addDays, dateRange, formatDate, formatManwon, upcomingWeekend } from "../../shared/format";
import type { CatalogInfo, SearchCriteria } from "../../shared/types";

/** 시간대 (AI가 문장을 해석할 때와 같은 기준) */
const BANDS = [
  { key: "any", label: "상관없음" },
  { key: "dawn", label: "새벽", from: "05:00", to: "07:00" },
  { key: "am", label: "오전", from: "05:00", to: "12:00" },
  { key: "pm", label: "오후", from: "12:00", to: "17:00" },
  { key: "eve", label: "저녁", from: "17:00", to: "20:00" },
] as const;
type BandKey = (typeof BANDS)[number]["key"];

const FEES = [0, 150000, 200000, 250000, 300000];

interface Props {
  catalog: CatalogInfo;
  /** 지금 대화의 조건 (있으면 미리 채움) */
  initial: SearchCriteria | null;
  onSearch: (criteria: SearchCriteria, note: string) => void;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function initialBand(c: SearchCriteria | null): BandKey {
  if (!c?.timeFrom && !c?.timeTo) return "any";
  return BANDS.find((b) => "from" in b && b.from === c.timeFrom && b.to === c.timeTo)?.key ?? "any";
}

/** AI 없이 눌러서 고르는 조건 검색 (휴대폰용 칩 방식) */
export function FilterSheet({ catalog, initial, onSearch }: Props) {
  const start = catalog.today > catalog.dateFrom ? catalog.today : catalog.dateFrom;
  const days = useMemo(() => dateRange(start, catalog.dateTo), [start, catalog.dateTo]);
  const inRange = (d: string) => d >= start && d <= catalog.dateTo;
  const thisWeekend = upcomingWeekend(start).filter(inRange);
  const nextWeekend = upcomingWeekend(addDays(thisWeekend[thisWeekend.length - 1] ?? start, 1)).filter(inRange);

  const [dates, setDates] = useState<string[]>(initial?.dates.filter(inRange) ?? []);
  const [regions, setRegions] = useState<string[]>(initial?.regions ?? []);
  const [club, setClub] = useState(initial?.clubs.length === 1 ? initial.clubs[0] : "");
  const [band, setBand] = useState<BandKey>(initialBand(initial));
  const [maxFee, setMaxFee] = useState(initial?.maxFee && FEES.includes(initial.maxFee) ? initial.maxFee : 0);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort());
  const clubGroups = catalog.regions.filter((r) => !regions.length || regions.includes(r.name));

  function reset() {
    setDates([]);
    setRegions([]);
    setClub("");
    setBand("any");
    setMaxFee(0);
  }

  function submit() {
    const b = BANDS.find((x) => x.key === band)!;
    const criteria: SearchCriteria = { dates, regions, clubs: club ? [club] : [], sort: initial?.sort ?? "recommend" };
    if ("from" in b) {
      criteria.timeFrom = b.from;
      criteria.timeTo = b.to;
    }
    if (maxFee) criteria.maxFee = maxFee;
    const when = !dates.length
      ? "전체 기간"
      : sameSet(dates, thisWeekend)
        ? "이번 주말"
        : sameSet(dates, nextWeekend)
          ? "다음 주말"
          : dates.length > 3
            ? `${formatDate(dates[0])} 외 ${dates.length - 1}일`
            : dates.map(formatDate).join(", ");
    const parts = [when, club || regions.join("·") || "전체 지역", band !== "any" ? b.label : "", maxFee ? `${formatManwon(maxFee)} 이하` : ""];
    onSearch(criteria, `조건 선택: ${parts.filter(Boolean).join(" · ")}`);
  }

  return (
    <div className="filter-sheet">
      <section className="fgroup">
        <h3>날짜 {dates.length > 0 && <span className="muted">{dates.length}일 선택</span>}</h3>
        <div className="fchips">
          {thisWeekend.length > 0 && (
            <button type="button" className={`fchip${sameSet(dates, thisWeekend) ? " on" : ""}`} onClick={() => setDates(sameSet(dates, thisWeekend) ? [] : thisWeekend)}>
              이번 주말
            </button>
          )}
          {nextWeekend.length > 0 && (
            <button type="button" className={`fchip${sameSet(dates, nextWeekend) ? " on" : ""}`} onClick={() => setDates(sameSet(dates, nextWeekend) ? [] : nextWeekend)}>
              다음 주말
            </button>
          )}
        </div>
        <div className="fchips scroll" aria-label="날짜 선택">
          {days.map((d) => (
            <button key={d} type="button" className={`fchip${dates.includes(d) ? " on" : ""}`} onClick={() => setDates(toggle(dates, d))}>
              {formatDate(d)}
            </button>
          ))}
        </div>
      </section>

      <section className="fgroup">
        <h3>지역</h3>
        <div className="fchips">
          {catalog.regions.map((r) => (
            <button
              key={r.name}
              type="button"
              className={`fchip${regions.includes(r.name) ? " on" : ""}`}
              onClick={() => {
                setRegions(toggle(regions, r.name));
                setClub("");
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      </section>

      <section className="fgroup">
        <h3>
          골프장 <span className="muted">선택 사항</span>
        </h3>
        <select className="fselect" value={club} onChange={(e) => setClub(e.target.value)} aria-label="골프장">
          <option value="">전체 골프장</option>
          {clubGroups.map((r) => (
            <optgroup key={r.name} label={r.name}>
              {r.clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </section>

      <section className="fgroup">
        <h3>시간대</h3>
        <div className="fchips">
          {BANDS.map((b) => (
            <button key={b.key} type="button" className={`fchip${band === b.key ? " on" : ""}`} onClick={() => setBand(b.key)}>
              {b.label}
              {"from" in b && <span className="fchip-sub">{`${Number(b.from.slice(0, 2))}~${Number(b.to.slice(0, 2))}시`}</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="fgroup">
        <h3>그린피</h3>
        <div className="fchips">
          {FEES.map((f) => (
            <button key={f} type="button" className={`fchip${maxFee === f ? " on" : ""}`} onClick={() => setMaxFee(f)}>
              {f ? `${formatManwon(f)} 이하` : "상관없음"}
            </button>
          ))}
        </div>
      </section>

      <div className="filter-actions">
        <button type="button" className="btn ghost" onClick={reset}>
          초기화
        </button>
        <button type="button" className="btn primary" onClick={submit}>
          티타임 찾기
        </button>
      </div>
    </div>
  );
}
