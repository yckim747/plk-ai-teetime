import type { Recommendation, SearchCriteria, SearchResult } from "../../shared/types";
import { criteriaChips } from "../criteriaChips";
import { ChevronRightIcon, CloseIcon, SpeakerIcon } from "../icons";
import { Carousel } from "./Carousel";
import { TeeCard } from "./TeeCard";

export interface AssistantMsg {
  id: number;
  role: "assistant";
  text: string;
  speech?: string;
  notices?: string[];
  suggestions?: string[];
  result?: SearchResult;
  error?: boolean;
}

interface Props {
  msg: AssistantMsg;
  isLast: boolean;
  busy: boolean;
  canSpeak: boolean;
  /** AI 문의 가능 여부 (꺼져 있으면 AI가 필요한 후속 질문 칩을 숨김) */
  canAsk: boolean;
  onSpeak: (text: string) => void;
  onSelect: (rec: Recommendation) => void;
  onShowAll: (result: SearchResult) => void;
  onSearch: (criteria: SearchCriteria, note: string) => void;
  onAsk: (text: string) => void;
  onNewChat: () => void;
  onOpenFilter: () => void;
}

const FOLLOW_UPS = ["좀 더 늦게", "좀 더 일찍", "더 저렴한 곳"];

/** AI 답변: 말풍선 없이 전체 폭. 결과 카드·조건·후속 질문을 답변 안에 함께 보여준다. */
export function AssistantMessage({ msg, isLast, busy, canSpeak, canAsk, onSpeak, onSelect, onShowAll, onSearch, onAsk, onNewChat, onOpenFilter }: Props) {
  const r = msg.result;
  const chips = r ? criteriaChips(r.criteria) : [];

  return (
    <article className={`amsg${msg.error ? " error" : ""}`} id={`m-${msg.id}`}>
      <div className="amsg-text">
        <p>{msg.text}</p>
        {msg.speech && canSpeak && (
          <button type="button" className="icon-btn small" onClick={() => onSpeak(msg.speech!)} aria-label="답변 듣기" title="답변 듣기">
            <SpeakerIcon width={18} height={18} />
          </button>
        )}
      </div>
      {msg.error && (
        <button type="button" className="btn ghost fallback-btn" onClick={onOpenFilter}>
          조건으로 직접 찾기
        </button>
      )}
      {msg.notices?.map((n) => (
        <p key={n} className="notice">
          {n}
        </p>
      ))}

      {r && chips.length > 0 && (
        <div className="cond-chips" aria-label="적용된 조건">
          {chips.map((chip) => (
            <span key={chip.key} className="cond">
              {chip.label}
              {chip.remove && (
                <button type="button" disabled={busy} aria-label={`${chip.label} 조건 빼기`} onClick={() => onSearch(chip.remove!(r.criteria), `'${chip.label}' 조건 빼고 보기`)}>
                  <CloseIcon width={12} height={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {r && r.total > 0 && (
        <>
          <Carousel label="추천 티타임">
            {r.recommendations.map((rec) => (
              <TeeCard key={rec.teeTime.id} rec={rec} onSelect={onSelect} />
            ))}
          </Carousel>
          <button type="button" className="all-btn" onClick={() => onShowAll(r)}>
            <span>
              전체 <strong>{r.total.toLocaleString("ko-KR")}건</strong> 보기 <span className="muted">· {r.clubCount}개 골프장</span>
            </span>
            <ChevronRightIcon width={18} height={18} />
          </button>
        </>
      )}

      {r && r.alternatives.length > 0 && (
        <div className="alts">
          {r.alternatives.map((a) => (
            <section key={a.label} className="alt">
              <div className="alt-head">
                <span>
                  {a.label} <span className="muted">{a.total}건</span>
                </span>
                <button type="button" className="link" disabled={busy} onClick={() => onSearch(a.criteria, a.label)}>
                  이 조건으로 보기
                </button>
              </div>
              <Carousel label={a.label}>
                {a.items.map((rec) => (
                  <TeeCard key={rec.teeTime.id} rec={rec} showReason={false} onSelect={onSelect} />
                ))}
              </Carousel>
            </section>
          ))}
        </div>
      )}

      {isLast && !busy && (
        <div className="chips">
          {(!canAsk ? [] : msg.suggestions?.length ? msg.suggestions : r && r.total > 0 ? FOLLOW_UPS : []).map((s) => (
            <button key={s} type="button" className="chip" onClick={() => onAsk(s)}>
              {s}
            </button>
          ))}
          {r && (
            <button type="button" className="chip" onClick={onNewChat}>
              새로 찾기
            </button>
          )}
        </div>
      )}
    </article>
  );
}
