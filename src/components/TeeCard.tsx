import { formatDate, formatManwon } from "../../shared/format";
import type { Recommendation } from "../../shared/types";

interface Props {
  rec: Recommendation;
  /** 보여줄 추천 이유 (첫 번째만) */
  showReason?: boolean;
  /** 답변(문장·음성)에서 말한 추천 티타임 → 강조 테두리와 "추천" 표시 */
  highlight?: boolean;
  onSelect: (rec: Recommendation) => void;
}

/** 가로로 넘기는 티타임 카드. 누르면 상세 시트가 열린다. */
export function TeeCard({ rec, showReason = true, highlight = false, onSelect }: Props) {
  const t = rec.teeTime;
  const reason = showReason ? rec.reasons.find((r) => r !== "그린피 문의 필요") : undefined;
  return (
    <button
      type="button"
      className={`tee-card${highlight ? " highlight" : ""}`}
      onClick={() => onSelect(rec)}
      aria-label={`${highlight ? "답변에서 추천한 티타임, " : ""}${t.club} ${formatDate(t.date)} ${t.time} 상세 보기`}
    >
      {highlight && <span className="tc-badge">★ 추천</span>}
      <span className="tc-top">
        <span className="tc-time">{t.time}</span>
        <span className="tc-date">{formatDate(t.date)}</span>
      </span>
      <span className="tc-club">{t.club}</span>
      <span className="tc-meta">
        {t.region} · {t.course}
      </span>
      <span className="tc-bottom">
        <span className={`tc-fee${t.fee == null ? " unknown" : ""}`}>{t.fee == null ? "그린피 문의" : formatManwon(t.fee)}</span>
        {reason && <span className="tc-reason">{reason}</span>}
      </span>
    </button>
  );
}
