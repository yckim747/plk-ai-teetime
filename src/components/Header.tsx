import { NewChatIcon, SpeakerIcon, SpeakerOffIcon } from "../icons";

interface Props {
  voiceReply: boolean;
  showVoiceToggle: boolean;
  canReset: boolean;
  onToggleVoice: () => void;
  onNewChat: () => void;
}

/** 상단: 로고와 아이콘 두 개만 (ChatGPT형 최소 헤더) */
export function Header({ voiceReply, showVoiceToggle, canReset, onToggleVoice, onNewChat }: Props) {
  return (
    <header className="header">
      <div className="header-inner">
        <button type="button" className="logo-btn" onClick={onNewChat} aria-label="처음 화면으로">
          <img className="logo" src="/logo-horizontal.png" alt="Pacific Links Korea" width={512} height={81} />
        </button>
        <div className="header-actions">
          {showVoiceToggle && (
            <button
              type="button"
              className={`icon-btn${voiceReply ? " on" : ""}`}
              onClick={onToggleVoice}
              aria-pressed={voiceReply}
              aria-label={voiceReply ? "음성 답변 끄기" : "음성 답변 켜기"}
              title={voiceReply ? "음성 답변 켜짐" : "음성 답변 꺼짐"}
            >
              {voiceReply ? <SpeakerIcon /> : <SpeakerOffIcon />}
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onNewChat} disabled={!canReset} aria-label="새로 찾기" title="새로 찾기">
            <NewChatIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
