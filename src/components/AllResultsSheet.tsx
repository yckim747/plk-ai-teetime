import { useMemo, useState } from "react";
import { formatDate, formatManwon } from "../../shared/format";
import type { Recommendation, SearchResult, TeeTime } from "../../shared/types";

type ListSort = "default" | "time" | "price";

const DEFAULT_LABEL = { recommend: "추천순", price: "가격순", time: "시간순" } as const;

const byTime = (a: TeeTime, b: TeeTime) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time);

interface Props {
  result: SearchResult;
  onSelect: (rec: Recommendation) => void;
}

/** 조건에 맞는 전체 티타임 (시트 안). 골프장별로 묶고, 정렬은 화면에서 바로 바꾼다. */
export function AllResultsSheet({ result, onSelect }: Props) {
  const [sort, setSort] = useState<ListSort>("default");
  const recById = new Map(result.recommendations.map((r) => [r.teeTime.id, r]));
  const multiDate = new Set(result.items.map((t) => t.date)).size > 1;

  const groups = useMemo(() => {
    const items = [...result.items];
    if (sort === "time") items.sort(byTime);
    if (sort === "price") items.sort((a, b) => (a.fee ?? Infinity) - (b.fee ?? Infinity) || byTime(a, b));
    const map = new Map<string, TeeTime[]>();
    for (const t of items) {
      const list = map.get(t.club);
      if (list) list.push(t);
      else map.set(t.club, [t]);
    }
    return [...map];
  }, [result, sort]);

  const sorts: [ListSort, string][] = [
    ["default", DEFAULT_LABEL[result.criteria.sort]],
    ...(result.criteria.sort !== "time" ? ([["time", "시간순"]] as [ListSort, string][]) : []),
    ...(result.criteria.sort !== "price" ? ([["price", "가격순"]] as [ListSort, string][]) : []),
  ];

  return (
    <div className="all-results">
      <div className="all-head">
        <span className="muted">
          {result.clubCount}개 골프장 · {result.total.toLocaleString("ko-KR")}건{result.total > result.items.length ? ` (상위 ${result.items.length}건)` : ""}
        </span>
        <div className="seg small" role="group" aria-label="정렬">
          {sorts.map(([key, label]) => (
            <button key={key} type="button" className={sort === key ? "on" : ""} onClick={() => setSort(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {groups.map(([club, list]) => (
        <section key={club} className="club-group">
          <h3>
            {club} <span className="muted">{list[0].region} · {list.length}건</span>
          </h3>
          <div className="slots">
            {list.map((t) => {
              const rec = recById.get(t.id);
              return (
                <button key={t.id} type="button" className={`slot${rec ? " rec" : ""}`} onClick={() => onSelect(rec ?? { teeTime: t, score: 0, reasons: [] })}>
                  {rec && <i aria-label="추천">★</i>}
                  {multiDate && <em>{formatDate(t.date)}</em>}
                  <b>{t.time}</b>
                  <span>{t.course}</span>
                  <span className={t.fee == null ? "unknown" : ""}>{t.fee == null ? "문의" : formatManwon(t.fee)}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
