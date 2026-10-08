import { RefreshIcon, SpeakerIcon, SpeakerOffIcon } from "../icons";

interface Props {
  voiceReply: boolean;
  showVoiceToggle: boolean;
  canReset: boolean;
  onToggleVoice: () => void;
  onNewChat: () => void;
}

/** 상단: 로고, 음성 답변 켜기/끄기, (대화 중일 때만) 새로 찾기 */
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
          {canReset && (
            <button type="button" className="reset-btn" onClick={onNewChat} title="대화를 지우고 처음 화면으로">
              <RefreshIcon width={16} height={16} />
              새로 찾기
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
