import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEndpointDetector, type EndpointState } from "../src/voice/endpoint";

const STEP = 50; // 화면에서 50ms마다 음량을 넣는다

/** [음량, 지속 ms] 구간들을 50ms 간격으로 넣고, 각 시점의 상태를 돌려준다 */
function run(segments: [number, number][], opts = {}) {
  const d = createEndpointDetector(opts);
  const states: { at: number; state: EndpointState }[] = [];
  let t = 0;
  for (const [level, ms] of segments) {
    for (let i = 0; i < ms; i += STEP) {
      states.push({ at: t, state: d.push(level, t) });
      t += STEP;
    }
  }
  const firstAt = (s: EndpointState) => states.find((x) => x.state === s)?.at;
  return { d, last: states[states.length - 1].state, firstAt };
}

const QUIET = 0.004;
const VOICE = 0.15;

describe("말 끝 감지", () => {
  it("말하다 0.8초 쉬어도 끊지 않고, 말이 끝나고 1.4초 조용하면 끝낸다", () => {
    const { firstAt, last } = run([
      [QUIET, 500],
      [VOICE, 1200],
      [QUIET, 800], // "음…" 하고 잠깐 쉼
      [VOICE, 1000],
      [QUIET, 2000],
    ]);
    assert.equal(last, "end");
    // 마지막 말이 끝난 시점(3500ms)에서 약 1.4초 뒤에 끝나야 한다 (쉬는 구간에서 끝나면 안 됨)
    const endAt = firstAt("end")!;
    assert.ok(endAt >= 3500 + 1400 - STEP && endAt <= 3500 + 1400 + STEP, `end at ${endAt}`);
  });

  it("6초 동안 말이 없으면 no-speech", () => {
    const { firstAt } = run([[QUIET, 7000]]);
    assert.equal(firstAt("no-speech"), 6000);
  });

  it("150ms짜리 짧은 잡음은 말로 치지 않는다", () => {
    const { firstAt, last } = run([
      [QUIET, 500],
      [VOICE, 150],
      [QUIET, 1000],
      [VOICE, 150],
      [QUIET, 5000],
    ]);
    assert.equal(firstAt("speaking"), undefined);
    assert.equal(last, "no-speech");
  });

  it("주변이 시끄러우면 기준이 올라가 소음만으로는 말로 보지 않는다", () => {
    const noisy = run([[0.05, 7000]]);
    assert.ok(noisy.d.threshold > 0.05, `threshold ${noisy.d.threshold}`);
    assert.equal(noisy.last, "no-speech");

    const speech = run([
      [0.05, 500],
      [0.2, 1500],
      [0.05, 2000],
    ]);
    assert.equal(speech.last, "end");
  });

  it("누르자마자 말해서 소음 측정에 말소리가 섞여도 감지한다", () => {
    const { last, firstAt } = run([
      [VOICE, 2000],
      [QUIET, 2000],
    ]);
    assert.ok(firstAt("speaking") != null);
    assert.equal(last, "end");
  });
});
