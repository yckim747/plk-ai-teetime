import { useState, type FormEvent } from "react";
import { CloseIcon, MicIcon, SendIcon, SlidersIcon, StopIcon } from "../icons";
import { useVoiceRecorder } from "../voice/useVoiceRecorder";

const BAR_SHAPE = [0.35, 0.6, 0.85, 1, 0.85, 0.6, 0.35];

interface Props {
  disabled: boolean;
  busy: boolean;
  onSend: (text: string, viaVoice: boolean) => void;
  onError: (message: string) => void;
  /** 조건을 눌러서 고르는 시트 열기 (AI 없이 동작) */
  onOpenFilter: () => void;
}

/**
 * 하단 고정 입력창. 🎤이 주 버튼이고, 녹음 중에는 입력창 자체가 음성 파형·취소·바로 검색으로 바뀐다.
 */
export function Composer({ disabled, busy, onSend, onError, onOpenFilter }: Props) {
  const [text, setText] = useState("");
  const voice = useVoiceRecorder({ onText: (t) => onSend(t, true), onError });
  const recording = voice.state === "recording";
  const transcribing = voice.state === "transcribing";

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy || disabled) return;
    setText("");
    onSend(t, false);
  }

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={submit}>
        {!recording && !transcribing && (
          <button type="button" className="filter-btn" onClick={onOpenFilter} disabled={busy} aria-label="조건으로 찾기" title="조건으로 찾기">
            <SlidersIcon width={20} height={20} />
          </button>
        )}
        {recording || transcribing ? (
          <div className={`pill listening${transcribing ? " transcribing" : ""}`} role="status">
            {recording && (
              <button type="button" className="pill-icon" onClick={() => voice.cancel()} aria-label="녹음 취소">
                <CloseIcon width={20} height={20} />
              </button>
            )}
            {recording ? (
              <span className="wave" aria-hidden>
                {BAR_SHAPE.map((k, i) => (
                  <i key={i} style={{ transform: `scaleY(${0.18 + Math.min(1, voice.level * 2.2) * k})` }} />
                ))}
              </span>
            ) : (
              <span className="spinner" aria-hidden />
            )}
            <span className="listening-text">{transcribing ? "알아듣는 중…" : voice.heard ? "말씀이 끝나면 바로 찾아드려요" : "듣고 있어요. 말씀해 주세요"}</span>
          </div>
        ) : (
          <div className="pill">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={disabled ? "왼쪽 조건 버튼으로 찾아 주세요" : "말하거나 입력하세요"}
              disabled={disabled}
              maxLength={500}
              enterKeyHint="search"
              aria-label="티타임 문의"
            />
            {text.trim() && (
              <button type="submit" className="send-btn" disabled={busy || disabled} aria-label="보내기">
                <SendIcon width={20} height={20} />
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          className={`mic-btn${recording ? " recording" : ""}`}
          style={recording ? { boxShadow: `0 0 0 ${4 + voice.level * 14}px rgb(220 50 40 / 0.22)` } : undefined}
          onClick={() => (recording ? voice.finish() : voice.start())}
          disabled={transcribing || (!recording && (disabled || busy))}
          aria-label={recording ? "말하기 끝내고 바로 검색" : "음성으로 문의하기"}
          title={recording ? "바로 검색" : "음성으로 문의"}
        >
          {recording ? <StopIcon /> : <MicIcon width={26} height={26} />}
        </button>
      </form>
    </div>
  );
}
