import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const MAX_SECONDS = 60;
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

interface Props {
  disabled: boolean;
  onText: (text: string) => void;
  onError: (message: string) => void;
}

/** 누르면 녹음 시작, 다시 누르면 종료 → 서버에서 음성 인식 → 인식된 문장으로 바로 문의 */
export function VoiceButton({ disabled, onText, onError }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => stop(), []);

  function stop() {
    window.clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("이 브라우저는 음성 녹음을 지원하지 않습니다. (localhost 또는 HTTPS에서 최신 브라우저를 이용해 주세요)");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      onError((e as DOMException).name === "NotAllowedError" ? "마이크 권한이 거부되었습니다. 브라우저 주소창에서 마이크를 허용해 주세요." : "마이크를 사용할 수 없습니다.");
      return;
    }
    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = rec.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size < 2000) {
        setState("idle");
        onError("녹음이 너무 짧아요. 버튼을 누르고 말한 뒤 다시 눌러 주세요.");
        return;
      }
      setState("transcribing");
      try {
        const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
        const { text } = await api.transcribe(blob, `voice.${ext}`);
        if (text) onText(text);
        else onError("음성을 알아듣지 못했어요. 다시 말씀해 주세요.");
      } catch (e) {
        onError(`음성 인식 실패: ${(e as Error).message}`);
      } finally {
        setState("idle");
      }
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setState("recording");
    const startedAt = Date.now();
    timer.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) stop();
    }, 250);
  }

  const label = state === "recording" ? `녹음 중 ${seconds}초 · 눌러서 종료` : state === "transcribing" ? "인식 중…" : "음성으로 문의";

  return (
    <button
      type="button"
      className={`mic ${state}`}
      onClick={() => (state === "recording" ? stop() : start())}
      disabled={state === "transcribing" || (disabled && state !== "recording")}
      aria-label={label}
      title={label}
    >
      {state === "recording" ? <span className="rec-dot" /> : state === "transcribing" ? "…" : "🎤"}
      {state === "recording" && <span className="sec">{seconds}s</span>}
    </button>
  );
}
