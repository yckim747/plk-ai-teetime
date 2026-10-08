import { useSyncExternalStore } from "react";

/**
 * 음성 답변 재생기.
 * - 서버가 만드는 대로 보내는 PCM(24kHz·16bit·모노) 조각을 받는 즉시 이어 붙여 재생한다 → 첫 소리 약 1초.
 * - 음성으로 물으면 미리 만들어 둔 "네, 찾아볼게요"를 바로 틀고, 답변은 그 뒤에 이어서 재생한다.
 * - 모바일 브라우저는 사용자가 누르는 순간에만 소리를 허용하므로, 마이크·전송 버튼을 누를 때 unlockAudio()로
 *   AudioContext를 깨워 두고 이후에 오는 소리를 재생한다.
 */
const PCM_RATE = 24000;
/** 이 길이(샘플)만큼 모이면 재생 예약 (0.2초). 첫 조각은 끊김을 막으려고 두 배(0.4초)를 모은다. */
const MIN_CHUNK = PCM_RATE / 5;
const ACK_URL = "/voice/ack.mp3";

let ctx: AudioContext | null = null;
/** 예약된 재생 조각들 */
let scheduled: AudioBufferSourceNode[] = [];
/** 다음 조각을 이어 붙일 시각 (AudioContext 시간) */
let nextTime = 0;
/** 현재 읽고 있는 음성 스트림 */
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
/** 스트림 세대 번호. 멈추거나 새로 시작하면 바뀌어 이전 스트림을 버린다. */
let generation = 0;
let ackBuffer: AudioBuffer | null = null;
let ackLoading = false;
let speaking = false;
const listeners = new Set<() => void>();

function setSpeaking(v: boolean) {
  if (speaking === v) return;
  speaking = v;
  listeners.forEach((l) => l());
}

function preloadAck() {
  if (!ctx || ackBuffer || ackLoading) return;
  ackLoading = true;
  fetch(ACK_URL)
    .then((r) => r.arrayBuffer())
    .then((b) => ctx!.decodeAudioData(b))
    .then((buf) => (ackBuffer = trimSilence(buf)))
    .catch(() => {})
    .finally(() => (ackLoading = false));
}

/** 앞뒤 무음을 잘라 멘트가 끝나자마자 답변이 이어지게 한다 */
function trimSilence(buf: AudioBuffer): AudioBuffer {
  const data = buf.getChannelData(0);
  const loud = (i: number) => Math.abs(data[i]) > 0.01;
  let start = 0;
  let end = data.length - 1;
  while (start < end && !loud(start)) start++;
  while (end > start && !loud(end)) end--;
  const pad = Math.floor(buf.sampleRate * 0.05);
  start = Math.max(0, start - pad);
  end = Math.min(data.length - 1, end + pad);
  const out = ctx!.createBuffer(buf.numberOfChannels, end - start + 1, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(start, end + 1), c);
  return out;
}

export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    preloadAck();
  } catch {
    // 오디오 미지원 환경: 음성 답변 없이 동작
  }
}

/** 마이크 음량 측정에도 같은 AudioContext를 쓴다 (iOS는 동시에 여러 개를 쓰기 어렵다) */
export function getAudioContext(): AudioContext | null {
  unlockAudio();
  return ctx;
}

/** 앞 조각이 끝나는 시각에 이어서 재생 예약 */
function schedule(buffer: AudioBuffer) {
  if (!ctx) return;
  const node = ctx.createBufferSource();
  node.buffer = buffer;
  node.connect(ctx.destination);
  const at = Math.max(ctx.currentTime + 0.03, nextTime);
  node.start(at);
  nextTime = at + buffer.duration;
  scheduled.push(node);
  node.onended = () => {
    scheduled = scheduled.filter((n) => n !== node);
    if (!scheduled.length && !reader) setSpeaking(false);
  };
  setSpeaking(true);
}

export function stopSpeaking() {
  generation++;
  reader?.cancel().catch(() => {});
  reader = null;
  for (const n of scheduled) {
    try {
      n.stop();
    } catch {
      // 이미 끝난 조각
    }
  }
  scheduled = [];
  nextTime = 0;
  setSpeaking(false);
}

/** "네, 찾아볼게요" (미리 받아 둔 경우에만, 지연 없이) */
export function playAck() {
  unlockAudio();
  stopSpeaking();
  if (ackBuffer) schedule(ackBuffer);
}

/**
 * 문장을 음성으로 재생한다. 서버 스트림을 받는 대로 이어서 재생한다.
 * @param afterCurrent true면 지금 재생 중인 소리(즉시 응답 멘트) 뒤에 이어서, false면 멈추고 새로 시작
 */
export async function speak(text: string, { afterCurrent = false } = {}): Promise<void> {
  unlockAudio();
  if (afterCurrent) {
    // 이전 답변 스트림만 정리하고, 재생 중인 멘트는 그대로 둔다.
    generation++;
    reader?.cancel().catch(() => {});
    reader = null;
  } else {
    stopSpeaking();
  }
  if (!ctx || !text) return;
  const my = generation;
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? "음성 답변을 만들지 못했습니다.");
  if (my !== generation) {
    res.body.cancel().catch(() => {});
    return;
  }
  const r = res.body.getReader();
  reader = r;
  let carry: Uint8Array | null = null; // 16bit 경계에 걸린 1바이트
  let pending: Float32Array<ArrayBuffer>[] = [];
  let pendingLen = 0;

  let started = false;
  const flush = (force: boolean) => {
    if (!ctx || !pendingLen || (!force && pendingLen < (started ? MIN_CHUNK : MIN_CHUNK * 2))) return;
    started = true;
    const buffer = ctx.createBuffer(1, pendingLen, PCM_RATE);
    let offset = 0;
    for (const p of pending) {
      buffer.copyToChannel(p, 0, offset);
      offset += p.length;
    }
    pending = [];
    pendingLen = 0;
    schedule(buffer);
  };

  try {
    for (;;) {
      const { done, value } = await r.read();
      if (my !== generation) return;
      if (done) break;
      let bytes = value;
      if (carry) {
        const merged = new Uint8Array(carry.length + bytes.length);
        merged.set(carry);
        merged.set(bytes, carry.length);
        bytes = merged;
        carry = null;
      }
      const even = bytes.length - (bytes.length % 2);
      if (even < bytes.length) carry = bytes.slice(even);
      const view = new DataView(bytes.buffer, bytes.byteOffset, even);
      const samples = new Float32Array(even / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
      pending.push(samples);
      pendingLen += samples.length;
      flush(false);
    }
    flush(true);
  } finally {
    if (my === generation) {
      reader = null;
      if (!scheduled.length) setSpeaking(false);
    }
  }
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
