/**
 * 미리 만들어 두는 짧은 음성 멘트. 음성으로 물으면 검색하는 동안 바로 재생한다(지연 없음).
 *   node scripts/gen-voice.mjs   → public/voice/*.mp3 (저장소에 커밋)
 * 목소리·말투는 답변 음성(server/nlu/speak.ts)과 맞춘다.
 */
import { mkdirSync, writeFileSync } from "node:fs";

try {
  process.loadEnvFile();
} catch {}

const CLIPS = { ack: "네, 찾아볼게요." };
const INSTRUCTIONS = "밝고 친절한 골프장 예약 상담원처럼 자연스러운 한국어로, 약간 빠르고 또박또박 말하세요.";

const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error("OPENAI_API_KEY가 필요합니다.");
mkdirSync("public/voice", { recursive: true });
for (const [name, input] of Object.entries(CLIPS)) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE || "nova",
      input,
      instructions: INSTRUCTIONS,
      response_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(`public/voice/${name}.mp3`, buf);
  console.log(`public/voice/${name}.mp3 (${buf.length}B) "${input}"`);
}
