import { useState } from "react";
import { formatDate, formatFee } from "../../shared/format";
import type { Recommendation, TeeTime } from "../../shared/types";

interface Props {
  rec: Recommendation;
  onMoreAtClub: (t: TeeTime) => void;
  onSimilar: (t: TeeTime) => void;
  onClose: () => void;
}

const PEOPLE = [1, 2, 3, 4];

/** 티타임 상세 → 예약 요청(데모) → 접수 완료. 실제 예약·결제는 하지 않고 서버로 보내지도 않는다. */
export function TeeTimeDetail({ rec, onMoreAtClub, onSimilar, onClose }: Props) {
  const t = rec.teeTime;
  const [step, setStep] = useState<"detail" | "request" | "done">("detail");
  const [people, setPeople] = useState(4);
  const reasons = rec.reasons.filter((r) => r !== "그린피 문의 필요");

  const summary = (
    <div className="detail-card">
      <div className="detail-club">
        <strong>{t.club}</strong>
        <span>{t.region}</span>
      </div>
      <div className="detail-when">
        <span className="detail-time">{t.time}</span>
        <span>
          {formatDate(t.date)} · {t.course}
        </span>
      </div>
      <dl className="detail-rows">
        <div>
          <dt>그린피 (1인)</dt>
          <dd className={t.fee == null ? "unknown" : ""}>{formatFee(t.fee)}</dd>
        </div>
        {step !== "detail" && (
          <div>
            <dt>인원</dt>
            <dd>{people}명</dd>
          </div>
        )}
      </dl>
    </div>
  );

  if (step === "done") {
    return (
      <div className="detail">
        <div className="done-mark" aria-hidden>
          ✓
        </div>
        <h3 className="done-title">예약 요청이 접수되었습니다</h3>
        <p className="done-note">데모 화면입니다. 실제 예약은 되지 않습니다.</p>
        {summary}
        <button type="button" className="btn primary block" onClick={onClose}>
          확인
        </button>
      </div>
    );
  }

  if (step === "request") {
    return (
      <div className="detail">
        {summary}
        <div className="people">
          <span>인원 선택</span>
          <div className="seg" role="group" aria-label="인원">
            {PEOPLE.map((n) => (
              <button key={n} type="button" className={people === n ? "on" : ""} onClick={() => setPeople(n)}>
                {n}명
              </button>
            ))}
          </div>
        </div>
        {t.fee != null && (
          <p className="total">
            예상 그린피 합계 <strong>{(t.fee * people).toLocaleString("ko-KR")}원</strong>
          </p>
        )}
        <button type="button" className="btn primary block" onClick={() => setStep("done")}>
          예약 요청하기
        </button>
        <button type="button" className="btn ghost block" onClick={() => setStep("detail")}>
          이전
        </button>
      </div>
    );
  }

  return (
    <div className="detail">
      {summary}
      {reasons.length > 0 && (
        <ul className="reason-chips">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <button type="button" className="btn primary block" onClick={() => setStep("request")}>
        예약 요청
      </button>
      <div className="detail-more">
        <button type="button" className="btn ghost" onClick={() => onMoreAtClub(t)}>
          이 골프장 다른 시간
        </button>
        <button type="button" className="btn ghost" onClick={() => onSimilar(t)}>
          비슷한 티타임 더 찾기
        </button>
      </div>
    </div>
  );
}
