/**
 * 말 끝 감지기. 마이크 음량(RMS, 0~1)을 일정 간격으로 넣으면 말이 시작됐는지, 끝났는지 알려준다.
 * 브라우저 API에 의존하지 않아 단위 테스트할 수 있다.
 *
 * calibrating → 처음 calibrateMs 동안 주변 소음 크기를 잰다
 * waiting     → 기준보다 큰 소리가 minSpeechMs 이상 쌓이면 speaking (기침·클릭 같은 짧은 소리는 무시)
 * speaking    → 마지막 소리 이후 silenceMs 동안 조용하면 end
 * no-speech   → noSpeechMs가 지나도록 말이 시작되지 않음
 */
export type EndpointState = "calibrating" | "waiting" | "speaking" | "end" | "no-speech";

export interface EndpointOptions {
  calibrateMs?: number;
  silenceMs?: number;
  noSpeechMs?: number;
  minSpeechMs?: number;
  /** 조용한 방에서도 이 이상은 되어야 말로 본다 */
  minThreshold?: number;
  /** 시작할 때 바로 말해 소음 측정이 오염돼도 기준이 이보다 높아지지 않게 한다 */
  maxThreshold?: number;
  /** 주변 소음의 몇 배를 말로 볼지 */
  noiseFactor?: number;
}

export function createEndpointDetector({
  calibrateMs = 300,
  silenceMs = 1400,
  noSpeechMs = 6000,
  minSpeechMs = 250,
  minThreshold = 0.015,
  maxThreshold = 0.06,
  noiseFactor = 2.5,
}: EndpointOptions = {}) {
  let state: EndpointState = "calibrating";
  let startAt: number | null = null;
  let prevAt = 0;
  const calibration: number[] = [];
  let threshold = minThreshold;
  /** 말이 이어지는지 볼 기준. 말꼬리는 작아지므로 조금 낮추되, 주변 소음보다는 높게 둔다. */
  let continueThreshold = minThreshold;
  let voicedMs = 0;
  let lastVoiceAt = 0;

  return {
    get threshold() {
      return threshold;
    },
    push(level: number, now: number): EndpointState {
      if (state === "end" || state === "no-speech") return state;
      if (startAt === null) startAt = prevAt = now;
      const dt = now - prevAt;
      prevAt = now;
      const elapsed = now - startAt;

      if (state === "calibrating") {
        calibration.push(level);
        if (elapsed < calibrateMs) return state;
        // 중앙값을 써서, 측정 중 잠깐 말소리가 섞여도 소음 추정이 크게 튀지 않게 한다.
        const sorted = [...calibration].sort((a, b) => a - b);
        const noise = sorted[Math.floor(sorted.length / 2)];
        threshold = Math.min(maxThreshold, Math.max(minThreshold, noise * noiseFactor));
        continueThreshold = Math.min(maxThreshold, Math.max(threshold * 0.8, noise * 1.5));
        state = "waiting";
      }

      if (state === "waiting") {
        if (level > threshold) {
          voicedMs += dt;
          if (voicedMs >= minSpeechMs) {
            state = "speaking";
            lastVoiceAt = now;
          }
        } else {
          voicedMs = Math.max(0, voicedMs - dt / 2);
        }
        if (state === "waiting" && elapsed >= noSpeechMs) state = "no-speech";
        return state;
      }

      if (level > continueThreshold) lastVoiceAt = now;
      else if (now - lastVoiceAt >= silenceMs) state = "end";
      return state;
    },
  };
}

/** AnalyserNode 시간 영역 데이터 → RMS 음량 */
export function rms(samples: Float32Array): number {
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}
