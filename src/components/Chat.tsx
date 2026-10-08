import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNarrow } from "../useNarrow";
import { VoiceButton } from "./VoiceButton";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  /** 음성 답변용 문장 (🔊 다시 듣기) */
  speech?: string;
  voice?: boolean;
  error?: boolean;
  notices?: string[];
  suggestions?: string[];
  /** 이 답변과 함께 온 검색 결과 건수 (결과 보기 안내용) */
  resultTotal?: number;
  hasAlternatives?: boolean;
}

const EXAMPLES = ["이번 주 토요일 오전 한강이남 25만원 이하", "10월 15일 오후 2시쯤 써닝포인트", "다음 주말 제주도 새벽 제일 싼 곳"];

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  aiEnabled: boolean;
  onAsk: (text: string, viaVoice?: boolean) => void;
  onError: (text: string) => void;
  onSpeak: (text: string) => void;
  onShowResults: () => void;
}

export function Chat({ messages, busy, aiEnabled, onAsk, onError, onSpeak, onShowResults }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const narrow = useNarrow();
  const where = narrow ? "아래" : "오른쪽";
  const arrow = narrow ? "👇" : "👉";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    onAsk(t);
  }

  const last = messages[messages.length - 1];

  return (
    <div className="chat">
      <div className="messages" ref={listRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="welcome">
            <p>
              안녕하세요! 원하시는 <b>날짜·지역·시간·예산</b>을 말씀해 주세요.
            </p>
            {aiEnabled && (
              <p className="voice-hint">
                <span className="mic-icon">🎤</span> 마이크를 누르고 말씀하시면, 말이 끝날 때 자동으로 찾아드려요.
              </p>
            )}
            <div className="chips">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="chip" disabled={!aiEnabled || busy} onClick={() => onAsk(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}${m.error ? " error" : ""}`}>
            {m.voice && <span className="voice-tag">🎤 음성</span>}
            <p>{m.text}</p>
            {m.notices?.map((n) => (
              <p key={n} className="notice">
                ⚠ {n}
              </p>
            ))}
            {m.resultTotal != null && (m.resultTotal > 0 || m.hasAlternatives) && (
              <button className="see-results" onClick={onShowResults}>
                {arrow} {m.resultTotal > 0 ? `추천 티타임과 전체 목록은 ${where}에서 확인하세요` : `바꿀 수 있는 대안은 ${where}에서 확인하세요`}
              </button>
            )}
            {m.role === "assistant" && m.speech && aiEnabled && (
              <button className="replay" onClick={() => onSpeak(m.speech!)} aria-label="답변 다시 듣기" title="답변 다시 듣기">
                🔊
              </button>
            )}
          </div>
        ))}
        {busy && <div className="msg assistant typing">티타임을 찾고 있어요…</div>}
        {!busy && last?.role === "assistant" && last.suggestions?.length ? (
          <div className="chips">
            {last.suggestions.map((s) => (
              <button key={s} className="chip" onClick={() => onAsk(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <form className="composer" onSubmit={submit}>
        <VoiceButton disabled={!aiEnabled || busy} onText={(t) => onAsk(t, true)} onError={onError} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={aiEnabled ? "말하거나 입력하세요 (예: 이번 주말 용인 오전)" : "AI 미설정 — '직접 고르기'를 이용하세요"}
          disabled={!aiEnabled}
          maxLength={500}
          aria-label="티타임 문의"
        />
        <button type="submit" className="primary" disabled={!aiEnabled || busy || !text.trim()}>
          찾기
        </button>
      </form>
    </div>
  );
}
