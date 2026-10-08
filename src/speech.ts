import { useSyncExternalStore } from "react";

/**
 * 음성 답변 재생기. 모바일 브라우저는 사용자가 누르는 순간에만 소리를 허용하므로,
 * 마이크·전송 버튼을 누를 때 unlockAudio()로 AudioContext를 깨워 두고 이후 응답이 오면 재생한다.
 */
let ctx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;
let token = 0;
let speaking = false;
const listeners = new Set<() => void>();

function setSpeaking(v: boolean) {
  speaking = v;
  listeners.forEach((l) => l());
}

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // 오디오 미지원 환경: 음성 답변 없이 동작
  }
}

export function stopSpeaking() {
  token++;
  try {
    current?.stop();
  } catch {
    // 이미 끝난 경우
  }
  current = null;
  if (speaking) setSpeaking(false);
}

export async function speak(text: string): Promise<void> {
  unlockAudio();
  stopSpeaking();
  if (!ctx || !text) return;
  const my = token;
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "음성 답변을 만들지 못했습니다.");
  const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
  if (my !== token) return; // 그 사이 다른 재생·녹음이 시작됨
  const node = ctx.createBufferSource();
  node.buffer = buffer;
  node.connect(ctx.destination);
  node.onended = () => {
    if (current === node) {
      current = null;
      setSpeaking(false);
    }
  };
  current = node;
  node.start();
  setSpeaking(true);
}

export function useSpeaking(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => speaking,
  );
}
