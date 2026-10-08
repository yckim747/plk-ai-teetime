import { useEffect, useRef, useState, type CSSProperties } from "react";
import { api } from "../api";
import { getAudioContext, stopSpeaking } from "../speech";
import { createEndpointDetector, rms } from "../voice/endpoint";
import { acquireMic, pauseMic } from "../voice/mic";

const MAX_SECONDS = 30;
const TICK_MS = 50;
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const BAR_SHAPE = [0.45, 0.75, 1, 0.75, 0.45];

interface Props {
  disabled: boolean;
  onText: (text: string) => void;
  onError: (message: string) => void;
}

/**
 * 한 번 누르고 말하면, 말이 끝날 때(1.4초 침묵) 자동으로 녹음을 끝내고 음성 인식 → 문의까지 이어간다.
 * 시끄러워서 자동 종료가 안 되면 다시 눌러 바로 끝낼 수 있다. 6초 동안 말이 없으면 취소한다.
 */
export function VoiceButton({ disabled, onText, onError }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const release = useRef<() => void>(() => {});
  const discard = useRef(false);

  useEffect(
    () => () => {
      discard.current = true;
      stop();
    },
    [],
  );

  function stop() {
    window.clearInterval(timer.current);
    release.current();
    release.current = () => {};
    setLevel(0);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  /** 서버로 보내지 않고 녹음을 버린다 */
  function cancel(message: string) {
    discard.current = true;
    stop();
    onError(message);
  }

  async function start() {
    // 녹음 중에 음성 답변이 마이크로 들어가지 않게 멈춘다. 이 터치로 오디오도 깨워 둔다.
    stopSpeaking();
    const ctx = getAudioContext();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("이 브라우저는 음성 녹음을 지원하지 않습니다. (localhost 또는 HTTPS에서 최신 브라우저를 이용해 주세요)");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await acquireMic();
    } catch (e) {
      onError((e as DOMException).name === "NotAllowedError" ? "마이크 권한이 거부되었습니다. 브라우저 주소창에서 마이크를 허용해 주세요." : "마이크를 사용할 수 없습니다.");
      return;
    }
    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    discard.current = false;
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      pauseMic();
      if (discard.current) {
        setState("idle");
        return;
      }
      const type = rec.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size < 2000) {
        setState("idle");
        onError("녹음이 너무 짧아요. 마이크를 누르고 말씀해 주세요.");
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

    // 음량 측정: 오디오를 쓸 수 없는 환경이면 자동 종료 없이 기존처럼 다시 눌러 끝낸다.
    let analyser: AnalyserNode | null = null;
    if (ctx) {
      const source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser); // 스피커로는 연결하지 않는다(하울링 방지)
      release.current = () => source.disconnect();
    }
    const samples = new Float32Array(1024);
    const detector = createEndpointDetector();

    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setHeard(false);
    setState("recording");
    const startedAt = performance.now();
    timer.current = window.setInterval(() => {
      const now = performance.now();
      const s = Math.floor((now - startedAt) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) return stop();
      if (!analyser || ctx?.state !== "running") return;
      analyser.getFloatTimeDomainData(samples);
      const v = rms(samples);
      setLevel(Math.min(1, v * 8));
      const st = detector.push(v, now);
      if (st === "speaking") setHeard(true);
      else if (st === "end") stop();
      else if (st === "no-speech") cancel("말씀이 들리지 않았어요. 마이크를 다시 누르고 말씀해 주세요.");
    }, TICK_MS);
  }

  const label = state === "recording" ? "듣는 중 · 누르면 바로 검색" : state === "transcribing" ? "알아듣는 중…" : "눌러서 말하기";

  return (
    <>
      <button
        type="button"
        className={`mic ${state}`}
        style={{ "--level": level } as CSSProperties}
        onClick={() => (state === "recording" ? stop() : start())}
        disabled={state === "transcribing" || (disabled && state !== "recording")}
        aria-label={label}
        title={label}
      >
        {state === "recording" ? <span className="rec-dot" /> : state === "transcribing" ? "…" : "🎤"}
      </button>
      {state !== "idle" && (
        <div className="voice-status" role="status">
          {state === "recording" ? (
            <>
              <span className="bars" aria-hidden>
                {BAR_SHAPE.map((k, i) => (
                  <i key={i} style={{ transform: `scaleY(${0.15 + Math.min(1, level * 2.2) * k})` }} />
                ))}
              </span>
              <span>{heard ? "말씀이 끝나면 자동으로 찾아드려요" : "듣고 있어요 — 말씀해 주세요"}</span>
              <span className="muted">
                {seconds}s · 버튼을 누르면 바로 검색
              </span>
            </>
          ) : (
            <span>알아듣는 중…</span>
          )}
        </div>
      )}
    </>
  );
}
