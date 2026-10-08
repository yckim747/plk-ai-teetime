import { formatDate, formatFee } from "../../shared/format";
import type { Recommendation } from "../../shared/types";

interface Props {
  items: Recommendation[];
  total: number;
}

export function RecommendCards({ items, total }: Props) {
  if (!total) return null;
  return (
    <section className="block" id="recommend">
      <h2>
        추천 티타임 <span className="muted">가능 {total.toLocaleString("ko-KR")}건 중</span>
      </h2>
      <div className="cards">
        {items.map((r, i) => (
          <RecommendCard key={r.teeTime.id} rec={r} rank={i + 1} />
        ))}
      </div>
      {total > items.length && (
        <button className="link more-link" onClick={() => document.getElementById("all-list")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          조건에 맞는 전체 {total.toLocaleString("ko-KR")}건은 아래 목록에서 확인하세요 ↓
        </button>
      )}
    </section>
  );
}

export function RecommendCard({ rec, rank, compact = false }: { rec: Recommendation; rank?: number; compact?: boolean }) {
  const t = rec.teeTime;
  return (
    <article className={`card${compact ? " compact" : ""}`}>
      <header>
        {rank && <span className="rank">{rank}</span>}
        <div>
          <h3>{t.club}</h3>
          <span className="muted">{t.region}</span>
        </div>
      </header>
      <div className="when">
        <span className="time">{t.time}</span>
        <span>{formatDate(t.date)}</span>
        <span className="course">{t.course}</span>
      </div>
      <div className={`fee${t.fee == null ? " unknown" : ""}`}>{formatFee(t.fee)}</div>
      {!compact && rec.reasons.length > 0 && (
        <ul className="reasons">
          {rec.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
