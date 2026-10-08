import { useState } from "react";
import { formatDate, formatFee } from "../../shared/format";
import type { SearchResult, Sort, TeeTime } from "../../shared/types";

const SORT_LABELS: Record<Sort, string> = { recommend: "추천순", price: "가격순", time: "시간순" };
const PREVIEW = 12;

interface Props {
  result: SearchResult;
  onSort: (sort: Sort) => void;
  disabled: boolean;
}

/** 조건에 맞는 전체 티타임을 골프장별로 묶어 보여준다. 골프장 순서는 정렬 기준에서 처음 등장한 순서. */
export function TeeTimeList({ result, onSort, disabled }: Props) {
  const groups = new Map<string, TeeTime[]>();
  for (const t of result.items) {
    const list = groups.get(t.club);
    if (list) list.push(t);
    else groups.set(t.club, [t]);
  }
  const multiDate = new Set(result.items.map((t) => t.date)).size > 1;
  const recIds = new Set(result.recommendations.map((r) => r.teeTime.id));

  return (
    <section className="block" id="all-list">
      <div className="list-head">
        <h2>
          가능한 티타임 <span className="muted">{result.clubCount}개 골프장 · {result.total.toLocaleString("ko-KR")}건</span>
        </h2>
        <div className="seg" role="group" aria-label="정렬">
          {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
            <button key={s} className={result.criteria.sort === s ? "on" : ""} disabled={disabled} onClick={() => onSort(s)}>
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">★ 표시는 위 추천 티타임입니다.</p>
      {result.total > result.items.length && <p className="muted small">상위 {result.items.length}건만 표시합니다. 조건을 좁혀 보세요.</p>}
      <div className="groups">
        {[...groups].map(([club, list]) => (
          <ClubGroup key={club} club={club} list={list} multiDate={multiDate} recIds={recIds} />
        ))}
      </div>
    </section>
  );
}

function ClubGroup({ club, list, multiDate, recIds }: { club: string; list: TeeTime[]; multiDate: boolean; recIds: Set<string> }) {
  const [open, setOpen] = useState(false);
  const fees = list.map((t) => t.fee).filter((f): f is number => f != null);
  const shown = open ? list : list.slice(0, PREVIEW);
  return (
    <div className="group panel">
      <div className="group-head">
        <strong>{club}</strong>
        <span className="muted">
          {list[0].region} · {list.length}건{fees.length ? ` · ${formatFee(Math.min(...fees))}~` : ""}
        </span>
      </div>
      <div className="slots">
        {shown.map((t) => (
          <span key={t.id} className={`slot${recIds.has(t.id) ? " rec" : ""}`} title={`${formatDate(t.date)} ${t.time} ${t.course} ${formatFee(t.fee)}`}>
            {recIds.has(t.id) && <i aria-label="추천">★</i>}
            {multiDate && <em>{formatDate(t.date)}</em>}
            <b>{t.time}</b>
            <span>{t.course}</span>
            <span className={t.fee == null ? "unknown" : ""}>{t.fee == null ? "문의" : `${(t.fee / 10000).toLocaleString("ko-KR")}만`}</span>
          </span>
        ))}
        {list.length > PREVIEW && (
          <button className="ghost small" onClick={() => setOpen((v) => !v)}>
            {open ? "접기" : `+${list.length - PREVIEW}건 더보기`}
          </button>
        )}
      </div>
    </div>
  );
}
